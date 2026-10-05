# Bozkurt Obası · doğrulama / Validation

Tarih / Date: 2026-10-05. Sürüm / Release: **v1.5.0**. Windows, Node.js 24, Docker Desktop, Playwright Chromium, Windows PowerShell 5.1.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| Kaynak ve çeviriler / Source and translations | 46 JavaScript dosyası, 289 eşleşen TR/EN anahtar / files and matching keys |
| Motor, hesap, SMTP ve sürüm / Engine, account, SMTP and release | 99/99 geçti / passed |
| Tarayıcı / Browser | 34/34 geçti / passed; hesaplar, giriş kapısı, rehber, oyun, TR/EN, temalar ve mobil / accounts, sign-in gate, guide, gameplay, languages, themes and mobile |
| Tam yedek / Full backup | PowerShell 5.1 çevrimdışı entegrasyon: 12/12 geçti / offline integration passed |
| Üretim ve tek dosya / Production and standalone | Geçti; `preview/index.html` ve gömülü favicon güncel / passed with updated preview and embedded favicon |
| Logo ve yerel servis / Logo and local service | 320px TR/EN taşma yok; SVG favicon HTTP 200; yerel v1.5.0 / no overflow; local version verified |
| Biçim ve diff / Formatting and diff | `npm run format:check`, `git diff --check` geçti / passed |
| Sürüm artışı / Version increase | v1.4.0 → v1.5.0; paket, kilit, README, CHANGELOG ve geçmiş eşleşiyor / version records agree |
| Dört servis / Four services | `web`, `api`, `admin`, `analyze` derlemeleri ve yerel sağlık kontrolleri geçti / builds and local health passed |
| Kaynak sayımı / Source count | 159 dosya, 29.845 fiziksel satır; 19.647 aktif web satırı / files, physical lines, active web lines |

## Türkçe

Yeni SVG logo, ana sayfa ve oyun menüsüne uygulandı. 320px TR/EN görünümü yatay taşma yapmadı; açık/koyu tema, favicon yanıtı ve yerel v1.5.0 kontrol edildi. Tek dosyalık önizleme favicon dahil yerel dosyaları kendi içinde taşır.

İlk adımlar rehberi gerçek komutlarla toplama, inşa, ödülü alma, iki eğitim ve ilk zaferi izler. Testler eski/sıra dışı ilerlemeyi, yenilgiyi, beş başlangıç savaş taktiğini, kaynak harcamayan yönlendirmeleri, klavye odağını, yenileme ve mobil görünümü kapsar.

PowerShell 5.1 teslim testleri geçici yerel depolarla varsayılan akışı, seçilen indexi, yayımlanmış HEAD'i, tüm gizli/ignore edilmiş dosyaları ve boş klasörleri doğrular. Silinmiş hassas commitler, yeniden adlandırma, başarısız push, kilitli kaynak, bozuk ZIP içeriği, son 30 sınırı ve junction hata davranışı kontrol edildi. Gerçek sırlar testlerde kullanılmadı. Tam Drive ZIP'i yalnızca içerik SHA-256 doğrulaması sonrasında yayımlanır. Bulut eşitleme durumu ve repo dışındaki canlı volume yedekleri bu kaynak arşiviyle doğrulanmaz.

SMTP etkinse kayıt sonrası `info@bozkurtobasi.com` göndereninden bir saatlik, tek kullanımlık doğrulama bağlantısı gönderilir. Hesap ekranındaki yeniden gönderim, oturum ve aynı kaynak denetimiyle korunur. Belirteç SQLite içinde yalnızca SHA-256 özeti olarak tutulur; bağlantıda URL parçasındadır ve HTTP istek adresine gitmez. Başarısız gönderim mevcut çalışan bağlantıyı bozmaz veya günlük başarılı gönderim kotasını tüketmez. Yavaş SMTP için kayıt yanıtı beş saniyelik gönderim üst sınırından sonra başarıyla döner; e-posta teslim edilememişse doğrulama gönderildi iddiası gösterilmez. Gönderen adresi sabittir; `MAIL_FROM` yalnızca güvenli görünen adı seçer.

Testlerde gerçek Hostinger hesabı yerine bellekteki posta göndericisi kullanıldı; canlı SMTP teslimatı ve VPS/Dokploy dağıtımı bu kayıtla doğrulanmış sayılmaz. Yerel Compose ortamında `SMTP_PASSWORD` boş ve `mailEnabled=false`; oyuncu kaydı/girişi ile dört servis sağlığı çalışır. `ADMIN_PASSWORD` yerelde boş olduğundan yönetim/analiz girişi burada denenmedi; yönetici API testleri test parolasıyla geçti. Yönetici girişi `ADMIN_EMAIL` ve `ADMIN_PASSWORD` ortam değişkenlerine bağlıdır, seed veritabanı hesabı yoktur.

Google ile aynı e-postanın eşleştirilmesi önceki sahiplik kanıtı ve köy koruma testleriyle geçti. Otomatik parola sıfırlama bu sürüme dahil değildir. Temiz kaynak ZIP'i Git projesindeki dosyalarla üretilir; kişisel takip edilmeyen dosyalar, sırlar, veritabanları ve bağımlılıklar dışarıda kalır. Canlı SMTP için parolayı yalnızca Dokploy Environment bölümüne girip [dağıtım rehberindeki](WEB-DEPLOYMENT.md) adımları uygulayın.

## English

The new SVG identity is applied to the homepage and game menu. TR/EN at 320px produced no horizontal overflow; light/dark themes, favicon response and local v1.5.0 were checked. The standalone preview embeds its favicon and assets.

First steps follows real gathering, construction, reward claim, two training actions and an initial victory. Tests cover old/out-of-order progress, defeat, all five initial combat tactics, navigation without spending, keyboard focus, reload and mobile layouts.

PowerShell 5.1 delivery tests use disposable local repositories to verify default/staged-only/backup-only flows and complete hidden/ignored files and empty directories. They cover deleted sensitive commits, renames, rejected pushes, locked source files, corrupted ZIP content, exact 30-backup retention and junction errors. Tests use no real secrets. Full Drive ZIPs are published after per-file SHA-256 validation. Cloud synchronization and live volumes outside this repo are not established by this source archive.

When SMTP is enabled, registration sends a one-hour, single-use verification link from `info@bozkurtobasi.com`. Resend from the account screen requires a session and same-origin request. SQLite stores only the SHA-256 token digest; the link places the token in a URL fragment so it does not reach the HTTP request URL. A failed resend keeps a previously delivered link usable and does not consume the daily successful-send quota. A five-second delivery bound prevents slow SMTP from holding a completed registration; the UI does not claim mail was sent when delivery failed. The From address is fixed and `MAIL_FROM` controls only a validated display name.

Tests use an in-memory sender rather than a real Hostinger mailbox; this record does not establish live SMTP delivery or a VPS/Dokploy deployment. Local Compose leaves `SMTP_PASSWORD` empty and reports `mailEnabled=false`, while player sign-in and all four services remain healthy. Local `ADMIN_PASSWORD` is unset, so admin/analytics login was not exercised in the local stack; admin API tests passed with a test password. Admin access uses the `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment values, without a seeded database account.

Matching Google/email methods passed the existing ownership-proof and village-preservation tests. Automatic password recovery is not included. The clean source ZIP contains Git project files and excludes personal untracked files, secrets, databases and dependencies. Put the real SMTP password only in Dokploy Environment and follow the [deployment guide](WEB-DEPLOYMENT.md) for a live delivery check.
