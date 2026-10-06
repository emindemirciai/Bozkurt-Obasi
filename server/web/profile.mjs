import { randomInt, randomUUID } from 'node:crypto';

const MAX_AVATAR = 2 * 1024 * 1024;
export function createProfileStore(database, { HttpError }) {
  database.exec(`CREATE TABLE IF NOT EXISTS player_profiles (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
    nickname TEXT NOT NULL, user_code TEXT NOT NULL UNIQUE,
    google_picture TEXT, avatar_mode TEXT NOT NULL DEFAULT 'google',
    avatar BLOB, avatar_mime TEXT, avatar_revision INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );`);
  const get = database.prepare('SELECT * FROM player_profiles WHERE email = ?');
  const byCode = database.prepare('SELECT * FROM player_profiles WHERE user_code = ?');
  const emailKey = (email) => email.trim().toLowerCase();
  function ensure({ email, name, googlePicture }, now) {
    email = emailKey(email);
    let row = get.get(email);
    if (!row) {
      const base =
        (name || 'bozkurt')
          .toLowerCase()
          .replace(/ı/g, 'i')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20) || 'bozkurt';
      let code,
        tries = 0;
      do {
        if (++tries > 100) throw new HttpError(503, 'profile_unavailable');
        code = `${base}#${tries < 30 ? randomInt(1000, 10000) : randomInt(100000, 1000000)}`;
      } while (byCode.get(code));
      database
        .prepare(
          'INSERT INTO player_profiles (id,email,full_name,nickname,user_code,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        )
        .run(randomUUID(), email, name, name, code, now, now);
      row = get.get(email);
    }
    if (googlePicture !== undefined) {
      database
        .prepare('UPDATE player_profiles SET google_picture = ?, updated_at = ? WHERE email = ?')
        .run(googlePicture || null, now, email);
    }
    return get.get(email);
  }
  function publicProfile(email) {
    const row = get.get(emailKey(email));
    if (!row) return null;
    return {
      name: row.nickname,
      nickname: row.nickname,
      fullName: row.full_name,
      email: row.email,
      userCode: row.user_code,
      avatarUrl:
        row.avatar_mode === 'custom'
          ? `/api/player/avatar/${encodeURIComponent(row.user_code)}?v=${row.avatar_revision}`
          : row.avatar_mode === 'google'
            ? row.google_picture
            : null,
    };
  }
  function update(email, body, now) {
    if (Object.keys(body).some((key) => !['nickname', 'avatarDataUrl'].includes(key)))
      throw new HttpError(400, 'unexpected_fields');
    const row = get.get(emailKey(email));
    if (!row) throw new HttpError(401, 'account_session_required');
    const nickname = body.nickname === undefined ? row.nickname : body.nickname;
    if (
      typeof nickname !== 'string' ||
      !nickname.trim() ||
      nickname.trim().length > 60 ||
      /[\x00-\x1f\x7f]/.test(nickname)
    )
      throw new HttpError(400, 'invalid_name');
    let avatar = row.avatar,
      mime = row.avatar_mime,
      mode = row.avatar_mode;
    if (body.avatarDataUrl !== undefined) {
      if (body.avatarDataUrl === null) {
        avatar = null;
        mime = null;
        mode = 'none';
      } else {
        if (typeof body.avatarDataUrl !== 'string' || body.avatarDataUrl.length > MAX_AVATAR * 1.38)
          throw new HttpError(400, 'invalid_avatar');
        const match = /^data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          body.avatarDataUrl,
        );
        if (!match) throw new HttpError(400, 'invalid_avatar');
        avatar = Buffer.from(match[2], 'base64');
        mime = match[1];
        if (!avatar.length || avatar.length > MAX_AVATAR || avatar.toString('base64') !== match[2])
          throw new HttpError(400, 'invalid_avatar');
        const valid =
          mime === 'image/png'
            ? avatar.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : mime === 'image/jpeg'
              ? avatar.length > 4 && avatar[0] === 255 && avatar[1] === 216 && avatar[2] === 255
              : /^GIF8[79]a$/.test(avatar.subarray(0, 6).toString('ascii'));
        if (!valid) throw new HttpError(400, 'invalid_avatar');
        mode = 'custom';
      }
    }
    database
      .prepare(
        'UPDATE player_profiles SET nickname=?,avatar=?,avatar_mime=?,avatar_mode=?,avatar_revision=?,updated_at=? WHERE email=?',
      )
      .run(
        nickname.trim(),
        avatar,
        mime,
        mode,
        row.avatar_revision + (body.avatarDataUrl !== undefined ? 1 : 0),
        now,
        row.email,
      );
    return publicProfile(row.email);
  }
  return {
    ensure,
    publicProfile,
    update,
    getByEmail: (email) => get.get(emailKey(email)),
    findByCode: (code) =>
      typeof code === 'string' && code.length <= 40
        ? byCode.get(code.trim().toLowerCase())
        : undefined,
    getAvatar(code) {
      const row = byCode.get(code);
      return row?.avatar_mode === 'custom' ? { bytes: row.avatar, mime: row.avatar_mime } : null;
    },
  };
}
