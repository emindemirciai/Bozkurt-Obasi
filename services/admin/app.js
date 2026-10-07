const dictionary = {
  tr: {
    subtitle: 'Obanı kur, sürünü koru.', eyebrow: 'YÖNETİM MERKEZİ',
    title: 'Obanın nabzını takip et.', lead: 'Oyuncu oturumlarını güvenli bir panelden izle. Trafik ayrıntıları analiz panelinde.',
    logout: 'Çıkış', access: 'ERİŞİM', loginTitle: 'Yönetici girişi',
    loginHint: 'Dokploy ortamında tanımladığınız yönetici hesabıyla giriş yapın.',
    email: 'E-posta', password: 'Parola', signIn: 'Panele gir →',
    overview: 'GENEL BAKIŞ', refresh: 'Yenile', totalPlayers: 'Toplam oyuncu oturumu',
    totalHint: 'Geçerli misafir köyleri', activePlayers: 'Son 24 saatte aktif',
    activeHint: 'Güncellenen oturumlar', status: 'Sistem durumu', statusHint: 'Oyun API sağlığı',
    checking: 'Kontrol ediliyor', healthy: 'Çalışıyor', unhealthy: 'Erişilemiyor',
    analytics: 'Trafik analizini aç', game: 'Oyunu aç',
    private: 'Yalnızca yetkili yöneticiler', invalid: 'E-posta veya parola hatalı.',
    unavailable: 'Yönetici girişi hazır değil. Dokploy API servisinde ADMIN_EMAIL ve ADMIN_PASSWORD (en az 12 karakter) ayarlarını kontrol edip yeniden dağıtın.',
    denied: 'Oturum geçersiz veya süresi dolmuş. Yeniden giriş yapın.',
    network: 'Yönetici API bağlantısı kurulamadı. Dokploy yönlendirmesini ve API servisinin çalıştığını kontrol edin.',
    throttled: 'Çok sayıda hatalı deneme. 10 dakika sonra tekrar deneyin.',
    updated: 'Son güncelleme: ',
    switchToLight: 'Aydınlık görünüme geç', switchToDark: 'Karanlık görünüme geç',
  },
  en: {
    subtitle: 'Build your village. Guard your herd.', eyebrow: 'ADMIN CENTER',
    title: 'Keep a watch on your village.', lead: 'Monitor player sessions from a secure panel. Find detailed traffic in the analytics dashboard.',
    logout: 'Sign out', access: 'ACCESS', loginTitle: 'Administrator sign in',
    loginHint: 'Sign in with the administrator account configured in Dokploy.',
    email: 'Email', password: 'Password', signIn: 'Sign in →',
    overview: 'OVERVIEW', refresh: 'Refresh', totalPlayers: 'Total player sessions',
    totalHint: 'Valid guest villages', activePlayers: 'Active in the last 24 hours',
    activeHint: 'Updated sessions', status: 'System status', statusHint: 'Game API health',
    checking: 'Checking', healthy: 'Online', unhealthy: 'Unavailable',
    analytics: 'Open traffic analytics', game: 'Open game',
    private: 'Authorized administrators only', invalid: 'Incorrect email or password.',
    unavailable: 'Admin sign-in is not ready. Check ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in the Dokploy API service, then redeploy.',
    denied: 'Session invalid or expired. Please sign in again.',
    network: 'Could not connect to the admin API. Check the Dokploy routing and that the API service is running.',
    throttled: 'Too many failed attempts. Try again in 10 minutes.',
    updated: 'Last updated: ',
    switchToLight: 'Switch to light mode', switchToDark: 'Switch to dark mode',
  },
};
const elements = {
  message: document.getElementById('message'),
  login: document.getElementById('login-panel'),
  dashboard: document.getElementById('dashboard'),
  logout: document.getElementById('logout'),
  form: document.getElementById('login-form'),
};
let language = localStorage.getItem('bozkurt_admin_language') === 'en' ? 'en' : 'tr';
let token = sessionStorage.getItem('bozkurt_admin_token') || '';
let messageKey = '';
let authVersion = 0;
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
let theme = localStorage.getItem('bozkurt_admin_theme');
if (theme !== 'dark' && theme !== 'light') theme = themeMedia.matches ? 'dark' : 'light';

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const label = dictionary[language][theme === 'dark' ? 'switchToLight' : 'switchToDark'];
  const button = document.getElementById('theme');
  button.textContent = theme === 'dark' ? '☀' : '☾';
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.setAttribute('aria-pressed', String(theme === 'dark'));
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#211a16' : '#f5f2e9';
}

