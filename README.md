# Bozkurt Obası: Ay-Yıldız Nöbeti

**TR:** “Obanı kur, sürünü koru.” Tarayıcıda oynanabilen köy kurma ve sürü savunma oyunu. Kurtlar ve sürü savaşta çakallara bakar. Ana sayfa görselinde beş kurt, obanın önünde sürüyü doğal bir hilal düzeninde korur; dağlar, göl ve gün batımı arka planı korunur.

**EN:** “Build your village. Guard your herd.” A browser village builder and herd defense game. Wolves and the herd face the jackals in battle. The homepage artwork shows five wolves guarding the herd in a natural crescent in front of the camp, retaining the mountain, lake and sunset background.

[Görsel düzenleme kaydı ve tam istem / Artwork edit record and exact prompt](docs/HERO-ART.md)

**Güncel sürüm / Current version: v1.2.4** · [GitHub Releases](https://github.com/emindemirciai/Bozkurt-Obasi/releases/latest) · [Sürüm geçmişi / Changelog](CHANGELOG.md) · [Sürüm oluşturma / Releasing](docs/RELEASING.md)

[Çevrimdışı görsel önizleme / Offline visual preview](preview/index.html) · [Dokploy rehberi / Deployment guide](docs/WEB-DEPLOYMENT.md) · [Google girişi / Google sign-in](docs/GOOGLE-SIGNIN.md) · [Gizlilik / Privacy](public/privacy.html) · [Koşullar / Terms](public/terms.html) · [Doğrulama / Validation](docs/WEB-VALIDATION.md) · [Kaynak depo / Repository](https://github.com/emindemirciai/Bozkurt-Obasi)

## Türkçe

GitHub About bölümü oyun açıklamasını, `https://bozkurtobasi.com` site bağlantısını ve proje konularını içerir. Görünür sayfa alt bilgisi `© 2026 Bozkurt Obası` şeklindedir. Ana görsel alanı TR/EN'de aynı ölçüyü kullanır, masaüstünde ilk ekrana sığar ve Google girişi burada görünür; sayfa sonunda tekrar giriş düğmesi yoktur.

### Her tamamlanan iş için sürüm

`npm run release:version -- patch --tr "Türkçe değişiklik notu" --en "English change note"` komutu paket sürümünü, kilit dosyasını, oyun içi sürüm geçmişini, CHANGELOG ve README'yi birlikte ilerletir. Yeni özellikler için `minor`, uyumsuz değişiklikler için `major` kullanın. Sürüm ve notlar commit'e dahildir. `main` dalına birleşme veya push sonrasında testler ve dört servis kontrolü geçerse GitHub Actions otomatik olarak `vX.Y.Z` etiketi ve CHANGELOG'daki TR/EN notlarla Release oluşturur; temiz kaynak ZIP'i, SHA-256 ve görsel `index.html` sürüme eklenir. CI, sürümün önceki `main` kaydından ilerlemesini zorunlu tutar. [Sürüm rehberi](docs/RELEASING.md).

### Ana sayfayı önizle ve oyuna giriş yap

[`preview/index.html`](preview/index.html) dosyasını indirip tarayıcıda açın; internet veya sunucu gerektirmeyen, tek dosyalık **görsel ana sayfa önizlemesidir**. Oyun ekranları bu dosyada açılmaz. GitHub dosya görüntüleyicisi etkileşimli önizlemeyi çalıştırmaz. Node.js 24 ile yerel API ve kalıcı SQLite kullanmak için:

```bash
npm ci
npm run build
npm start
```

Ardından <http://127.0.0.1:3000> adresini açın. Görselli ana sayfa ve bilgi sayfaları herkese açıktır; **köye ve diğer oyun ekranlarına geçerli Google oturumu olmadan girilemez**, doğrudan `#village` bağlantısıyla da açılamaz. Önce [Google istemcisini yapılandırın](docs/GOOGLE-SIGNIN.md), ardından ana sayfadan Google ile giriş yapın. Mevcut eski misafir köyü, geçerli eski oturum çerezi varsa ilk Google girişinde hesaba bağlanabilir; tarayıcıdaki eski yerel kayıt otomatik aktarılmaz.

Oyunda 9 yapı türü, kaynak üretimi, 5 eğitilebilir muhafız, hilal/yıldız formasyonları, savaş başında rastgele belirlenen 5 çakal taktiği, hareketli dalga savaşları, 4 bölge ve görevler bulunur. Görselli ana sayfa, oyun, yönetim ve analiz arayüzleri Türkçe/İngilizce ile açık/koyu temayı destekler. Oyundaki **Sürüm geçmişi** v1.2.4 ve önceki değişiklikleri gösterir. Google Cloud istemcisi ve Dokploy ortamı ayarlanana kadar giriş kapalıdır ve oyun erişimi sağlanmaz. PvP, arkadaş/sohbet, parola sıfırlama ve ödeme henüz yoktur.

### Tek Dokploy Compose, dört servis

Dokploy'da depo `main` dalını bağlayın. Ekrandaki **Compose Path = `./docker-compose.yml`** ayarı doğrudan çalışır; `./compose.yml` aynı dört servisi içerir. Servislerin tamamı tek Compose içinde üretilir:

| Alan adı                                     | Dokploy servisi | Port | İşlev                                                                     |
| -------------------------------------------- | --------------- | ---: | ------------------------------------------------------------------------- |
| `bozkurtobasi.com` ve `www.bozkurtobasi.com` | `web`           | 3000 | Görselli ana sayfa, oyun, gizlilik/koşullar ve aynı kaynaklı `/api` proxy |
| `api.bozkurtobasi.com`                       | `api`           | 3000 | Oyun API'si ve yönetici kimlik doğrulaması                                |
| `admin.bozkurtobasi.com`                     | `admin`         | 3000 | İki dilli yönetim paneli; canlı 502 için Dokploy eşlemesi incelenmeli     |
| `analiz.bozkurtobasi.com`                    | `analyze`       | 3000 | Trafik kolektörü ve analiz paneli                                         |

Güncel [üretim ortamı örneğini](.env.production.example) Dokploy Environment için temel alın. Örnek, yalnızca Compose tarafından okunan değiştirilebilir anahtarları içerir; gerçek sır içermez. **`ADMIN_PASSWORD` değerini en az 12 karakterlik güçlü bir sır** olarak Dokploy'da tanımlayın. Compose'un varsayılan yönetici e-postası `info@bozkurtobasi.com`; örnek üretim ortamı, girişte kullanılan `emindemirci.ai@gmail.com` adresini `ADMIN_EMAIL` olarak ayarlar. Parola olmadan oyun ve sağlık kontrolleri çalışır, ancak yönetim/analiz girişi kapalı kalır. Parolayı Git'e, ZIP'e veya ekran görüntüsüne koymayın. `ANALYZE_AUTH_MODE=platform-admin` ve `ANALYZE_AUTH_API_URL=https://api.bozkurtobasi.com` Compose'da hazırdır. Verdiğiniz diğer `ANALYZE_*` varsayılanları da [Compose dosyasında](compose.yml) tanımlıdır. Domain değişikliklerinden sonra Dokploy'da yeniden dağıtın.

Google ile girişi açmak için Google Cloud Console içinde **Web application** OAuth istemcisi oluşturup `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` değerlerini Dokploy Environment bölümüne ekleyin. `GOOGLE_REDIRECT_URIS` tam olarak `https://bozkurtobasi.com/api/auth/google/callback,https://www.bozkurtobasi.com/api/auth/google/callback` olmalı ve her iki adres Google istemcisinde izinli yönlendirme URI olarak kayıtlı olmalıdır. Anasayfadaki [gizlilik bildirimi](public/privacy.html) ve [kullanım koşulları](public/terms.html) Google marka ekranına eklenmelidir. Adımlar [Google giriş rehberinde](docs/GOOGLE-SIGNIN.md). Bu anahtarlar boşken Google düğmesi kullanılamaz görünür ve oyun kapalı kalır; yalnızca açık ana sayfa ile bilgi sayfaları görüntülenir.

Yönetici veya analiz girişinde admin_unavailable (503) görülürse Dokploy Environment bölümünde **ADMIN_PASSWORD** değerinin en az 12 karakter olduğunu ve **ADMIN_EMAIL** değerinin girişte kullanılacak adresle eşleştiğini doğrulayın; ardından Compose uygulamasını yeniden dağıtarak API servisini güncelleyin. **admin.bozkurtobasi.com** 502 dönerse Domains kaydının **admin:3000** servisine bağlı olduğunu kontrol edin; admin konteynerinin durumunu, /healthz sağlık kontrolünü ve Dokploy loglarını inceleyin.

`game-data` volume'u `/data/game.sqlite` dosyasını, `analyze-data` volume'u `/app/data` olaylarını korur. İki veriyi de ayrıca yedekleyin. SQLite kullanan API ve analiz servisi tek replica çalışır. SMTP gönderimi ve parola sıfırlama henüz uygulanmadı; `info@bozkurtobasi.com` iletişim adresidir.

Yerelde dört servisi açmak için Docker Desktop ile:

```bash
docker compose -f compose.yml -f compose.local.yml up --build -d
```

Portlar: oyun <http://127.0.0.1:3000>, API <http://127.0.0.1:3001>, yönetim <http://127.0.0.1:3002>, analiz <http://127.0.0.1:3003>. Yerelde yönetici girişi için `ADMIN_PASSWORD` ortam değişkenini Compose komutundan önce tanımlayın. Yerel Compose oyun analitiğini kapatır ve analiz panelinin auth çağrısını dahili API'ye yöneltir. Durdurmak için `docker compose -f compose.yml -f compose.local.yml down` kullanın; `down -v` kalıcı volume'ları siler.

### Trafik ve doğrulama

Üretimde oyun, `GET /api/config` üzerinden izinli kolektör adresini alır ve ana sayfa/köy/savaş/dünya/kurt/görev ekran görüntüleme ve süre olaylarını `https://analiz.bozkurtobasi.com/api/track` adresine gönderir. Oyun kaydı, kaynaklar, URL parametreleri ve oturum çerezi gönderilmez. DNT/GPC tercihleri dikkate alınır; çevrimdışı/yerel önizleme trafik üretmez. `ANALYZE_GEO_LOOKUP=true` etkinse IP konumu HTTPS üzerinden ipwho.is ile çözümlenebilir; [gizlilik bildirimi](public/privacy.html) bunu açıklar.

`npm run verify` kaynak kontrolü, motor/API testleri, üretim ve tek dosya derlemesi, tarayıcı testlerini çalıştırır. `npm run count:lines` aşağıdaki sayımı yeniler; `npm run backup` `artifacts/` altında temiz kaynak ZIP'i ve SHA-256 dosyası oluşturur. ZIP oyuncu veritabanlarını, sırları, bağımlılıkları veya Git geçmişini içermez. Güncel sonuçlar [doğrulama kaydında](docs/WEB-VALIDATION.md).

## English

GitHub About includes the game description, `https://bozkurtobasi.com` website link and project topics. Visible page footers show `© 2026 Bozkurt Obası`. The hero uses equal TR/EN dimensions, fits the first desktop screen and displays Google sign-in there; the bottom of the page does not repeat the sign-in button.

### A version for each completed update

Run `npm run release:version -- patch --tr "Türkçe değişiklik notu" --en "English change note"` to advance the package, lockfile, in-game history, CHANGELOG and README together. Use `minor` for new features and `major` for breaking changes. Commit the version and notes with the change. After a merge or push to `main`, passing tests and all four service checks trigger an automatic `vX.Y.Z` tag and GitHub Release with this version's TR/EN CHANGELOG notes, clean source ZIP, SHA-256 and visual `index.html`. CI requires a version newer than the previous `main` revision. See the [release guide](docs/RELEASING.md).

### Preview the homepage and sign in to play

Download and open [`preview/index.html`](preview/index.html) in a browser for a self-contained **visual homepage preview**. It does not open the game. GitHub file preview cannot run its interactive content. For the SQLite-backed local server, install Node.js 24, then run `npm ci`, `npm run build`, and `npm start`. Open <http://127.0.0.1:3000>, [configure Google OAuth](docs/GOOGLE-SIGNIN.md), and sign in from the homepage. The homepage and information pages are public; **the village and every other game screen require a valid Google session**, including direct `#village` visits. An earlier server guest village can be claimed at first sign-in if its existing cookie remains valid. Earlier browser-local saves are not uploaded automatically.

The playable release includes nine building types, resource production, five trainable guardians, crescent/star formations, five jackal tactics chosen randomly when combat begins, animated battles, four regions, and quests. The illustrated homepage, game, admin, and analytics interfaces support Turkish/English and light/dark themes. The in-game **Release history** shows v1.2.4 and earlier updates. Until Google Cloud credentials are configured in Dokploy, sign-in and game access remain unavailable. PvP, chat, password recovery, and payments are not yet included.

### Four services in one Dokploy Compose stack

Connect the private repository's `main` branch and keep the existing **Compose Path `./docker-compose.yml`**. `./compose.yml` is an identical alternative. Map both game domains to `web:3000`, `api.bozkurtobasi.com` to `api:3000`, `admin.bozkurtobasi.com` to `admin:3000`, and `analiz.bozkurtobasi.com` to `analyze:3000`. The admin domain currently needs its Dokploy mapping/502 issue resolved. Redeploy after changing domains.

Use the current [production environment example](.env.production.example) as the starting point in Dokploy Environment. It contains only configurable keys consumed by Compose and no real secrets. Set **`ADMIN_PASSWORD` to a strong secret of at least 12 characters** in Dokploy. Compose defaults to `info@bozkurtobasi.com`; the example sets `ADMIN_EMAIL=emindemirci.ai@gmail.com` to match the sign-in address. Without the password, gameplay and health checks work, but admin and analytics login cannot succeed. Do not commit the secret. The supplied `ANALYZE_*` defaults and platform-admin/API URL are already in [`compose.yml`](compose.yml). `game-data` holds SQLite game progress; `analyze-data` holds analytics events. Back up both separately and keep one replica for the SQLite services. SMTP sending and password recovery are not implemented.

To enable Google sign-in and game access, create a **Web application** OAuth client in Google Cloud Console and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Dokploy Environment. Register both exact callback URLs listed in `GOOGLE_REDIRECT_URIS` with Google, and add the [privacy notice](public/privacy.html) and [terms](public/terms.html) to the OAuth branding setup. Follow the [Google sign-in guide](docs/GOOGLE-SIGNIN.md). With empty credentials, the button correctly reports that sign-in is unavailable and the game stays closed.

If admin or analytics sign-in returns admin_unavailable (503), verify that **ADMIN_PASSWORD** has at least 12 characters and **ADMIN_EMAIL** matches the intended sign-in address in Dokploy Environment; redeploy the Compose application so the API receives them. If **admin.bozkurtobasi.com** returns 502, check that its Domains entry targets **admin:3000**, then inspect the admin container status, /healthz check and Dokploy logs.

For a local four-service preview, run `docker compose -f compose.yml -f compose.local.yml up --build -d`. Ports are game 3000, API 3001, admin 3002, analytics 3003 on loopback. Set `ADMIN_PASSWORD` in the shell first to sign in locally. The local override disables outgoing game analytics and uses the internal API for panel authentication. Stop with `docker compose -f compose.yml -f compose.local.yml down`, preserving data volumes.

### Traffic, checks and backup

On production HTTPS, the site sends screen views and cumulative duration for home, village, battle, world, wolves, and quests to the bundled analytics collector. Payloads omit saves, resources, URL parameters, and session cookies. DNT/GPC are honored; the local/offline visual preview sends nothing. When enabled, geo lookup can send visitor IPs to ipwho.is over HTTPS, as described in the [privacy notice](public/privacy.html).

Run `npm run verify` for checks, tests, builds, and browser tests. Run `npm run count:lines` to refresh the table below and `npm run backup` for a clean source ZIP and SHA-256 sidecar in `artifacts/`. The ZIP includes the visual preview but excludes player data, secrets, dependencies, production build directories, and Git history. See the [validation record](docs/WEB-VALIDATION.md) and [deployment guide](docs/WEB-DEPLOYMENT.md).

## Depo yapısı / Repository layout

| Yol / Path                              | İçerik / Contents                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/`, `shared/`                       | Görselli ana sayfa, oyun arayüzü ve kuralları / Visual homepage, game UI and rules                                                           |
| `web/assets/`, `public/`                | Ana görsel, gizlilik ve koşullar / Hero art, privacy and terms                                                                               |
| `server/web/`                           | Oyun, Google ve yönetici API'si, SQLite / Game, Google and admin API, SQLite                                                                 |
| `services/web/`                         | Nginx oyun gateway / Nginx game gateway                                                                                                      |
| `services/admin/`                       | İki dilli yönetim arayüzü / Bilingual admin UI                                                                                               |
| `services/analyze/`                     | MIT lisanslı analiz paneli ve kolektör / MIT analytics dashboard and collector                                                               |
| `tests/`, `scripts/`                    | Test, önizleme, ölçüm ve ZIP / Tests, preview, metrics, and ZIP                                                                              |
| `preview/index.html`                    | Tek dosyalık görsel ana sayfa önizlemesi; oyun için Google girişi gerekir / Standalone visual homepage preview; game requires Google sign-in |
| `releases.json`, `CHANGELOG.md`         | İki dilli sürüm kayıtları / Bilingual release history                                                                                        |
| `.env.production.example`               | Dokploy üretim ortamı örneği / Production environment example                                                                                |
| `docs/GOOGLE-SIGNIN.md`                 | İki dilli Google OAuth kurulumu / Bilingual Google OAuth setup                                                                               |
| `Assets/`, `client/`, `infrastructure/` | Korunan Unity dönemi kaynakları / Preserved Unity-era sources                                                                                |

## Kaynak satırları / Source line counts

<!-- metrics:start -->

| Kapsam / Scope                                     | Dosya / Files | Satır / Lines |
| -------------------------------------------------- | ------------: | ------------: |
| Web istemci / Web client                           |             8 |          5156 |
| Web sunucu / Web server                            |             5 |          1215 |
| Dağıtım servisleri / Deployment services           |            30 |          4014 |
| Paylaşılan oyun / Shared game                      |             1 |           718 |
| Web test ve araçlar / Web tests and tools          |            26 |          4448 |
| Korunan Unity kaynakları / Preserved Unity sources |            75 |         10198 |
| **Toplam / Total**                                 |       **145** |     **25749** |

Aktif web kaynakları / Active web source: **15551** satır / lines.
Fiziksel kaynak satırları; boş satırlar ve yorumlar dahil, üretilen önizleme, bağımlılıklar ve kilit dosyaları hariç. / Physical source lines include comments and blank lines; generated preview, dependencies, and lockfiles are excluded.
<!-- metrics:end -->

## Lisans / License

Bu depo [MIT lisansı](LICENSE) altındadır. © 2026 Emin DEMİRCİ ve MIT bildirimi sayfa kaynağında görülebilir. MIT lisansı kullanıma, değiştirmeye ve dağıtıma izin verir; telif ve izin bildirimi kopyalarda korunmalıdır. Bildirimi kaldırmak veya lisans koşulları dışında davranmak hak ihlaline yol açabilir. Analiz servisinin özgün MIT telif bildirimi [`services/analyze/LICENSE`](services/analyze/LICENSE) içinde korunur; [kaynak bildirimi](docs/ANALYZE-SOURCE.md). Üçüncü taraf bağımlılıkların kendi lisansları geçerlidir. Giriş düğmesindeki [resmî Google G simgesi](https://developers.google.com/static/identity/images/g-logo.png) Google markasıdır ve [marka yönergelerine](https://developers.google.com/identity/branding-guidelines) göre kullanılır; MIT lisansı bu simgeye uygulanmaz.

This repository is licensed under [MIT](LICENSE). The © 2026 Emin DEMİRCİ and MIT notice is visible in page source. MIT permits use, modification, and redistribution provided the copyright and permission notice is retained in copies. Removing the notice or acting outside the license terms may infringe rights. The analytics service retains its original MIT notice in [`services/analyze/LICENSE`](services/analyze/LICENSE); see the [source notice](docs/ANALYZE-SOURCE.md). Third-party dependencies retain their respective licenses. The [official Google G icon](https://developers.google.com/static/identity/images/g-logo.png) on the sign-in button is a Google brand asset used under its [branding guidelines](https://developers.google.com/identity/branding-guidelines); the repository MIT license does not apply to that icon.
