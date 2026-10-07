# Bozkurt Obası · Dokploy dağıtımı / Deployment

## Türkçe

### Tek Compose kurulumu

Dokploy'da Docker Compose uygulaması açın, özel [depoyu](https://github.com/emindemirciai/Bozkurt-Obasi) GitHub bağlantınızla seçin ve `main` dalını kullanın. Ekran görüntüsündeki **Compose Path: `./docker-compose.yml`** artık doğrudan çalışır; `./compose.yml` aynı dört servisli içeriğin eşidir. Her iki dosya da depo kökündedir. `compose.local.yml` sadece yerel Docker içindir.

| Alan adı                  | Servis    | Konteyner portu | Durum                                                      |
| ------------------------- | --------- | --------------: | ---------------------------------------------------------- |
| `bozkurtobasi.com`        | `web`     |            3000 | Görselli ana sayfa, oyun, gizlilik ve koşullar             |
| `www.bozkurtobasi.com`    | `web`     |            3000 | Aynı anasayfa/oyun; kanonik adrese yönlendirme önerilir    |
| `api.bozkurtobasi.com`    | `api`     |            3000 | Oyun ve yönetici API                                       |
| `admin.bozkurtobasi.com`  | `admin`   |            3000 | Yönetim paneli                                             |
| `analiz.bozkurtobasi.com` | `analyze` |            3000 | Trafik paneli ve `/api/track`                              |

