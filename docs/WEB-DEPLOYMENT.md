# Bozkurt Obası · Dokploy dağıtımı / Deployment

## Türkçe

### Tek Compose kurulumu

Dokploy'da Docker Compose uygulaması açın, özel [depoyu](https://github.com/emindemirciai/Bozkurt-Obasi) GitHub bağlantınızla seçin ve `main` dalını kullanın. Ekran görüntüsündeki **Compose Path: `./docker-compose.yml`** artık doğrudan çalışır; `./compose.yml` aynı dört servisli içeriğin eşidir. Her iki dosya da depo kökündedir. `compose.local.yml` sadece yerel Docker içindir.

| Alan adı | Servis | Konteyner portu | Durum |
| --- | --- | ---: | --- |
| `bozkurtobasi.com` | `web` | 3000 | Görselli ana sayfa, oyun, gizlilik ve koşullar |
| `www.bozkurtobasi.com` | `web` | 3000 | Aynı anasayfa/oyun; kanonik adrese yönlendirme önerilir |
| `api.bozkurtobasi.com` | `api` | 3000 | Oyun ve yönetici API |
| `admin.bozkurtobasi.com` | `admin` | 3000 | Yönetim paneli; canlı 502 için Dokploy eşlemesini düzeltin |
| `analiz.bozkurtobasi.com` | `analyze` | 3000 | Trafik paneli ve `/api/track` |

Domains ekranında her alan adını ilgili **servise** bağlayın. Dokploy kendi ters proxy yönlendirmesini oluşturur; konteyner host portu veya `container_name` ayarlamak gerekmez. HTTPS'i etkinleştirin ve alan adı değişikliklerinden sonra yeniden deploy edin. [Dokploy Compose alan adı rehberi](https://docs.dokploy.com/docs/core/docker-compose/domains).

### Ortam ve giriş

[Üretim ortamı örneği](../.env.production.example), yalnızca Compose'un değiştirilebilir alanlarını içerir. İçeriği Dokploy **Environment** bölümüne aktarın ve `ADMIN_PASSWORD` için gerçek, benzersiz bir parola yazın. Örnekte `ADMIN_PASSWORD=` bilerek boştur. Yer tutucu açıklamayı `=` sonrasına yazmayın: yereldeki Docker Compose v5.5.1, boş değerden sonra gelen `#` açıklamasını parola değeri olarak okudu. Boş parola yönetici girişini kapatır. `ADMIN_EMAIL=emindemirci.ai@gmail.com` örnekte kullanıcının giriş adresine ayarlanmıştır; anahtar verilmezse Compose `info@bozkurtobasi.com` kullanır. `NODE_ENV`, `ANALYZE_AUTH_MODE` ve `ANALYZE_DATA_DIR` Compose içinde sabittir. SMTP henüz uygulanmadığı için ortam örneğinde SMTP sırrı yoktur.

Compose, ilettiğiniz `ANALYZE_SITE_ID`, `ANALYZE_SITE_NAME`, başlık/açıklama, `ANALYZE_ALLOWED_ORIGINS`, `ANALYZE_EVENT_SITES`, `ANALYZE_DATA_DIR=/app/data`, `ANALYZE_MAX_EVENTS=200000` ve `ANALYZE_GEO_LOOKUP=true` değerleri için varsayılanlar içerir. `ANALYZE_AUTH_MODE=platform-admin` ve `ANALYZE_AUTH_API_URL=https://api.bozkurtobasi.com` da tanımlıdır. Dokploy Environment bölümüne **gerçek yönetici parolasını** ekleyin:

```dotenv
# ## Dokploy'da en az 12 karakterlik guclu parola uretip bu bos degeri degistirin. ##
ADMIN_EMAIL=emindemirci.ai@gmail.com
ADMIN_PASSWORD=
```

