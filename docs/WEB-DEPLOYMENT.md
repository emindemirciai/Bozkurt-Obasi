# Web kurulumu ve dağıtımı / Web setup and deployment

## Türkçe

Bu sürüm Unity derlemesi gerektirmeyen bir web oyunudur. Vite tarayıcı dosyalarını üretir; Node.js 24 aynı adreste hem dosyaları hem HTTP API'yi sunar. Misafir oturumu ve oyun ilerlemesi SQLite üzerinde tutulur. Aktif dağıtım dosyaları kökteki `Dockerfile` ve `compose.yml` dosyalarıdır; `infrastructure/web` eski Unity WebGL dağıtımıdır.

### Yerel çalışma

Node.js **24.x** ve npm kurulu olmalıdır. Depo kökünde:

```bash
npm ci
npm run check
npm test
npm run build
npm start
```

Tarayıcıda <http://127.0.0.1:3000> adresini açın. API ve kalıcı misafir kaydı bu adreste birlikte çalışır. Varsayılan veritabanı yerel `data/` klasöründedir; Git'e ve kaynak ZIP'ine alınmaz.

Hızlı arayüz geliştirme için ayrı bir terminalde `npm run dev` çalıştırın ve gösterilen Vite adresini açın. API geliştirmesi için sunucu da açık olmalıdır. Sunucu olmadan çevrimdışı mod, tarayıcıya kaydeder. `npm run build:preview` sonrasında `preview/index.html` dosyasını çift tıklayarak sunucusuz görsel/oynanabilir önizleme açılabilir; bu tek dosyalık önizleme çevrimdışı mod içindir.

### Docker ile yerel prova

Docker Desktop/Linux Docker Engine açıkken:

```bash
docker compose -f compose.yml -f compose.local.yml config --quiet
docker compose -f compose.yml -f compose.local.yml up --build -d
docker compose -f compose.yml -f compose.local.yml logs --tail 60 game
```

<http://127.0.0.1:3000> adresini açın. `compose.local.yml` yalnızca yerel adresi dışarı açar ve proxy güvenini kapatır. Durdurma: `docker compose -f compose.yml -f compose.local.yml down`. `down -v` oyun verisini sileceği için normal durdurmada kullanılmaz.

İmaj için CI'daki sağlık/kalıcılık provasını ayrıca çalıştırabilirsiniz:

```bash
docker build -t bozkurt-obasi:local .
node scripts/container-smoke.mjs bozkurt-obasi:local
```

Bu prova kendine ait geçici konteyner ve disk oluşturur, gerçek oyun diskinize dokunmaz; sağlık, ana sayfa, misafir oturumu, inşaat ve yeniden başlatmadan sonra kayıt kalıcılığını doğrular.

### GitHub ve Dokploy

