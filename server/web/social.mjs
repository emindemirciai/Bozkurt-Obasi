import { advanceGame, validateGame } from '../../shared/game.mjs';

export function createSocialStore(database, { HttpError, profiles }) {
  database.exec(`CREATE TABLE IF NOT EXISTS friendships (
    first_id TEXT NOT NULL, second_id TEXT NOT NULL, sender_id TEXT NOT NULL,
    status TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(first_id,second_id)
  );
  CREATE TABLE IF NOT EXISTS stone_transfers (
    sender_id TEXT NOT NULL, request_id TEXT NOT NULL, recipient_id TEXT NOT NULL,
    amount INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(sender_id,request_id)
  );`);
  const profileById = database.prepare('SELECT nickname,user_code FROM player_profiles WHERE id=?');
  const relation = database.prepare('SELECT * FROM friendships WHERE first_id=? AND second_id=?');
  function pair(email, code) {
    const me = profiles.getByEmail(email),
      other = profiles.findByCode(code);
    if (!other) throw new HttpError(404, 'player_not_found');
    if (me.id === other.id) throw new HttpError(400, 'self_friend');
    return { me, other, ids: [me.id, other.id].sort() };
  }
  function list(email) {
    const me = profiles.getByEmail(email);
    const result = { friends: [], incoming: [], outgoing: [], transfers: [] };
    for (const row of database
      .prepare('SELECT * FROM friendships WHERE first_id=? OR second_id=?')
      .all(me.id, me.id)) {
      const other = profileById.get(row.first_id === me.id ? row.second_id : row.first_id);
      const key =
        row.status === 'accepted' ? 'friends' : row.sender_id === me.id ? 'outgoing' : 'incoming';
      result[key].push({ name: other.nickname, userCode: other.user_code });
    }
    for (const row of database
      .prepare(
        'SELECT * FROM stone_transfers WHERE sender_id=? OR recipient_id=? ORDER BY created_at DESC,rowid DESC LIMIT 20',
      )
      .all(me.id, me.id)) {
      const sent = row.sender_id === me.id;
      const other = profileById.get(sent ? row.recipient_id : row.sender_id);
      result.transfers.push({
        sent,
        amount: row.amount,
        createdAt: row.created_at,
        name: other.nickname,
        userCode: other.user_code,
      });
    }
    return result;
  }
  function request(email, code, now) {
    const { me, other, ids } = pair(email, code);
    if (relation.get(...ids)) throw new HttpError(409, 'friend_exists');
    const count = database.prepare(
      'SELECT COUNT(*) AS count FROM friendships WHERE first_id=? OR second_id=?',
    );
    if ([me, other].some((person) => count.get(person.id, person.id).count >= 100))
      throw new HttpError(400, 'friend_limit');
    database
      .prepare('INSERT INTO friendships VALUES (?,?,?,?,?)')
      .run(...ids, me.id, 'pending', now);
    return list(email);
  }
  function accept(email, code) {
    const { me, ids } = pair(email, code),
      row = relation.get(...ids);
    if (!row || row.status !== 'pending' || row.sender_id === me.id)
      throw new HttpError(403, 'friend_request_required');
    database
      .prepare("UPDATE friendships SET status='accepted' WHERE first_id=? AND second_id=?")
      .run(...ids);
    return list(email);
  }
  function remove(email, code) {
    const { ids } = pair(email, code);
    database.prepare('DELETE FROM friendships WHERE first_id=? AND second_id=?').run(...ids);
    return list(email);
  }
  function game(email) {
    let account = database.prepare('SELECT * FROM email_accounts WHERE email=?').get(email);
    let table = 'email_accounts';
    if (account?.google_sub) {
      account = database
        .prepare('SELECT * FROM google_accounts WHERE sub=?')
        .get(account.google_sub);
      table = 'google_accounts';
    } else if (!account) {
      account = database
        .prepare('SELECT * FROM google_accounts WHERE lower(trim(email))=?')
        .get(email);
      table = 'google_accounts';
    }
    if (!account || (table === 'email_accounts' && !account.email_verified))
      throw new HttpError(403, 'email_verification_required');
    const state = JSON.parse(account.state_json);
    if (!validateGame(state)) throw new Error('Invalid persisted village');
    return { table, account, state };
  }
  function transfer(email, body, now) {
    if (
      !Number.isSafeInteger(body.amount) ||
      body.amount < 1 ||
      body.amount > 10000 ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        body.requestId || '',
      )
    )
      throw new HttpError(400, 'invalid_transfer');
    const { me, other, ids } = pair(email, body.userCode);
    database.exec('BEGIN IMMEDIATE');
    try {
      const receipt = database
        .prepare('SELECT * FROM stone_transfers WHERE sender_id=? AND request_id=?')
        .get(me.id, body.requestId);
      if (receipt) {
        if (receipt.recipient_id !== other.id || receipt.amount !== body.amount)
          throw new HttpError(409, 'transfer_conflict');
        database.exec('COMMIT');
        return { ok: true, duplicate: true, requestId: body.requestId };
      }
      if (relation.get(...ids)?.status !== 'accepted') throw new HttpError(403, 'friend_required');
      const source = game(me.email),
        target = game(other.email);
      if (source.account.revision !== body.revision) throw new HttpError(409, 'stale_revision');
      advanceGame(source.state, now);
      advanceGame(target.state, now);
      if (source.state.resources.stone < body.amount)
        throw new HttpError(400, 'insufficient_stone');
      if (target.state.resources.stone + body.amount > target.state.capacity)
        throw new HttpError(400, 'recipient_storage_full');
      source.state.resources.stone -= body.amount;
      target.state.resources.stone += body.amount;
      for (const entry of [source, target]) {
        if (!validateGame(entry.state)) throw new Error('Invalid transfer state');
        const result = database
          .prepare(
            `UPDATE ${entry.table} SET state_json=?,revision=?,updated_at=? WHERE sub=? AND revision=?`,
          )
          .run(
            JSON.stringify(entry.state),
            entry.account.revision + 1,
            now,
            entry.account.sub,
            entry.account.revision,
          );
        if (result.changes !== 1) throw new HttpError(409, 'stale_revision');
      }
      database
        .prepare('INSERT INTO stone_transfers VALUES (?,?,?,?,?)')
        .run(me.id, body.requestId, other.id, body.amount, now);
      database.exec('COMMIT');
      return {
        ok: true,
        duplicate: false,
        requestId: body.requestId,
        state: source.state,
        revision: source.account.revision + 1,
      };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return { list, request, accept, remove, transfer };
}