`ADMIN_EMAIL` isteğe bağlıdır; `ADMIN_PASSWORD` yönetim ve analiz girişi için zorunludur. Parola eksikse `/api/auth/login` 503 döner; açık ana sayfa, Google ile oyuncu girişi, API health ve analiz kolektörü çalışabilir, ancak yönetim/analiz oturumu açılamaz. Giriş akışı: `POST /api/auth/login` bir bearer token üretir, `GET /api/admin/session` token'ı doğrular, `GET /api/admin/overview` oturum sayılarını verir. Analiz paneli aynı token'ı sunucu tarafında doğrular. Yönetici paneli TR/EN dil değiştirir. Parolayı kaynak dosyalarına veya ZIP'e yazmayın.

`ANALYZE_ENABLED=true` ile üretimde site, `GET /api/config` yanıtından kolektör URL'sini alır ve ekran görüntüleme/süre olaylarını `https://analiz.bozkurtobasi.com/api/track` adresine yollar. Sadece `bozkurtobasi.com` ve `www.bozkurtobasi.com` origin'leri kabul edilir. Oyun kaydı, kaynakları, oturum çerezi ve URL parametreleri gönderilmez; DNT/GPC dikkate alınır. `ANALYZE_GEO_LOOKUP=true` ziyaretçi IP'sini HTTPS üzerinden ipwho.is ile çözümleyebilir; [gizlilik bildirimi](../public/privacy.html) bunu açıklar. SMTP gönderimi henüz uygulanmamıştır.

### Google ile giriş

Google girişi **oyun erişimi için zorunludur**. Google Cloud Console'da **Web application** OAuth istemcisi oluşturun. İzinli yönlendirme URI'leri `https://bozkurtobasi.com/api/auth/google/callback` ve `https://www.bozkurtobasi.com/api/auth/google/callback` olmalıdır. Dokploy Environment içine `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ve aynı adreslerin virgülle ayrılmış `GOOGLE_REDIRECT_URIS` listesini girip yeniden dağıtın. Gizlilik ve koşullar sayfalarını Google marka/izin ekranında tanımlayın. Ayrıntılı adımlar [Google giriş rehberinde](GOOGLE-SIGNIN.md). Bu anahtarlar boşken `/api/auth/google/status` güvenli şekilde `enabled: false` döndürür; ana sayfa erişilebilir, oyun kapalı kalır. İstemci sırrını kaynak depoya koymayın.
### Kalıcılık ve geri dönüş

`game-data:/data` SQLite oyun verisini; `analyze-data:/app/data` analiz olaylarını saklar. Dokploy Volume Backups ile **iki volume'u da** yedekleyin ve geri yüklemeyi ayrı ortamda deneyin. `down -v` veya Fresh Volumes veri siler. Compose proje adını değiştirmek yeni, boş volume yaratabilir. SQLite nedeniyle `api` ve `analyze` tek replica çalışır.

Dağıtım sonrası şunları kontrol edin:

```text
https://bozkurtobasi.com/
https://bozkurtobasi.com/privacy.html
https://bozkurtobasi.com/terms.html
https://bozkurtobasi.com/api/auth/google/status
https://bozkurtobasi.com/api/health
https://api.bozkurtobasi.com/api/health
https://admin.bozkurtobasi.com/
https://analiz.bozkurtobasi.com/api/health
https://analiz.bozkurtobasi.com/login
```

Yönetici girişini, Google ile oyuncu girişini, girişsiz `#village` erişiminin engellenmesini ve giriş sonrası oyun gezintisinin analiz panelinde görünmesini ayrıca sınayın. Yerel Docker/CI başarısı canlı DNS, TLS veya VPS erişimini doğrulamaz.

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

