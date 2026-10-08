const dictionary = {
  tr: {
    subtitle: 'Obanı kur, sürünü koru.',
    eyebrow: 'YÖNETİM MERKEZİ',
    title: 'Obanın nabzını takip et.',
    lead: 'Kullanıcıları, kayıtları ve hesap işlemlerini tek merkezden yönet.',
    logout: 'Çıkış',
    access: 'ERİŞİM',
    loginTitle: 'Yönetici girişi',
    loginHint: 'Dokploy ortamında tanımladığınız yönetici hesabıyla giriş yapın.',
    email: 'E-posta',
    password: 'Parola',
    signIn: 'Panele gir →',
    overview: 'GENEL BAKIŞ',
    refresh: 'Yenile',
    totalPlayers: 'Toplam oyuncu oturumu',
    totalHint: 'Tekil oyuncu hesapları',
    activePlayers: 'Son 24 saatte aktif',
    activeHint: 'Güncellenen oyun kayıtları',
    status: 'Sistem durumu',
    statusHint: 'Oyun API sağlığı',
    checking: 'Kontrol ediliyor',
    healthy: 'Çalışıyor',
    unhealthy: 'Erişilemiyor',
    analytics: 'Trafik analizini aç',
    game: 'Oyunu aç',
    private: 'Yalnızca yetkili yöneticiler',
    invalid: 'E-posta veya parola hatalı.',
    unavailable:
      'Yönetici girişi hazır değil. Dokploy API servisinde ADMIN_EMAIL ve ADMIN_PASSWORD (en az 12 karakter) ayarlarını kontrol edip yeniden dağıtın.',
    denied: 'Oturum geçersiz veya süresi dolmuş. Yeniden giriş yapın.',
    network:
      'Yönetici API bağlantısı kurulamadı. Dokploy yönlendirmesini ve API servisinin çalıştığını kontrol edin.',
    throttled: 'Çok sayıda hatalı deneme. 10 dakika sonra tekrar deneyin.',
    updated: 'Son güncelleme: ',
    switchToLight: 'Aydınlık görünüme geç',
    switchToDark: 'Karanlık görünüme geç',
  },
  en: {
    subtitle: 'Build your village. Guard your herd.',
    eyebrow: 'ADMIN CENTER',
    title: 'Keep a watch on your village.',
    lead: 'Manage players, registrations and account activity in one place.',
    logout: 'Sign out',
    access: 'ACCESS',
    loginTitle: 'Administrator sign in',
    loginHint: 'Sign in with the administrator account configured in Dokploy.',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in →',
    overview: 'OVERVIEW',
    refresh: 'Refresh',
    totalPlayers: 'Total player sessions',
    totalHint: 'Unique player accounts',
    activePlayers: 'Active in the last 24 hours',
    activeHint: 'Updated game records',
    status: 'System status',
    statusHint: 'Game API health',
    checking: 'Checking',
    healthy: 'Online',
    unhealthy: 'Unavailable',
    analytics: 'Open traffic analytics',
    game: 'Open game',
    private: 'Authorized administrators only',
    invalid: 'Incorrect email or password.',
    unavailable:
      'Admin sign-in is not ready. Check ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in the Dokploy API service, then redeploy.',
    denied: 'Session invalid or expired. Please sign in again.',
    network:
      'Could not connect to the admin API. Check the Dokploy routing and that the API service is running.',
    throttled: 'Too many failed attempts. Try again in 10 minutes.',
    updated: 'Last updated: ',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
  },
};
const dashboardCopy = {
  overview: ['Genel bakış', 'Overview'],
  users: ['Kullanıcılar', 'Users'],
  logs: ['İşlem günlüğü', 'Activity log'],
  sections: ['Yönetim bölümleri', 'Administration sections'],
  totalUsers: ['Kayıtlı kullanıcılar', 'Registered users'],
  verifiedUsers: ['Doğrulanmış hesaplar', 'Verified accounts'],
  verifiedHint: ['E-posta doğrulaması tamamlandı', 'Email verification complete'],
  pendingUsers: ['Doğrulama bekleyenler', 'Awaiting verification'],
  pendingHint: ['Henüz oyuna erişemez', 'Cannot access the game yet'],
  emailUsers: ['E-posta ile giriş', 'Email sign-in'],
  googleUsers: ['Google ile bağlı', 'Google linked'],
  linkedHint: [
    'Aynı hesap iki giriş yöntemini kullanabilir',
    'One account may use both sign-in methods',
  ],
  usersLead: [
    'Kayıt tarihlerini ve giriş yöntemlerini incele, hesapları yönet.',
    'Review registration dates and sign-in methods, and manage accounts.',
  ],
  logsLead: [
    'Kayıt, giriş ve yönetici işlemlerinin tarihli kayıtları.',
    'Dated records of registrations, sign-ins and administrator actions.',
  ],
  addUser: ['Kullanıcı ekle', 'Add user'],
  searchUsers: ['Kullanıcı ara', 'Search users'],
  searchLogs: ['Günlüklerde ara', 'Search activity'],
  usersSearchPlaceholder: ['Ad, e-posta veya oyuncu kodu', 'Name, email or player code'],
  logsSearchPlaceholder: ['Oyuncu veya işlem ara', 'Search players or actions'],
  verification: ['Doğrulama', 'Verification'],
  all: ['Tümü', 'All'],
  verified: ['Doğrulanmış', 'Verified'],
  pending: ['Bekliyor', 'Pending'],
  loginMethod: ['Giriş yöntemi', 'Sign-in method'],
  emailMethod: ['E-posta', 'Email'],
  search: ['Ara', 'Search'],
  player: ['Oyuncu', 'Player'],
  registeredAt: ['Kayıt tarihi', 'Registered'],
  lastActive: ['Son etkinlik', 'Last activity'],
  lastLogin: ['Son giriş', 'Last sign-in'],
  actions: ['İşlemler', 'Actions'],
  details: ['Ayrıntılar', 'Details'],
  previous: ['Önceki', 'Previous'],
  next: ['Sonraki', 'Next'],
  date: ['Tarih', 'Date'],
  logAction: ['İşlem', 'Action'],
  actor: ['İşlemi yapan', 'Actor'],
  target: ['Hedef', 'Target'],
  level: ['Düzey', 'Level'],
  info: ['Bilgi', 'Info'],
  warning: ['Uyarı', 'Warning'],
  error: ['Hata', 'Error'],
  loading: ['Yükleniyor…', 'Loading…'],
  noUsers: ['Bu filtrelere uyan kullanıcı yok.', 'No users match these filters.'],
  noLogs: ['Bu filtrelere uyan işlem kaydı yok.', 'No activity matches these filters.'],
  pageSummary: ['{total} kayıt · {page} / {pages}', '{total} records · {page} / {pages}'],
  unknown: ['Bilinmiyor', 'Unknown'],
  close: ['Kapat', 'Close'],
  cancel: ['Vazgeç', 'Cancel'],
  fullName: ['Ad soyad', 'Full name'],
  nickname: ['Takma ad', 'Nickname'],
  userCode: ['Oyuncu kodu', 'Player code'],
  activeSessions: ['Aktif oturumlar', 'Active sessions'],
  villages: ['Köy kayıtları', 'Village records'],
  wave: ['Dalga', 'Wave'],
  herd: ['Sürü', 'Herd'],
  wolves: ['Kurtlar', 'Wolves'],
  water: ['Su', 'Water'],
  feed: ['Yem', 'Feed'],
  wood: ['Odun', 'Wood'],
  stone: ['Taş', 'Stone'],
  herbs: ['Ot', 'Herbs'],
  sessions: ['Oturum kayıtları', 'Session records'],
  expiresAt: ['Bitiş', 'Expires'],
  noVillage: ['Henüz köy kaydı yok.', 'No village record yet.'],
  noSessions: ['Kayıtlı oturum yok.', 'No stored sessions.'],
  createHint: [
    'Yeni hesap e-posta doğrulamasını bekler. Oyuncu kendi giriş ekranında doğrulama kodunu istemeli ve hesabını onaylamalıdır.',
    'New accounts await email verification. The player must request a verification code on their sign-in screen and verify the account.',
  ],
  newPassword: ['Başlangıç parolası', 'Initial password'],
  passwordHint: [
    '12–128 karakter kullanın. Parolayı güvenli bir kanaldan iletin.',
    'Use 12–128 characters. Share the password through a secure channel.',
  ],
  createAccount: ['Hesabı oluştur', 'Create account'],
  created: [
    'Hesap oluşturuldu. Oyuncunun e-posta doğrulaması gerekiyor.',
    'Account created. The player must verify their email.',
  ],
  deleteUser: ['Kullanıcıyı kalıcı sil', 'Permanently delete user'],
  deleteTitle: ['Bu hesabı kalıcı sil?', 'Permanently delete this account?'],
  deleteHint: [
    'Hesap, köy kayıtları, oturumlar ve arkadaşlık bağlantıları kalıcı olarak kaldırılır. Bu işlem geri alınamaz.',
    'The account, village records, sessions and friendships will be permanently removed. This cannot be undone.',
  ],
  deleteCodeHint: [
    'Onaylamak için aşağıdaki oyuncu kodunu aynen yazın.',
    'Type the player code below exactly to confirm.',
  ],
  confirmCode: ['Oyuncu kodunu yaz', 'Type the player code'],
  deleted: [
    'Kullanıcı ve bağlı oyun verileri kalıcı olarak silindi.',
    'The user and associated game data were permanently deleted.',
  ],
  saving: ['İşleniyor…', 'Processing…'],
  invalidEmail: ['Geçerli bir e-posta adresi girin.', 'Enter a valid email address.'],
  invalidName: ['Geçerli bir ad soyad girin.', 'Enter a valid full name.'],
  invalidPassword: ['Parola 12–128 karakter olmalıdır.', 'Password must be 12–128 characters.'],
  emailInUse: ['Bu e-posta zaten bir hesaba bağlı.', 'This email already belongs to an account.'],
  googleRequired: [
    'Bu hesap Google ile bağlı. Mevcut giriş yöntemini kullanın.',
    'This account is linked to Google. Use the existing sign-in method.',
  ],
  userNotFound: ['Kullanıcı bulunamadı. Listeyi yenileyin.', 'User not found. Refresh the list.'],
  confirmationRequired: [
    'Oyuncu kodu eşleşmiyor. Kodu aynen yazın.',
    'The player code does not match. Type it exactly.',
  ],
  forbidden: [
    'Bu işlem için yönetici yetkisi gerekli.',
    'Administrator access is required for this action.',
  ],
  adminActor: ['Yönetici', 'Administrator'],
  playerActor: ['Oyuncu', 'Player'],
  systemActor: ['Sistem', 'System'],
  loginSuccess: ['Yönetici girişi', 'Administrator sign-in'],
  loginFailed: ['Başarısız yönetici girişi', 'Failed administrator sign-in'],
  loginLimited: ['Yönetici deneme sınırı', 'Administrator rate limit'],
  adminLogout: ['Yönetici çıkışı', 'Administrator sign-out'],
  userCreated: ['Kullanıcı oluşturuldu', 'User created'],
  userDeleted: ['Kullanıcı silindi', 'User deleted'],
  playerRegister: ['Oyuncu kaydı', 'Player registration'],
  playerLogin: ['Oyuncu girişi', 'Player sign-in'],
  playerLogout: ['Oyuncu çıkışı', 'Player sign-out'],
  playerVerify: ['E-posta doğrulandı', 'Email verified'],
  passwordChanged: ['Parola değiştirildi', 'Password changed'],
  passwordRecovery: ['Parola yenileme', 'Password recovery'],
  googleLogin: ['Google ile giriş', 'Google sign-in'],
  googleLinked: ['Google hesabı bağlandı', 'Google account linked'],
  passwordAdded: ['Parola ile giriş eklendi', 'Password sign-in added'],
  createFailed: ['Kullanıcı oluşturulamadı', 'User creation failed'],
  deleteFailed: ['Kullanıcı silinemedi', 'User deletion failed'],
  profileUpdated: ['Profil güncellendi', 'Profile updated'],
  friendRequested: ['Arkadaşlık isteği gönderildi', 'Friend request sent'],
  friendAccepted: ['Arkadaşlık kabul edildi', 'Friend request accepted'],
  friendRemoved: ['Arkadaşlık kaldırıldı', 'Friendship removed'],
  stoneTransferred: ['Taş gönderildi', 'Stone transferred'],
  gameAction: ['Oyun işlemi', 'Game action'],
  apiError: ['API hatası', 'API error'],
  metaProvider: ['Giriş yöntemi', 'Sign-in method'],
  metaActionType: ['Oyun işlemi türü', 'Game action type'],
  metaResult: ['Sonuç', 'Result'],
  metaError: ['Hata kodu', 'Error code'],
  metaStatus: ['HTTP durumu', 'HTTP status'],
  metaAmount: ['Taş miktarı', 'Stone amount'],
  metaCount: ['Kayıt sayısı', 'Record count'],
  metaAccounts: ['Silinen hesaplar', 'Deleted accounts'],
  metaSessions: ['Silinen oturumlar', 'Deleted sessions'],
  metaFriendships: ['Silinen arkadaşlıklar', 'Deleted friendships'],
  metaTransfers: ['Silinen transfer kayıtları', 'Deleted transfer records'],
  logsRetention: [
    'Günlükler en fazla 90 gün ve 100.000 kayıt saklanır. Parolalar ve doğrulama kodları kaydedilmez.',
    'Logs retain up to 90 days and 100,000 entries. Passwords and verification codes are never recorded.',
  ],
};
for (const [key, values] of Object.entries(dashboardCopy)) {
  dictionary.tr[key] = values[0];
  dictionary.en[key] = values[1];
}
const actionLabels = {
  'admin.login.success': 'loginSuccess',
  'admin.login.failed': 'loginFailed',
  'admin.login.rate_limited': 'loginLimited',
  'admin.logout': 'adminLogout',
  'admin.user.create': 'userCreated',
  'admin.user.delete': 'userDeleted',
  'admin.user.create_failed': 'createFailed',
  'admin.user.delete_failed': 'deleteFailed',
  'player.register': 'playerRegister',
  'player.login': 'playerLogin',
  'player.logout': 'playerLogout',
  'player.email_verified': 'playerVerify',
  'player.password_added': 'passwordAdded',
  'player.password_changed': 'passwordChanged',
  'player.password_reset': 'passwordRecovery',
  'player.google_login': 'googleLogin',
  'player.google_linked': 'googleLinked',
  'player.profile_updated': 'profileUpdated',
  'player.friend_requested': 'friendRequested',
  'player.friend_accepted': 'friendAccepted',
  'player.friend_removed': 'friendRemoved',
  'player.stone_transferred': 'stoneTransferred',
  'player.game_action': 'gameAction',
  'system.api_error': 'apiError',
};
const detailLabels = {
  provider: 'metaProvider',
  actionType: 'metaActionType',
  result: 'metaResult',
  error: 'metaError',
  status: 'metaStatus',
  amount: 'metaAmount',
  count: 'metaCount',
  accounts: 'metaAccounts',
  sessions: 'metaSessions',
  friendships: 'metaFriendships',
  transfers: 'metaTransfers',
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
let overviewVersion = 0;
let overviewData = null;
let selectedTab = 'overview';
let dialogVersion = 0;
let dialogState = null;
const lists = {
  users: {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    loaded: false,
    loading: false,
    error: '',
    version: 0,
  },
  logs: {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    loaded: false,
    loading: false,
    error: '',
    version: 0,
  },
};
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
  document.querySelector('meta[name="theme-color"]').content =
    theme === 'dark' ? '#211a16' : '#f5f2e9';
}