Domains ekranında her alan adını ilgili **servise** ve **konteyner portu 3000** değerine bağlayın. `3001`, yerel override'ın API'ye verdiği host portudur; üretimde admin alan adı için kullanılmaz. Dokploy kendi ters proxy yönlendirmesini oluşturur; konteyner host portu veya `container_name` ayarlamak gerekmez. HTTPS'i etkinleştirin ve değişiklikleri **Save → Deploy** ile uygulayın. **Preview Compose**, Dokploy'un eklediği Traefik etiketlerini ve ağları gösterir. [Dokploy Compose alan adı rehberi](https://docs.dokploy.com/docs/core/docker-compose/domains).

### Ortam ve giriş

[Üretim ortamı örneği](../.env.production.example), yalnızca Compose'un değiştirilebilir alanlarını içerir. İçeriği Dokploy **Environment** bölümüne aktarın; yeni kurulumda yönetici parolasını `ADMIN_PASSWORD` alanına yazın. Mevcut `ADMIN_BOOTSTRAP_PASSWORD` için aşağıdaki uyumluluk geçerlidir. Örnekte parola alanları bilerek boştur. Yer tutucu açıklamayı `=` sonrasına yazmayın: yereldeki Docker Compose v5.5.1, boş değerden sonra gelen `#` açıklamasını parola değeri olarak okudu. Her iki parola anahtarı da boşsa yönetici girişi kapalı kalır. `ADMIN_EMAIL=emindemirci.ai@gmail.com` örnekte kullanıcının giriş adresine ayarlanmıştır; birincil ve uyumluluk e-posta alanları verilmezse Compose `info@bozkurtobasi.com` kullanır. `NODE_ENV`, `ANALYZE_AUTH_MODE` ve `ANALYZE_DATA_DIR` Compose içinde sabittir. SMTP parolasını yalnızca Dokploy Environment içine girin.

**v1.8.1, `ADMIN_BOOTSTRAP_EMAIL` ve `ADMIN_BOOTSTRAP_PASSWORD` anahtarlarını da destekler.** Önceki sürüm bu alanları API'ye aktarmadığı için parolanın Dokploy'da bulunmasına rağmen yönetici girişi kapanabiliyordu. Mevcut anahtarları koruyup yeni sürümü **Save → Deploy** ile dağıtın veya adlarını `ADMIN_EMAIL`/`ADMIN_PASSWORD` olarak değiştirin; ikinci bir parola gerekmez. Compose her alanı ayrı seçer: boş olmayan `ADMIN_EMAIL` ve `ADMIN_PASSWORD` önceliklidir, boş/yoksa ilgili `ADMIN_BOOTSTRAP_*` değeri alınır. Aynı anda iki e-posta tanımlarsanız birincil değerin girişte kullanacağınız adres olduğundan emin olun. API içinde kullanılan alan adları yine `ADMIN_EMAIL`/`ADMIN_PASSWORD` olur; uyumluluk veritabanında seed hesap oluşturmaz ve en az 12 karakter şartını değiştirmez.

Compose, ilettiğiniz `ANALYZE_SITE_ID`, `ANALYZE_SITE_NAME`, başlık/açıklama, `ANALYZE_ALLOWED_ORIGINS`, `ANALYZE_EVENT_SITES`, `ANALYZE_DATA_DIR=/app/data`, `ANALYZE_MAX_EVENTS=200000` ve `ANALYZE_GEO_LOOKUP=true` değerleri için varsayılanlar içerir. `ANALYZE_AUTH_MODE=platform-admin` ve `ANALYZE_AUTH_API_URL=http://api:3000` da tanımlıdır. Dahili API adresi yalnızca aynı Compose ağındaki servisler içindir: analiz sunucusu buraya bağlanır, tarayıcı `https://analiz.bozkurtobasi.com` kullanmaya devam eder. API ayrı dağıtılıyorsa erişilebilir HTTPS adresini kullanın. Environment içinde önceden `https://api.bozkurtobasi.com` yazılıysa bu değer varsayılanı geçersiz kılar; aynı yığındaki dahili yolu kullanmak için `http://api:3000` olarak değiştirip kaydedin ve yeniden dağıtın. Dokploy Environment bölümüne **gerçek yönetici parolasını** ekleyin:

```dotenv
# Dokploy'da en az 12 karakterlik mevcut yonetici parolanizi bu alana yazin.
ADMIN_EMAIL=emindemirci.ai@gmail.com
ADMIN_PASSWORD=
```

`ADMIN_EMAIL` isteğe bağlıdır; `ADMIN_PASSWORD` veya uyumluluk alanı `ADMIN_BOOTSTRAP_PASSWORD` üzerinden geçerli parola yönetim ve analiz girişi için zorunludur. Bu yapılandırma yönetici girişini başlatır; ayrı bir veritabanı seed hesabı gerekmez. Parola eksikse `/api/auth/login` 503 döner; açık ana sayfa, oyuncu girişi, API health ve analiz kolektörü çalışabilir, ancak yönetim/analiz oturumu açılamaz. Giriş akışı: `POST /api/auth/login` bir bearer token üretir, `GET /api/admin/session` token'ı doğrular, `GET /api/admin/overview` oturum sayılarını verir. Analiz paneli aynı token'ı sunucu tarafında doğrular. Yönetici paneli TR/EN dil değiştirir. `ADMIN_EMAIL`, oyuncu hesabından ve giden e-posta adresinden bağımsızdır. Parolayı kaynak dosyalarına veya temiz GitHub ZIP'ine yazmayın; özel tam Drive yedeği yerel dosyaları filtrelemez.

`ANALYZE_ENABLED=true` ile üretimde site, `GET /api/config` yanıtından kolektör URL'sini alır ve ekran görüntüleme/süre olaylarını `https://analiz.bozkurtobasi.com/api/track` adresine yollar. Sadece `bozkurtobasi.com` ve `www.bozkurtobasi.com` origin'leri kabul edilir. Oyun kaydı, kaynakları, oturum çerezi ve URL parametreleri gönderilmez; DNT/GPC dikkate alınır. `ANALYZE_GEO_LOOKUP=true` ziyaretçi IP'sini HTTPS üzerinden ipwho.is ile çözümleyebilir; [gizlilik bildirimi](../public/privacy.html) bunu açıklar.

### Doğrulama e-postası ve gönderici

Giden doğrulama iletilerinin **From adresi** sabit olarak `info@bozkurtobasi.com` kullanır; `MAIL_FROM` yalnızca görünen adı belirler (varsayılan `Bozkurtobasi.com <info@bozkurtobasi.com>`). Başka bir gönderici adresi kabul edilmez. `SMTP_USER` yalnızca posta sunucusuna giriş kimliğidir; `ADMIN_EMAIL` yönetici girişidir. Bu üç kimliği karıştırmayın. Posta sağlayıcınızın `info@bozkurtobasi.com` adına gönderime izin verdiğini ve alan adının SPF/DKIM/DMARC kayıtlarını doğrulayın. `PUBLIC_URL` görselli kod e-postasındaki site bağlantısının kökünü belirler; üretimde `https://bozkurtobasi.com` olmalıdır.

Dokploy **Environment** bölümünde aşağıdaki Hostinger ayarlarını kullanın. `SMTP_PASSWORD` değerini orada gerçek posta kutusu parolasıyla doldurun; değer eksikken gerçek e-posta gönderimi kullanılamaz. Sırrı depoya veya temiz kaynak ZIP'ine koymayın. Özel Drive yedeğinin tam içerik standardı geçerlidir.

```dotenv
PUBLIC_URL=https://bozkurtobasi.com
MAIL_PROVIDER=smtp
MAIL_FROM="Bozkurtobasi.com <info@bozkurtobasi.com>"
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@bozkurtobasi.com
SMTP_PASSWORD=
```

Hostinger'ın 465 numaralı bağlantı noktasında baştan TLS için `SMTP_SECURE=true` kullanın. Sağlayıcı 587/STARTTLS verirse portu 587, `SMTP_SECURE` değerini `false` yapın. SMTP sunucusunun geçerli TLS sertifikası olmalıdır; sertifika doğrulamasını kapatmayın. Değerleri kaydedip Compose uygulamasını yeniden dağıtın. Gerçek teslimat ancak SMTP sağlayıcısı ve canlı posta kutusuyla uçtan uca doğrulanabilir. [Hostinger SMTP ayarları](https://support.hostinger.com/en/articles/1575756-how-to-get-email-account-configuration-details-for-hostinger-email) ve [Nodemailer TLS ayarları](https://nodemailer.com/smtp).

Kod doğrulanmadan e-posta hesabı oyuna ulaşamaz. SMTP kapalıysa veya teslim başarısızsa kayıt beklemede kalır; giriş zorunluluğu kaldırılmaz. HTML e-posta ay-yıldız PNG görselini CID ekiyle içerir. Google tarafından doğrulanmış hesaplar Google ile giriş yapabilir. API konteyneri görseli `server/web/assets/formation.png` içinden okur; yeni servis veya ortam anahtarı gerekmez.

### Google ile giriş

Oyuncular e-posta/şifreyle kayıt olup giriş yapabilir; Google girişi isteğe bağlı ek seçenektir. [Hesap rehberi](ACCOUNT-SIGNIN.md). Google Cloud Console'da **Web application** OAuth istemcisi oluşturun. İzinli yönlendirme URI'leri `https://bozkurtobasi.com/api/auth/google/callback` ve `https://www.bozkurtobasi.com/api/auth/google/callback` olmalıdır. Dokploy Environment içine `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ve aynı adreslerin virgülle ayrılmış `GOOGLE_REDIRECT_URIS` listesini girip yeniden dağıtın. Gizlilik ve koşullar sayfalarını Google marka/izin ekranında tanımlayın. Ayrıntılı adımlar [Google giriş rehberinde](GOOGLE-SIGNIN.md). Bu anahtarlar boşken `/api/auth/google/status` güvenli şekilde `enabled: false` döndürür; e-posta kaydı ve girişi kullanılabilir. İstemci sırrını kaynak depoya koymayın.

### Kalıcılık ve geri dönüş

`game-data:/data` SQLite oyun verisini; `analyze-data:/app/data` analiz olaylarını saklar. Dokploy Volume Backups ile **iki volume'u da** yedekleyin ve geri yüklemeyi ayrı ortamda deneyin. `down -v` veya Fresh Volumes veri siler. Compose proje adını değiştirmek yeni, boş volume yaratabilir. SQLite nedeniyle `api` ve `analyze` tek replica çalışır.

Dağıtım sonrası şunları kontrol edin:

```text
https://bozkurtobasi.com/
https://bozkurtobasi.com/privacy.html
https://bozkurtobasi.com/terms.html
https://bozkurtobasi.com/api/auth/player/status
https://bozkurtobasi.com/api/auth/google/status
https://bozkurtobasi.com/api/health
https://api.bozkurtobasi.com/api/health
https://admin.bozkurtobasi.com/
https://analiz.bozkurtobasi.com/api/health
https://analiz.bozkurtobasi.com/login
```

Yönetici girişini, e-posta/şifreyle oyuncu girişini, Google etkinse Google girişini, girişsiz `#village` erişiminin engellenmesini ve giriş sonrası oyun gezintisinin analiz panelinde görünmesini ayrıca sınayın. SMTP etkinse `info@bozkurtobasi.com` göndericisinden bir doğrulama iletisinin ulaştığını kontrol edin. Yerel Docker/CI başarısı canlı DNS, TLS, SMTP teslimatı veya VPS erişimini doğrulamaz.

### Yerel Docker

```bash
docker compose -f compose.yml -f compose.local.yml config --quiet
docker compose -f compose.yml -f compose.local.yml up --build -d
docker compose -f compose.yml -f compose.local.yml ps
```

Yerel portlar: `3000 web`, `3001 api`, `3002 admin`, `3003 analyze`; yalnızca `127.0.0.1` üzerinde dinler. Yerel `ADMIN_PASSWORD` ortam değişkenini ayarlayıp Compose'u başlatırsanız hem yönetim hem analiz girişi çalışır. Yerel override, dış analitik gönderimini kapatır, panel auth adresini açıkça `http://api:3000` olarak ayarlar, e-postadaki site bağlantısını `http://127.0.0.1:3000` adresine yöneltir ve konum sorgusunu kapatır. Durdurma: `docker compose -f compose.yml -f compose.local.yml down` (volume'ları korur).

