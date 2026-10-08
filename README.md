# Bozkurt Obası: Ay-Yıldız Nöbeti

**TR:** “Obanı kur, sürünü koru.” Tarayıcıda oynanabilen köy kurma ve sürü savunma oyunu. Kurtlar ve sürü savaşta çakallara bakar. Ana sayfa görselinde beş kurt, obanın önünde sürüyü doğal bir hilal düzeninde korur; dağlar, göl ve gün batımı arka planı korunur.

**EN:** “Build your village. Guard your herd.” A browser village builder and herd defense game. Wolves and the herd face the jackals in battle. The homepage artwork shows five wolves guarding the herd in a natural crescent in front of the camp, retaining the mountain, lake and sunset background.

[Görsel düzenleme kaydı ve tam istem / Artwork edit record and exact prompt](docs/HERO-ART.md)

[Gerçekçi savaş hayvanları ve tam istemler / Realistic battle animals and exact prompts](docs/BATTLE-ART.md) · [Çevrimdışı savaş görseli / Offline battlefield preview](preview/battle.html)

**Güncel sürüm / Current version: v1.8.3** · [GitHub Releases](https://github.com/emindemirciai/Bozkurt-Obasi/releases/latest) · [Sürüm geçmişi / Changelog](CHANGELOG.md) · [Sürüm oluşturma / Releasing](docs/RELEASING.md)

[Çevrimdışı görsel önizleme / Offline visual preview](preview/index.html) · [Dokploy rehberi / Deployment guide](docs/WEB-DEPLOYMENT.md) · [Hesap kaydı / Account registration](docs/ACCOUNT-SIGNIN.md) · [Görselli mail önizlemesi / Email preview](preview/mail.html) · [Şifre yenileme maili / Password reset email](preview/password-reset.html) · [Google girişi / Google sign-in](docs/GOOGLE-SIGNIN.md) · [Gizlilik / Privacy](public/privacy.html) · [Koşullar / Terms](public/terms.html) · [Doğrulama / Validation](docs/WEB-VALIDATION.md) · [Kaynak depo / Repository](https://github.com/emindemirciai/Bozkurt-Obasi)

## Türkçe

GitHub About bölümü oyun açıklamasını, `https://bozkurtobasi.com` site bağlantısını ve proje konularını içerir. Görünür sayfa alt bilgisi `© 2026 Bozkurt Obası` şeklindedir. Ana görsel alanı TR/EN'de aynı ölçüyü kullanır, masaüstünde ilk ekrana sığar ve Google girişi burada görünür; sayfa sonunda tekrar giriş düğmesi yoktur.

### Her tamamlanan iş için sürüm

`npm run release:version -- patch --tr "Türkçe değişiklik notu" --en "English change note"` komutu paket sürümünü, kilit dosyasını, oyun içi sürüm geçmişini, CHANGELOG ve README'yi birlikte ilerletir. Yeni özellikler için `minor`, uyumsuz değişiklikler için `major` kullanın. Sürüm ve notlar commit'e dahildir. `main` dalına birleşme veya push sonrasında testler ve dört servis kontrolü geçerse GitHub Actions otomatik olarak `vX.Y.Z` etiketi ve CHANGELOG'daki TR/EN notlarla Release oluşturur; temiz kaynak ZIP'i, SHA-256 ve görsel `index.html` sürüme eklenir. CI, sürümün önceki `main` kaydından ilerlemesini zorunlu tutar. [Sürüm rehberi](docs/RELEASING.md).

### Ana sayfayı önizle ve oyuna giriş yap

Savaş meydanındaki kurt, çakal, koyun ve büyükbaşlar gerçekçi saydam görsellerle çizilir. Dört WebP dosyası toplam yaklaşık 193 KiB'dir; kurtlar ve sürü çakallara bakar. [`preview/battle.html`](preview/battle.html), gerçek savaş sahnesinin tek dosyalık görsel önizlemesidir: TR/EN, açık/kahverengi koyu tema, yakınlaştırma ve görsel hareket kontrolleri internet olmadan kullanılabilir. Oyuncu hesabına veya oyun kaydına erişmez. `npm run build:preview` iki görsel önizlemeyi de yeniler.

[`preview/index.html`](preview/index.html) dosyasını indirip tarayıcıda açın; internet veya sunucu gerektirmeyen, tek dosyalık **görsel ana sayfa önizlemesidir**. Oyun ekranları bu dosyada açılmaz. GitHub dosya görüntüleyicisi etkileşimli önizlemeyi çalıştırmaz. Node.js 24 ile yerel API ve kalıcı SQLite kullanmak için:

```bash
npm ci
npm run build
npm start
```

Ardından <http://127.0.0.1:3000> adresini açın. Görselli ana sayfa ve bilgi sayfaları herkese açıktır; **köye ve diğer oyun ekranlarına geçerli hesap oturumu olmadan girilemez**, doğrudan `#village` bağlantısıyla da açılamaz. Ana sayfadaki **Kayıt ol** ile e-posta/şifre hesabı oluşturabilir veya **Giriş yap** ile mevcut hesabınızı açabilirsiniz. Şifre 12–128 karakterdir. Google seçeneği için [Google istemcisini yapılandırın](docs/GOOGLE-SIGNIN.md). [Hesap rehberi](docs/ACCOUNT-SIGNIN.md). Mevcut eski misafir köyü, geçerli eski oturum çerezi varsa ilk Google girişinde hesaba bağlanabilir; tarayıcıdaki eski yerel kayıt otomatik aktarılmaz.

Oyunda 9 yapı türü, kaynak üretimi, 5 eğitilebilir muhafız, hilal/yıldız formasyonları, savaş başında rastgele belirlenen 5 çakal taktiği, hareketli dalga savaşları, 4 bölge ve görevler bulunur. Görselli ana sayfa, oyun, yönetim ve analiz arayüzleri Türkçe/İngilizce ile açık/koyu temayı destekler. Koyu tema sıcak kahverengi ve toprak yüzeyleri, krem metinleri, altın vurguları ve bozkır yeşili düğme/seçili alanları kullanır; açık tema korunur. Tema seçimi cihazda hatırlanır. Oyundaki **Sürüm geçmişi** v1.8.3 ve önceki değişiklikleri gösterir. E-posta kaydı Google anahtarları olmadan çalışır. SMTP yapılandırıldığında 15 dakika geçerli, altı haneli doğrulama kodu `Bozkurtobasi.com <info@bozkurtobasi.com>` göndereninden görselli HTML e-postayla gider. Kod doğrulanmadan oyun ve oyuncu API'leri açılmaz; SMTP hatası bu kapıyı kaldırmaz. Google'ın doğruladığı hesaplar Google ile başlayabilir. Profilde ad soyad ve e-posta sabit, takma ad ve fotoğraf değiştirilebilir; özel fotoğraf Google fotoğrafından önceliklidir. Kalıcı oyuncu koduyla arkadaş isteği gönderilir, kabul edilmiş arkadaşlara depo kapasitesi dahilinde maden (taş) aktarılır. Aynı e-postaya ait Google ve şifre girişleri sahiplik doğrulanınca tek hesaba ve köye açılır. Giriş ekranındaki **Şifremi unuttum**, görselli e-postayla tek kullanımlık kod gönderir. Yeni şifre belirlenince tüm e-posta ve bağlı Google oturumları kapatılır; köy, profil ve arkadaşlar korunur. PvP, sohbet ve ödeme henüz yoktur.

Köydeki **İlk adımlar** rehberi kaynak toplama, yeni yapı, ilk görev ödülü, iki eğitim ve ilk zaferi kayıtlı ilerlemeden izler. Düğmeler ilgili kontrole götürür; kendiliğinden kaynak harcamaz. Önceden tamamlanan adımlar tanınır. Yeni hilal ve bozkurt logosu masaüstü/mobil, açık/koyu tema ve favicon için SVG olarak kullanılır; [logo dosyaları ve kullanım](docs/BRAND.md).

### Tek Dokploy Compose, dört servis

Dokploy'da depo `main` dalını bağlayın. Ekrandaki **Compose Path = `./docker-compose.yml`** ayarı doğrudan çalışır; `./compose.yml` aynı dört servisi içerir. Servislerin tamamı tek Compose içinde üretilir:

| Alan adı                                     | Dokploy servisi | Port | İşlev                                                                     |
| -------------------------------------------- | --------------- | ---: | ------------------------------------------------------------------------- |
| `bozkurtobasi.com` ve `www.bozkurtobasi.com` | `web`           | 3000 | Görselli ana sayfa, oyun, gizlilik/koşullar ve aynı kaynaklı `/api` proxy |
| `api.bozkurtobasi.com`                       | `api`           | 3000 | Oyun API'si ve yönetici kimlik doğrulaması                                |
| `admin.bozkurtobasi.com`                     | `admin`         | 3000 | İki dilli yönetim paneli                                                  |
| `analiz.bozkurtobasi.com`                    | `analyze`       | 3000 | Trafik kolektörü ve analiz paneli                                         |

Güncel [üretim ortamı örneğini](.env.production.example) Dokploy Environment için temel alın. Örnek, yalnızca Compose tarafından okunan değiştirilebilir anahtarları içerir; gerçek sır içermez. **`ADMIN_PASSWORD` değerini en az 12 karakterlik güçlü bir sır** olarak Dokploy'da tanımlayın. Compose'un varsayılan yönetici e-postası `info@bozkurtobasi.com`; örnek üretim ortamı, girişte kullanılan `emindemirci.ai@gmail.com` adresini `ADMIN_EMAIL` olarak ayarlar. Parola olmadan oyun ve sağlık kontrolleri çalışır, ancak yönetim/analiz girişi kapalı kalır. Parolayı Git'e, temiz kaynak ZIP'ine veya ekran görüntüsüne koymayın. `ANALYZE_AUTH_MODE=platform-admin` ve aynı Compose ağı için `ANALYZE_AUTH_API_URL=http://api:3000` varsayılan olarak hazırdır. Analiz girişinin sunucu çağrısı bu dahili adresi kullanır; panelin dış adresi HTTPS olarak kalır. Ayrı dağıtılan API için bu anahtarı erişilebilir HTTPS API adresiyle değiştirebilirsiniz. Verdiğiniz diğer `ANALYZE_*` varsayılanları da [Compose dosyasında](compose.yml) tanımlıdır. Environment veya Domains değişikliklerini **Save → Deploy** ile uygulayın.

**v1.8.3 uyumluluğu:** Dokploy'da mevcut `ADMIN_BOOTSTRAP_EMAIL` ve `ADMIN_BOOTSTRAP_PASSWORD` anahtarları da kabul edilir; yeni sürümü dağıtınca Compose bunları API'nin `ADMIN_EMAIL`/`ADMIN_PASSWORD` alanlarına aktarır. Mevcut parolayı değiştirmek veya ikinci bir parola oluşturmak gerekmez. İsterseniz anahtar adlarını doğrudan `ADMIN_EMAIL` ve `ADMIN_PASSWORD` olarak değiştirebilirsiniz. Her alan için boş olmayan birincil değer önceliklidir; yoksa ilgili `ADMIN_BOOTSTRAP_*` değeri kullanılır. Parolanın en az 12 karakter olması değişmez; bu uyumluluk veritabanında seed hesabı oluşturmaz.

Google ile girişi açmak için Google Cloud Console içinde **Web application** OAuth istemcisi oluşturup `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` değerlerini Dokploy Environment bölümüne ekleyin. `GOOGLE_REDIRECT_URIS` tam olarak `https://bozkurtobasi.com/api/auth/google/callback,https://www.bozkurtobasi.com/api/auth/google/callback` olmalı ve her iki adres Google istemcisinde izinli yönlendirme URI olarak kayıtlı olmalıdır. Anasayfadaki [gizlilik bildirimi](public/privacy.html) ve [kullanım koşulları](public/terms.html) Google marka ekranına eklenmelidir. Adımlar [Google giriş rehberinde](docs/GOOGLE-SIGNIN.md). Bu anahtarlar boşken yalnızca Google düğmesi kullanılamaz; e-posta ile kayıt/giriş kullanılabilir.

Yönetici veya analiz girişinde `admin_unavailable` (503) görülürse çalışan **API konteynerinin** `ADMIN_EMAIL` ve en az 12 karakterlik `ADMIN_PASSWORD` aldığını kontrol edin; Environment ekranında yazılı olması tek başına yeterli değildir. Genel `/api/health` yanıtının 200 olması da yönetici girişinin yapılandırıldığını göstermez. **admin.bozkurtobasi.com** 502 dönerse Domains kaydını **admin:3000** yapın; **3001 yalnızca yerel API host portudur**, Dokploy konteyner portu değildir. Kaydedip dağıtın. `/healthz` ve `/api/health` sonuçlarıyla yönlendirme ve API bağlantısını ayrı kontrol edin; sırları göstermeyen konteyner kontrolü ve **Preview Compose** ağ incelemesi [dağıtım rehberinde](docs/WEB-DEPLOYMENT.md). Nginx, API yeniden oluşturulduğunda Docker DNS adresini yeniler; analiz girişinde bağlantı hatası ve yönetici yapılandırma hatası ayrı mesajlarla gösterilir.

`game-data` volume'u `/data/game.sqlite` dosyasını, `analyze-data` volume'u `/app/data` olaylarını korur. İki veriyi de ayrıca yedekleyin. SQLite kullanan API ve analiz servisi tek replica çalışır. Giden doğrulama postası için `MAIL_PROVIDER=smtp`, Hostinger SMTP ayarları ve `MAIL_FROM` örnekte hazırdır; gerçek `SMTP_PASSWORD` değerini yalnızca Dokploy Environment bölümüne ekleyin. Gönderen adresi her zaman `info@bozkurtobasi.com` olarak sabitlenir. Yönetici hesabı ayrı `ADMIN_EMAIL` ve `ADMIN_PASSWORD` değerleriyle açılır; veritabanında seed yönetici gerekmez. Ayrıntılar [dağıtım rehberinde](docs/WEB-DEPLOYMENT.md).

Yerelde dört servisi açmak için Docker Desktop ile:

```bash
docker compose -f compose.yml -f compose.local.yml up --build -d
```

Portlar: oyun <http://127.0.0.1:3000>, API <http://127.0.0.1:3001>, yönetim <http://127.0.0.1:3002>, analiz <http://127.0.0.1:3003>. Yerelde yönetici girişi için `ADMIN_PASSWORD` ortam değişkenini Compose komutundan önce tanımlayın. Yerel Compose oyun analitiğini kapatır ve analiz panelinin auth çağrısını dahili API'ye yöneltir. Durdurmak için `docker compose -f compose.yml -f compose.local.yml down` kullanın; `down -v` kalıcı volume'ları siler.

### Trafik ve doğrulama

Docker imajları derlendikten sonra `node scripts/compose-env-smoke.mjs`, `node scripts/proxy-smoke.mjs` ve `node scripts/analyze-auth-smoke.mjs` dağıtım regresyonlarını sınar. Ağ geçidi testi, Docker'ın ayırdığı boş alt ağı açıkça tanımlayarak Linux/Docker Desktop üzerinde API'nin farklı IP'ye geçmesini zorunlu tutar. Testler bağımsız geçici ağ/konteyner kullanır ve sonunda temizler; mevcut oyuncu verilerini kullanmaz.

Üretimde oyun, `GET /api/config` üzerinden izinli kolektör adresini alır ve ana sayfa/köy/savaş/dünya/kurt/görev ekran görüntüleme ve süre olaylarını `https://analiz.bozkurtobasi.com/api/track` adresine gönderir. Oyun kaydı, kaynaklar, URL parametreleri ve oturum çerezi gönderilmez. DNT/GPC tercihleri dikkate alınır; çevrimdışı/yerel önizleme trafik üretmez. `ANALYZE_GEO_LOOKUP=true` etkinse IP konumu HTTPS üzerinden ipwho.is ile çözümlenebilir; [gizlilik bildirimi](public/privacy.html) bunu açıklar.

`npm run verify` kaynak kontrolü, motor/API testleri, üretim ve tek dosya derlemesi, tarayıcı testlerini çalıştırır. `npm run count:lines` aşağıdaki sayımı yeniler; `npm run backup` `artifacts/` altında temiz kaynak ZIP'i ve SHA-256 dosyası oluşturur. ZIP oyuncu veritabanlarını, sırları, bağımlılıkları veya Git geçmişini içermez. Güncel sonuçlar [doğrulama kaydında](docs/WEB-VALIDATION.md).

Windows tesliminde kontroller geçtikten sonra [`push-and-backup.ps1`](push-and-backup.ps1) commit/push ve **tam proje yedeğini** birlikte yapar. İncelenen dosyaları `git add -- <dosyalar>` ile hazırlayıp `.\push-and-backup.ps1 -StagedOnly -CommitMessage "feat: açıklama"` çalıştırın; varsayılan çağrı bütün görünür değişiklikleri stage eder. Yayımlanmış sürümün yeni yedeği için `-BackupOnly` kullanın. Tam ZIP, `H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası\Bozkurt Obası_YYYY-MM-DD_HHMMSS.zip` yoluna yazılır; `.git`, `node_modules`, derlemeler, yerel `.env` ve boş klasörler dahil hiçbir içerik hariç tutulmaz. İçerik doğrulanır, son 30 tarihli yedek saklanır. Bu özel Drive ZIP'i GitHub'a yüklenmez; GitHub Release temiz kaynak ZIP'ini kullanır. Drive'ın bulut eşitleme durumu masaüstü istemcisinden kontrol edilir. [Tam yedek standardı](BACKUP-STANDARD.md), [teslim kuralları](PROJECT-BACKUP-RULES.md). Repo dışındaki Docker volume'ları ayrıca yedeklenir.

## English

GitHub About includes the game description, `https://bozkurtobasi.com` website link and project topics. Visible page footers show `© 2026 Bozkurt Obası`. The hero uses equal TR/EN dimensions, fits the first desktop screen and displays Google sign-in there; the bottom of the page does not repeat the sign-in button.

### A version for each completed update

Run `npm run release:version -- patch --tr "Türkçe değişiklik notu" --en "English change note"` to advance the package, lockfile, in-game history, CHANGELOG and README together. Use `minor` for new features and `major` for breaking changes. Commit the version and notes with the change. After a merge or push to `main`, passing tests and all four service checks trigger an automatic `vX.Y.Z` tag and GitHub Release with this version's TR/EN CHANGELOG notes, clean source ZIP, SHA-256 and visual `index.html`. CI requires a version newer than the previous `main` revision. See the [release guide](docs/RELEASING.md).

### Preview the homepage and sign in to play

Battlefield wolves, jackals, sheep and cows use realistic transparent cutouts. The four WebP files total approximately 193 KiB; wolves and the herd face the jackals. [`preview/battle.html`](preview/battle.html) is a self-contained visual preview of the actual battlefield, with offline TR/EN, light/brown dark themes, zoom and visual motion controls. It does not access player accounts or game saves. `npm run build:preview` rebuilds both visual previews.

Download and open [`preview/index.html`](preview/index.html) in a browser for a self-contained **visual homepage preview**. It does not open the game. GitHub file preview cannot run its interactive content. For the SQLite-backed local server, install Node.js 24, then run `npm ci`, `npm run build`, and `npm start`. Open <http://127.0.0.1:3000>, and register/sign in with email and password from the homepage, then confirm the emailed code. SMTP is required for new email accounts; Google can also verify ownership. A password must contain 12–128 characters. Alternatively, [configure Google OAuth](docs/GOOGLE-SIGNIN.md) to use Google. See the [account guide](docs/ACCOUNT-SIGNIN.md). The homepage and information pages are public; **the village and every other game screen require a valid account session**, including direct `#village` visits. An earlier server guest village can be claimed at first sign-in if its existing cookie remains valid. Earlier browser-local saves are not uploaded automatically.

The playable release includes nine building types, resource production, five trainable guardians, crescent/star formations, five jackal tactics chosen randomly when combat begins, animated battles, four regions, and quests. The illustrated homepage, game, admin, and analytics interfaces support Turkish/English and light/dark themes. Dark mode uses warm brown and earth surfaces, cream text, gold highlights and steppe green buttons/selected areas; light mode is preserved. The theme preference is remembered on the device. The in-game **Release history** shows v1.8.3 and earlier updates. Email registration works without Google credentials. With SMTP configured, registration sends a six-digit, 15-minute verification code from `Bozkurtobasi.com <info@bozkurtobasi.com>` in illustrated HTML email. Game and player APIs stay locked until confirmation, including during SMTP failure. Google-verified accounts can start through Google. Profile email and full name are immutable; nickname and photo are editable, with custom uploads taking priority over Google pictures. Permanent player codes support accepted friendships and atomic stone gifts within warehouse capacity. Google and password sign-in for the same email open one account and village after ownership is confirmed. **Forgot password** sends a single-use code in illustrated email. Resetting revokes all email and linked Google sessions while preserving the village, profile and friends. PvP, chat and payments are not yet included.

The village **First steps** guide follows gathering, construction, the first quest reward, two training actions and the first victory from saved progress. Buttons lead to the relevant control without spending resources. Previously completed steps are recognized. The new crescent-and-wolf SVG identity supports desktop/mobile, light/dark themes and the favicon; see [logo files and usage](docs/BRAND.md).

### Four services in one Dokploy Compose stack

Connect the private repository's `main` branch and keep the existing **Compose Path `./docker-compose.yml`**. `./compose.yml` is an identical alternative. Map both game domains to `web:3000`, `api.bozkurtobasi.com` to `api:3000`, `admin.bozkurtobasi.com` to `admin:3000`, and `analiz.bozkurtobasi.com` to `analyze:3000`. Apply Environment or Domains changes with **Save → Deploy**.

Use the current [production environment example](.env.production.example) as the starting point in Dokploy Environment. It contains only configurable keys consumed by Compose and no real secrets. Set **`ADMIN_PASSWORD` to a strong secret of at least 12 characters** in Dokploy. Compose defaults to `info@bozkurtobasi.com`; the example sets `ADMIN_EMAIL=emindemirci.ai@gmail.com` to match the sign-in address. Without the password, gameplay and health checks work, but admin and analytics login cannot succeed. Do not commit the secret. [`compose.yml`](compose.yml) includes the supplied `ANALYZE_*` defaults and `platform-admin` authentication. The default `ANALYZE_AUTH_API_URL=http://api:3000` sends server-side authentication over the same Compose network; the public panel remains HTTPS. Override it with a reachable HTTPS API URL if the API is deployed separately. `game-data` holds SQLite game progress; `analyze-data` holds analytics events. Back up both separately and keep one replica for the SQLite services. Outgoing verification mail always uses `info@bozkurtobasi.com`; add the real `SMTP_PASSWORD` only in Dokploy. The admin login uses separate `ADMIN_EMAIL` and `ADMIN_PASSWORD` settings and needs no seeded database account. Password recovery uses the same SMTP settings without additional environment keys.

**v1.8.3 compatibility:** Existing Dokploy `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` settings are also accepted. Deploying this version maps them to the API's `ADMIN_EMAIL`/`ADMIN_PASSWORD`; you do not need to change your existing password or create another one. Alternatively, rename the keys to `ADMIN_EMAIL` and `ADMIN_PASSWORD`. A nonempty primary value takes priority for each field; otherwise its `ADMIN_BOOTSTRAP_*` value is used. The 12-character minimum remains, and this compatibility does not create a database seed account.

To enable the Google sign-in option, create a **Web application** OAuth client in Google Cloud Console and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Dokploy Environment. Register both exact callback URLs listed in `GOOGLE_REDIRECT_URIS` with Google, and add the [privacy notice](public/privacy.html) and [terms](public/terms.html) to the OAuth branding setup. Follow the [Google sign-in guide](docs/GOOGLE-SIGNIN.md). With empty credentials, only Google sign-in is unavailable; email registration/sign-in remains available.

If admin or analytics sign-in returns `admin_unavailable` (503), verify that the **running API container** received `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 12 characters. Values saved in the Environment editor and a successful generic `/api/health` check do not prove admin authentication is configured. For an admin-domain 502, set its Domains entry to **admin:3000**; **3001 is only the local API host port**, not a Dokploy container port. Save and deploy. Compare `/healthz` and `/api/health` to separate routing from API connectivity; the [deployment guide](docs/WEB-DEPLOYMENT.md) includes a secret-free container check and **Preview Compose** network inspection. Nginx refreshes Docker DNS after API recreation, and analytics sign-in distinguishes connectivity failures from unavailable admin configuration.

For a local four-service preview, run `docker compose -f compose.yml -f compose.local.yml up --build -d`. Ports are game 3000, API 3001, admin 3002, analytics 3003 on loopback. Set `ADMIN_PASSWORD` in the shell first to sign in locally. The local override disables outgoing game analytics and uses the internal API for panel authentication. Stop with `docker compose -f compose.yml -f compose.local.yml down`, preserving data volumes.

### Traffic, checks and backup

After building the Docker images, run `node scripts/compose-env-smoke.mjs`, `node scripts/proxy-smoke.mjs` and `node scripts/analyze-auth-smoke.mjs` for deployment regression checks. The gateway test explicitly configures a free subnet allocated by Docker to force a different replacement API IP on Linux/Docker Desktop. These checks create and remove disposable networks/containers without using existing player data.

On production HTTPS, the site sends screen views and cumulative duration for home, village, battle, world, wolves, and quests to the bundled analytics collector. Payloads omit saves, resources, URL parameters, and session cookies. DNT/GPC are honored; the local/offline visual preview sends nothing. When enabled, geo lookup can send visitor IPs to ipwho.is over HTTPS, as described in the [privacy notice](public/privacy.html).

Run `npm run verify` for checks, tests, builds, and browser tests. Run `npm run count:lines` to refresh the table below and `npm run backup` for a clean source ZIP and SHA-256 sidecar in `artifacts/`. The ZIP includes the visual preview but excludes player data, secrets, dependencies, production build directories, and Git history. See the [validation record](docs/WEB-VALIDATION.md) and [deployment guide](docs/WEB-DEPLOYMENT.md).

On Windows, after checks pass, [`push-and-backup.ps1`](push-and-backup.ps1) commits/pushes and creates a **full project backup**. Stage reviewed files with `git add -- <files>` and run `.\push-and-backup.ps1 -StagedOnly -CommitMessage "feat: description"`; the default invocation stages every visible change. Use `-BackupOnly` to snapshot an already published revision. The full ZIP goes to `H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası\Bozkurt Obası_YYYY-MM-DD_HHMMSS.zip` with no exclusions, including `.git`, `node_modules`, builds, local `.env` and empty directories. Contents are verified and the latest 30 dated backups retained. This private Drive ZIP is separate from the clean GitHub Release archive. Check cloud sync status in the Drive desktop client. See [backup standard](BACKUP-STANDARD.md) and [delivery rules](PROJECT-BACKUP-RULES.md). Docker volumes outside the repo need separate backups.

## Depo yapısı / Repository layout

| Yol / Path                              | İçerik / Contents                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web/`, `shared/`                       | Görselli ana sayfa, oyun arayüzü ve kuralları / Visual homepage, game UI and rules                                                               |
| `web/assets/`, `public/`                | Ana görsel, gizlilik ve koşullar / Hero art, privacy and terms                                                                                   |
| `server/web/`                           | Oyun, Google ve yönetici API'si, SQLite / Game, Google and admin API, SQLite                                                                     |
| `services/web/`                         | Nginx oyun gateway / Nginx game gateway                                                                                                          |
| `services/admin/`                       | İki dilli yönetim arayüzü / Bilingual admin UI                                                                                                   |
| `services/analyze/`                     | MIT lisanslı analiz paneli ve kolektör / MIT analytics dashboard and collector                                                                   |
| `tests/`, `scripts/`                    | Test, önizleme, ölçüm ve ZIP / Tests, preview, metrics, and ZIP                                                                                  |
| `preview/index.html`                    | Tek dosyalık görsel ana sayfa önizlemesi; oyun için hesap oturumu gerekir / Standalone visual homepage preview; game requires an account session |
| `preview/battle.html`                   | Gerçekçi savaş sahnesi için çevrimdışı görsel önizleme / Offline visual preview of the realistic battlefield                                     |
| `releases.json`, `CHANGELOG.md`         | İki dilli sürüm kayıtları / Bilingual release history                                                                                            |
| `.env.production.example`               | Dokploy üretim ortamı örneği / Production environment example                                                                                    |
| `docs/GOOGLE-SIGNIN.md`                 | İki dilli Google OAuth kurulumu / Bilingual Google OAuth setup                                                                                   |
| `Assets/`, `client/`, `infrastructure/` | Korunan Unity dönemi kaynakları / Preserved Unity-era sources                                                                                    |

## Kaynak satırları / Source line counts

<!-- metrics:start -->
| Kapsam / Scope | Dosya / Files | Satır / Lines |
| --- | ---: | ---: |
| Web istemci / Web client | 14 | 6992 |
| Web sunucu / Web server | 12 | 2733 |
| Dağıtım servisleri / Deployment services | 31 | 4317 |
| Paylaşılan oyun / Shared game | 1 | 718 |
| Web test ve araçlar / Web tests and tools | 46 | 9247 |
| Korunan Unity kaynakları / Preserved Unity sources | 75 | 10198 |
| **Toplam / Total** | **179** | **34205** |

Aktif web kaynakları / Active web source: **24007** satır / lines.
Fiziksel kaynak satırları; boş satırlar ve yorumlar dahil, üretilen önizleme, bağımlılıklar ve kilit dosyaları hariç. / Physical source lines include comments and blank lines; generated preview, dependencies, and lockfiles are excluded.
<!-- metrics:end -->

## Lisans / License

Bu depo [MIT lisansı](LICENSE) altındadır. © 2026 Emin DEMİRCİ ve MIT bildirimi sayfa kaynağında görülebilir. MIT lisansı kullanıma, değiştirmeye ve dağıtıma izin verir; telif ve izin bildirimi kopyalarda korunmalıdır. Bildirimi kaldırmak veya lisans koşulları dışında davranmak hak ihlaline yol açabilir. Analiz servisinin özgün MIT telif bildirimi [`services/analyze/LICENSE`](services/analyze/LICENSE) içinde korunur; [kaynak bildirimi](docs/ANALYZE-SOURCE.md). Üçüncü taraf bağımlılıkların kendi lisansları geçerlidir. Giriş düğmesindeki [resmî Google G simgesi](https://developers.google.com/static/identity/images/g-logo.png) Google markasıdır ve [marka yönergelerine](https://developers.google.com/identity/branding-guidelines) göre kullanılır; MIT lisansı bu simgeye uygulanmaz.

This repository is licensed under [MIT](LICENSE). The © 2026 Emin DEMİRCİ and MIT notice is visible in page source. MIT permits use, modification, and redistribution provided the copyright and permission notice is retained in copies. Removing the notice or acting outside the license terms may infringe rights. The analytics service retains its original MIT notice in [`services/analyze/LICENSE`](services/analyze/LICENSE); see the [source notice](docs/ANALYZE-SOURCE.md). Third-party dependencies retain their respective licenses. The [official Google G icon](https://developers.google.com/static/identity/images/g-logo.png) on the sign-in button is a Google brand asset used under its [branding guidelines](https://developers.google.com/identity/branding-guidelines); the repository MIT license does not apply to that icon.
