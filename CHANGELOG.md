# Sürüm geçmişi / Changelog

Sürüm kayıtları [`releases.json`](releases.json) ile aynı içeriktedir; oyun içindeki **Sürüm geçmişi / Release history** bölümü bu kaynaktan beslenir. Yeni bir iş tamamlandığında sürümü, iki dilde değişiklikleri, doğrulamayı, README satır sayısını ve temiz kaynak ZIP'ini birlikte güncelleyin.

Release entries match [`releases.json`](releases.json); the in-game **Release history** reads that file. After each completed update, advance the version and update both languages, validation, README line count, and clean source ZIP together.

## v1.8.1 — 2026-10-07

**TR**

- Admin ve analiz girişinde eksik yönetici ayarı, bağlantı hatası, yanlış parola ve deneme sınırı ayrı TR/EN mesajlarıyla gösterilir; API kesintisi geçerli oturumu silmez.
- Analiz yönetici doğrulaması varsayılan olarak dahili API üzerinden çalışır; web/admin ağ geçitleri API yeniden oluşturulduğunda Docker DNS bilgisini yeniler.
- Dokploy admin:3000 port eşlemesi ve API ortamı tanısı belgelenir; giriş ve API IP değişimi senaryoları CI testlerine eklenir.
- Mevcut ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD ortam adları API yönetici hesabına aktarılır; ADMIN_EMAIL/ADMIN_PASSWORD önceliği ve en az 12 karakter kuralı korunur.

**EN**

- Admin and analytics sign-in distinguish missing administrator configuration, transport failures, invalid credentials and rate limits in TR/EN; API outages preserve valid sessions.
- Analytics administrator authentication defaults to the internal API; web/admin gateways refresh Docker DNS after API container replacement.
- Document the Dokploy admin:3000 domain mapping and safe API environment diagnostics; add sign-in and API IP replacement regression checks to CI.
- Existing ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD environment names configure the API administrator; ADMIN_EMAIL/ADMIN_PASSWORD precedence and the 12-character minimum remain enforced.

## v1.8.0 — 2026-10-06

**TR**

- Savaş meydanında kurt, çakal, koyun ve büyükbaşlar doğal anatomi ve kürke sahip gerçekçi, saydam WebP görsellerine kavuştu.
- Hilal/yıldız yerleşimi, karşı tarafa bakan hayvanlar, seçim, can göstergeleri ve hareketler korundu; TR/EN ve tema destekli çevrimdışı savaş önizlemesi eklendi.

**EN**

- Battlefield wolves, jackals, sheep and cows now use realistic transparent WebP cutouts with natural anatomy and fur.
- Crescent/star placement, opponent-facing animals, selection, health bars and animations are preserved, with a bilingual themed offline battle preview.

## v1.7.0 — 2026-10-06

**TR**

- Şifremi unuttum: görselli e-posta koduyla şifre yenileme, tüm cihaz oturumlarını kapatma ve aynı köyü koruma.

**EN**

- Forgot password: illustrated email codes reset credentials, revoke every device session and preserve the same village.

## v1.6.0 — 2026-10-06

**TR**

- Profil: sabit e-posta ve ad soyad, düzenlenebilir takma ad ve özel fotoğraf önceliği; logo oturumlu oyuncuyu Ana Yurt'a açar.
- Görselli HTML e-posta, 15 dakikalık doğrulama kodu ve doğrulanmadan oyun/API erişiminin kapatılması.
- Kalıcı oyuncu kodları, kabul edilen arkadaşlık istekleri ve tekrar göndermeye dayanıklı atomik maden transferi.

**EN**

- Profiles keep email and full name immutable, allow nickname/photo edits, preserve custom photo priority, and route signed-in logo clicks to the homeland.
- Illustrated HTML mail and 15-minute verification codes gate gameplay and player APIs until confirmation.
- Permanent player codes, accepted friendships, and idempotent atomic stone gifts between villages.

## v1.5.0 — 2026-10-05

**TR**

- Hilal ve bozkurt simgeli yeni SVG logo; mobil, açık/koyu tema ve tarayıcı simgesi uyumu.
- Köyde ilerlemeyi izleyen beş aşamalı İlk adımlar rehberi; mevcut kayıtlar korunur.
- Tam Google Drive yedeği, doğrulama ve son 30 yedeği saklama akışı; temiz GitHub ZIP teslimi sürer.

**EN**

- New crescent-and-wolf SVG identity with responsive layouts, light/dark themes and a browser icon.
- A five-step village guide follows saved progress without changing existing saves.
- Full Google Drive backups with verification and 30-backup retention alongside clean GitHub source archives.

