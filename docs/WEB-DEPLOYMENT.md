# Bozkurt Obası · Dokploy dağıtımı / Deployment

## Türkçe

### Tek Compose kurulumu

Dokploy'da Docker Compose uygulaması açın, özel [depoyu](https://github.com/emindemirciai/Bozkurt-Obasi) GitHub bağlantınızla seçin ve `main` dalını kullanın. Ekran görüntüsündeki **Compose Path: `./docker-compose.yml`** artık doğrudan çalışır; `./compose.yml` aynı dört servisli içeriğin eşidir. Her iki dosya da depo kökündedir. `compose.local.yml` sadece yerel Docker içindir.

| Alan adı | Servis | Konteyner portu | Durum |
| --- | --- | ---: | --- |
| `bozkurtobasi.com` | `web` | 3000 | Oyun |
| `www.bozkurtobasi.com` | `web` | 3000 | Oyun; kanonik adrese yönlendirme önerilir |
| `api.bozkurtobasi.com` | `api` | 3000 | Oyun ve yönetici API |
| `admin.bozkurtobasi.com` | `admin` | 3000 | Yönetim paneli; DNS kaydı ekleyin |
| `analiz.bozkurtobasi.com` | `analyze` | 3000 | Trafik paneli ve `/api/track` |

Domains ekranında her alan adını ilgili **servise** bağlayın. Dokploy kendi ters proxy yönlendirmesini oluşturur; konteyner host portu veya `container_name` ayarlamak gerekmez. HTTPS'i etkinleştirin ve alan adı değişikliklerinden sonra yeniden deploy edin. [Dokploy Compose alan adı rehberi](https://docs.dokploy.com/docs/core/docker-compose/domains).

### Ortam ve giriş

Compose, ilettiğiniz `ANALYZE_SITE_ID`, `ANALYZE_SITE_NAME`, başlık/açıklama, `ANALYZE_ALLOWED_ORIGINS`, `ANALYZE_EVENT_SITES`, `ANALYZE_DATA_DIR=/app/data`, `ANALYZE_MAX_EVENTS=200000` ve `ANALYZE_GEO_LOOKUP=true` değerleri için varsayılanlar içerir. `ANALYZE_AUTH_MODE=platform-admin` ve `ANALYZE_AUTH_API_URL=https://api.bozkurtobasi.com` da tanımlıdır. Dokploy Environment bölümüne **gerçek yönetici parolasını** ekleyin:

```dotenv
ADMIN_EMAIL=info@bozkurtobasi.com
ADMIN_PASSWORD=<en az 12 karakterlik güçlü parola>
```

`ADMIN_EMAIL` isteğe bağlıdır; `ADMIN_PASSWORD` yönetim ve analiz girişi için zorunludur. Parola eksikse `/api/auth/login` 503 döner; oyun, API health ve analiz kolektörü yine çalışır. Giriş akışı: `POST /api/auth/login` bir bearer token üretir, `GET /api/admin/session` token'ı doğrular, `GET /api/admin/overview` oturum sayılarını verir. Analiz paneli aynı token'ı sunucu tarafında doğrular. Yönetici paneli TR/EN dil değiştirir. Parolayı kaynak dosyalarına veya ZIP'e yazmayın.

`ANALYZE_ENABLED=true` ile üretimde oyun tarayıcısı `GET /api/config` yanıtından kolektör URL'sini alır ve ekran görüntüleme/süre olaylarını `https://analiz.bozkurtobasi.com/api/track` adresine yollar. Sadece `bozkurtobasi.com` ve `www.bozkurtobasi.com` origin'leri kabul edilir. Oyun kaydı, kaynakları, misafir çerezi ve URL parametreleri gönderilmez; DNT/GPC dikkate alınır. `ANALYZE_GEO_LOOKUP=true` ziyaretçi IP'siyle konum çözümleyebilir; canlı gizlilik metninde açıklayın. SMTP gönderimi henüz uygulanmamıştır.

### Kalıcılık ve geri dönüş

`game-data:/data` SQLite oyun verisini; `analyze-data:/app/data` analiz olaylarını saklar. Dokploy Volume Backups ile **iki volume'u da** yedekleyin ve geri yüklemeyi ayrı ortamda deneyin. `down -v` veya Fresh Volumes veri siler. Compose proje adını değiştirmek yeni, boş volume yaratabilir. SQLite nedeniyle `api` ve `analyze` tek replica çalışır.

Dağıtım sonrası şunları kontrol edin:

```text
https://bozkurtobasi.com/
https://bozkurtobasi.com/api/health
https://api.bozkurtobasi.com/api/health
https://admin.bozkurtobasi.com/
https://analiz.bozkurtobasi.com/api/health
https://analiz.bozkurtobasi.com/login
```