### Canlı yönetici girişi ve 502 sorunları

Bu iki hatayı ayrı kontrol edin:

| Kontrol | Sonucun anlamı | Sonraki işlem |
| --- | --- | --- |
| `https://admin.bozkurtobasi.com/healthz` → 502 | Dokploy admin konteynerine ulaşamıyor; bu yol API'yi çağırmaz. | Domains kaydını `admin:3000` yapın, **Save → Deploy** uygulayın; konteyner durumu ve Nginx başlangıç logunu inceleyin. |
| Admin `/healthz` → 200, admin `/api/health` → 502 | Admin arayüzü ayakta, fakat admin–API bağlantısı başarısız. | API sağlık durumunu ve iki servisin ortak Compose ağını kontrol edin. |
| API `/api/health` → 200, `/api/admin/session` → 503 `admin_unavailable` | API ayakta, yönetici ortamı eksik veya geçersiz. | Çalışan `api` konteynerinin aşağıdaki kontrolünü yapın; Environment'ı kaydedip API'yi yeniden dağıtın. |
| Girişsiz API `/api/admin/session` → 401 | Yönetici yapılandırılmış, bu istekte geçerli oturum yok. | `ADMIN_EMAIL` ve parolayla yönetim/analiz panelinden giriş yapın. |
| Analiz `/api/health` → 200, giriş → bağlantı hatası | Kolektör ayakta olsa da yetkilendirme API'sine erişemiyor olabilir. | Aynı yığında `ANALYZE_AUTH_API_URL=http://api:3000` kullanın; API durumunu ve ağları kontrol edin. |

