# Bozkurt Obası: Ay-Yıldız Nöbeti

**TR:** “Obanı kur, sürünü koru.” Tarayıcıda oynanabilen köy kurma ve sürü savunma oyunu. Kurtlar ve sürü savaşta çakallara bakar.

**EN:** “Build your village. Guard your herd.” A browser village builder and herd defense game. Wolves and the herd face the jackals in battle.

[Çevrimdışı oynanabilir önizleme / Offline playable preview](preview/index.html) · [Dokploy rehberi / Deployment guide](docs/WEB-DEPLOYMENT.md) · [Doğrulama / Validation](docs/WEB-VALIDATION.md) · [Kaynak depo / Repository](https://github.com/emindemirciai/Bozkurt-Obasi)

## Türkçe

### Hemen oyna

[`preview/index.html`](preview/index.html) dosyasını indirip tarayıcıda açın; internet veya sunucu gerektirmez. Bu dosya yerel kayıt kullanan tek dosyalık oyun önizlemesidir. GitHub dosya görüntüleyicisi oyunu çalıştırmaz. Node.js 24 ile yerel API ve kalıcı SQLite kullanmak için:

```bash
npm ci
npm run build
npm start
```

Ardından <http://127.0.0.1:3000> adresini açın. Oyun yerel köyle başlar; “Sunucuya bağlan” ayrı bir çevrim içi misafir köyü oluşturur. Yerel ve sunucu kayıtları birbirine aktarılmaz.

Oyunda 9 yapı türü, kaynak üretimi, 5 eğitilebilir muhafız, hilal/yıldız formasyonları, 5 çakal taktiği, dalga savaşları, 4 bölge ve görevler bulunur. Arayüz Türkçe/İngilizcedir. Bu ilk oynanabilir web sürümünde PvP, arkadaş/sohbet, hesap kurtarma ve ödeme yoktur. Misafir köyü 30 günlük tarayıcı çerezine bağlıdır; çerez silinirse başka cihazdan geri getirilemez.

### Tek Dokploy Compose, dört servis

Dokploy'da depo `main` dalını bağlayın. Ekrandaki **Compose Path = `./docker-compose.yml`** ayarı doğrudan çalışır; `./compose.yml` aynı dört servisi içerir. Servislerin tamamı tek Compose içinde üretilir:

| Alan adı | Dokploy servisi | Port | İşlev |
| --- | --- | ---: | --- |
| `bozkurtobasi.com` ve `www.bozkurtobasi.com` | `web` | 3000 | Oyun ve aynı kaynaklı `/api` proxy |
| `api.bozkurtobasi.com` | `api` | 3000 | Oyun API'si ve yönetici kimlik doğrulaması |
| `admin.bozkurtobasi.com` | `admin` | 3000 | İki dilli yönetim paneli; DNS kaydı eklenmeli |
| `analiz.bozkurtobasi.com` | `analyze` | 3000 | Trafik kolektörü ve analiz paneli |

Dokploy ortamında **`ADMIN_PASSWORD` değerini en az 12 karakterlik güçlü bir sır** olarak tanımlayın. Varsayılan yönetici e-postası `info@bozkurtobasi.com`; `ADMIN_EMAIL` ile değiştirilebilir. Parola olmadan oyun ve sağlık kontrolleri çalışır, ancak yönetim/analiz girişi kapalı kalır. Parolayı Git'e, ZIP'e veya ekran görüntüsüne koymayın. `ANALYZE_AUTH_MODE=platform-admin` ve `ANALYZE_AUTH_API_URL=https://api.bozkurtobasi.com` Compose'da hazırdır. Verdiğiniz diğer `ANALYZE_*` varsayılanları da [Compose dosyasında](compose.yml) tanımlıdır. Domain değişikliklerinden sonra Dokploy'da yeniden dağıtın.

`game-data` volume'u `/data/game.sqlite` dosyasını, `analyze-data` volume'u `/app/data` olaylarını korur. İki veriyi de ayrıca yedekleyin. SQLite kullanan API ve analiz servisi tek replica çalışır. SMTP gönderimi ve parola sıfırlama henüz uygulanmadı; `info@bozkurtobasi.com` iletişim adresidir.

Yerelde dört servisi açmak için Docker Desktop ile:

```bash
docker compose -f compose.yml -f compose.local.yml up --build -d
```

Portlar: oyun <http://127.0.0.1:3000>, API <http://127.0.0.1:3001>, yönetim <http://127.0.0.1:3002>, analiz <http://127.0.0.1:3003>. Yerelde yönetici girişi için `ADMIN_PASSWORD` ortam değişkenini Compose komutundan önce tanımlayın. Yerel Compose oyun analitiğini kapatır ve analiz panelinin auth çağrısını dahili API'ye yöneltir. Durdurmak için `docker compose -f compose.yml -f compose.local.yml down` kullanın; `down -v` kalıcı volume'ları siler.

### Trafik ve doğrulama

Üretimde oyun, `GET /api/config` üzerinden izinli kolektör adresini alır ve köy/savaş/dünya/kurt/görev ekran görüntüleme ve süre olaylarını `https://analiz.bozkurtobasi.com/api/track` adresine gönderir. Oyun kaydı, kaynaklar, URL parametreleri ve misafir çerezi gönderilmez. DNT/GPC tercihleri dikkate alınır; çevrimdışı/yerel oyun trafik üretmez. `ANALYZE_GEO_LOOKUP=true` konum çözümlemesi yapabilir; canlı gizlilik metninde açıklayın.

`npm run verify` kaynak kontrolü, motor/API testleri, üretim ve tek dosya derlemesi, tarayıcı testlerini çalıştırır. `npm run count:lines` aşağıdaki sayımı yeniler; `npm run backup` `artifacts/` altında temiz kaynak ZIP'i ve SHA-256 dosyası oluşturur. ZIP oyuncu veritabanlarını, sırları, bağımlılıkları veya Git geçmişini içermez. Güncel sonuçlar [doğrulama kaydında](docs/WEB-VALIDATION.md).

## English

### Play now

Download and open [`preview/index.html`](preview/index.html) in a browser for the self-contained offline game. GitHub's file viewer cannot run it. For the persistent SQLite-backed local server, install Node.js 24, then run `npm ci`, `npm run build`, and `npm start`. Open <http://127.0.0.1:3000>. “Connect to server” starts a separate guest village; local saves are not uploaded.

The playable release includes nine building types, resource production, five trainable guardians, crescent/star formations, five jackal tactics, wave combat, four regions, and quests. It supports Turkish and English. PvP, chat, recoverable accounts, and payments are not yet included. Guest progress depends on a 30-day browser cookie.

### Four services in one Dokploy Compose stack

Connect the private repository's `main` branch and keep the existing **Compose Path `./docker-compose.yml`**. `./compose.yml` is an identical alternative. Map both game domains to `web:3000`, `api.bozkurtobasi.com` to `api:3000`, `admin.bozkurtobasi.com` to `admin:3000`, and `analiz.bozkurtobasi.com` to `analyze:3000`. Add DNS for the admin subdomain before using it. Redeploy after changing domains.

Set **`ADMIN_PASSWORD` to a strong secret of at least 12 characters** in Dokploy. The default email is `info@bozkurtobasi.com`, overridable with `ADMIN_EMAIL`. Without the password, gameplay and health checks work, but admin and analytics login cannot succeed. Do not commit the secret. The supplied `ANALYZE_*` defaults and platform-admin/API URL are already in [`compose.yml`](compose.yml). `game-data` holds SQLite game progress; `analyze-data` holds analytics events. Back up both separately and keep one replica for the SQLite services. SMTP sending and password recovery are not implemented.

For a local four-service preview, run `docker compose -f compose.yml -f compose.local.yml up --build -d`. Ports are game 3000, API 3001, admin 3002, analytics 3003 on loopback. Set `ADMIN_PASSWORD` in the shell first to sign in locally. The local override disables outgoing game analytics and uses the internal API for panel authentication. Stop with `docker compose -f compose.yml -f compose.local.yml down`, preserving data volumes.

### Traffic, checks and backup

On production HTTPS, the game sends screen views and cumulative duration for village, battle, world, wolves, and quests to the bundled analytics collector. Payloads omit saves, resources, URL parameters, and guest cookies. DNT/GPC are honored; local/offline play sends nothing. Geo lookup can use visitor IPs when enabled, so disclose it in the production privacy notice.

Run `npm run verify` for checks, tests, builds, and browser tests. Run `npm run count:lines` to refresh the table below and `npm run backup` for a clean source ZIP and SHA-256 sidecar in `artifacts/`. The ZIP excludes player data, secrets, dependencies, generated builds, and Git history. See the [validation record](docs/WEB-VALIDATION.md) and [deployment guide](docs/WEB-DEPLOYMENT.md).

## Depo yapısı / Repository layout

| Yol / Path | İçerik / Contents |
| --- | --- |
| `web/`, `shared/` | Oyun arayüzü ve kuralları / Game UI and rules |
| `server/web/` | Oyun ve yönetici API'si, SQLite / Game and admin API, SQLite |
| `services/web/` | Nginx oyun gateway / Nginx game gateway |
| `services/admin/` | İki dilli yönetim arayüzü / Bilingual admin UI |
| `services/analyze/` | MIT lisanslı analiz paneli ve kolektör / MIT analytics dashboard and collector |
| `tests/`, `scripts/` | Test, önizleme, ölçüm ve ZIP / Tests, preview, metrics, and ZIP |
| `preview/index.html` | Tek dosyalık oynanabilir oyun / Standalone playable game |
| `Assets/`, `client/`, `infrastructure/` | Korunan Unity dönemi kaynakları / Preserved Unity-era sources |

## Kaynak satırları / Source line counts

<!-- metrics:start -->
| Kapsam / Scope | Dosya / Files | Satır / Lines |
| --- | ---: | ---: |
| Web istemci / Web client | 6 | 3251 |
| Web sunucu / Web server | 4 | 721 |
| Dağıtım servisleri / Deployment services | 29 | 3762 |
| Paylaşılan oyun / Shared game | 1 | 721 |
| Web test ve araçlar / Web tests and tools | 17 | 1945 |
| Korunan Unity kaynakları / Preserved Unity sources | 75 | 10198 |
| **Toplam / Total** | **132** | **20598** |

Aktif web kaynakları / Active web source: **10400** satır / lines.
Fiziksel kaynak satırları; boş satırlar ve yorumlar dahil, üretilen önizleme, bağımlılıklar ve kilit dosyaları hariç. / Physical source lines include comments and blank lines; generated preview, dependencies, and lockfiles are excluded.
<!-- metrics:end -->

## Lisans / License

Bu depo [MIT lisansı](LICENSE) altındadır. Analiz servisinin özgün MIT telif bildirimi [`services/analyze/LICENSE`](services/analyze/LICENSE) içinde korunur; [kaynak bildirimi](docs/ANALYZE-SOURCE.md). Üçüncü taraf bağımlılıkların kendi lisansları geçerlidir.

This repository is licensed under [MIT](LICENSE). The analytics service retains its original MIT notice in [`services/analyze/LICENSE`](services/analyze/LICENSE); see the [source notice](docs/ANALYZE-SOURCE.md). Third-party dependencies retain their respective licenses.
