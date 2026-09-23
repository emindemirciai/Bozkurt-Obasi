# Web v1.0.0 doğrulama / Validation

Tarih / Date: 2026-09-24. Yerel ortam / Local environment: Windows, Node 24.16.0, Chromium 153 via Playwright 1.63.0; Linux containers via Docker Desktop 29.8.0.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| `npm run check` | Geçti / Passed — 22 JavaScript files, 173 TR/EN keys, Docker source paths, lock metadata |
| `npm run format:check` | Geçti / Passed |
| `npm test` | 30/30 — deterministic simulation, validation, economy, interrupted battles, HTTP, SQLite, session isolation, CSRF, revisions, persistence, analytics config/CSP |
| `npm run build` | Geçti / Passed — Vite 8.3.0 production bundle |
| `npm run build:preview` | Geçti / Passed — self-contained `preview/index.html` |
| `npm run test:e2e` | 14/14 — desktop/mobile, build/quests/training, combat, TR/EN, file preview, server/local separation, analytics view/duration/opt-out/failure isolation, delayed responses, keyboard focus |
| Docker image build | Geçti / Passed — Linux Node 24, locked `npm ci`, non-root runtime |
| `node scripts/container-smoke.mjs bozkurt-obasi:verify` | Geçti / Passed — non-root read-only container, health, HTML, guest session, construction, SQLite state after restart |
| Production and local Compose config | Geçti / Passed |

## Türkçe

Kurtlar ve karma sürü savaş alanında çakallara dönüktür. `npm run verify` yeniden çalıştırıldı: 30 motor/API ve 14 tarayıcı testi geçti; üretim ve tek dosya önizleme yenilendi. Yeni tarayıcı testleri üretim alan adındaki analitik veri akışını ağ taklidiyle doğruladı; canlı analiz paneline olay gönderilmedi. Ekran geçişinde tek kimlikli görüntüleme ve süre güncellemesi, gizli oyun bilgisinin dışarı çıkmaması, DNT/GPC, yerel ortamın sessiz kalması ve analiz kesintisinde oyunun çalışması sınandı. Yeni Linux imajı derlenip konteynerin sağlık, işlem ve yeniden başlatma sonrası SQLite kalıcılığı doğrulandı.

Görsel kontrol masaüstü 1440×1100 ve mobil 390×844 boyutlarında yapıldı. Köy, ay-yıldız savaş sahnesi ve mobil menü incelendi. Test ekran görüntüleri `artifacts/` altında üretilir ve kaynak ZIP'ine dahil edilmez. Oyun çizimleri özgün SVG kodudur; uzaktan yazı tipi/görsel gerektirmez.

Kayıt güvenliği için geciken sunucu yanıtı sırasında yerel köye dönme, bekleyen okuma sonrası doğru revision ile işlem, bozuk başarılı API yanıtını reddetme ve otomatik kaynak üretimiyle inşaatın açılması tarayıcıda sınandı. Savaş açılışta hazırlığa dönerken HP/XP ve ilerlemenin korunması motor/API testlerinde doğrulandı.

İlk konteyner testinde Docker'ın yeniden başlatma sırasında rastgele host portunu değiştirebildiği görüldü. Test aracı yeniden başlatmadan sonra portu tekrar okur; düzeltilmiş test geçti. Testler kendi geçici konteyner/volume ve bellek veritabanlarını kullanır.

GitHub hedefi `emindemirciai/Bozkurt-Obasi`, oyun alan adı `bozkurtobasi.com`, analiz alan adı `analiz.bozkurtobasi.com` olarak belirlendi. Canlı Dokploy yayını, gerçek TLS/domain erişimi, analiz paneline gerçek ziyaret, çok oyunculu yük ve Unity derlemesi bu yerel çalışmada test edilmedi. Analiz panelinin `platform-admin` girişi, oyunda bulunmayan ayrı yönetici API uç noktalarını gerektirir. GitHub Actions sonucunu push sonrası ayrıca doğrulayın. Bu kayıt yerel sonuçların sınırlarını gösterir.

## English

Wolves and the mixed herd face the jackals in battle. `npm run verify` was rerun: 30 engine/API and 14 browser tests passed, and production/standalone preview builds were refreshed. New browser tests mock the production analytics network without sending events to the live panel. They cover one view ID with a cumulative duration update on navigation, no game secrets in the payload, DNT/GPC preferences, no localhost traffic, and continued gameplay when analytics fails. The fresh Linux image passed container health, action, and SQLite persistence checks across restart.

Visual inspection covered desktop 1440×1100 and mobile 390×844, including the village, crescent/star battle scene, and mobile navigation. Test screenshots are generated under `artifacts/` and excluded from source archives. Artwork is original SVG code and needs no remote images or fonts.

Browser regressions cover delayed server responses after returning to the local village, action serialization with the latest revision, rejecting invalid successful API responses, and unlocking construction through passive production. Engine/API tests confirm interrupted battles return to preparation without resetting HP/XP or granting unearned rewards.

The initial container smoke exposed that Docker may reassign an ephemeral host port on restart. The smoke now re-reads the binding after restart and passes. Tests use dedicated temporary containers/volumes and in-memory databases.

The selected GitHub target is `emindemirciai/Bozkurt-Obasi`; the game and analytics domains are `bozkurtobasi.com` and `analiz.bozkurtobasi.com`. Live Dokploy publication, production TLS/domain access, actual traffic arriving in the analytics panel, multiplayer load, and Unity builds were not tested locally. The panel's `platform-admin` login requires a separate admin API that is absent from this game repository. Verify the GitHub Actions run after push. These are local results, not a guarantee of future deployments.
