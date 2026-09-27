# Bozkurt Obası · Google ile giriş / Google sign-in

## Türkçe

Google ile giriş, oyuncunun sunucu köyünü Google hesabına bağlar. İlk girişte mevcut **sunucu misafir köyü** hesaba alınır; sonraki girişlerde aynı Google hesabının kayıtlı köyü açılır. Tarayıcıdaki **yerel/çevrimdışı köy** ayrı kalır. Oyun Google parolasını veya Google erişim belirtecini saklamaz. OAuth istemci sırrı yalnızca API servisinde bulunur. Giriş düğmesi Google'ın [resmî renkli G simgesini](https://developers.google.com/static/identity/images/g-logo.png) [marka yönergelerine](https://developers.google.com/identity/branding-guidelines) göre kullanır.

1. [Google Cloud Console](https://console.cloud.google.com/auth/overview) içinde Bozkurt Obası için OAuth onay/marka ekranını hazırlayın. Uygulama adı ve destek e-postasını girin; doğruladığınız `bozkurtobasi.com` alan adını, `https://bozkurtobasi.com/` ana sayfasını, `https://bozkurtobasi.com/privacy.html` gizlilik bildirimini ve `https://bozkurtobasi.com/terms.html` kullanım koşullarını ekleyin. Google'ın [OAuth politikası](https://developers.google.com/identity/protocols/oauth2/policies) üretim ana sayfası ve bu bağlantıları ister. Uygulama Test aşamasındaysa izinli test kullanıcılarını ekleyin.
2. **Web application** türünde OAuth istemcisi oluşturun. İzinli yönlendirme URI'lerine aşağıdaki iki tam adresi ayrı ayrı girin. `www` kullanılmayacaksa onun URI'sini hem Google ayarından hem Dokploy listesinden çıkarın. Google [tam eşleşme](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri) ister.

   ```text
   https://bozkurtobasi.com/api/auth/google/callback
   https://www.bozkurtobasi.com/api/auth/google/callback
   ```

3. Dokploy Compose uygulamasının **Environment** bölümüne `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` değerlerini ekleyin. `GOOGLE_REDIRECT_URIS` değerini [üretim örneğindeki](../.env.production.example) gibi virgülle ayrılmış tam URI listesi olarak bırakın veya alan adı tercihinize göre düzenleyin. Sırrı Git'e, ZIP'e, README'ye veya istemci koduna yazmayın. Kaydedip uygulamayı yeniden dağıtın.
4. `https://bozkurtobasi.com/api/auth/google/status` yanıtında `enabled: true` görünmesini, ana sayfada **Google ile giriş** düğmesini, izin ekranından sonra köyün açılmasını ve ikinci cihazda aynı Google hesabıyla ilerlemenin gelmesini kontrol edin. Giriş yapılandırılmamışsa durum `enabled: false` döner; misafir oyunu çalışmaya devam eder. Yönlendirme uyuşmazlığında Google Cloud URI'lerini ve Dokploy ortamını harf, şema, yol ve son eğik çizgi dahil karşılaştırın.

Yerel Docker testi için `compose.local.yml` yönlendirmeyi `http://127.0.0.1:3000/api/auth/google/callback` yapar. Google Cloud istemcisine bu URI'yi de ekleyin ve yerel Compose çalıştırmadan önce istemci kimliği/sırrını yalnızca yerel ortam değişkenlerinde tanımlayın. Yerel test için HTTPS istisnası Google'ın [sunucu uygulaması rehberinde](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri) açıklanır.

## English

Google sign-in links a server village to a Google account. The first sign-in claims the existing **server guest village**; subsequent sign-ins reopen that account's saved village, including on another device. The browser's **local/offline village** remains separate. The game stores neither the Google password nor Google access tokens. The OAuth client secret stays on the API service. The button uses Google's [official color G icon](https://developers.google.com/static/identity/images/g-logo.png) under its [branding guidelines](https://developers.google.com/identity/branding-guidelines).

1. Configure the OAuth consent/branding screen in [Google Cloud Console](https://console.cloud.google.com/auth/overview). Set the app name and support email, verify ownership of `bozkurtobasi.com`, and add the public home page `https://bozkurtobasi.com/`, privacy notice `https://bozkurtobasi.com/privacy.html`, and terms `https://bozkurtobasi.com/terms.html`. Google's [OAuth policy](https://developers.google.com/identity/protocols/oauth2/policies) requires these production links. Add test users while the app is in Testing mode.
2. Create an OAuth client of type **Web application**. Register each exact authorized redirect URI separately:

   ```text
   https://bozkurtobasi.com/api/auth/google/callback
   https://www.bozkurtobasi.com/api/auth/google/callback
   ```

   If `www` is not used, remove it from both Google and the Dokploy list. Google requires an [exact redirect URI match](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri).
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Dokploy Compose application's **Environment**. Keep `GOOGLE_REDIRECT_URIS` as the comma-separated exact URI list in the [production example](../.env.production.example), adjusted only for your domains. Never put the secret in Git, ZIP, README, or client code. Save and redeploy.
4. Confirm `https://bozkurtobasi.com/api/auth/google/status` reports `enabled: true`; use the **Sign in with Google** button, complete consent, and check that the village opens on a second device. With missing credentials the status reports `enabled: false` while guest play remains available. For a redirect mismatch, compare scheme, case, path, and trailing slash exactly between Google Cloud and Dokploy.

For local Docker testing, `compose.local.yml` selects `http://127.0.0.1:3000/api/auth/google/callback`. Add that URI to the Google client and provide the client ID/secret through local environment variables before starting Compose. Google's [web server guide](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri) documents the local HTTP exception.