1. Kaynakları özel [emindemirciai/Bozkurt-Obasi](https://github.com/emindemirciai/Bozkurt-Obasi) deposunun `main` dalına gönderin. `package-lock.json` dahil olmalıdır. `.env`, `data/`, `node_modules/` ve `artifacts/` gönderilmez.
2. GitHub Actions içindeki **Web checks and container** akışını kontrol edin. Bağımlılık kurulumu, kaynak/sözlük kontrolü, testler, build, önizleme, ZIP ve konteyner sağlık/kalıcılık provası çalışır. Eski **Unity Build** akışı yalnızca elle çağrılır; web sürümü için Unity lisansı gerekmez.
3. Dokploy'da proje ve **Docker Compose** servisi oluşturun; özel GitHub deposunu yetkili bir GitHub bağlantısı veya yalnızca bu depoya erişen deploy anahtarı/token ile bağlayın. Hedef dal `main`, Compose yolu `./compose.yml`, çalışma dizini depo kökü olmalıdır.
4. Deploy çalıştırın. **Domains** bölümüne `bozkurtobasi.com` alan adını ekleyin; servis **game**, konteyner portu **3000** olmalıdır. DNS kaydını VPS'e yönlendirin ve HTTPS'i açın. `www.bozkurtobasi.com` kullanılacaksa aynı servise ekleyip ana adrese yönlendirin. `compose.local.yml` üretimde kullanılmaz.
5. `game-data` adlı volume'u koruyun. Uygulama `/data/game.sqlite` dosyasına yazar. Compose proje/servis kimliğini değiştirmek yeni boş volume oluşturabilir. Güncelleme öncesi Dokploy volume yedeği alın ve geri yüklemeyi ayrı ortamda doğrulayın.
6. Uygulamayı **tek replica** çalıştırın. Bu sürüm aynı SQLite dosyasını farklı sunucular arasında paylaşmaz. Çok düğümlü ölçekleme öncesinde PostgreSQL, hesap/oturum sistemi ve veri taşıma planı gerekir.

Dokploy, Compose servislerini alan adına kendisi bağlar; sabit `container_name`, host portu veya elle Traefik etiketi gerekmiyor. [Dokploy alan adı rehberi](https://docs.dokploy.com/docs/core/docker-compose/domains).

### Alan adı, iletişim ve SMTP

Canlı adres **<https://bozkurtobasi.com>**, genel iletişim adresi **<info@bozkurtobasi.com>** olarak belirlenmiştir. `www.bozkurtobasi.com` isteğe bağlıdır; kullanılırsa tek bir kanonik adrese yönlendirilmelidir.

Bu sürüm e-posta göndermez; iletişim formu, doğrulama e-postası veya parola sıfırlama akışı yoktur. `.env.example` içindeki `SMTP_*` adları ilerideki sunucu tarafı e-posta entegrasyonu için ayrılmış örneklerdir. SMTP sağlayıcısının sunucu adı, portu, TLS yöntemi ve kimlik bilgileri henüz verilmediği için Dokploy'da gerçek SMTP yapılandırması yapılamaz. Sağlayıcı bilgileri geldiğinde parolayı yalnızca Dokploy secret/environment alanında tutun; `.env`, log, Git geçmişi veya kaynak ZIP'ine eklemeyin. `info@bozkurtobasi.com` adresinin var olması tek başına SMTP gönderiminin çalıştığını göstermez.

### Analiz paneline veri akışı

Oyun `compose.yml` ile yayınlandığında `ANALYZE_ENABLED=true`, `ANALYZE_URL=https://analiz.bozkurtobasi.com`, `ANALYZE_SITE_ID=bozkurtobasi.com` ve `ANALYZE_ALLOWED_ORIGINS=https://bozkurtobasi.com,https://www.bozkurtobasi.com` varsayılanlarını kullanır. Dokploy'da bu değerler ayrı ortam değişkenleriyle değiştirilebilir; `ANALYZE_ENABLED=false` gönderimi kapatır. Tarayıcı önce `GET /api/config` ile yalnızca herkese açık kolektör adresini öğrenir, sonra izinli HTTPS oyun alan adından panelin `POST /api/track` uç noktasına ekran görüntüleme ve aynı kimlikte birikimli süre güncellemesi yollar. Oyun kaydı, misafir çerezi, URL sorgusu ve hash gönderilmez. Yerel/çevrimdışı önizleme veri göndermez; DNT/GPC tercihleri dikkate alınır. Analitik erişilemezse oyun çalışmaya devam eder.

**Analiz paneli ayrı bir Dokploy uygulamasıdır.** Panelin kendi deposunu/Dockerfile'ını `analiz.bozkurtobasi.com` alan adına bağlayın ve kalıcı `/app/data` volume'unu koruyun. Aşağıdaki değerleri **panel servisine** girin; Markdown'da görünen bağlantı biçimleri yerine düz URL ve virgülle ayrılmış dizeler kullanın:

```dotenv
NODE_ENV=production
ANALYZE_SITE_ID=bozkurtobasi.com
ANALYZE_SITE_NAME=Bozkurtobasi.com
ANALYZE_TITLE_TR=Bozkurtobasi.com Siteni Analiz Et
ANALYZE_TITLE_EN=Bozkurtobasi.com Analyze Your Site
ANALYZE_METADATA_TITLE=Bozkurtobasi.com Siteni Analiz Et | Trafik Paneli
ANALYZE_DESCRIPTION=Bozkurtobasi.com için gerçek zamanlı trafik analiz paneli
ANALYZE_HEALTH_NAME=Bozkurtobasi.com Siteni Analiz Et
ANALYZE_AUTH_MODE=platform-admin
ANALYZE_AUTH_API_URL=https://api.bozkurtobasi.com
ANALYZE_ALLOWED_ORIGINS=https://bozkurtobasi.com,https://www.bozkurtobasi.com
ANALYZE_EVENT_SITES=bozkurtobasi.com,www.bozkurtobasi.com
ANALYZE_DATA_DIR=/app/data
ANALYZE_MAX_EVENTS=200000
ANALYZE_GEO_LOOKUP=true
```

`platform-admin` modunda panel, verilen API'de `/api/auth/login` ile giriş ve `/api/admin/session` veya `/api/auth/me` ile yönetici oturumu doğrulaması bekler. **Bu oyun deposunun API'si bu uç noktaları içermez.** `api.bozkurtobasi.com` adresinde başka bir yönetici API'si varsa önce bu uç noktaları doğrulayın; yoksa panel girişi çalışmayacaktır. `ANALYZE_GEO_LOOKUP=true` panelin ziyaretçi IP'siyle dış konum servislerine sorgu göndermesine yol açabilir; üretim gizlilik metninde açıklayın. Panel şu anda olayları JSON dosyasında tutar; `200000` kayıt hedefi için disk, yazma süresi ve yedeklemeyi izleyin. Oyun tarafı süre güncellemelerini `pageview` türüyle aynı kayıt kimliğine yollar; panelin mevcut `duration` türünü görüntülemeden filtreleyen davranışı nedeniyle kayıt bu şekilde görünür kalır.

Dağıtımdan sonra `GET https://bozkurtobasi.com/api/config` içindeki `analytics.enabled=true` ve panelde `bozkurtobasi.com` site kimliğiyle görüntüleme artışını doğrulayın. Bu kontrol gerçek tarayıcıda ve izinli üretim alan adında yapılmalıdır; yerel testler canlı paneli beslemez.

### Ortam değişkenleri

| Değişken | Yerel varsayılan | Konteyner | Açıklama |
| --- | --- | --- | --- |
| `HOST` | `127.0.0.1` | `0.0.0.0` | Dinleme adresi |
| `PORT` | `3000` | `3000` | HTTP portu |
| `DATABASE_PATH` | `data/game.sqlite` | `/data/game.sqlite` | Kalıcı SQLite yolu |
| `STATIC_DIR` | `dist` | `/app/dist` | Üretilen tarayıcı dosyaları |
| `TRUST_PROXY` | `false` | Compose'da `true` | Dokploy HTTPS proxy başlıklarına güven |
| `ANALYZE_ENABLED` | `false` | Compose'da `true` | Trafik akışını aç/kapat |
| `ANALYZE_URL` | `https://analiz.bozkurtobasi.com` | Aynı | Analiz panelinin HTTPS origin adresi |
| `ANALYZE_SITE_ID` | `bozkurtobasi.com` | Aynı | Paneldeki site kimliği |
| `ANALYZE_ALLOWED_ORIGINS` | Apex ve `www` | Aynı | Gönderime izinli oyun origin listesi |

`TRUST_PROXY=true` yalnızca güvenilen ters proxy arkasında kullanılmalıdır. Kökteki `.env.example`, çalışan sunucu değişkenlerinin yanında herkese açık proje kimliği ve gelecekteki SMTP entegrasyonu için ayrılmış adları da belgeler. Kullanılmayan SMTP örneklerini dağıtımın çalışması için doldurmak gerekmez. Health endpoint: `GET /api/health`, başarılı yanıt `{"status":"ok"}`. Misafir hesabı tarayıcı çerezine bağlıdır; çerezi temizlemek veya başka cihaz kullanmak aynı ilerlemeyi geri getirmez. Kaynak ZIP'i **oyuncu verisi yedeği değildir**.

### Güncel teslim

```bash
npm run check
npm test
npm run build
npm run build:preview
npm run test:e2e
npm run count:lines
npm run backup
```

Satır sayımı README'nin ölçüm tablosunu günceller. `artifacts/` içinde tarihli temiz kaynak ZIP'i ve SHA-256 kontrol dosyası oluşur. Unity kaynakları arşivde korunur; bağımlılıklar, derleme çıktıları, kişisel ortam dosyaları, oyuncu verileri ve Git geçmişi dışarıda tutulur. ZIP'i açtıktan sonra `npm ci` ile kurulumu tekrarlayın. Sunucudaki log/health kontrolü, GitHub'daki gerçek CI sonucu ve alan adı/TLS kontrolü başarılı olmadan canlı dağıtımın doğrulandığı kabul edilmemelidir.

## English

This release is a browser game without a Unity build requirement. Vite produces browser assets; Node.js 24 serves the assets and HTTP API on the same origin. SQLite persists guest sessions and progress. Use the root `Dockerfile` and `compose.yml`; `infrastructure/web` belongs to the preserved Unity WebGL version.

### Local setup

Install Node.js **24.x** and npm. From the repository root, run `npm ci`, `npm run check`, `npm test`, `npm run build`, and `npm start`. Open <http://127.0.0.1:3000> for the game and persistent guest API. Local database files live in `data/` and are excluded from Git and source archives.

For interface development, run `npm run dev` in a second terminal and open the displayed Vite URL. Keep the API server running for online mode. Offline mode uses browser storage. Run `npm run build:preview`, then double-click `preview/index.html` for a playable offline preview without installing a server.

For a local Docker rehearsal, run `docker compose -f compose.yml -f compose.local.yml up --build -d`. Open <http://127.0.0.1:3000>. The override binds only the loopback address and disables proxy trust. Stop with `docker compose -f compose.yml -f compose.local.yml down`; avoid `down -v` because it deletes persistent game data. Build an image with `docker build -t bozkurt-obasi:local .`, then run `node scripts/container-smoke.mjs bozkurt-obasi:local` to test HTTP health, HTML, guest sessions, construction, and persistence across a restart. The smoke test uses a separate temporary volume.

### GitHub and Dokploy

1. Push the sources, including `package-lock.json`, to the `main` branch of the private [emindemirciai/Bozkurt-Obasi](https://github.com/emindemirciai/Bozkurt-Obasi) repository. Exclude `.env`, `data/`, `node_modules/`, and `artifacts/`.
2. Inspect the actual **Web checks and container** workflow result. It installs locked dependencies, checks sources/translations, runs tests, builds the game and offline preview, creates a clean ZIP, and tests container health and persistence. The old **Unity Build** workflow runs manually only; this web release needs no Unity license.
3. Create a **Docker Compose** service in Dokploy and connect the private repository through an authorized GitHub connection or a deploy key/token scoped to this repository. Select branch `main`, set the Compose path to `./compose.yml`, and use the repository root as the working directory.
4. Deploy, then add `bozkurtobasi.com` under **Domains** with service **game** and container port **3000**. Point DNS at the VPS and enable HTTPS. If `www.bozkurtobasi.com` is used, attach it to the same service and redirect it to the canonical domain. Do not use `compose.local.yml` in production. [Dokploy domain documentation](https://docs.dokploy.com/docs/core/docker-compose/domains).
5. Preserve the `game-data` volume containing `/data/game.sqlite`. Changing the Compose project identity can create an empty volume. Back up the volume before updates and test recovery in a separate environment.
6. Keep **one replica**. Sharing SQLite across multiple hosts is unsupported. PostgreSQL, an account system, and a migration plan are prerequisites for horizontal scaling.

### Domain, contact, and SMTP

The live address is **<https://bozkurtobasi.com>**, and the public contact address is **<info@bozkurtobasi.com>**. `www.bozkurtobasi.com` is optional and should redirect to one canonical hostname if enabled.

This release does not send email and has no contact-form delivery, verification email, or password-reset flow. The `SMTP_*` names in `.env.example` are placeholders reserved for a future server-side mail integration. The SMTP provider hostname, port, TLS mode, and credentials have not been supplied, so production SMTP cannot yet be configured in Dokploy. When provider details are available, store the password only as a Dokploy secret/environment value; never put it in `.env`, logs, Git history, or source archives. An existing `info@bozkurtobasi.com` mailbox does not by itself establish working SMTP delivery.

### Analytics data flow

The game's `compose.yml` defaults to `ANALYZE_ENABLED=true`, `ANALYZE_URL=https://analiz.bozkurtobasi.com`, `ANALYZE_SITE_ID=bozkurtobasi.com`, and `ANALYZE_ALLOWED_ORIGINS=https://bozkurtobasi.com,https://www.bozkurtobasi.com`. Override these in Dokploy if needed, or use `ANALYZE_ENABLED=false` to stop collection. A production HTTPS browser reads the public collector configuration at `GET /api/config` and posts screen views and cumulative time on screen to the panel's `POST /api/track`. The payload omits saves, guest cookies, URL queries, and hashes. Local/offline previews send nothing, DNT/GPC preferences are honored, and an unavailable collector does not block gameplay.

Deploy the analytics panel as a **separate Dokploy application** at `analiz.bozkurtobasi.com`, using its own source/Dockerfile and a persistent volume for `/app/data`. Put the exact panel environment values shown in the Turkish section above into that service. Use plain URL strings and comma-separated lists, without Markdown link syntax. With `ANALYZE_AUTH_MODE=platform-admin`, the panel requires `/api/auth/login` plus `/api/admin/session` or `/api/auth/me` on `https://api.bozkurtobasi.com`. **The game API in this repository does not implement these endpoints.** If a separate admin API is deployed there, verify those endpoints before relying on panel login. `ANALYZE_GEO_LOOKUP=true` can send visitor IPs to external geolocation providers; disclose it in the production privacy notice. The panel stores events in a JSON file; monitor disk usage, write time, and backups with the requested `200000` event limit. The game sends duration updates as the `pageview` type with the same ID, so the panel's existing filter for `duration` rows does not hide visits.

After deployment, check that `GET https://bozkurtobasi.com/api/config` reports `analytics.enabled=true` and that a production browser visit increases the panel's `bozkurtobasi.com` view count. Local tests intentionally do not send live events.

Runtime environment variables are `HOST` (local `127.0.0.1`, container `0.0.0.0`), `PORT` (`3000`), `DATABASE_PATH` (local `data/game.sqlite`, container `/data/game.sqlite`), `STATIC_DIR` (defaults to `dist`), and `TRUST_PROXY` (local `false`, Dokploy Compose `true`). Set proxy trust only behind a trusted reverse proxy. `.env.example` also documents public project identity and names reserved for the future SMTP integration; unused SMTP placeholders do not need values for this release. `GET /api/health` returns `{"status":"ok"}` when ready.

Guest access depends on a browser cookie; clearing cookies or switching devices does not recover the same progress. Source archives do **not** back up player data. Before each delivery, run the check/test/build/preview commands, `npm run count:lines`, and `npm run backup`. The line count refreshes the README table. A dated clean ZIP and SHA-256 sidecar are written to `artifacts/`. Archives preserve the Unity sources and omit dependencies, generated builds, local secrets, player data, and Git history. Reinstall an extracted archive with `npm ci`. A live deployment is only verified after the actual GitHub run, server logs/health, domain, and TLS have been checked.
