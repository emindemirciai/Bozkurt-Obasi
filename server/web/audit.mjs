const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_LOGS = 100_000;
const ACTIONS = new Set([
  'admin.login.success',
  'admin.login.failed',
  'admin.login.rate_limited',
  'admin.logout',
  'admin.user.create',
  'admin.user.delete',
  'admin.user.create_failed',
  'admin.user.delete_failed',
  'player.register',
  'player.login',
  'player.logout',
  'player.email_verified',
  'player.password_added',
  'player.password_changed',
  'player.password_reset',
  'player.google_login',
  'player.google_linked',
  'player.profile_updated',
  'player.friend_requested',
  'player.friend_accepted',
  'player.friend_removed',
  'player.stone_transferred',
  'player.asset_gifted',
  'player.message_sent',
  'player.game_action',
  'system.api_error',
]);
const LEVELS = new Set(['info', 'warning', 'error']);
const ACTOR_TYPES = new Set(['admin', 'player', 'system']);
const TEXT_DETAILS = new Set([
  'provider',
  'actionType',
  'result',
  'error',
  'status',
  'asset',
  'kind',
]);
const COUNT_DETAILS = new Set([
  'amount',
  'count',
  'accounts',
  'sessions',
  'friendships',
  'transfers',
  'gifts',
  'messages',
  'status',
]);

function safeLabel(value, max = 254) {
  return typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value)
    ? value
    : null;
}

function safeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  const result = {};
  for (const [key, value] of Object.entries(details)) {
    if (TEXT_DETAILS.has(key) && typeof value === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(value))
      result[key] = value;
    else if (
      COUNT_DETAILS.has(key) &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 1_000_000_000
    )
      result[key] = value;
  }
  return result;
}

export function createAuditStore(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    level TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor TEXT,
    action TEXT NOT NULL,
    target_id TEXT,
    target_label TEXT,
    details_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_logs_created ON audit_logs(created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS audit_logs_action ON audit_logs(action, created_at DESC);`);
  const insert = database.prepare(
    'INSERT INTO audit_logs(created_at,level,actor_type,actor,action,target_id,target_label,details_json) VALUES(?,?,?,?,?,?,?,?)',
  );
  const expire = database.prepare('DELETE FROM audit_logs WHERE created_at < ?');
  const count = database.prepare('SELECT COUNT(*) AS total FROM audit_logs');
  const trim = database.prepare(
    'DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs ORDER BY id ASC LIMIT ?)',
  );
  const purgeActor = database.prepare('UPDATE audit_logs SET actor=NULL WHERE actor IN (?,?,?)');
  const purgeTarget = database.prepare(
    'UPDATE audit_logs SET target_id=NULL WHERE target_id IN (?,?,?)',
  );
  const purgeLabel = database.prepare(
    'UPDATE audit_logs SET target_label=NULL WHERE target_label IN (?,?,?)',
  );

  function record({
    at,
    level = 'info',
    actorType = 'system',
    actor = null,
    action,
    targetId = null,
    targetLabel = null,
    details = {},
  }) {
    if (
      !ACTIONS.has(action) ||
      !LEVELS.has(level) ||
      !ACTOR_TYPES.has(actorType) ||
      !Number.isSafeInteger(at) ||
      at < 0
    )
      return false;
    insert.run(
      at,
      level,
      actorType,
      safeLabel(actor),
      action,
      safeLabel(targetId, 80),
      safeLabel(targetLabel, 80),
      JSON.stringify(safeDetails(details)),
    );
    expire.run(at - RETENTION_MS);
    const surplus = count.get().total - MAX_LOGS;
    if (surplus > 0) trim.run(surplus);
    return true;
  }

  function list({
    query = '',
    action = '',
    level = 'all',
    page = 1,
    limit = 20,
    now = Date.now(),
  } = {}) {
    if (
      typeof query !== 'string' ||
      query.length > 100 ||
      (action && action !== 'all' && !ACTIONS.has(action)) ||
      !['all', ...LEVELS].includes(level) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10_000 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(now)
    )
      throw new RangeError('invalid_log_filter');
    expire.run(now - RETENTION_MS);
    const terms = [];
    const parameters = [];
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      terms.push(
        "(instr(lower(action), ?) > 0 OR instr(lower(coalesce(actor, '')), ?) > 0 OR instr(lower(coalesce(target_label, '')), ?) > 0)",
      );
      parameters.push(needle, needle, needle);
    }
    if (action && action !== 'all') {
      terms.push('action = ?');
      parameters.push(action);
    }
    if (level !== 'all') {
      terms.push('level = ?');
      parameters.push(level);
    }
    const where = terms.length ? `WHERE ${terms.join(' AND ')}` : '';
    const total = database
      .prepare(`SELECT COUNT(*) AS count FROM audit_logs ${where}`)
      .get(...parameters).count;
    const rows = database
      .prepare(
        `SELECT id,created_at,level,actor_type,actor,action,target_id,target_label,details_json
      FROM audit_logs ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
      )
      .all(...parameters, limit, (page - 1) * limit);
    return {
      logs: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        level: row.level,
        actorType: row.actor_type,
        actor: row.actor,
        action: row.action,
        targetId: row.target_id,
        targetLabel: row.target_label,
        details: JSON.parse(row.details_json),
      })),
      total,
      page,
      limit,
    };
  }

  function purgeIdentity({ id, userCode, email = null }) {
    if (typeof id !== 'string' || typeof userCode !== 'string') return 0;
    const values = [id, userCode, email];
    return (
      purgeActor.run(...values).changes +
      purgeTarget.run(...values).changes +
      purgeLabel.run(...values).changes
    );
  }
  return { record, list, purgeIdentity };
}