Yönetici girişini ve oyundaki bir ekran gezintisinden sonra analiz olaylarının panelde görünmesini ayrıca sınayın. Yerel Docker/CI başarısı canlı DNS, TLS veya VPS erişimini doğrulamaz.

### Yerel Docker

```bash
docker compose -f compose.yml -f compose.local.yml config --quiet
docker compose -f compose.yml -f compose.local.yml up --build -d
docker compose -f compose.yml -f compose.local.yml ps
```

Yerel portlar: `3000 web`, `3001 api`, `3002 admin`, `3003 analyze`; yalnızca `127.0.0.1` üzerinde dinler. Yerel `ADMIN_PASSWORD` ortam değişkenini ayarlayıp Compose'u başlatırsanız hem yönetim hem analiz girişi çalışır. Yerel override, dış analitik gönderimini kapatır, panel auth URL'sini dahili `http://api:3000` adresine taşır ve konum sorgusunu kapatır. Durdurma: `docker compose -f compose.yml -f compose.local.yml down` (volume'ları korur).

### Canlı yönetici girişi ve 502 sorunları

API yönetici oturumunda admin_unavailable (503) dönüyorsa Dokploy Environment içindeki **ADMIN_PASSWORD** değerini (en az 12 karakter) ve girişte kullanılacak **ADMIN_EMAIL** değerini doğrulayın. Kaydedip Compose uygulamasını yeniden dağıtın; API'nin yeni ortamı aldığını kontrol edin. **admin.bozkurtobasi.com** sayfası veya /healthz yolu 502 dönerse Domains eşlemesini **admin:3000** olarak doğrulayın, admin konteynerinin çalıştığını ve sağlık kontrolünü inceleyin, ardından Dokploy loglarındaki başlangıç/çalışma hatasını giderin. Parolayı log veya destek mesajına eklemeyin.

## English

Create one Docker Compose application in Dokploy from the private [repository](https://github.com/emindemirciai/Bozkurt-Obasi), branch `main`. The screenshot's existing **Compose Path `./docker-compose.yml`** now works; `./compose.yml` contains the same stack. Map the apex and `www` to `web:3000`, `api.bozkurtobasi.com` to `api:3000`, `admin.bozkurtobasi.com` to `admin:3000`, and `analiz.bozkurtobasi.com` to `analyze:3000`. Add admin DNS, enable HTTPS, and redeploy after domain changes. Dokploy handles the reverse proxy; see its [Compose domain guide](https://docs.dokploy.com/docs/core/docker-compose/domains).

The supplied `ANALYZE_*` values are defaults in Compose, including the production origin list, 200,000-event limit, geo lookup, and `platform-admin` auth against `https://api.bozkurtobasi.com`. Add a strong **`ADMIN_PASSWORD` of at least 12 characters** in Dokploy; `ADMIN_EMAIL` defaults to `info@bozkurtobasi.com`. Without the password, gameplay and health endpoints work, but admin/analytics login returns unavailable. Never commit the secret. The API implements login, bearer session validation, logout, and protected guest-session counts. The analytics panel uses the same admin login.

`game-data` stores SQLite game progress; `analyze-data` stores analytics events. Back up both volumes independently and test restores. Fresh Volumes or `down -v` deletes data. Keep one replica for the SQLite services. Production tracking sends only screen views and cumulative duration, honors DNT/GPC, and excludes game saves, resources, guest cookies, and URL parameters. Geo lookup may use visitor IPs; disclose it in the live privacy notice. SMTP delivery is not implemented.

For a local rehearsal, run `docker compose -f compose.yml -f compose.local.yml up --build -d`. Open game on <http://127.0.0.1:3000>, API on port 3001, admin on 3002, and analytics on 3003. Set `ADMIN_PASSWORD` in your shell before starting if you want to sign in. Local Compose disables outgoing game analytics and points panel auth to the internal API. Stop with `docker compose -f compose.yml -f compose.local.yml down` to preserve volumes. After production deployment, check every HTTPS health/page URL listed above and verify an actual game visit appears in the analytics panel.

### Live admin sign-in and 502 troubleshooting

If the API admin session returns admin_unavailable (503), verify **ADMIN_PASSWORD** (at least 12 characters) and the intended **ADMIN_EMAIL** in Dokploy Environment. Save and redeploy the Compose application so the API receives the new environment. If the **admin.bozkurtobasi.com** page or /healthz returns 502, verify its Domains mapping targets **admin:3000**, check that the admin container is running and healthy, and inspect Dokploy logs for startup or runtime errors. Keep the password out of logs and support messages.
