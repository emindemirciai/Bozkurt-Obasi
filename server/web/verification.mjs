import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';

/** Pending email sessions can prove ownership without receiving game authorization. */
export function createVerificationStore(database, { mail, HttpError }) {
  for (const [column, definition] of [
    ['salt', "TEXT NOT NULL DEFAULT ''"],
    ['failed_attempts', 'INTEGER NOT NULL DEFAULT 0'],
  ]) {
    if (
      !database
        .prepare('PRAGMA table_info(email_verifications)')
        .all()
        .some((item) => item.name === column)
    )
      database.exec(`ALTER TABLE email_verifications ADD COLUMN ${column} ${definition}`);
  }
  const accountGet = database.prepare(
    'SELECT email,email_verified,google_sub FROM email_accounts WHERE sub=?',
  );
  const get = database.prepare('SELECT * FROM email_verifications WHERE email_sub=?');
  const pending = new Set(),
    attempts = new Map();
  function digest(sub, salt, code) {
    return createHash('sha256').update(`${sub}:${salt}:${code}`).digest();
  }
  async function issue(sub, now) {
    if (!mail.enabled || !sub || pending.has(sub)) return false;
    const account = accountGet.get(sub),
      previous = get.get(sub);
    if (!account || account.email_verified || account.google_sub) return false;
    if (
      now - (attempts.get(sub) ?? -Infinity) < 60000 ||
      (previous && now - previous.issued_at < 60000)
    )
      return false;
    const sameWindow = previous && now - previous.window_start < 86400000;
    if (sameWindow && previous.window_count >= 5) return false;
    const code = String(randomInt(0, 1000000)).padStart(6, '0'),
      salt = randomBytes(24).toString('hex');
    if (attempts.size >= 10000)
      for (const [key, time] of attempts) if (now - time >= 60000) attempts.delete(key);
    if (attempts.size >= 10000) return false;
    attempts.set(sub, now);
    pending.add(sub);
    try {
      if (!(await mail.sendVerification(account.email, code))) return false;
      const current = accountGet.get(sub);
      if (!current || current.email_verified || current.google_sub) return false;
      database
        .prepare(
          `INSERT INTO email_verifications(email_sub,token_hash,issued_at,expires_at,window_start,window_count,salt,failed_attempts)
        VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(email_sub) DO UPDATE SET token_hash=excluded.token_hash,
        issued_at=excluded.issued_at,expires_at=excluded.expires_at,window_start=excluded.window_start,
        window_count=excluded.window_count,salt=excluded.salt,failed_attempts=0`,
        )
        .run(
          sub,
          digest(sub, salt, code).toString('hex'),
          now,
          now + 900000,
          sameWindow ? previous.window_start : now,
          sameWindow ? previous.window_count + 1 : 1,
          salt,
        );
      return true;
    } catch {
      return false;
    } finally {
      pending.delete(sub);
    }
  }
  function confirm(sub, code, now) {
    if (!sub) throw new HttpError(401, 'account_session_required');
    if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code))
      throw new HttpError(400, 'invalid_verification_code');
    database.exec('BEGIN IMMEDIATE');
    let failure;
    try {
      const row = get.get(sub);
      if (!row || row.expires_at <= now || row.failed_attempts >= 5 || !row.salt)
        failure = new HttpError(400, 'verification_expired');
      else if (!timingSafeEqual(digest(sub, row.salt, code), Buffer.from(row.token_hash, 'hex'))) {
        database
          .prepare(
            'UPDATE email_verifications SET failed_attempts=failed_attempts+1 WHERE email_sub=?',
          )
          .run(sub);
        failure = new HttpError(400, 'invalid_verification_code');
      } else {
        database
          .prepare('UPDATE email_accounts SET email_verified=1,updated_at=? WHERE sub=?')
          .run(now, sub);
        database.prepare('DELETE FROM email_verifications WHERE email_sub=?').run(sub);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    if (failure) throw failure;
  }
  return { issue, confirm };
}
