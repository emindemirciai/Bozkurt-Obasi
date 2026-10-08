import { createHash, randomBytes } from 'node:crypto';
import { createGame } from '../../shared/game.mjs';

const FLOW_AGE_MS = 10 * 60_000;
const RESOURCES = ['water', 'feed', 'herbs', 'wood', 'stone'];
const IDENTITIES = `WITH identities AS (
  SELECT lower(trim(email)) AS email, MIN(created_at) AS created_at
  FROM (
    SELECT email, created_at FROM email_accounts
    UNION ALL
    SELECT email, created_at FROM google_accounts
  )
  GROUP BY lower(trim(email))
)`;
const VERIFIED = `(
  EXISTS(SELECT 1 FROM google_accounts g WHERE lower(trim(g.email)) = identities.email)
  OR EXISTS(SELECT 1 FROM email_accounts e WHERE e.email = identities.email AND e.email_verified = 1)
)`;

function placeholders(rows) {
  return rows.map(() => '?').join(',');
}
function maxDate(...values) {
  const present = values.filter(Number.isSafeInteger);
  return present.length ? Math.max(...present) : null;
}
function village(provider, account) {
  let state;
  try {
    state = JSON.parse(account.state_json);
  } catch {
    state = {};
  }
  return {
    provider,
    regionId: typeof state.location === 'string' ? state.location : null,
    wave: Number.isSafeInteger(state.battle?.wave) ? state.battle.wave : 0,
    herd: Number.isSafeInteger(state.herd?.count) ? state.herd.count : 0,
    wolves: Array.isArray(state.wolves) ? state.wolves.length : 0,
    resources: Object.fromEntries(
      RESOURCES.map((key) => [
        key,
        Number.isFinite(state.resources?.[key]) ? state.resources[key] : 0,
      ]),
    ),
    revision: account.revision,
  };
}

