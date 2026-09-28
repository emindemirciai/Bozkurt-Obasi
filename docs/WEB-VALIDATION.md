# Bozkurt Obası · doğrulama / Validation

Tarih / Date: 2026-09-28. Yerel ortam / Local environment: Windows, Node.js 24.16.0, Docker Desktop 29.8.0, Playwright Chromium. Sürüm / Release: **v1.2.1**.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| Kaynak ve çeviriler / Source and translations | Geçti / Passed — 31 JavaScript dosyası, 223 eşleşen TR/EN anahtar |
| Motor, API ve OAuth / Engine, API and OAuth | 39/39 geçti / passed |
| Tarayıcı / Browser | 21/21 geçti / passed — oturumlu oyun, oturumsuz bağlantı engeli, çıkış yarışı, analiz, mobil, tema ve önizleme |
| Üretim ve tek dosya derlemesi / Production and single-file builds | Geçti / Passed; `preview/index.html` 699.964 bayt / bytes |
| Biçim ve diff / Formatting and diff | `npm run format:check`, `git diff --check` geçti / passed |
| Dokploy ve yerel Compose / Production and local Compose | Yapılandırma doğrulandı; dört imaj derlendi / config validated; all four images built |
| Konteyner smoke / Container smoke | Sağlık, salt okunur non-root çalışma, yeniden başlatma öncesi/sonrası oturumsuz erişim engeli geçti / health, read-only non-root runtime and guest denial across restart passed |
| Yerel Compose / Local Compose | Dört servis `127.0.0.1:3000–3003` üzerinde healthy; sağlık ve Google giriş kapısı smoke geçti / all four healthy; health and Google gate smoke passed |
| Docker Chromium | 1440 px genişlikte tam görsel, 390 px mobil, üst giriş düğmesinin kaldırılması, oturumsuz `#village` engeli ve API 401 doğrulandı; sayfa hatası yok / full art, mobile, removed header button, anonymous route/API denial and no runtime errors |
| Kaynak satırları / Source lines | 139 dosya, 24.047 fiziksel satır; 13.849 aktif web satırı / 139 files, 24,047 physical lines; 13,849 active web-source lines |

## Türkçe

Google giriş akışı canlı anahtar veya gerçek Google parolası kullanılmadan, yalnızca test sunucusunda bulunan imzalı taklit sağlayıcıyla doğrulandı. İlk girişte geçerli eski sunucu misafir köyü hesaba bağlanır; başka cihazda ve süreç yeniden başlatılınca aynı ilerleme açılır. İmza, audience, nonce, state, çerez, tekrar oynatma ve same-origin olumsuz kontrolleri geçti. Yeni misafir oturumu oluşturulmaz; eski misafir çerezi `/api/session`, `/api/state` ve `/api/action` için oyun erişimi sağlamaz. Çıkış sırasında geciken bir yanıt köyü yeniden açamaz. Geçersiz API yanıtı yerel oyuna düşmez. Eski tarayıcı kayıtları değiştirilmez ve yeni yerel oyun kaydı yazılmaz.

Ana sayfa masaüstü, tablet, mobil ve koyu temada incelendi. Görsel doğal 1672:941 oranıyla kırpılmadan tüm hero alanına yayılır; mobilde tamamı metnin altında görünür. `preview/index.html` görseli ve Google simgesini içine gömer, anasayfa/tema/dil önizlemesi sunar; Google sunucu oturumu olmadan oyun açmaz. Analiz, oturum çözülürken geçici bir ana sayfa ziyareti saymaz ve oturumsuz köy bağlantısını yalnızca `/home` olarak ölçer. Analiz payload'larına hesap e-postası, oyun durumu veya çerez eklenmez.

Gerçek Google girişini açmak için [Google Cloud ve Dokploy ayarları](GOOGLE-SIGNIN.md) gerekir. Anahtarlar yerelde boş olduğundan Google düğmesi kapalıdır ve oyun erişimi yoktur. Bu turdaki yerel stack smoke, `ADMIN_PASSWORD` boş olduğu için yönetici/analiz paneline gerçek giriş adımını atladı; yönetici kimlik doğrulaması birim testlerinde geçti. Kalıcı oyun ve analiz volume'ları korundu.

27 Eylül tarihli önceki VPS kontrolünde yönetici oturumu 503 `admin_unavailable`, `admin.bozkurtobasi.com/healthz` 502 döndürmüştü. Bu sürüm VPS dağıtımını doğrulamaz: Dokploy'da `ADMIN_PASSWORD`/`ADMIN_EMAIL` ve `admin:3000` alan adı eşlemesini kontrol edip yeniden dağıtın. Yerel kontroller GitHub CI sonucuyla aynı değildir; bu commit'in [GitHub Actions koşusu](https://github.com/emindemirciai/Bozkurt-Obasi/actions/workflows/web-ci.yml) ayrıca kontrol edilmelidir.

## English

OAuth was verified without live credentials or real Google passwords using a signed mock provider that exists only in the test server. First sign-in can claim a valid earlier server guest village; progress resumes on another device and after restart. Signature, audience, nonce, state, cookie, replay and same-origin negative tests passed. New guest sessions are not created; an old guest cookie cannot access `/api/session`, `/api/state` or `/api/action`. A delayed response after logout cannot reopen the village, and invalid API responses never fall back to local gameplay. Earlier browser saves remain untouched; no new local game save is written.

The homepage was reviewed on desktop, tablet, mobile and in dark mode. The complete artwork fills the hero at its native 1672:941 ratio; mobile displays it below the copy. The standalone `preview/index.html` embeds the artwork and Google icon for homepage/theme/language preview; it cannot open the game without a server Google session. Analytics waits for authentication to resolve instead of recording a transient homepage visit, and an unauthenticated village link records only `/home`. Payloads omit account email, game state and cookies.

Live sign-in needs the [Google Cloud and Dokploy configuration](GOOGLE-SIGNIN.md). Local credentials are empty, so the Google button and game access are closed. Local stack smoke skipped authenticated admin/analytics panel login because `ADMIN_PASSWORD` is unset; admin authentication passed unit tests. Persistent game and analytics volumes were preserved.

The earlier 27 September VPS check returned 503 `admin_unavailable` for the admin session and 502 for `admin.bozkurtobasi.com/healthz`. This release does not confirm a VPS deployment: verify Dokploy `ADMIN_PASSWORD`/`ADMIN_EMAIL` and the `admin:3000` domain mapping, then redeploy. Local verification is separate from GitHub CI; inspect this commit's [GitHub Actions run](https://github.com/emindemirciai/Bozkurt-Obasi/actions/workflows/web-ci.yml).