## v1.4.0 — 2026-10-01

**TR**

- Hostinger SMTP ile info@bozkurtobasi.com göndereninden e-posta doğrulaması ve hesap ekranında yeniden gönderim eklendi.
- Tek kullanımlık bağlantı bir saat geçerli; belirteç erişim kayıtlarına gitmez ve SMTP parolası olmayan kurulumlarda oyun çalışır.

**EN**

- Added email verification from info@bozkurtobasi.com through Hostinger SMTP, with resend from the account screen.
- Single-use links expire after one hour; tokens avoid access logs and gameplay remains available without an SMTP password.

## v1.3.0 — 2026-09-30

**TR**

- Google girişine ek olarak e-posta ve şifreyle kayıt ve giriş eklendi; ana sayfada Kayıt ol ve Giriş yap düğmeleri bulunur.
- Hesaba bağlı köyler sunucuda saklanır; güvenli parola özetleri ve yenilenen oturum çerezleriyle cihazlar arasında ilerlemeye devam edilir.
- Kayıt ve giriş pencereleri Türkçe/İngilizce, açık/koyu tema ve mobil kullanımı destekler; aynı e-postaya ait Google ve şifre girişleri sahiplik doğrulamasıyla tek hesaba ve köye bağlanır.

**EN**

- Email/password registration and sign-in are available alongside Google, with Register and Sign in buttons on the homepage.
- Account villages persist on the server; salted password hashes and rotated session cookies support resuming progress across devices.
- Registration and sign-in dialogs support Turkish/English, light/dark mode and mobile layouts; Google and password sign-in for the same email link to one account and village after ownership verification.

## v1.2.5 — 2026-09-29

**TR**

- Koyu tema ana sayfa, oyun, yönetim ve analiz ekranlarında sıcak kahverengi ve toprak tonlarına taşındı; vurgu alanlarında bozkır yeşili kullanılıyor.
- Krem metinler, altın vurgular ve uyumlu kart, düğme, bildirim ve pencere renkleriyle okunabilirlik iyileştirildi; açık tema ve ana görsel ölçüleri korundu.

**EN**

- Dark mode now uses warm brown and earth tones across the homepage, game, admin and analytics screens, with steppe green accents.
- Cream text, gold highlights and coordinated cards, buttons, notices and dialogs improve readability; light mode and hero image dimensions remain unchanged.

## v1.2.4 — 2026-09-28

**TR**

- Ana sayfa görselinde beş muhafız kurt, obanın önünde sürüyü hilal düzeninde koruyacak şekilde yerleştirildi; yüzleri çakallara dönük kaldı.
- Dağlar, göl, gün batımı ve oba arka planı korundu; görselin 1672×941 ölçüsü, TR/EN eşit boyutları ve ilk ekrandaki Google girişi değişmedi.

**EN**

- Repositioned five guardian wolves in the homepage artwork into a crescent in front of the camp, protecting the herd and facing the jackals.
- Preserved the mountains, lake, sunset and camp background; retained the 1672×941 artwork size, equal TR/EN layout and first-screen Google sign-in.

## v1.2.3 — 2026-09-28

**TR**

- Ana sayfa, gizlilik ve koşullar sayfalarının alt bilgilerindeki MIT etiketi kaldırıldı; alt bilgi artık © 2026 Bozkurt Obası şeklindedir.

**EN**

- Removed the MIT label from the homepage, privacy and terms page footers; the footer now reads © 2026 Bozkurt Obası.

## v1.2.2 — 2026-09-28

**TR**

- main güncellemelerinde başarılı test ve dört servis kontrolünden sonra otomatik Git etiketi ve TR/EN GitHub Release yayını eklendi.
- Sürümler temiz kaynak ZIP, SHA-256 ve görsel index.html ile teslim edilir; güncel sürüm README ve GitHub Releases bölümünde görünür.
- Tek komutla sürüm kayıtlarını birlikte ilerleten araç, sürüm artışını zorunlu tutan CI kontrolü ve güvenli tekrar yayın desteği eklendi.
- GitHub About açıklaması, site bağlantısı ve proje konuları eklendi; görünür sayfa alt bilgilerindeki kişi adı kaldırıldı.
- Ana sayfa görseli TR/EN dil değişiminde aynı ölçüde kalır ve masaüstünde ilk ekrana sığar; sayfa sonundaki tekrarlanan Google girişi kaldırıldı.

**EN**