Create one Docker Compose application in Dokploy from the private [repository](https://github.com/emindemirciai/Bozkurt-Obasi), branch `main`. The screenshot's existing **Compose Path `./docker-compose.yml`** now works; `./compose.yml` contains the same stack. Map the apex and `www` to `web:3000`, `api.bozkurtobasi.com` to `api:3000`, `admin.bozkurtobasi.com` to `admin:3000`, and `analiz.bozkurtobasi.com` to `analyze:3000`. Verify the existing admin DNS/domain mapping, enable HTTPS, and redeploy after domain changes. Dokploy handles the reverse proxy; see its [Compose domain guide](https://docs.dokploy.com/docs/core/docker-compose/domains).

Use the [production environment example](../.env.production.example) in Dokploy **Environment**; it includes only configurable Compose inputs. Replace its empty `ADMIN_PASSWORD=` with a real, unique secret in Dokploy. Keep comments on separate lines: local Docker Compose v5.5.1 interpreted an inline `#` after an empty value as literal password text. The example sets `ADMIN_EMAIL=emindemirci.ai@gmail.com` to the sign-in address; omitting it uses the Compose default `info@bozkurtobasi.com`. `NODE_ENV`, `ANALYZE_AUTH_MODE`, and `ANALYZE_DATA_DIR` are fixed in Compose. SMTP is not implemented, so no SMTP secret is requested.

The supplied `ANALYZE_*` values are defaults in Compose, including the production origin list, 200,000-event limit, geo lookup, and `platform-admin` auth against `https://api.bozkurtobasi.com`. Add a strong **`ADMIN_PASSWORD` of at least 12 characters** in Dokploy; `ADMIN_EMAIL` defaults to `info@bozkurtobasi.com`. Without the password, the public homepage, Google player sign-in, and health endpoints can work, but admin/analytics login returns unavailable. Never commit the secret. The API implements login, bearer session validation, logout, and protected session counts. The analytics panel uses the same admin login.

`game-data` stores SQLite game progress; `analyze-data` stores analytics events. Back up both volumes independently and test restores. Fresh Volumes or `down -v` deletes data. Keep one replica for the SQLite services. Production tracking sends only screen views and cumulative duration, honors DNT/GPC, and excludes game saves, resources, session cookies, and URL parameters. Geo lookup may send visitor IPs to ipwho.is over HTTPS, as disclosed in the [privacy notice](../public/privacy.html). SMTP delivery is not implemented.

For a local rehearsal, run `docker compose -f compose.yml -f compose.local.yml up --build -d`. Open game on <http://127.0.0.1:3000>, API on port 3001, admin on 3002, and analytics on 3003. Set `ADMIN_PASSWORD` in your shell before starting if you want to sign in. Local Compose disables outgoing game analytics and points panel auth to the internal API. Stop with `docker compose -f compose.yml -f compose.local.yml down` to preserve volumes. After production deployment, check every HTTPS health/page URL listed above and verify an actual game visit appears in the analytics panel.

### Google sign-in

Google sign-in is **required for game access**. Create a **Web application** OAuth client in Google Cloud Console and register `https://bozkurtobasi.com/api/auth/google/callback` and `https://www.bozkurtobasi.com/api/auth/google/callback` as exact redirect URIs. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the comma-separated `GOOGLE_REDIRECT_URIS` in Dokploy Environment, then redeploy. Add the homepage, [privacy notice](../public/privacy.html), and [terms](../public/terms.html) to Google's branding setup. See the [Google sign-in guide](GOOGLE-SIGNIN.md). Without these credentials `/api/auth/google/status` safely reports `enabled: false`; the homepage is accessible while the game remains closed. Never commit the client secret.
### Live admin sign-in and 502 troubleshooting

If the API admin session returns admin_unavailable (503), verify **ADMIN_PASSWORD** (at least 12 characters) and the intended **ADMIN_EMAIL** in Dokploy Environment. Save and redeploy the Compose application so the API receives the new environment. If the **admin.bozkurtobasi.com** page or /healthz returns 502, verify its Domains mapping targets **admin:3000**, check that the admin container is running and healthy, and inspect Dokploy logs for startup or runtime errors. Keep the password out of logs and support messages.
