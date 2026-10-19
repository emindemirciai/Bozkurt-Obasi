import { FIRST_WATCH_STEPS } from '../shared/first-watch.mjs';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_TIME = 8_640_000_000_000_000;
const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const timestamp = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIME;

/**
 * Read saved chapter events using the last authoritative game update.
 * Durations measure wall-clock time, including time spent offline. Migrated
 * returning villages retain their statuses but never contribute timing data.
 */
export function firstWatchJournal(state) {
  const save = object(state);
  const chapter = object(save.firstWatch);
  const milestones = object(chapter.milestones);
  const cohort = ['new', 'returning'].includes(chapter.cohort) ? chapter.cohort : null;
  const inferred = cohort === 'returning';
  const baseValid =
    timestamp(chapter.startedAt) &&
    timestamp(save.updatedAt) &&
    save.updatedAt >= chapter.startedAt;
  const timingAvailable = chapter.version === 1 && cohort === 'new' && baseValid;
  const recorded = (value) =>
    timestamp(value) && (!baseValid || (value >= chapter.startedAt && value <= save.updatedAt));
  const relative = (value) =>
    timingAvailable && recorded(value) ? value - chapter.startedAt : null;
  const completion = Object.fromEntries(
    FIRST_WATCH_STEPS.map(({ id }) => [id, recorded(milestones[id])]),
  );
  // Recovery only has meaning after the first completed battle, including a loss.
  completion.recover =
    completion.recover && completion.battle && milestones.recover >= milestones.battle;

  const claims = Array.isArray(chapter.claims) ? chapter.claims : [];
  let claimed = 0;
  for (const { id } of FIRST_WATCH_STEPS) {
    if (object(claims[claimed]).id !== id || !completion[id]) break;
    claimed += 1;
  }
  const currentId = FIRST_WATCH_STEPS[claimed]?.id ?? null;
  let previousClaimAt = chapter.startedAt;
  let claimClockValid = baseValid;
  const steps = FIRST_WATCH_STEPS.map(({ id }, index) => {
    const completed = completion[id];
    const isClaimed = index < claimed;
    const current = id === currentId;
    const completionMs = completed ? relative(milestones[id]) : null;
    let claimMs = null;
    let claimDelayMs = null;
    if (isClaimed) {
      const at = object(claims[index]).at;
      claimClockValid =
        claimClockValid && recorded(at) && at >= milestones[id] && at >= previousClaimAt;
      if (timingAvailable && claimClockValid) {
        claimMs = at - chapter.startedAt;
        claimDelayMs = at - milestones[id];
      }
      previousClaimAt = at;
    }
    return {
      id,
      index,
      status: isClaimed ? 'claimed' : current ? (completed ? 'pendingClaim' : 'current') : 'locked',
      completed,
      claimed: isClaimed,
      current,
      locked: index > claimed,
      completionMs,
      claimMs,
      claimDelayMs,
      withinWindow: completionMs === null ? null : completionMs <= WINDOW_MS,
    };
  });
  const firstWinRecorded =
    recorded(chapter.firstWinAt) && completion.battle && chapter.firstWinAt >= milestones.battle;
  const firstWinMs = firstWinRecorded ? relative(chapter.firstWinAt) : null;
  const elapsedMs = timingAvailable ? save.updatedAt - chapter.startedAt : null;

  return {
    cohort,
    inferred,
    timingAvailable,
    elapsedMs,
    windowMs: WINDOW_MS,
    windowClosed: elapsedMs === null ? null : elapsedMs > WINDOW_MS,
    total: steps.length,
    completed: steps.filter((step) => step.completed).length,
    claimed,
    currentId,
    firstWin: {
      recorded: firstWinRecorded,
      elapsedMs: firstWinMs,
      withinWindow: firstWinMs === null ? null : firstWinMs <= WINDOW_MS,
    },
    battleRecoveryMs:
      timingAvailable && completion.recover ? milestones.recover - milestones.battle : null,
    steps,
  };
}