Bu dağıtım sorununda güvenli konteyner kontrolü `adminEmailPresent: true`, `adminPasswordPresent: false` sonucunu verdi: Dokploy'daki parola `ADMIN_BOOTSTRAP_PASSWORD` adıyla tanımlıydı ve eski Compose bu anahtarı aktarmıyordu. v1.8.1 uyumluluğunu dağıtın veya mevcut parolanın anahtar adını düzeltin.

Dokploy **Environment** bölümünde parolanın en az 12 karakter olması yeterli değildir; yeni ortam çalışan **api** servisine uygulanmış olmalıdır. Konteyner içindeki `ADMIN_EMAIL` boş olmamalı ve girişte kullandığınız adresle eşleşmelidir. API konteynerinin terminalinde şu komut yalnızca alanların varlığını, parola uzunluğunu ve yapılandırma sonucunu gösterir; değerleri yazdırmaz:

```bash
node -e 'const email = (process.env.ADMIN_EMAIL || "").trim(); const password = process.env.ADMIN_PASSWORD || ""; console.log(JSON.stringify({adminEmailPresent: Boolean(email), adminPasswordPresent: Boolean(password), adminPasswordLength: password.length, adminConfigured: Boolean(email) && password.length >= 12}));'
```

`adminConfigured: false` ise doğru Compose uygulamasının Environment bölümünü düzeltin, **Save → Deploy** uygulayın ve komutu yeni API konteynerinde tekrar çalıştırın. Doğru yapılandırmada oturumsuz `/api/admin/session` 401 döner; 503 devam ederse yanlış API servisine veya eski dağıtıma yönlendirme ihtimalini **Preview Compose** ve konteyner loglarıyla inceleyin. Parolayı, `printenv` çıktısını veya tüm çözümlenmiş ortamı destek mesajına eklemeyin.

