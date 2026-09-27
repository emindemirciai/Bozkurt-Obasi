# Bozkurt Obası · doğrulama / Validation

Tarih / Date: 2026-09-27. Yerel ortam / Local environment: Windows, Node.js 24.16.0, Docker Desktop 29.8.0, Playwright Chromium. Sürüm / Release: **v1.2.0**.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| `npm run verify` | Geçti / Passed — 30 JavaScript dosyası, 228 eşleşen TR/EN anahtar, 39/39 birim/API testi, Vite ve çevrimdışı önizleme derlemesi, 20/20 tarayıcı testi |
| `npm run format:check`, `git diff --check` | Geçti / Passed |
| `docker compose -f compose.yml config --quiet` ve yerel override | Geçti / Passed |
| Dört Docker imajı / Four Docker images | Geçti / Passed — `web`, `api`, `admin`, `analyze`; Next.js derleme ve tip kontrolü dahil |
| Yerel Compose / Local Compose | Dört servis `127.0.0.1:3000–3003` üzerinde healthy; oyun/health smoke geçti / all four healthy; health/gameplay smoke passed |
| Docker Chromium | Ana görsel yüklendi (1672 px), Google anahtarsız durum dürüstçe kapalı, gizlilik bağlantısı ve `#village` geçişi çalıştı, sayfa hatası yok / image loaded, unconfigured auth safely disabled, privacy link and game navigation worked, no page errors |
| Kaynak satırları / Source lines | 138 dosya, 23.968 fiziksel satır; 13.770 aktif web satırı / 138 files, 23,968 physical lines; 13,770 active web-source lines |

## Türkçe

Google akışı gerçek Google parolası veya canlı anahtar kullanmadan taklit sağlayıcıyla sınandı: ilk giriş mevcut sunucu misafir köyünü hesaba bağladı, başka cihaz ve süreç yeniden başlatmasından sonra aynı ilerleme açıldı. İmza, audience, nonce, state, tarayıcı çerezi, tekrar oynatma ve same-origin kontrolleri olumsuz testlerden geçti; çıkış ilgili cihaz oturumunu geçersiz kıldı. Eski SQLite misafir kayıtları şema yükseltmesinden sonra okundu. Gerçek Google izin ekranının çalışması, Google Cloud istemcisi ve Dokploy'da sırrın tanımlanmasına bağlıdır; [kurulum rehberi](GOOGLE-SIGNIN.md).

Görselli ana sayfa masaüstü, 390 px mobil ve koyu temada incelendi; Google düğmesi resmî renkli G simgesiyle yenilendi ve simgenin çevrimiçi/çevrimdışı yüklendiği tarayıcıda doğrulandı. Oyun sekmesi ve tema yenilemeden sonra korundu; uzun ana sayfa kaydırması pasif üretim sırasında bozulmadı. `preview/index.html` görseli içine gömülü tek dosyalık çevrimdışı önizlemedir (707.754 bayt). Yerel Docker web servisi `/`, `/privacy.html`, `/terms.html` ve Google durumunu 200 döndürdü. Yerel `ADMIN_PASSWORD` ayarlanmadığından bu turda yönetici giriş smoke adımı atlandı; admin sağlık ucu 200 ve önceki sürümdeki geçici parola ile giriş testi başarılıydı. Testler kalıcı oyun/analiz volume'larını silmedi.

27 Eylül canlı VPS kontrolünde ana site, API sağlık ve analiz sağlık uçları 200; yönetici oturumu `admin_unavailable` ile 503, `admin.bozkurtobasi.com/healthz` ise 502 döndürdü. Bu kontrol v1.2.0'ın Dokploy'a dağıtıldığını kanıtlamaz. Dokploy'da `ADMIN_PASSWORD` ve `ADMIN_EMAIL` değerlerini doğrulayıp `admin.bozkurtobasi.com` alanını `admin:3000` servisine bağlayın; konteyner/alan adı loglarını inceleyip yeniden dağıtın. Google istemci kimliği ve sırrı eklenene kadar canlı Google girişi açılmaz. Önceki v1.1.0 [GitHub Actions çalışması](https://github.com/emindemirciai/Bozkurt-Obasi/actions/runs/36298568274) başarılıydı; v1.2.0 CI sonucu push sonrasında ayrıca izlenecektir.

## English

A mocked Google provider exercised OAuth without real credentials: first sign-in claimed the existing server guest village, and the same progress resumed on another device and after process restart. Negative tests covered signature, audience, nonce, state, browser cookie, replay and same-origin protection; sign-out revoked that device's session. Existing SQLite guest saves survived the schema migration. Live Google consent needs a Google Cloud client and Dokploy secret; see the [setup guide](GOOGLE-SIGNIN.md).

The visual homepage was reviewed on desktop, at 390 px mobile width and in dark mode; its Google button uses the official color G icon, verified loaded online and offline. Game-tab and theme state persisted across reloads, and passive resource updates did not interrupt long-page scrolling. `preview/index.html` is a self-contained offline preview with the 400 KB hero art embedded (707,754 bytes total). Local Docker web served `/`, `/privacy.html`, `/terms.html`, and auth status with HTTP 200. This run skipped authenticated admin smoke because `ADMIN_PASSWORD` is unset locally; admin health returned 200, and the prior temporary-password login check passed. Persistent data volumes were preserved.

On 27 September the live VPS returned 200 for the main site, API health, and analytics health, but 503 `admin_unavailable` for the admin session and 502 for `admin.bozkurtobasi.com/healthz`. This does not establish that v1.2.0 is deployed on Dokploy. Verify `ADMIN_PASSWORD`/`ADMIN_EMAIL`, map the admin domain to `admin:3000`, inspect container/domain logs, and redeploy. Live Google sign-in also waits for the OAuth client ID and secret. The previous v1.1.0 [GitHub Actions run](https://github.com/emindemirciai/Bozkurt-Obasi/actions/runs/36298568274) passed; the v1.2.0 run will be monitored after push.
