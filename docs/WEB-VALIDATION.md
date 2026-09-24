# Bozkurt Obası · doğrulama / Validation

Tarih / Date: 2026-09-24. Ortam / Environment: Windows, Node.js 24.16.0, Docker Desktop 29.8.0, Playwright Chromium.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| `npm run check` | Geçti / Passed — 27 JS dosyası, 173 TR/EN oyun çeviri anahtarı, dört Compose servisi, MIT lisansı |
| `npm run format:check` | Geçti / Passed |
| `npm test` | 33/33 — oyun motoru, SQLite, API, yönetici giriş/oturum/koruma/kalıcılık |
| `npm run build` | Geçti / Passed — Vite üretim paketi |
| `npm run build:preview` | Geçti / Passed — tek dosyalık `preview/index.html` |
| `npm run test:e2e` | 14/14 — masaüstü/mobil oyun, savaş, kayıt, TR/EN, analitik gönderimi ve tercihleri |
| Dört Docker imajı / Four Docker images | Geçti / Passed — `web`, `api`, `admin`, `analyze` derlendi |
| `docker compose config --quiet` | Geçti / Passed — üretim ve yerel override |
| `node scripts/stack-smoke.mjs` | Geçti / Passed — dört servis health, oyun oturumu, yönetici ve analiz girişi, olay/süre kaydı |
| `node scripts/stack-browser-smoke.mjs` | Geçti / Passed — yönetim ve analiz girişleri, TR/EN seçimi, iki panelin hatasız tarayıcı çizimi |
| Görsel kontrol / Visual review | Yönetim ekranı 1440×900 ve 390×844 incelendi / Admin screen reviewed at both sizes |

## Türkçe

Dört servis yerel Docker'da `127.0.0.1:3000–3003` portlarında çalıştırıldı. Yönetim paneli giriş sayfasındaki ilk 404 gerçek HTTP testinde yakalandı ve düzeltildi. Geçici test parolasıyla yönetim API'sinden bearer oturumu alındı; analiz paneli aynı oturumu doğruladı. Üretim origin başlığıyla `/api/track` adresine aynı kimlikte iki olay gönderildi; panelde tek kaydın süresi 7 saniyeye güncellendi. Yönetim ve analiz panellerinde gerçek Chromium ile giriş, dil değiştirme ve konsol hatası olmadan çizim doğrulandı. İlk denemede görülen React hydration uyuşmazlığı giderildi. Test parolası ortamdan kaldırılarak yerel API tekrar parolasız başlatıldı. Testler kalıcı oyunun volume'unu silmedi.

Analiz imajının ilk derlemesi, özgün kaynakta React 19 ile `react-simple-maps` peer bağımlılığı uyuşmazlığı nedeniyle durdu. Docker kurulumu `npm ci --legacy-peer-deps` ile yeniden üretilebilir şekilde düzeltildi; Next.js derleme/tip kontrolü ve gerçek dört servis testi geçti. Analiz kaynağı ve özgün MIT lisansı [kaynak bildiriminde](ANALYZE-SOURCE.md) tanımlıdır.

Canlı Dokploy VPS, gerçek DNS/TLS ve GitHub Actions sonucu bu yerel kontrollerden ayrı doğrulanmalıdır. `ADMIN_PASSWORD` Dokploy'da tanımlanmadan yönetim ve analiz girişleri çalışmaz. SMTP gönderimi bu sürümde yoktur.

## English

All four services ran locally on ports `127.0.0.1:3000–3003`. An initial admin-root 404 was found by real HTTP smoke testing and fixed. With a temporary test-only password, the API issued a bearer session, the analytics panel validated it, and two production-origin tracking posts with the same ID produced one event updated to seven seconds. Real Chromium also verified both panel sign-ins, language switching, and rendering without page errors. An initial React hydration mismatch was fixed. The test password was removed and the local API restored without it. Game volumes were preserved.

The first analytics image build exposed an upstream React 19 / `react-simple-maps` peer dependency mismatch. Reproducible installation now uses `npm ci --legacy-peer-deps`; Next.js compilation/type checking and the full stack smoke passed. The original analytics MIT notice is retained in the [source notice](ANALYZE-SOURCE.md).

Local tests do not establish live Dokploy DNS/TLS or the GitHub Actions result. Set `ADMIN_PASSWORD` in Dokploy to enable admin and analytics login. SMTP delivery is not implemented.