function translate() {
  document.documentElement.lang = language;
  document.title = language === 'tr' ? 'Bozkurt Obası · Yönetim' : 'Bozkurt Obası · Admin';
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = dictionary[language][element.dataset.i18n];
  }
  const languageButton = document.getElementById('language');
  languageButton.textContent = language === 'tr' ? 'EN' : 'TR';
  languageButton.setAttribute('aria-label', language === 'tr' ? 'Switch to English' : 'Türkçeye geç');
  message(messageKey);
  applyTheme();
}
function message(key) {
  messageKey = key;
  elements.message.textContent = key ? dictionary[language][key] : '';
  elements.message.classList.toggle('hidden', !key);
}
function authenticated(value) {
  elements.login.classList.toggle('hidden', value);
  elements.dashboard.classList.toggle('hidden', !value);
  elements.logout.classList.toggle('hidden', !value);
}
function discardToken() {
  authVersion += 1;
  token = '';
  sessionStorage.removeItem('bozkurt_admin_token');
  authenticated(false);
}
function failureMessage(response, data, session = false) {
  if (response.status === 503 && data.error === 'admin_unavailable') return 'unavailable';
  if (response.status === 429) return 'throttled';
  if (response.status === 401) return session ? 'denied' : 'invalid';
  return 'network';
}
async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(path, {
    ...options, headers, cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data: data ?? {} };
}
async function checkConfiguration() {
  const version = authVersion;
  try {
    const { response, data } = await request('/api/admin/session');
    if (version !== authVersion || token || response.ok || response.status === 401) return;
    message(failureMessage(response, data));
  } catch {
    if (version === authVersion && !token) message('network');
  }
}
async function refresh() {
  const version = authVersion;
  try {
    const [overview, health] = await Promise.all([
      request('/api/admin/overview'),
      request('/api/health').catch(() => ({ response: { ok: false } })),
    ]);
    if (version !== authVersion) return;
    if (!overview.response.ok) {
      if (overview.response.status === 401) discardToken();
      if (overview.data.error === 'admin_unavailable') authenticated(false);
      message(failureMessage(overview.response, overview.data, true));
      return;
    }
    document.getElementById('total').textContent = Number(overview.data.totalPlayers || 0).toLocaleString(language);
    document.getElementById('active').textContent = Number(overview.data.activePlayers || 0).toLocaleString(language);
    const healthElement = document.getElementById('health');
    healthElement.dataset.i18n = health.response.ok ? 'healthy' : 'unhealthy';
    healthElement.textContent = dictionary[language][healthElement.dataset.i18n];
    document.getElementById('updated').textContent = dictionary[language].updated +
      new Date(overview.data.generatedAt).toLocaleString(language);
    authenticated(true);
    message('');
  } catch {
    if (version === authVersion) message('network');
  }
}
document.getElementById('theme').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('bozkurt_admin_theme', theme);
  applyTheme();
});
themeMedia.addEventListener('change', () => {
  if (localStorage.getItem('bozkurt_admin_theme')) return;
  theme = themeMedia.matches ? 'dark' : 'light';
  applyTheme();
});
document.getElementById('language').addEventListener('click', () => {
  language = language === 'tr' ? 'en' : 'tr';
  localStorage.setItem('bozkurt_admin_language', language);
  translate();
  if (token) refresh();
});
elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  authVersion += 1;
  const button = elements.form.querySelector('button[type=submit]');
  button.disabled = true;
  message('');
  try {
    const { response, data } = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: elements.form.elements.namedItem('email').value.trim(),
        password: elements.form.elements.namedItem('password').value,
      }),
    });
    if (!response.ok || typeof data.token !== 'string' || !data.token) {
      message(failureMessage(response, data));
      return;
    }
    token = data.token;
    sessionStorage.setItem('bozkurt_admin_token', token);
    elements.form.reset();
    await refresh();
  } catch {
    message('network');
  } finally {
    button.disabled = false;
  }
});
elements.logout.addEventListener('click', async () => {
  try { await request('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch {}
  discardToken();
  message('');
});
document.getElementById('refresh').addEventListener('click', refresh);
translate();
authenticated(false);
if (token) refresh();
else checkConfiguration();