- Added automatic Git tags and TR/EN GitHub Releases after successful tests and four-service checks on main updates.
- Releases include a clean source ZIP, SHA-256 and visual index.html; the current version appears in README and GitHub Releases.
- Added one-command version updates, a CI version-increase requirement and safe publishing retries.
- Added the GitHub About description, website link and project topics; removed the personal name from visible page footers.
- Homepage artwork keeps the same size across TR/EN and fits the first desktop screen; removed the repeated Google sign-in at the bottom of the page.

## v1.2.1 — 2026-09-28

**TR**

- Oyun API'sinde oturumsuz erişim engeli ve çıkış sırasında geciken yanıtlar test edildi; analiz oturum çözümlemesini bekler.
- Ana sayfa görseli, sahne bütünüyle görünür olacak şekilde ana görsel alanına yayıldı.
- Üst menüdeki **Obaya gir** düğmesi kaldırıldı. Köy ve diğer oyun ekranları, doğrudan URL ile açıldığında da geçerli Google oturumu gerektirir.
- Google istemcisi yapılandırılmadan oyun açılmaz; çevrimdışı `preview/index.html` yalnızca görsel ana sayfa önizlemesi sunar.

**EN**

- Tested unauthenticated game API denial and delayed responses after logout; analytics waits for session resolution.
- Expanded the homepage artwork across the hero area so the entire scene remains visible.
- Removed the header **Enter village** button. The village and other game screens now require a valid Google session, including direct URL visits.
- Game access remains closed until the Google client is configured; offline `preview/index.html` provides a visual homepage preview only.

## v1.2.0 — 2026-09-27

**TR**

- Kurtların ve sürünün çakallara baktığı özgün görselle desteklenen ana sayfa, hikâye ve oyuna hızlı giriş eklendi.
- Google ile güvenli giriş, mevcut sunucu misafir köyünü hesaba bağlama, cihazlar arası sürdürme ve çıkış eklendi. Google anahtarları yalnızca sunucu ortamında tutulur.
- Türkçe/İngilizce gizlilik bildirimi ve kullanım koşulları; Google Cloud ve Dokploy kurulum rehberi eklendi.
- Trafik analizinde ana sayfa ölçümü eklendi ve IP konum çözümlemesindeki şifresiz HTTP yedeği kaldırıldı.

**EN**

- Added a visual homepage with original artwork showing the wolves and herd facing the jackals, a story section, and direct game entry.
- Added secure Google sign-in, linking of an existing server guest village, cross-device progress, and sign-out. Google credentials remain server-side.
- Added Turkish/English privacy notice and terms, plus Google Cloud and Dokploy setup guidance.
- Added homepage analytics and removed the plaintext HTTP fallback for IP geolocation.

## v1.1.0 — 2026-09-26

**TR**

- Oyun, yönetim ve analiz ekranları için açık/koyu tema seçimi eklendi.
- Oyun içine güncel sürümü gösteren Türkçe/İngilizce sürüm geçmişi eklendi.
- Kaynak görüntüsünde © 2026 Emin DEMİRCİ ve MIT lisans bildirimi görünür hale getirildi. MIT, telif ve lisans bildirimi korunduğu sürece kullanım, değiştirme ve dağıtıma izin verir; bu koşula uymayan kullanım hak ihlaline yol açabilir.
- Dört servisli Dokploy için paylaşılabilir, sır içermeyen üretim ortamı örneği ve dağıtım açıklamaları eklendi.

**EN**

- Added light/dark theme selection across the game, admin, and analytics screens.
- Added an in-game Turkish/English release history showing the current version.
- Made the © 2026 Emin DEMİRCİ and MIT license notice visible in page source. MIT permits use, modification, and redistribution when the copyright and license notice are preserved; use outside those terms may infringe rights.
- Added a shareable, secret-free production environment example and deployment guidance for the four-service Dokploy stack.

## v1.0.0 — 2026-09-25

**TR**

- Oynanabilir tarayıcı köy kurma, üretim, kurt muhafızları ve sürü savunması.
- Hareketli savaş sahnesi ve savaş başladığında beş seçenekten rastgele gelen çakal taktiği.
- Tek Compose içinde `web`, `api`, `admin` ve kullanıcının Analyze Your Site kaynağından uyarlanan `analyze`.
- Türkçe/İngilizce arayüz, çevrimdışı oynanabilir index, testler, MIT lisansı ve kaynak ZIP'i.

**EN**

- Playable browser village builder with production, wolf guardians, and herd defense.
- Animated battle scene and one of five randomly selected jackal tactics at battle start.
- One Compose stack for `web`, `api`, `admin`, and `analyze`, adapted from the user's Analyze Your Site source.
- Turkish/English interface, playable offline index, tests, MIT license, and source ZIP.
