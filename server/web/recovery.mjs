import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';

const RESEND_MS = 60_000;
const WINDOW_MS = 86_400_000;
const CODE_MS = 900_000;
const MAX_SENDS = 5;
const MAX_ATTEMPTS = 5;
const MAX_IDENTITIES = 10_000;
const MAX_PENDING = 16;

/** Recovery proves an already verified account; it never creates or verifies one. */
export function createRecoveryStore(database, { mail, HttpError }) {
  database.exec(`CREATE TABLE IF NOT EXISTS password_recoveries (
    email_sub TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    issued_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    window_start INTEGER NOT NULL,
    window_count INTEGER NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    consumed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS password_recoveries_expiry ON password_recoveries(expires_at);`);
  const accountGet = database.prepare(
    'SELECT sub,email,password_hash,email_verified,google_sub FROM email_accounts WHERE email=?',
  );
  const challengeGet = database.prepare('SELECT * FROM password_recoveries WHERE email_sub=?');
  const pending = new Set();
  const attempts = new Map();
  const requested = () => ({ requested: true });
  const eligible = (account) => Boolean(account?.email_verified && account.password_hash);

  function digest(sub, salt, passwordHash, code) {
    return createHash('sha256').update(`recovery:${sub}:${salt}:${passwordHash}:${code}`).digest();
  }

  async function request(email, now) {
    if (!mail.enabled || typeof email !== 'string' || pending.has(email)) return requested();
    if (attempts.size >= MAX_IDENTITIES)
      for (const [key, time] of attempts) if (now - time >= RESEND_MS) attempts.delete(key);
    if (attempts.size >= MAX_IDENTITIES || pending.size >= MAX_PENDING) return requested();
    if (now - (attempts.get(email) ?? -Infinity) < RESEND_MS) return requested();
    attempts.set(email, now);
    const account = accountGet.get(email);
    if (!eligible(account)) return requested();
    const previous = challengeGet.get(account.sub);
    if (previous && now - previous.issued_at < RESEND_MS) return requested();
    const sameWindow = previous && now - previous.window_start < WINDOW_MS;
    if (sameWindow && previous.window_count >= MAX_SENDS) return requested();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = randomBytes(24).toString('hex');
    pending.add(email);
    try {
      if (!(await mail.sendPasswordReset(account.email, code))) return requested();
      const current = accountGet.get(email);
      // A concurrent password change cannot reactivate a code sent for the former password.
      if (
        !eligible(current) ||
        current.sub !== account.sub ||
        current.password_hash !== account.password_hash
      )
        return requested();
      database
        .prepare(
          `INSERT INTO password_recoveries(email_sub,token_hash,salt,password_hash,issued_at,
            expires_at,window_start,window_count,failed_attempts,consumed_at)
          VALUES(?,?,?,?,?,?,?,?,0,NULL)
          ON CONFLICT(email_sub) DO UPDATE SET token_hash=excluded.token_hash,salt=excluded.salt,
            password_hash=excluded.password_hash,issued_at=excluded.issued_at,
            expires_at=excluded.expires_at,window_start=excluded.window_start,
            window_count=excluded.window_count,failed_attempts=0,consumed_at=NULL`,
        )
        .run(
          account.sub,
          digest(account.sub, salt, account.password_hash, code).toString('hex'),
          salt,
          account.password_hash,
          now,
          now + CODE_MS,
          sameWindow ? previous.window_start : now,
          sameWindow ? previous.window_count + 1 : 1,
        );
    } catch {
      // Neither SMTP failures nor account existence are disclosed to the requester.
    } finally {
      pending.delete(email);
    }
    return requested();
  }

  function confirm(email, code, expectedPasswordHash, newPasswordHash, now) {
    const invalid = () => new HttpError(400, 'recovery_code_invalid');
    if (
      typeof email !== 'string' ||
      typeof code !== 'string' ||
      !/^[0-9]{6}$/.test(code) ||
      typeof expectedPasswordHash !== 'string' ||
      typeof newPasswordHash !== 'string' ||
      !newPasswordHash
    )
      throw invalid();
    database.exec('BEGIN IMMEDIATE');
    let failure;
    try {
      const account = accountGet.get(email);
      const row = account && challengeGet.get(account.sub);
      if (
        !eligible(account) ||
        !row ||
        row.expires_at <= now ||
        row.failed_attempts >= MAX_ATTEMPTS ||
        row.consumed_at !== null ||
        !/^[0-9a-f]{64}$/.test(row.token_hash) ||
        !row.salt ||
        account.password_hash !== expectedPasswordHash ||
        row.password_hash !== expectedPasswordHash
      )
        failure = invalid();
      else if (
        !timingSafeEqual(
          digest(account.sub, row.salt, expectedPasswordHash, code),
          Buffer.from(row.token_hash, 'hex'),
        )
      ) {
        database
          .prepare(
            'UPDATE password_recoveries SET failed_attempts=failed_attempts+1 WHERE email_sub=?',
          )
          .run(account.sub);
        failure = invalid();
      } else {
        const changed = database
          .prepare(
            'UPDATE email_accounts SET password_hash=?,updated_at=? WHERE sub=? AND password_hash=? AND email_verified=1',
          )
          .run(newPasswordHash, now, account.sub, expectedPasswordHash);
        if (changed.changes !== 1) throw invalid();
        database
          .prepare(
            "DELETE FROM sessions WHERE (account_provider='email' AND account_sub=?) OR (account_provider='google' AND account_sub=?)",
          )
          .run(account.sub, account.google_sub ?? null);
        database
          .prepare(
            "UPDATE password_recoveries SET consumed_at=?,token_hash='',salt='',password_hash='',expires_at=0 WHERE email_sub=?",
          )
          .run(now, account.sub);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    if (failure) throw failure;
    return { reset: true };
  }

  return { request, confirm };
}