Domains eşlemesi doğru olduğu halde 502 sürüyorsa **Preview Compose** içindeki ilgili servis portunun 3000 olduğunu, Traefik yönlendirmesini ve seçilen Docker ağını inceleyin. Dokploy normal Compose dağıtımında `dokploy-network`, **Isolated Deployments** kullanımında uygulamaya ait ağ ekleyebilir; ağ adını kontrol etmeden `traefik.docker.network=dokploy-network` sabitlemeyin. `admin` ile `api` ortak Compose ağında bulunmalıdır. Nginx Docker DNS'ini yeniden çözümleyerek API konteynerinin IP değişimini takip eder; API DNS'i hazır değilken statik admin sayfası ve `/healthz` başlayabilir. Kimlik doğrulama kapısı korunur; API yokken giriş açılamaz. [Dokploy'un ağ ve Preview Compose açıklaması](https://docs.dokploy.com/docs/core/docker-compose/domains).

Bu işlemlerde **Fresh Volumes** veya `down -v` kullanmayın; ayar ve kod dağıtımı mevcut köy ve analiz volume'larını koruyarak yapılır. Yeniden dağıtım sonrası admin ve analiz girişini ayrı ayrı sınayın. Yerel doğrulama, canlı VPS yönlendirmesinin düzeldiği anlamına gelmez.

Şifremi unuttum akışı mevcut SMTP yapılandırmasını kullanır; yeni ortam anahtarı veya servis gerektirmez. Güncellenmiş `web` ve `api` için Compose'u yeniden dağıtın. Canlı bir doğrulanmış şifre hesabında görselli yenileme kodunun teslimini, yeni şifreyle aynı köyün açılmasını ve diğer cihaz oturumlarının kapanmasını sınayın. Yalnızca Google kullanan hesap önce Google ile giriş yapıp profilinden şifre ekler. Kodlar kayıt doğrulamasından bağımsızdır.

## English

Create one Docker Compose application in Dokploy from the private [repository](https://github.com/emindemirciai/Bozkurt-Obasi), branch `main`. The screenshot's existing **Compose Path `./docker-compose.yml`** now works; `./compose.yml` contains the same stack. Map the apex and `www` to `web:3000`, `api.bozkurtobasi.com` to `api:3000`, `admin.bozkurtobasi.com` to `admin:3000`, and `analiz.bozkurtobasi.com` to `analyze:3000`. These are container ports. **3001 is only the local API host port**, not the production admin port. Enable HTTPS and apply changes with **Save → Deploy**. Dokploy handles the reverse proxy; **Preview Compose** shows the injected Traefik labels and networks. See its [Compose domain guide](https://docs.dokploy.com/docs/core/docker-compose/domains).

Use the [production environment example](../.env.production.example) in Dokploy **Environment**; it includes only configurable Compose inputs. For a new setup, enter your administrator password in `ADMIN_PASSWORD`. Existing `ADMIN_BOOTSTRAP_PASSWORD` settings have the compatibility described below. Both password fields are deliberately empty in the example. Keep comments on separate lines: local Docker Compose v5.5.1 interpreted an inline `#` after an empty value as literal password text. If both password keys are empty, admin login remains unavailable. The example sets `ADMIN_EMAIL=emindemirci.ai@gmail.com` to the sign-in address; if neither email key is supplied, Compose defaults to `info@bozkurtobasi.com`. `NODE_ENV`, `ANALYZE_AUTH_MODE`, and `ANALYZE_DATA_DIR` are fixed in Compose. Enter SMTP credentials only in Dokploy.

**v1.8.1 also accepts `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`.** Earlier Compose versions did not pass these keys to the API, so an existing Dokploy password could still leave admin login unavailable. Keep the current keys and deploy this version with **Save → Deploy**, or rename them to `ADMIN_EMAIL`/`ADMIN_PASSWORD`; you do not need another password. Compose selects each field independently: a nonempty primary value takes priority, otherwise its bootstrap value is used. If both email keys are present, ensure the primary email matches your intended login. The API still receives `ADMIN_EMAIL`/`ADMIN_PASSWORD`; this mapping creates no database seed account and preserves the 12-character minimum.

The supplied `ANALYZE_*` values are defaults in Compose, including the production origin list, 200,000-event limit, geo lookup, and `platform-admin` auth against `http://api:3000`. This internal address is available only within the same Compose network: analytics authenticates server-side while the browser continues using public HTTPS. An existing Environment value overrides the default; set `ANALYZE_AUTH_API_URL=http://api:3000` and **Save → Deploy** to use the internal path. For a separately deployed API, use its reachable HTTPS address instead. Add a strong **`ADMIN_PASSWORD` of at least 12 characters** in Dokploy; `ADMIN_EMAIL` defaults to `info@bozkurtobasi.com`. These environment credentials initialize admin/analytics login; no database seed account is required. Without the password, the public homepage, player sign-in, and health endpoints can work, but admin/analytics login returns unavailable. Never commit the secret. The API implements login, bearer session validation, logout, and protected session counts. The analytics panel uses the same admin login. Admin credentials are separate from player accounts and SMTP sender settings.

`game-data` stores SQLite game progress; `analyze-data` stores analytics events. Back up both volumes independently and test restores. Fresh Volumes or `down -v` deletes data. Keep one replica for the SQLite services. Production tracking sends only screen views and cumulative duration, honors DNT/GPC, and excludes game saves, resources, session cookies, and URL parameters. Geo lookup may send visitor IPs to ipwho.is over HTTPS, as disclosed in the [privacy notice](../public/privacy.html).

### Verification email and sender

Outgoing verification messages always use **`info@bozkurtobasi.com`** as their From address. `MAIL_FROM` may set the display name, with `Bozkurtobasi.com <info@bozkurtobasi.com>` as the default; another From address is rejected. `SMTP_USER` is the mail server login and `ADMIN_EMAIL` is the administrator login; neither changes the sender. Authorize the From address with your provider and configure SPF/DKIM/DMARC for the domain. Set `PUBLIC_URL=https://bozkurtobasi.com` for the website link in verification email. The example uses `MAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, and `SMTP_USER=info@bozkurtobasi.com`. Supply the real `SMTP_PASSWORD` only in Dokploy; without it no real mail can be sent. Port 465 uses implicit TLS. If your provider specifies port 587, switch to `SMTP_SECURE=false` for STARTTLS. Keep TLS certificate validation enabled and secrets out of the repository and clean source ZIP; the private full Drive backup includes local files. Redeploy after changing environment values, then test delivery with a real mailbox. CI/local checks cannot verify live SMTP, DNS, or provider authorization. See [Hostinger's SMTP settings](https://support.hostinger.com/en/articles/1575756-how-to-get-email-account-configuration-details-for-hostinger-email) and [Nodemailer's TLS settings](https://nodemailer.com/smtp).

For a local rehearsal, run `docker compose -f compose.yml -f compose.local.yml up --build -d`. Open game on <http://127.0.0.1:3000>, API on port 3001, admin on 3002, and analytics on 3003. Set `ADMIN_PASSWORD` in your shell before starting if you want to sign in. Local Compose disables outgoing game analytics, points panel auth to the internal API, and targets the email site link at `http://127.0.0.1:3000`. Stop with `docker compose -f compose.yml -f compose.local.yml down` to preserve volumes. After production deployment, check every HTTPS health/page URL listed above and verify an actual game visit appears in the analytics panel.

### Google sign-in

Players can register/sign in with email and password; Google is an optional alternative. See the [account guide](ACCOUNT-SIGNIN.md). Create a **Web application** OAuth client in Google Cloud Console and register `https://bozkurtobasi.com/api/auth/google/callback` and `https://www.bozkurtobasi.com/api/auth/google/callback` as exact redirect URIs. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the comma-separated `GOOGLE_REDIRECT_URIS` in Dokploy Environment, then redeploy. Add the homepage, [privacy notice](../public/privacy.html), and [terms](../public/terms.html) to Google's branding setup. See the [Google sign-in guide](GOOGLE-SIGNIN.md). Without these credentials `/api/auth/google/status` safely reports `enabled: false`; email registration and sign-in remain available. Never commit the client secret.

### Live admin sign-in and 502 troubleshooting

Check routing and authentication independently:

| Check | Meaning | Next action |
| --- | --- | --- |
| Admin `/healthz` → 502 | Dokploy cannot reach the admin container; this endpoint does not call the API. | Set Domains to `admin:3000`, **Save → Deploy**, and inspect container status and Nginx startup logs. |
| Admin `/healthz` → 200, admin `/api/health` → 502 | The admin UI is running but its API connection is failing. | Check API health and the shared Compose network. |
| API `/api/health` → 200, `/api/admin/session` → 503 `admin_unavailable` | The API is running but admin environment settings are missing or invalid. | Check the running `api` container, then save Environment and redeploy the API. |
| Anonymous API `/api/admin/session` → 401 | Admin authentication is configured; this request has no valid session. | Sign in to admin/analytics with the configured email and password. |
| Analytics health → 200, sign-in → connection failure | A healthy collector does not prove its auth API is reachable. | Use `http://api:3000` for the same stack and check API health and networks. |

The safe container check for this incident reported `adminEmailPresent: true` and `adminPasswordPresent: false`: the existing password was set under `ADMIN_BOOTSTRAP_PASSWORD`, which the earlier Compose version did not pass through. Deploy v1.8.1 compatibility or rename the existing key.

A password entered in Dokploy's editor is not proof that the running **api** container received it. Run the secret-free `node -e` command shown in the Turkish section from the API container terminal: it prints only presence flags, password length, and `adminConfigured`. A false result requires checking this Compose application's primary or compatibility settings, then **Save → Deploy** and another check in the new API container. A configured anonymous session request returns 401. If 503 persists with valid container settings, inspect **Preview Compose** and container logs for routing to another API or an older deployment. Never share the password, full `printenv` output, or resolved environment values.

If 502 remains after correcting the domain port, inspect **Preview Compose** for the service port, Traefik labels, and selected Docker network. Dokploy can use `dokploy-network` for regular deployments or an application-specific network with **Isolated Deployments**. Do not hardcode `traefik.docker.network=dokploy-network` without checking the actual network. Admin and API must share a Compose network. Nginx re-resolves Docker DNS when an API container changes IP; static admin pages and `/healthz` can start before API DNS is ready. Authentication remains required when the API is unavailable. See [Dokploy's network and Preview Compose guidance](https://docs.dokploy.com/docs/core/docker-compose/domains).

Use ordinary redeployment to preserve existing village and analytics volumes; do not use **Fresh Volumes** or `down -v` for these fixes. Test both admin and analytics login after deployment. Passing local checks does not establish that live VPS routing has been repaired.

Email accounts cannot enter gameplay until the emailed code is confirmed. Missing or failed SMTP keeps them pending; Google-verified accounts may use Google. The API image contains the embedded email illustration, so this update requires no new service or environment key.

Forgot password uses the existing SMTP settings and embedded illustration. Redeploy the updated `web` and `api` through Compose. With a real verified password account, confirm reset-mail delivery, preserved village progress under the new password and revoked sessions on other devices. Google-only players sign in with Google and add a password first. Recovery codes never replace registration verification.