function translate() {
  document.documentElement.lang = language;
  document.title = language === 'tr' ? 'Bozkurt Obası · Yönetim' : 'Bozkurt Obası · Admin';
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = dictionary[language][element.dataset.i18n];
  }
  for (const element of document.querySelectorAll('[data-i18n-placeholder]'))
    element.placeholder = t(element.dataset.i18nPlaceholder);
  for (const element of document.querySelectorAll('[data-i18n-aria]'))
    element.setAttribute('aria-label', t(element.dataset.i18nAria));
  const languageButton = document.getElementById('language');
  languageButton.textContent = language === 'tr' ? 'EN' : 'TR';
  languageButton.setAttribute(
    'aria-label',
    language === 'tr' ? 'Switch to English' : 'Türkçeye geç',
  );
  message(messageKey);
  applyTheme();
  if (overviewData) renderOverview();
  for (const kind of ['users', 'logs'])
    if (lists[kind].loaded || lists[kind].loading || lists[kind].error) renderList(kind);
  if (lists.logs.loaded) renderActionFilter();
  if (dialogState) renderDialog();
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
  document.documentElement.dataset.authenticated = String(value);
  if (!value) closeDialog();
}
function discardToken() {
  authVersion += 1;
  token = '';
  sessionStorage.removeItem('bozkurt_admin_token');
  overviewData = null;
  for (const list of Object.values(lists)) {
    list.items = [];
    list.loaded = false;
    list.version += 1;
  }
  authenticated(false);
}
function failureMessage(response, data, session = false) {
  if (response.status === 503 && data.error === 'admin_unavailable') return 'unavailable';
  if (response.status === 429) return 'throttled';
  if (response.status === 401) return session ? 'denied' : 'invalid';
  if (response.status === 403) return 'forbidden';
  return (
    {
      invalid_email: 'invalidEmail',
      invalid_name: 'invalidName',
      invalid_password: 'invalidPassword',
      email_in_use: 'emailInUse',
      google_login_required: 'googleRequired',
      player_not_found: 'userNotFound',
      confirmation_required: 'confirmationRequired',
    }[data.error] || 'network'
  );
}
async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(path, {
    ...options,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
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
  const sequence = ++overviewVersion;
  try {
    const [overview, health] = await Promise.all([
      request('/api/admin/overview'),
      request('/api/health').catch(() => ({ response: { ok: false } })),
    ]);
    if (version !== authVersion || sequence !== overviewVersion) return;
    if (!overview.response.ok) {
      if (overview.response.status === 401) discardToken();
      if (overview.data.error === 'admin_unavailable') authenticated(false);
      message(failureMessage(overview.response, overview.data, true));
      return;
    }
    overviewData = overview.data;
    renderOverview();
    const healthElement = document.getElementById('health');
    healthElement.dataset.i18n = health.response.ok ? 'healthy' : 'unhealthy';
    healthElement.textContent = dictionary[language][healthElement.dataset.i18n];
    authenticated(true);
    message('');
  } catch {
    if (version === authVersion && sequence === overviewVersion) message('network');
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
});
elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  authVersion += 1;
  const version = authVersion;
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
    if (version !== authVersion) return;
    if (!response.ok || typeof data.token !== 'string' || !data.token) {
      message(failureMessage(response, data));
      return;
    }
    token = data.token;
    sessionStorage.setItem('bozkurt_admin_token', token);
    elements.form.reset();
    await refresh();
  } catch {
    if (version === authVersion) message('network');
  } finally {
    button.disabled = false;
  }
});
elements.logout.addEventListener('click', async () => {
  const pending = request('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  discardToken();
  message('');
  try {
    await pending;
  } catch {}
});
document
  .getElementById('refresh')
  .addEventListener('click', () =>
    selectedTab === 'overview' ? refresh() : loadList(selectedTab),
  );

function t(key, values = {}) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll('{' + name + '}', String(value)),
    dictionary[language][key] || key,
  );
}
function date(value) {
  if (value === null || value === undefined || value === '') return t('unknown');
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US')
    : t('unknown');
}
const number = (value) => Number(value || 0).toLocaleString(language);
function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = String(text ?? '');
  return element;
}
function actionButton(label, handler, className = 'ghost compact') {
  const button = node('button', className, t(label));
  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
}
function renderOverview() {
  const data = overviewData;
  for (const [id, value] of Object.entries({
    total: data.totalUsers ?? data.totalPlayers,
    active: data.activePlayers,
    'verified-total': data.verifiedUsers,
    'pending-total': data.pendingUsers,
    'email-total': data.emailUsers,
    'google-total': data.googleUsers,
  }))
    document.getElementById(id).textContent = number(value);
  document.getElementById('updated').textContent = t('updated') + date(data.generatedAt);
}
function failed(result) {
  if (result.response.ok) return false;
  if (result.response.status === 401) discardToken();
  if (result.data.error === 'admin_unavailable') authenticated(false);
  message(failureMessage(result.response, result.data, true));
  return true;
}
function selectTab(tab) {
  selectedTab = tab;
  for (const button of document.querySelectorAll('[data-tab]')) {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    document.getElementById('view-' + button.dataset.tab).classList.toggle('hidden', !active);
  }
  if (tab !== 'overview') loadList(tab);
}
async function loadList(kind, reset = false) {
  const list = lists[kind];
  if (reset) list.page = 1;
  const version = authVersion;
  const sequence = ++list.version;
  list.loading = true;
  list.error = '';
  renderList(kind);
  const form = document.getElementById(kind + '-filter');
  const query = new URLSearchParams({
    ...Object.fromEntries(new FormData(form)),
    page: String(list.page),
    limit: String(list.limit),
  });
  try {
    const result = await request('/api/admin/' + kind + '?' + query);
    if (version !== authVersion || sequence !== list.version || !token) return;
    if (failed(result)) {
      list.error = failureMessage(result.response, result.data, true);
      return;
    }
    if (!Array.isArray(result.data[kind])) throw new Error('Invalid list response');
    list.items = result.data[kind];
    list.total = Number(result.data.total || 0);
    list.page = Number(result.data.page || list.page);
    list.limit = Number(result.data.limit || list.limit);
    list.loaded = true;
    message('');
    if (kind === 'logs') renderActionFilter();
  } catch {
    if (version === authVersion && sequence === list.version) list.error = 'network';
  } finally {
    if (version === authVersion && sequence === list.version) {
      list.loading = false;
      renderList(kind);
    }
  }
}
function cell(label, content) {
  const td = node('td');
  td.dataset.label = t(label);
  td.append(content);
  return td;
}
function providerLabel(user) {
  return (
    (user.providers || [])
      .map((value) => (value === 'google' ? 'Google' : t('emailMethod')))
      .join(' + ') || t('unknown')
  );
}
function renderList(kind) {
  const list = lists[kind];
  const state = document.getElementById(kind + '-state');
  state.textContent = list.loading
    ? t('loading')
    : list.error
      ? t(list.error)
      : list.items.length
        ? ''
        : t(kind === 'users' ? 'noUsers' : 'noLogs');
  const tbody = document.getElementById(kind + '-list');
  tbody.replaceChildren();
  if (kind === 'users') {
    for (const user of list.items) {
      const row = node('tr');
      const identity = node('div', 'identity');
      identity.append(
        node('strong', '', user.nickname || user.fullName),
        node('span', '', user.email),
        node('code', '', user.userCode),
      );
      row.append(
        cell('player', identity),
        cell('registeredAt', node('span', '', date(user.createdAt))),
        cell('loginMethod', node('span', 'provider', providerLabel(user))),
        cell(
          'verification',
          node(
            'span',
            'badge ' + (user.verified ? 'verified' : 'pending'),
            t(user.verified ? 'verified' : 'pending'),
          ),
        ),
        cell('lastActive', node('span', '', date(user.lastActiveAt))),
        cell(
          'actions',
          actionButton('details', () => openDetails(user.id)),
        ),
      );
      tbody.append(row);
    }
  } else {
    for (const entry of list.items) {
      const row = node('tr');
      const action = node('div', 'log-action');
      const level = ['info', 'warning', 'error'].includes(entry.level) ? entry.level : 'info';
      action.append(
        node(
          'strong',
          '',
          actionLabels[entry.action] ? t(actionLabels[entry.action]) : entry.action,
        ),
        node('span', 'badge ' + level, t(level)),
      );
      const actor = node('div', 'identity');
      actor.append(
        node(
          'strong',
          '',
          entry.actor ||
            t(
              entry.actorType === 'admin'
                ? 'adminActor'
                : entry.actorType === 'player'
                  ? 'playerActor'
                  : 'systemActor',
            ),
        ),
      );
      const metadata = node('dl', 'metadata');
      for (const [key, value] of Object.entries(entry.details || {})) {
        if (typeof value === 'object' && value !== null) continue;
        const label = detailLabels[key] ? t(detailLabels[key]) : key;
        const display = key === 'provider' && value === 'email' ? t('emailMethod') : value;
        metadata.append(node('dt', '', label), node('dd', '', display));
      }
      if (!metadata.childElementCount) metadata.append(node('span', 'muted', '—'));
      row.append(
        cell('date', node('span', '', date(entry.createdAt))),
        cell('logAction', action),
        cell('actor', actor),
        cell('target', node('span', '', entry.targetLabel || '—')),
        cell('details', metadata),
      );
      tbody.append(row);
    }
  }
  const pages = Math.max(1, Math.ceil(list.total / list.limit));
  document.getElementById(kind + '-page').textContent = t('pageSummary', {
    total: number(list.total),
    page: number(list.page),
    pages: number(pages),
  });
  document.getElementById(kind + '-prev').disabled = list.loading || list.page <= 1;
  document.getElementById(kind + '-next').disabled = list.loading || list.page >= pages;
}
function renderActionFilter() {
  const select = document.getElementById('logs-action');
  const value = select.value;
  select.replaceChildren();
  const all = node('option', '', t('all'));
  all.value = '';
  select.append(all);
  const actions = new Set([
    ...Object.keys(actionLabels),
    ...lists.logs.items.map((entry) => entry.action),
  ]);
  if (value) actions.add(value);
  for (const action of actions) {
    const option = node('option', '', actionLabels[action] ? t(actionLabels[action]) : action);
    option.value = action;
    select.append(option);
  }
  select.value = value;
}
function closeDialog() {
  dialogVersion += 1;
  const dialog = document.getElementById('admin-dialog');
  if (dialog.open) dialog.close();
  if (dialogState) document.getElementById('dialog-content').replaceChildren();
  dialogState = null;
}
function showDialog(state) {
  closeDialog();
  dialogState = state;
  renderDialog();
  const dialog = document.getElementById('admin-dialog');
  dialog.showModal();
  (
    document.getElementById('dialog-content').querySelector('input, button') ||
    document.getElementById('dialog-close')
  ).focus();
}
async function openDetails(id) {
  showDialog({ type: 'details', id, data: null, error: '', busy: false });
  const version = authVersion;
  const sequence = dialogVersion;
  try {
    const result = await request('/api/admin/users/' + encodeURIComponent(id));
    if (version !== authVersion || sequence !== dialogVersion || !dialogState) return;
    if (failed(result)) {
      if (dialogState) dialogState.error = failureMessage(result.response, result.data, true);
    } else {
      if (!result.data.user) throw new Error('Invalid user response');
      dialogState.data = result.data.user;
    }
  } catch {
    if (version === authVersion && sequence === dialogVersion && dialogState)
      dialogState.error = 'network';
  }
  if (version === authVersion && sequence === dialogVersion && dialogState) renderDialog();
}
function field(label, value) {
  const group = node('div', 'detail-field');
  group.append(node('dt', '', t(label)), node('dd', '', value));
  return group;
}
function inputField(form, label, name, type = 'text', value = '') {
  const wrapper = node('label', 'form-field', t(label));
  const input = node('input');
  input.name = name;
  input.type = type;
  input.value = value || '';
  input.required = true;
  wrapper.append(input);
  form.append(wrapper);
  return input;
}
function renderDialog() {
  const state = dialogState;
  const content = document.getElementById('dialog-content');
  const values = state.values || {};
  const existingForm = content.querySelector('form');
  if (existingForm) for (const [key, value] of new FormData(existingForm)) values[key] = value;
  state.values = values;
  content.replaceChildren();
  document.getElementById('dialog-title').textContent = t(
    state.type === 'create' ? 'addUser' : state.type === 'delete' ? 'deleteTitle' : 'details',
  );
  const error = document.getElementById('dialog-message');
  error.textContent = state.error ? t(state.error) : '';
  error.classList.toggle('hidden', !state.error);
  document.getElementById('dialog-close').disabled = state.busy;
  if (state.type === 'details') {
    if (!state.data) {
      content.append(node('p', 'muted', state.error ? '' : t('loading')));
      return;
    }
    const user = state.data;
    const details = node('dl', 'detail-grid');
    for (const [key, value] of [
      ['fullName', user.fullName],
      ['nickname', user.nickname],
      ['email', user.email],
      ['userCode', user.userCode],
      ['registeredAt', date(user.createdAt)],
      ['lastLogin', date(user.lastLoginAt)],
      ['lastActive', date(user.lastActiveAt)],
      ['loginMethod', providerLabel(user)],
      ['verification', t(user.verified ? 'verified' : 'pending')],
      ['activeSessions', number(user.activeSessions)],
    ])
      details.append(field(key, value || '—'));
    content.append(details, node('h3', '', t('villages')));
    for (const village of user.villages || []) {
      const card = node('article', 'village-summary');
      card.append(node('strong', '', village.provider === 'google' ? 'Google' : t('emailMethod')));
      const stats = node('dl', 'detail-grid');
      const herd =
        typeof village.herd === 'object' && village.herd ? village.herd.count : village.herd;
      const wolves = Array.isArray(village.wolves) ? village.wolves.length : village.wolves;
      stats.append(
        field('wave', number(village.wave)),
        field('herd', number(herd)),
        field('wolves', number(wolves)),
      );
      for (const [key, value] of Object.entries(village.resources || {}))
        stats.append(field(key, number(value)));
      card.append(stats);
      content.append(card);
    }
    if (!(user.villages || []).length) content.append(node('p', 'muted', t('noVillage')));
    content.append(node('h3', '', t('sessions')));
    for (const session of user.sessions || [])
      content.append(
        node(
          'p',
          'session-record',
          (session.provider === 'google' ? 'Google' : t('emailMethod')) +
            ' · ' +
            t('registeredAt') +
            ': ' +
            date(session.createdAt) +
            ' · ' +
            t('lastActive') +
            ': ' +
            date(session.updatedAt) +
            ' · ' +
            t('expiresAt') +
            ': ' +
            date(session.expiresAt),
        ),
      );
    if (!(user.sessions || []).length) content.append(node('p', 'muted', t('noSessions')));
    const actions = node('div', 'dialog-actions');
    actions.append(
      actionButton(
        'deleteUser',
        () => showDialog({ type: 'delete', data: user, error: '', busy: false }),
        'danger',
      ),
    );
    content.append(actions);
    return;
  }
  const form = node('form', 'dialog-form');
  if (state.type === 'create') {
    content.append(node('p', 'dialog-note', t('createHint')));
    const name = inputField(form, 'fullName', 'name', 'text', values.name);
    name.minLength = 1;
    name.maxLength = 60;
    name.autocomplete = 'off';
    const email = inputField(form, 'email', 'email', 'email', values.email);
    email.maxLength = 254;
    email.autocomplete = 'off';
    const password = inputField(form, 'newPassword', 'password', 'password', values.password);
    password.minLength = 12;
    password.maxLength = 128;
    password.autocomplete = 'new-password';
    form.append(node('p', 'field-hint', t('passwordHint')));
  } else {
    const user = state.data;
    content.append(node('p', 'destructive-note', t('deleteHint')));
    const target = node('div', 'delete-target');
    target.append(
      node('strong', '', user.fullName || user.nickname),
      node('span', '', user.email),
      node('code', '', user.userCode),
    );
    content.append(target, node('p', 'dialog-note', t('deleteCodeHint')));
    const confirmation = inputField(
      form,
      'confirmCode',
      'confirmation',
      'text',
      values.confirmation,
    );
    confirmation.autocomplete = 'off';
    confirmation.spellcheck = false;
  }
  form.addEventListener('submit', (event) => submitMutation(event, state));
  const actions = node('div', 'dialog-actions');
  const submit = node(
    'button',
    state.type === 'delete' ? 'danger' : 'primary',
    t(state.busy ? 'saving' : state.type === 'delete' ? 'deleteUser' : 'createAccount'),
  );
  submit.type = 'submit';
  submit.disabled =
    state.busy || (state.type === 'delete' && values.confirmation !== state.data.userCode);
  if (state.type === 'delete')
    form.elements.namedItem('confirmation').addEventListener('input', (event) => {
      submit.disabled = state.busy || event.target.value !== state.data.userCode;
    });
  const cancel = actionButton('cancel', closeDialog);
  cancel.disabled = state.busy;
  for (const input of form.querySelectorAll('input')) input.disabled = state.busy;
  actions.append(cancel, submit);
  form.append(actions);
  content.append(form);
}
async function submitMutation(event, state) {
  event.preventDefault();
  if (state.busy || dialogState !== state) return;
  const body = Object.fromEntries(new FormData(event.currentTarget));
  if (state.type === 'delete' && body.confirmation !== state.data.userCode) {
    state.error = 'confirmationRequired';
    renderDialog();
    return;
  }
  const version = authVersion;
  const sequence = dialogVersion;
  state.values = body;
  state.busy = true;
  state.error = '';
  renderDialog();
  try {
    const result = await request(
      '/api/admin/users' + (state.type === 'delete' ? '/' + encodeURIComponent(state.data.id) : ''),
      {
        method: state.type === 'delete' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (version !== authVersion || sequence !== dialogVersion || dialogState !== state) return;
    if (failed(result)) {
      if (dialogState === state) state.error = failureMessage(result.response, result.data, true);
      return;
    }
    closeDialog();
    await Promise.all([refresh(), loadList('users', state.type === 'create')]);
    if (version === authVersion) message(state.type === 'delete' ? 'deleted' : 'created');
  } catch {
    if (version === authVersion && sequence === dialogVersion && dialogState === state)
      state.error = 'network';
  } finally {
    if (version === authVersion && sequence === dialogVersion && dialogState === state) {
      state.busy = false;
      renderDialog();
    }
  }
}
for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', () => selectTab(button.dataset.tab));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = ['overview', 'users', 'logs'];
    const index = tabs.indexOf(selectedTab);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 2
          : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
    selectTab(tabs[next]);
    document.getElementById('tab-' + tabs[next]).focus();
  });
}
for (const kind of ['users', 'logs']) {
  document.getElementById(kind + '-filter').addEventListener('submit', (event) => {
    event.preventDefault();
    loadList(kind, true);
  });
  document.getElementById(kind + '-prev').addEventListener('click', () => {
    if (!lists[kind].loading && lists[kind].page > 1) {
      lists[kind].page -= 1;
      loadList(kind);
    }
  });
  document.getElementById(kind + '-next').addEventListener('click', () => {
    if (!lists[kind].loading && lists[kind].page * lists[kind].limit < lists[kind].total) {
      lists[kind].page += 1;
      loadList(kind);
    }
  });
}
document
  .getElementById('add-user')
  .addEventListener('click', () => showDialog({ type: 'create', busy: false, error: '' }));
document.getElementById('dialog-close').addEventListener('click', closeDialog);
document.getElementById('admin-dialog').addEventListener('cancel', (event) => {
  if (dialogState?.busy) event.preventDefault();
  else closeDialog();
});
translate();
authenticated(false);
if (token) refresh();
else checkConfiguration();
