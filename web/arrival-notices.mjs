const RESOURCE_KEYS = ['water', 'feed', 'herbs', 'wood', 'stone'];
const MAX_READ_RECEIPTS = 40;
const EMPTY = () => ({ notice: null, unreadCount: 0 });
const timestamp = (value) => Number.isSafeInteger(value) && value >= 0;
const amount = (value) => Number.isFinite(value) && value >= 0;
const receipt = (value) =>
  typeof value === 'string' && /^outing-[1-9]\d{0,6}@\d{1,16}$/.test(value);
const account = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : null;

/** Copy the actual credited report; never quote, grant rewards, or change a save. */
export function arrivalReport(report) {
  if (
    !report ||
    !/^outing-[1-9]\d{0,6}$/.test(report.id) ||
    !['expedition', 'caravan'].includes(report.kind) ||
    typeof report.region !== 'string' ||
    typeof report.difficulty !== 'string' ||
    !timestamp(report.startedAt) ||
    !timestamp(report.completedAt) ||
    report.completedAt <= report.startedAt ||
    !report.reward ||
    !RESOURCE_KEYS.every((key) => amount(report.reward[key])) ||
    typeof report.item !== 'string' ||
    ![0, 1].includes(report.itemCount) ||
    !amount(report.xp) ||
    !Array.isArray(report.wolfIds) ||
    !report.wolfIds.length ||
    report.wolfIds.length > 5 ||
    !report.wolfIds.every((id) => typeof id === 'string')
  )
    return null;
  return {
    key: report.id + '@' + report.startedAt,
    id: report.id,
    kind: report.kind,
    region: report.region,
    difficulty: report.difficulty,
    ...(typeof report.plan === 'string' ? { plan: report.plan } : {}),
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    reward: Object.fromEntries(RESOURCE_KEYS.map((key) => [key, report.reward[key]])),
    item: report.item,
    itemCount: report.itemCount,
    xp: report.xp,
    wolfIds: [...report.wolfIds],
  };
}

function copyNotice(notice) {
  return notice ? { ...notice, reward: { ...notice.reward }, wolfIds: [...notice.wolfIds] } : null;
}

/**
 * A latest-report inbox outside the strict game save. Storage contains only bounded
 * receipt identities, scoped by public user code; denied storage falls back to memory.
 */
export function createArrivalTracker({
  storage,
  storagePrefix = 'bozkurt-obasi:arrival-read:v1:',
} = {}) {
  let current = null;

  function load(accountKey) {
    let read = [];
    try {
      const raw = storage?.getItem(storagePrefix + encodeURIComponent(accountKey));
      if (typeof raw === 'string' && raw.length <= 16_384) {
        const value = JSON.parse(raw);
        if (value?.version === 1 && Array.isArray(value.read))
          read = [...new Set(value.read.filter(receipt))].slice(-MAX_READ_RECEIPTS);
      }
    } catch {
      // Private browsing, corrupt JSON and quota failures must not block gameplay.
    }
    return {
      accountKey,
      read,
      initialized: false,
      sequence: 0,
      latest: null,
      activeKey: null,
      notice: null,
    };
  }

  function snapshot() {
    return { notice: copyNotice(current?.notice), unreadCount: current?.notice ? 1 : 0 };
  }

  return {
    update(accountKey, state) {
      accountKey = account(accountKey);
      if (!accountKey) {
        current = null;
        return EMPTY();
      }
      if (current?.accountKey !== accountKey) current = load(accountKey);
      const adventure = state?.adventure;
      const reports = Array.isArray(adventure?.history) ? adventure.history.slice(0, 20) : [];
      const latest = reports.map(arrivalReport).find(Boolean) || null;
      const sequence = timestamp(adventure?.sequence) ? adventure.sequence : 0;
      const active = adventure?.active;
      const activeKey =
        active && typeof active.id === 'string' && timestamp(active.startedAt)
          ? active.id + '@' + active.startedAt
          : null;
      const changed = latest?.key !== current.latest?.key;
      const reset =
        sequence < current.sequence ||
        (changed && latest && sequence === current.sequence && current.activeKey !== latest.key) ||
        (changed && latest && current.latest && latest.startedAt <= current.latest.startedAt);
      let source = 'existing';
      if (!changed && current.notice) source = current.notice.source;
      else if (
        current.initialized &&
        changed &&
        latest &&
        !reset &&
        (current.activeKey === latest.key ||
          sequence > current.sequence ||
          (current.latest && latest.startedAt > current.latest.startedAt))
      )
        source = 'returned';

      current.notice = latest && !current.read.includes(latest.key) ? { ...latest, source } : null;
      current.latest = latest;
      current.sequence = sequence;
      current.activeKey = activeKey;
      current.initialized = true;
      return snapshot();
    },

    dismiss(accountKey, key) {
      if (
        !current ||
        account(accountKey) !== current.accountKey ||
        !current.notice ||
        (key !== undefined && key !== current.notice.key)
      )
        return current && account(accountKey) === current.accountKey ? snapshot() : EMPTY();
      current.read = [
        ...current.read.filter((known) => known !== current.notice.key),
        current.notice.key,
      ].slice(-MAX_READ_RECEIPTS);
      current.notice = null;
      try {
        storage?.setItem(
          storagePrefix + encodeURIComponent(current.accountKey),
          JSON.stringify({ version: 1, read: current.read }),
        );
      } catch {
        // Keep this receipt in memory even when persistence is unavailable.
      }
      return snapshot();
    },

    /** Logout clears in-memory state while preserving account-scoped read receipts. */
    clear() {
      current = null;
      return EMPTY();
    },
  };
}
