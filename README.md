# Bozkurt Obası: Ay-Yıldız Nöbeti · Web v1.0.0

**TR:** “Obanı kur, sürünü koru.” Tarayıcıda çalışan köy kurma ve sürü savunma oyunu. Yurdunu geliştir; bozkurtlarını hilal, sürünü yıldız düzeninde koru. Unity veya 3B modelleme araçları kurulmadan oynanabilir.

**EN:** “Build your village. Guard your herd.” A browser village-building and herd-defense game. Grow your settlement and defend a star-shaped herd with a crescent of wolves. Play without installing Unity or 3D modeling tools.

[Türkçe](#türkçe) · [English](#english) · [bozkurtobasi.com](https://bozkurtobasi.com) · [Önizleme / Preview](preview/index.html) · [Dağıtım / Deployment](docs/WEB-DEPLOYMENT.md) · [Yol haritası / Roadmap](docs/WEB-ROADMAP.md)

## Türkçe

### Hemen dene

İndirdiğiniz ZIP'i açın ve **`preview/index.html`** dosyasını çift tıklayın. Bu, kaynakları ve oyun kodu içinde bulunan, internetsiz oynanabilen tek dosyalık önizlemedir. GitHub dosya görüntüleyicisi oyunu çalıştırmaz; dosyayı indirip tarayıcıda açın. Kök `index.html`, Vite geliştirmesinin giriş dosyasıdır ve doğrudan çift tıklamayla kullanım için hazırlanmaz.

Yerel sunucu ve SQLite kaydı için **Node.js 24.x** kurun, depo kökünde çalıştırın:

```bash
npm ci
npm run build
npm start
```

Tarayıcıda **<http://127.0.0.1:3000>** adresini açın. Oyun yerel köyle başlar; üst bölümdeki bağlantı düğmesinden **Sunucuya bağlan** seçerek ayrı bir çevrim içi misafir köyü açın. Yerel kayıt sunucuya yüklenmez; iki köy birbirinden bağımsızdır. Sunucu modunda kaynakları, inşaatı ve savaş sonuçlarını sunucu doğrular ve SQLite'a yazar.

### Bu sürümde oynanabilenler

**Son görsel düzeltme:** Savaş hazırlığında ve savaş sırasında kurtlar ile karma sürü çakalların geldiği sola bakar. Hilal/yıldız yerleşimi ve sağlık göstergeleri korunur.

- 9 yapı türü ve seviye geliştirme; su, yem, şifalı bitki, odun, taş üretimi ve depo kapasitesi.
- 5 muhafız; deneyim, seviye, eğitim puanları ve Muhafız/Avcı/Lider/Şifacı eğitimleri.
- Hilal ve yıldız için 3 formasyon seçeneği, 5 çakal taktiği, dalga savaşları, yaralanma, sürü paniği, dinlenme ve tedavi.
- 4 bölge arasında kaynak tüketen yolculuklar ve 4 ödüllü görev.
- Türkçe/İngilizce arayüz, responsive köy/savaş ekranları, yerel otomatik kayıt ve JSON kayıt dışa aktarma.
- Aynı oyunun Node API üzerinden sunucu kontrollü misafir ilerlemesi; kalıcı SQLite ve Docker/Dokploy dağıtım dosyaları.

Bu **ilk oynanabilir web MVP'sidir**. Önceki Unity WP-00–WP-11 kapsamının tamamının taşındığı iddia edilmez. PvP, sohbet, arkadaş sistemi, kooperatif oyun, paylaşılan dünya, hesap açma, ödeme ve hesap kurtarma bu sürümde yoktur. Savaş bir formasyon/taktik simülasyonudur; Unity'deki tek tek birim sürükleme/hareket emri sistemi taşınmamıştır.

Misafir erişimi **30 günlük tarayıcı çerezine** bağlıdır. Çerezi silmek veya cihaz/tarayıcı değiştirmek aynı köye erişimi geri getirmez. Yerel ilerleme tarayıcı depolamasına bağlıdır; JSON dışa aktarma, dosya yedeği sağlar ancak bu sürümde kullanıcı arayüzünden JSON içe aktarma yoktur. Kaynak üretiminde çevrimdışı birikim en fazla 8 saat hesaplanır. Kaynak ZIP'i oyuncu veritabanını içermez.

### Geliştirme ve kontroller

Hızlı geliştirme için iki terminal kullanın:

```bash
# Terminal 1 — API
npm run dev:server
```

```bash
# Terminal 2 — Vite istemci, http://127.0.0.1:5173
npm run dev
```

Vite, `/api` isteklerini yerel `3000` portuna yönlendirir. İlk tarayıcı testi için `npx playwright install chromium` çalıştırın. Linux üzerinde sistem paketleri gerekiyorsa CI'daki gibi `npx playwright install --with-deps chromium` kullanın.

| Komut | Görevi |
| --- | --- |
| `npm run verify` | Kaynak/sözlük kontrolü → motor/API testleri → üretim derlemesi → tek dosya önizleme → tarayıcı testleri |
| `npm run check` | JS sözdizimi, TR/EN anahtar eşliği ve dağıtım kaynakları |
| `npm test` | Ortak oyun motoru ve gerçek SQLite kullanan HTTP API testleri |
| `npm run test:e2e` | Playwright tarayıcı testleri |
| `npm run build:preview` | Güncel `preview/index.html` oluşturur |
| `npm run count:lines` | Aşağıdaki kaynak satırı tablosunu yeniler |
| `npm run backup` | `artifacts/` içinde temiz kaynak ZIP'i ve SHA-256 dosyası oluşturur |

Her teslimden önce doğrulama ve önizleme çalıştırılır; ardından README güncellenir, satır sayımı ve temiz ZIP üretilir. ZIP'te mevcut Unity kaynakları da korunur. `node_modules`, derleme çıktıları, yerel önbellekler, `.env`, oyuncu verileri, Git geçmişi ve eski yedekler dışarıda tutulur. Yeni ortamda `npm ci` ile kurulum tekrar yapılır.

### GitHub ve VPS

GitHub otomatik kontrolü `.github/workflows/web-ci.yml` içindedir. Akış test/build/tarayıcı kontrollerinden sonra Docker imajını derler; sağlık, misafir işlem yapma ve konteyner yeniden başlatıldıktan sonra SQLite kalıcılığını sınar. Eski Unity workflow'u yalnızca elle çalışır.

Dokploy'da **Docker Compose** servisi ve `./compose.yml` kullanın. Domain ayarında servis **game**, port **3000** seçin. `/data` için `game-data` volume'unu koruyun ve **tek replica** çalıştırın. Yerel Docker provası için `docker compose -f compose.yml -f compose.local.yml up --build -d` kullanın. Ayrıntılar ve yedekleme sınırları [dağıtım rehberinde](docs/WEB-DEPLOYMENT.md).

Kaynak depo: [github.com/emindemirciai/Bozkurt-Obasi](https://github.com/emindemirciai/Bozkurt-Obasi) (private). Yayın alan adı: [bozkurtobasi.com](https://bozkurtobasi.com). Genel iletişim adresi: [info@bozkurtobasi.com](mailto:info@bozkurtobasi.com). SMTP ile e-posta gönderimi veya iletişim formu bu sürümde uygulanmadı; sağlayıcı sunucusu, port, TLS türü ve gizli parola yalnızca Dokploy ortamında tanımlanmalıdır. Yerel test başarısı, GitHub'daki gerçek akışın veya VPS dağıtımının çalıştırıldığı anlamına gelmez; gerçek CI ve Dokploy sonuçlarını ayrıca doğrulayın. [Sonraki aşamalar](docs/WEB-ROADMAP.md): dengeleme, hesap ve cihazlar arası devamlılık, ardından ortak dünya altyapısı.

### Trafik analizi

Üretim alan adında oyun, [analiz.bozkurtobasi.com](https://analiz.bozkurtobasi.com) panelinin `/api/track` uç noktasına köy, savunma, dünya, kurtlar ve görevler ekranları için görüntüleme ve ekranda geçirilen süre bilgisi gönderir. Her ekran için tek bir kayıt kimliği kullanılır; süre aynı kaydı günceller. URL parametreleri, oyun kaydı, kaynaklar ve misafir çerezi gönderilmez. Yerel sunucu/ZIP önizlemesi trafik oluşturmaz; tarayıcının Do Not Track ve Global Privacy Control tercihlerine uyulur. Kolektör IP adresinden konum çıkarmak için `ANALYZE_GEO_LOOKUP=true` ayarını kullanabilir; bunun dağıtımdan önce gizlilik metninde açıklanması gerekir.

Oyun konteynerinde varsayılan `ANALYZE_ENABLED=true`, `ANALYZE_URL=https://analiz.bozkurtobasi.com`, `ANALYZE_SITE_ID=bozkurtobasi.com` ve iki üretim adresini içeren `ANALYZE_ALLOWED_ORIGINS` kullanılır. Analiz paneli **ayrı bir Dokploy servisi** olarak dağıtılır; verdiğiniz diğer `ANALYZE_*` değerleri o servise aittir. Panelin `platform-admin` girişi, `https://api.bozkurtobasi.com` üzerinde gerçek yönetici giriş/oturum uç noktaları gerektirir; oyun API'si bunları sağlamaz. Kurulum adımları ve tam değişken listesi [dağıtım rehberinde](docs/WEB-DEPLOYMENT.md).

Güncel yerel kontrollerin sonuçları [doğrulama kaydında](docs/WEB-VALIDATION.md). GitHub Actions sonucu push sonrasında, Dokploy sonucu ise dağıtım sonrasında ayrıca kontrol edilir.

## English

### Play now

Extract the source ZIP and double-click **`preview/index.html`**. This self-contained file includes the game code and artwork and works offline. GitHub's file viewer does not run the game; download and open it in a browser. The root `index.html` is the Vite entry point and requires the development/build workflow.

For the local server and persistent SQLite storage, install **Node.js 24.x** and run `npm ci`, `npm run build`, and `npm start` from the repository root. Open **<http://127.0.0.1:3000>**. The game begins with a local village; use the connection button and **Connect to server** to open a separate online guest village. Local progress is not uploaded. Server mode validates resource changes, construction, and battle outcomes before persisting them in SQLite.

### Playable scope

**Latest visual correction:** During battle preparation and combat, wolves and the mixed herd face left toward the attacking jackals. Crescent/star positions and health indicators are preserved.

- 9 building types and upgrades; water, feed, herbs, wood, stone production, and storage capacity.
- 5 guardians with XP, levels, skill points, and Guardian/Hunter/Leader/Healer training.
- 3 formation choices for the wolf crescent and herd star, 5 jackal tactics, wave battles, injuries, herd panic, rest, and healing.
- Resource-consuming travel between 4 regions and 4 reward-bearing quests.
- Turkish/English interface, responsive village/combat views, local autosave, and JSON save export.
- Server-controlled guest progression through the Node API, persistent SQLite, and Docker/Dokploy deployment files.

This is an **initial playable web MVP**, not a claim that every Unity WP-00–WP-11 feature has been ported. There is no PvP, chat, friends system, co-op, shared world, account signup, payment, or account recovery. Combat is a formation/tactics simulation; individual-unit movement commands from the Unity version have not been ported.

Guest access depends on a **30-day browser cookie**. Clearing cookies or switching devices/browsers does not recover the same village. Local progress depends on browser storage; JSON export provides a file backup, but a user-facing JSON import flow is not implemented. Offline resource production is capped at 8 hours. Source archives do not include player databases.

### Development and verification

Use two terminals: `npm run dev:server` for the API, and `npm run dev` for Vite at <http://127.0.0.1:5173>. Vite forwards `/api` requests to port `3000`. Install the test browser once with `npx playwright install chromium`; on Linux, `npx playwright install --with-deps chromium` also installs required system dependencies.

Run `npm run verify` for source/translation checks, engine/API tests, the production build, the offline preview, and Playwright browser tests. Individual commands are `npm run check`, `npm test`, `npm run build`, `npm run build:preview`, and `npm run test:e2e`. Run `npm run count:lines` to update the metrics below and `npm run backup` to create a dated clean source ZIP plus SHA-256 sidecar in `artifacts/`.

Every delivery includes an updated bilingual README, actual verification results, line counts, a current standalone preview, and a clean source ZIP. Archives retain Unity sources and exclude dependencies, generated builds, local caches, `.env`, player data, Git history, and previous archives. Reinstall extracted sources using `npm ci`.

### GitHub and VPS

`.github/workflows/web-ci.yml` runs checks, tests, production/preview builds, browser tests, and a Docker health/action/persistence smoke test. The preserved Unity workflow is manual only. In Dokploy, create a **Docker Compose** service using `./compose.yml`; route the domain to service **game**, port **3000**. Preserve the `game-data` volume mounted at `/data` and run **one replica**. For local Docker, run `docker compose -f compose.yml -f compose.local.yml up --build -d`.

Source repository: [github.com/emindemirciai/Bozkurt-Obasi](https://github.com/emindemirciai/Bozkurt-Obasi) (private). Canonical domain: [bozkurtobasi.com](https://bozkurtobasi.com). Public contact: [info@bozkurtobasi.com](mailto:info@bozkurtobasi.com). SMTP delivery and a contact form are not implemented in this release; provider host, port, TLS mode, and secret password belong only in Dokploy's environment. Passing local tests does not establish that a real GitHub run or VPS deployment has completed. See the [deployment guide](docs/WEB-DEPLOYMENT.md) for setup and backup boundaries, and the [roadmap](docs/WEB-ROADMAP.md) for balancing, recoverable accounts, and shared-world infrastructure.

### Traffic analytics

On the production origin, the game sends screen views and time on each screen to the `/api/track` endpoint at [analiz.bozkurtobasi.com](https://analiz.bozkurtobasi.com). The village, battle, world, wolves, and quests screens each use one record ID, updated with cumulative duration. The payload excludes URL parameters, game saves, resources, and guest cookies. Local servers and the offline ZIP preview do not generate traffic; Do Not Track and Global Privacy Control are respected. With `ANALYZE_GEO_LOOKUP=true`, the collector may derive location from the visitor IP; disclose this in the production privacy notice.

The game container defaults to `ANALYZE_ENABLED=true`, `ANALYZE_URL=https://analiz.bozkurtobasi.com`, `ANALYZE_SITE_ID=bozkurtobasi.com`, and an `ANALYZE_ALLOWED_ORIGINS` list for the apex and `www` domains. Deploy the analytics panel as a **separate Dokploy service**, with the other `ANALYZE_*` variables you supplied. Its `platform-admin` mode requires working admin login/session endpoints at `https://api.bozkurtobasi.com`; the game API does not provide these. See the [deployment guide](docs/WEB-DEPLOYMENT.md) for the complete settings.

Current local check results are in the [validation record](docs/WEB-VALIDATION.md). Verify the GitHub Actions run after pushing and the Dokploy service after deployment.

## Depo yapısı / Repository layout

| Yol / Path | İçerik / Contents |
| --- | --- |
| `web/` | Tarayıcı arayüzü, SVG çizimleri, TR/EN / Browser UI, SVG artwork, TR/EN |
| `shared/game.mjs` | İstemci ve sunucunun ortak oyun kuralları / Shared client/server rules |
| `server/web/` | Node HTTP API ve SQLite / Node HTTP API and SQLite |
| `tests/` | Motor, API ve tarayıcı testleri / Engine, API, and browser tests |
| `scripts/` | Doğrulama, önizleme, ölçüm ve ZIP / Checks, preview, metrics, and ZIP |
| `preview/index.html` | Üretilen tek dosya oyun / Generated standalone playable game |
| `Dockerfile`, `compose.yml` | Aktif web dağıtımı / Active web deployment |
| `client/`, `Assets/`, `infrastructure/`, `tools/` | Korunan Unity dönemi kaynakları / Preserved Unity-era sources |
| `docs/UNITY-LEGACY-README.md` | Unity dönemi kapsamının yeni markaya uyarlanmış kaydı / Unity-era scope updated for the new brand |

## Kaynak satırları / Source line counts

<!-- metrics:start -->
| Kapsam / Scope | Dosya / Files | Satır / Lines |
| --- | ---: | ---: |
| Web istemci / Web client | 6 | 3251 |
| Web sunucu / Web server | 3 | 554 |
| Paylaşılan oyun / Shared game | 1 | 721 |
| Web test ve araçlar / Web tests and tools | 14 | 1648 |
| Korunan Unity kaynakları / Preserved Unity sources | 75 | 10198 |
| **Toplam / Total** | **99** | **16372** |

Aktif web kaynakları / Active web source: **6174** satır / lines.
Fiziksel kaynak satırları; boş satırlar ve yorumlar dahil, üretilen önizleme, bağımlılıklar ve kilit dosyaları hariç. / Physical source lines include comments and blank lines; generated preview, dependencies, and lockfiles are excluded.
<!-- metrics:end -->

## Lisans / License

Mevcut [LICENSE](LICENSE) geçerlidir; açık kaynak lisansı varsaymayın. / The existing [LICENSE](LICENSE) applies; do not assume an open-source license.
