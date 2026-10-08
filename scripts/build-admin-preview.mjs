import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Only the generated offline artifact uses these fictional, read-only responses.
// Production admin assets and authentication never import this module.
function offlineFixture() {
  const memory = new Map([['bozkurt_admin_token', 'offline-visual-preview']]);
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
  const now = Date.UTC(2026, 9, 8, 9);
  const users = Array.from({ length: 24 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    email: `player${index + 1}@example.com`,
    fullName: `Player ${index + 1}`,
    nickname: `Guardian ${index + 1}`,
    userCode: `player${index + 1}#${String(1000 + index)}`,
    createdAt: now - (index + 1) * 86_400_000,
    lastActiveAt: now - index * 3_600_000,
    lastLoginAt: index % 4 ? now - index * 3_600_000 : null,
    verified: index % 3 !== 1 || index >= 18,
    providers: index % 3 ? ['email'] : ['google'],
    googleLinked: false,
    activeSessions: index % 4 ? 1 : 0,
  }));
  const logs = users.map((user, index) => ({
    id: index + 1,
    createdAt: now - index * 60_000,
    action: index % 3 ? 'player.login' : 'admin.user.create',
    level: 'info',
    actorType: index % 3 ? 'player' : 'admin',
    actor: index % 3 ? user.userCode : 'admin@example.com',
    targetId: user.id,
    targetLabel: user.userCode,
    details: { provider: user.providers[0], status: index % 3 ? 200 : 201 },
  }));
  const response = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const paginate = (items, key, query) => {
    const page = Number(query.get('page') || 1);
    const limit = Number(query.get('limit') || 20);
    return {
      [key]: items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
    };
  };
  const fetch = async (path, options = {}) => {
    if ((options.method || 'GET') !== 'GET') return response({ error: 'preview_read_only' }, 403);
    const url = new URL(path, 'https://offline-preview.invalid');
    const query = url.searchParams;
    const needle = (query.get('query') || '').toLowerCase();
    if (url.pathname === '/api/admin/overview')
      return response({
        totalUsers: 24,
        verifiedUsers: 18,
        pendingUsers: 6,
        emailUsers: 16,
        googleUsers: 8,
        totalPlayers: 18,
        activePlayers: 12,
        generatedAt: now,
      });
    if (url.pathname === '/api/health') return response({ ok: true });
    if (url.pathname === '/api/admin/users')
      return response(
        paginate(
          users.filter(
            (user) =>
              [user.email, user.fullName, user.nickname, user.userCode].some((value) =>
                value.toLowerCase().includes(needle),
              ) &&
              (!query.get('verification') ||
                query.get('verification') === 'all' ||
                user.verified === (query.get('verification') === 'verified')) &&
              (!query.get('provider') ||
                query.get('provider') === 'all' ||
                user.providers.includes(query.get('provider'))),
          ),
          'users',
          query,
        ),
      );
    if (url.pathname === '/api/admin/logs')
      return response(
        paginate(
          logs.filter(
            (log) =>
              [log.action, log.actor, log.targetLabel].some((value) =>
                value.toLowerCase().includes(needle),
              ) &&
              (!query.get('action') ||
                query.get('action') === 'all' ||
                log.action === query.get('action')) &&
              (!query.get('level') ||
                query.get('level') === 'all' ||
                log.level === query.get('level')),
          ),
          'logs',
          query,
        ),
      );
    const user = users.find((item) => url.pathname === '/api/admin/users/' + item.id);
    if (user)
      return response({
        user: {
          ...user,
          sessions: [],
          villages: [
            {
              provider: user.providers[0],
              regionId: 'steppe',
              wave: 3,
              herd: 174,
              wolves: 5,
              resources: { water: 180, feed: 220, herbs: 40, wood: 300, stone: 150 },
              revision: 12,
            },
          ],
        },
      });
    return response({ error: 'preview_read_only' }, 403);
  };
  return { storage, fetch };
}

const [template, css, app] = await Promise.all([
  readFile('services/admin/index.html', 'utf8'),
  readFile('services/admin/app.css', 'utf8'),
  readFile('services/admin/app.js', 'utf8'),
]);
const banner =
  '<aside id="offline-banner" role="note" style="padding:16px 24px;border-bottom:1px solid var(--line);background:var(--surface);text-align:center;overflow-wrap:anywhere"></aside>';
const controls = `
  const notice = document.getElementById('offline-banner');
  const lock = () => {
    const en = document.documentElement.lang === 'en';
    notice.textContent = en
      ? 'Offline visual preview · Fictional sample data · Read-only · No server connection'
      : 'Çevrimdışı görsel önizleme · Örnek veriler · Salt okunur · Sunucu bağlantısı yok';
    for (const element of document.querySelectorAll('#add-user, #logout, #admin-dialog .danger')) {
      if (!element.disabled) element.disabled = true;
    }
  };
  new MutationObserver(lock).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  new MutationObserver(lock).observe(document.getElementById('dialog-content'), { childList: true, subtree: true });
  for (const anchor of document.querySelectorAll('a')) anchor.removeAttribute('href');
  lock();
`;
const script = `(() => { const preview = (${offlineFixture.toString()})();
const localStorage = preview.storage, sessionStorage = preview.storage, fetch = preview.fetch;
${app}
${controls}
})();`.replace(/<\/script/gi, '<\\/script');
const html = template
  .replace('<link rel="stylesheet" href="/app.css" />', `<style>${css}</style>`)
  .replace(/^[ \t]*<script src="\/app.js" defer><\/script>[ \t]*\r?\n/m, '')
  .replace('<body>', `<body>${banner}`)
  .replace('</body>', `<script>${script}</script></body>`)
  .replace(
    '<title>Bozkurt Obası · Yönetim</title>',
    '<title>Bozkurt Obası · Admin Önizleme / Preview</title>',
  );
await mkdir('preview', { recursive: true });
await writeFile('preview/admin.html', html, 'utf8');
console.log(`Offline admin visual preview: preview/admin.html (${Buffer.byteLength(html)} bytes)`);