export function createAdminUserStore(
  database,
  { profiles, audit, hashPassword, normalizedEmail, boundedPassword, HttpError },
) {
  database.exec(`CREATE TABLE IF NOT EXISTS deleted_google_accounts (
    sub_hash TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS deleted_google_accounts_expiry
    ON deleted_google_accounts(expires_at);`);
  const emailByAddress = database.prepare('SELECT * FROM email_accounts WHERE email=?');
  const googleByAddress = database.prepare(
    'SELECT * FROM google_accounts WHERE lower(trim(email))=?',
  );
  const googleBySub = database.prepare('SELECT * FROM google_accounts WHERE sub=?');
  const googleAllByAddress = database.prepare(
    'SELECT * FROM google_accounts WHERE lower(trim(email))=?',
  );
  const profileById = database.prepare('SELECT * FROM player_profiles WHERE id=?');
  const profileByAddress = database.prepare('SELECT * FROM player_profiles WHERE email=?');
  const insertEmail = database.prepare(`INSERT INTO email_accounts
    (sub,email,display_name,password_hash,state_json,revision,created_at,updated_at,email_verified)
    VALUES(?,?,?,?,?,0,?,?,0)`);
  const deleteEmail = database.prepare('DELETE FROM email_accounts WHERE sub=?');
  const deleteGoogle = database.prepare('DELETE FROM google_accounts WHERE sub=?');
  const deleteProfile = database.prepare('DELETE FROM player_profiles WHERE id=?');
  const deleteVerification = database.prepare('DELETE FROM email_verifications WHERE email_sub=?');
  const deleteRecovery = database.prepare('DELETE FROM password_recoveries WHERE email_sub=?');
  const deleteFriends = database.prepare('DELETE FROM friendships WHERE first_id=? OR second_id=?');
  const deleteTransfers = database.prepare(
    'DELETE FROM stone_transfers WHERE sender_id=? OR recipient_id=?',
  );
  const purgeTombstones = database.prepare(
    'DELETE FROM deleted_google_accounts WHERE expires_at<=?',
  );
  const saveTombstone =
    database.prepare(`INSERT INTO deleted_google_accounts(sub_hash,deleted_at,expires_at)
    VALUES(?,?,?) ON CONFLICT(sub_hash) DO UPDATE SET
    deleted_at=excluded.deleted_at,expires_at=excluded.expires_at`);

  function accounts(email) {
    const emailAccount = emailByAddress.get(email);
    const googleAccounts = googleAllByAddress.all(email);
    if (
      emailAccount?.google_sub &&
      !googleAccounts.some((row) => row.sub === emailAccount.google_sub)
    ) {
      const linked = googleBySub.get(emailAccount.google_sub);
      if (linked) googleAccounts.push(linked);
    }
    return { emailAccount, googleAccounts };
  }
  function sessionFilter(emailAccount, googleAccounts) {
    const parts = [],
      values = [];
    if (emailAccount) {
      parts.push("(account_provider='email' AND account_sub=?)");
      values.push(emailAccount.sub);
    }
    if (googleAccounts.length) {
      parts.push(
        `(account_provider='google' AND account_sub IN (${placeholders(googleAccounts)}))`,
      );
      values.push(...googleAccounts.map((row) => row.sub));
    }
    return { sql: parts.length ? parts.join(' OR ') : '0', values };
  }
  function summary(email, createdAt, now) {
    const { emailAccount, googleAccounts } = accounts(email);
    if (!emailAccount && !googleAccounts.length) return null;
    const first = emailAccount || googleAccounts[0];
    const profile =
      profileByAddress.get(email) ||
      profiles.ensure(
        { email, name: first.display_name || email.split('@')[0] },
        createdAt ?? first.created_at ?? now,
      );
    const { sql, values } = sessionFilter(emailAccount, googleAccounts);
    const session = database
      .prepare(
        `SELECT
      COALESCE(SUM(CASE WHEN expires_at > ? THEN 1 ELSE 0 END),0) AS active_sessions,
      MAX(updated_at) AS last_active_at FROM sessions WHERE ${sql}`,
      )
      .get(now, ...values);
    const created = [emailAccount, ...googleAccounts]
      .map((row) => row?.created_at)
      .filter(Number.isSafeInteger);
    return {
      id: profile.id,
      email,
      fullName: profile.full_name,
      nickname: profile.nickname,
      userCode: profile.user_code,
      createdAt: created.length ? Math.min(...created) : createdAt,
      lastActiveAt: maxDate(
        emailAccount?.updated_at,
        ...googleAccounts.map((row) => row.updated_at),
        session.last_active_at,
      ),
      lastLoginAt: maxDate(
        emailAccount?.last_login_at,
        ...googleAccounts.map((row) => row.last_login_at),
      ),
      verified: Boolean(googleAccounts.length || emailAccount?.email_verified),
      providers: [...(emailAccount ? ['email'] : []), ...(googleAccounts.length ? ['google'] : [])],
      googleLinked: Boolean(
        emailAccount?.google_sub &&
        googleAccounts.some((row) => row.sub === emailAccount.google_sub),
      ),
      activeSessions: session.active_sessions,
    };
  }
  function whereClause({ query = '', verification = 'all', provider = 'all' } = {}) {
    if (
      typeof query !== 'string' ||
      query.length > 100 ||
      !['all', 'verified', 'pending'].includes(verification) ||
      !['all', 'email', 'google'].includes(provider)
    )
      throw new HttpError(400, 'invalid_user_filter');
    const parts = [],
      values = [];
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      parts.push(`(instr(identities.email,?)>0
        OR instr(lower(coalesce(player_profiles.full_name,'')),?)>0
        OR instr(lower(coalesce(player_profiles.nickname,'')),?)>0
        OR instr(lower(coalesce(player_profiles.user_code,'')),?)>0)`);
      values.push(needle, needle, needle, needle);
    }
    if (verification !== 'all')
      parts.push(verification === 'verified' ? VERIFIED : `NOT ${VERIFIED}`);
    if (provider !== 'all') {
      const table = provider === 'email' ? 'email_accounts' : 'google_accounts';
      parts.push(`EXISTS(SELECT 1 FROM ${table} a WHERE lower(trim(a.email))=identities.email)`);
    }
    return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', values };
  }
  function list(options = {}, now) {
    const { page = 1, limit = 20 } = options;
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10_000 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new HttpError(400, 'invalid_user_filter');
    const filter = whereClause(options);
    const from = `FROM identities LEFT JOIN player_profiles
      ON player_profiles.email=identities.email ${filter.sql}`;
    const total = database
      .prepare(`${IDENTITIES} SELECT COUNT(*) AS count ${from}`)
      .get(...filter.values).count;
    const rows = database
      .prepare(
        `${IDENTITIES} SELECT identities.email,identities.created_at ${from}
      ORDER BY identities.created_at DESC,identities.email ASC LIMIT ? OFFSET ?`,
      )
      .all(...filter.values, limit, (page - 1) * limit);
    return {
      users: rows.map((row) => summary(row.email, row.created_at, now)).filter(Boolean),
      total,
      page,
      limit,
    };
  }
  function detail(id, now) {
    if (typeof id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(id))
      throw new HttpError(404, 'player_not_found');
    const profile = profileById.get(id);
    if (!profile) throw new HttpError(404, 'player_not_found');
    const { emailAccount, googleAccounts } = accounts(profile.email);
    if (!emailAccount && !googleAccounts.length) throw new HttpError(404, 'player_not_found');
    const base = summary(profile.email, profile.created_at, now);
    const { sql, values } = sessionFilter(emailAccount, googleAccounts);
    const sessions = database
      .prepare(
        `SELECT account_provider,created_at,updated_at,expires_at
      FROM sessions WHERE ${sql} ORDER BY created_at DESC LIMIT 50`,
      )
      .all(...values)
      .map((row) => ({
        provider: row.account_provider,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
      }));
    return {
      user: {
        ...base,
        villages: [
          ...(emailAccount ? [village('email', emailAccount)] : []),
          ...googleAccounts.map((row) => village('google', row)),
        ],
        sessions,
      },
    };
  }
  function counts() {
    const row = database
      .prepare(
        `${IDENTITIES} SELECT COUNT(*) AS totalUsers,
      COALESCE(SUM(CASE WHEN ${VERIFIED} THEN 1 ELSE 0 END),0) AS verifiedUsers,
      COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM email_accounts e WHERE e.email=identities.email)
        THEN 1 ELSE 0 END),0) AS emailUsers,
      COALESCE(SUM(CASE WHEN EXISTS(SELECT 1 FROM google_accounts g WHERE lower(trim(g.email))=identities.email)
        THEN 1 ELSE 0 END),0) AS googleUsers FROM identities`,
      )
      .get();
    return {
      totalUsers: row.totalUsers,
      verifiedUsers: row.verifiedUsers,
      pendingUsers: row.totalUsers - row.verifiedUsers,
      emailUsers: row.emailUsers,
      googleUsers: row.googleUsers,
    };
  }
  async function create(body, { now, actor, recheck = () => {} }) {
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !['email', 'name', 'password'].includes(key))
    )
      throw new HttpError(400, 'unexpected_fields');
    const email = normalizedEmail(body.email);
    if (!email) throw new HttpError(400, 'invalid_email');
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 60 ||
      /[\x00-\x1f\x7f]/.test(body.name)
    )
      throw new HttpError(400, 'invalid_name');
    if (!boundedPassword(body.password, 12)) throw new HttpError(400, 'invalid_password');
    if (emailByAddress.get(email) || profileByAddress.get(email))
      throw new HttpError(409, 'email_in_use');
    if (googleByAddress.get(email)) throw new HttpError(409, 'google_login_required');
    const passwordHash = await hashPassword(body.password);
    recheck();
    const sub = randomBytes(24).toString('base64url'),
      name = body.name.trim();
    database.exec('BEGIN IMMEDIATE');
    try {
      if (emailByAddress.get(email) || profileByAddress.get(email))
        throw new HttpError(409, 'email_in_use');
      if (googleByAddress.get(email)) throw new HttpError(409, 'google_login_required');
      insertEmail.run(sub, email, name, passwordHash, JSON.stringify(createGame(now)), now, now);
      const profile = profiles.ensure({ email, name }, now);
      audit.record({
        at: now,
        actorType: 'admin',
        actor,
        action: 'admin.user.create',
        targetId: profile.id,
        targetLabel: profile.user_code,
        details: { provider: 'email', status: 201 },
      });
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { user: summary(email, now, now) };
  }
  function remove(id, confirmation, { now, actor, recheck = () => {} }) {
    if (typeof confirmation !== 'string' || !confirmation)
      throw new HttpError(400, 'confirmation_required');
    database.exec('BEGIN IMMEDIATE');
    try {
      recheck();
      const profile = profileById.get(id);
      if (!profile) throw new HttpError(404, 'player_not_found');
      if (confirmation !== profile.user_code) throw new HttpError(400, 'confirmation_required');
      const { emailAccount, googleAccounts } = accounts(profile.email);
      const { sql, values } = sessionFilter(emailAccount, googleAccounts);
      const sessions = database
        .prepare(`SELECT COUNT(*) AS count FROM sessions WHERE ${sql}`)
        .get(...values).count;
      database
        .prepare(
          `DELETE FROM google_oauth_flows
        WHERE session_hash IN (SELECT token_hash FROM sessions WHERE ${sql})`,
        )
        .run(...values);
      database.prepare(`DELETE FROM sessions WHERE ${sql}`).run(...values);
      if (emailAccount) {
        deleteVerification.run(emailAccount.sub);
        deleteRecovery.run(emailAccount.sub);
        deleteEmail.run(emailAccount.sub);
      }
      purgeTombstones.run(now);
      for (const row of googleAccounts) {
        saveTombstone.run(
          createHash('sha256').update(row.sub).digest('hex'),
          now,
          now + FLOW_AGE_MS,
        );
        deleteGoogle.run(row.sub);
      }
      const friendships = deleteFriends.run(profile.id, profile.id).changes;
      const transfers = deleteTransfers.run(profile.id, profile.id).changes;
      audit.purgeIdentity({ id: profile.id, userCode: profile.user_code, email: profile.email });
      deleteProfile.run(profile.id);
      audit.record({
        at: now,
        actorType: 'admin',
        actor,
        action: 'admin.user.delete',
        details: {
          accounts: (emailAccount ? 1 : 0) + googleAccounts.length,
          sessions,
          friendships,
          transfers,
        },
      });
      database.exec('COMMIT');
      return {
        ok: true,
        deleted: {
          accounts: (emailAccount ? 1 : 0) + googleAccounts.length,
          sessions,
          friendships,
          transfers,
        },
      };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return { list, detail, counts, create, remove };
}
