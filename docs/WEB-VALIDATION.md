# Bozkurt Obası · doğrulama / Validation

Tarih / Date: 2026-09-29. Sürüm / Release: **v1.2.5**. Windows, Node.js 24.16.0, Docker Desktop 29.8.0, Playwright Chromium.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| Kaynak ve çeviriler / Source and translations | 37 JavaScript dosyası ve 223 eşleşen TR/EN anahtar / files and matching keys |
| Motor, API, OAuth ve sürüm araçları / Engine, API, OAuth and release tools | 71/71 geçti / passed |
| Tarayıcı / Browser | 25/25 geçti / passed; masaüstü, mobil, TR/EN, tema, oturum ve önizleme / desktop, mobile, theme, sessions and preview |
| Üretim ve tek dosya / Production and single-file builds | Geçti / passed; preview/index.html 782.577 bayt / bytes |
| Biçim ve diff / Formatting and diff | npm run format:check ve git diff --check geçti / passed |
| Sürüm artışı / Version increase | v1.2.4 → v1.2.5; paket, kilit, README, CHANGELOG ve geçmiş eşleşiyor / all version records agree |
| Dört servis / Four services | Dört Docker imajı derlendi, yerel sağlık ve Google giriş kapısı kontrolü geçti / all images built, local health and sign-in gate passed |
| Analiz üretim derlemesi / Analytics production build | Next.js derleme, lint, TypeScript ve 8 statik sayfa geçti / compile, lint, type checking and 8 static pages passed |
| Kaynak sayımı / Source count | 145 dosya, 25.967 fiziksel satır; 15.769 aktif web satırı / files, physical lines, active web lines |

## Türkçe

Koyu tema ana sayfa, köy, savaş, muhafızlar, görevler, sürüm geçmişi, hesap penceresi, yönetim ve analiz ekranlarında kahverengi/toprak yüzeyler kullanır. Krem metinler ve altın vurgular; bozkır yeşili düğmeler, seçili kartlar, bildirimler, grafikler ve harita detaylarıyla tamamlanır. Temel metin/yüzey kontrastları 4,52–13,79 aralığındadır. Web açık tema kuralları ve hero ölçüleri önceki commit ile aynı; yönetim açık tema bloğu ve analizin önceki açık tema renkleri korunur. Analizin sistem tercihi ve açıkça seçilen koyu tema paletleri eşleşir.

Masaüstü ve mobil ekran görüntüleri yerelde incelendi. Yönetim ve analiz panolarının görsel incelemesi sentetik tarayıcı verileriyle yapıldı; geçici localhost analiz konteyneri kontrol sonrası kaldırıldı. Kalıcı proje volume'ları korundu. Yerel stack kontrolünde ADMIN_PASSWORD boş olduğundan gerçek panel oturumu adımı atlandı; GitHub CI korunan panel akışını test parolasıyla sınar. Gerçek Google anahtarları yerelde ayarlı değil; oyun erişimi için yapılandırma gerekir. OAuth testleri yalnızca test sunucusundaki imzalı taklit sağlayıcıyla çalışır.

Bu kayıt VPS dağıtımını doğrulamaz. Dokploy'da dört servisi yeniden dağıtın; Google anahtarları, ADMIN_PASSWORD/ADMIN_EMAIL ve alan adı-servis-port eşlemelerini [dağıtım rehberinden](WEB-DEPLOYMENT.md) kontrol edin. Bu commit'in tam test/Docker/Release sonucu [GitHub Actions](https://github.com/emindemirciai/Bozkurt-Obasi/actions/workflows/web-ci.yml) üzerinden görülebilir.

## English

Dark mode uses brown/earth surfaces across the homepage, village, battle, guardians, quests, release history, account dialog, admin and analytics screens. Cream text and gold highlights pair with steppe green buttons, selected cards, notices, charts and map details. Key text/surface contrast ratios range from 4.52 to 13.79. Web light rules and hero geometry match the previous commit; admin light overrides and previous analytics light colors are preserved. Analytics system-preference and explicitly selected dark palettes agree.

Desktop and mobile screenshots were reviewed locally. Admin and analytics dashboards used synthetic browser fixtures for visual review; the temporary localhost analytics container was removed afterward. Persistent project volumes were preserved. Local stack smoke skipped actual panel sign-in because ADMIN_PASSWORD is unset; GitHub CI exercises protected panels with a test password. Live Google credentials are unset locally; game access requires configuration. OAuth tests use a signed mock provider restricted to the test server.

This record does not confirm a VPS deployment. Redeploy the four services in Dokploy and verify Google credentials, ADMIN_PASSWORD/ADMIN_EMAIL and domain/service/port mappings using the [deployment guide](WEB-DEPLOYMENT.md). This commit's full test, Docker and Release result is available in [GitHub Actions](https://github.com/emindemirciai/Bozkurt-Obasi/actions/workflows/web-ci.yml).
