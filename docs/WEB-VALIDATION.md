# Bozkurt Obası · doğrulama / Validation

Tarih / Date: 2026-10-01. Sürüm / Release: **v1.4.0**. Windows, Node.js 24, Docker Desktop 29.8.1, Playwright Chromium.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| Kaynak ve çeviriler / Source and translations | 42 JavaScript dosyası, 270 eşleşen TR/EN anahtar / files and matching keys |
| Motor, hesap, SMTP ve sürüm testleri / Engine, account, SMTP and release tests | 95/95 geçti / passed |
| Tarayıcı / Browser | 32/32 geçti / passed; kayıt, giriş, doğrulama bağlantısı, yeniden gönderim, hesap eşleştirme, oyun ve mobil / registration, sign-in, verification link, resend, account linking, game and mobile |
| Üretim ve tek dosya / Production and single-file builds | Geçti / passed; `preview/index.html` yeniden üretildi / regenerated |
| Biçim ve diff / Formatting and diff | `npm run format:check` ve `git diff --check` geçti / passed |
| Sürüm artışı / Version increase | v1.3.0 → v1.4.0; paket, kilit, README, CHANGELOG ve geçmiş eşleşiyor / all version records agree |
| Dört servis / Four services | `web`, `api`, `admin`, `analyze` imajları derlendi ve yerel sağlık kontrolü geçti / images built and local health checks passed |
| Konteyner kalıcılığı / Container persistence | Salt-okunur, root olmayan API konteynerinde kayıt → köy inşası → yeniden başlatma → yeniden giriş → aynı köy → çıkış geçti / read-only non-root API container registration, village, restart, sign-in and logout passed |
| Kaynak sayımı / Source count | 150 Git projesi dosyası, 28.676 fiziksel satır; 18.478 aktif web satırı / Git project files, physical lines, active web lines |

## Türkçe

SMTP etkinse kayıt sonrası `info@bozkurtobasi.com` göndereninden bir saatlik, tek kullanımlık doğrulama bağlantısı gönderilir. Hesap ekranındaki yeniden gönderim, oturum ve aynı kaynak denetimiyle korunur. Belirteç SQLite içinde yalnızca SHA-256 özeti olarak tutulur; bağlantıda URL parçasındadır ve HTTP istek adresine gitmez. Başarısız gönderim mevcut çalışan bağlantıyı bozmaz veya günlük başarılı gönderim kotasını tüketmez. Yavaş SMTP için kayıt yanıtı beş saniyelik gönderim üst sınırından sonra başarıyla döner; e-posta teslim edilememişse doğrulama gönderildi iddiası gösterilmez. Gönderen adresi sabittir; `MAIL_FROM` yalnızca güvenli görünen adı seçer.

Testlerde gerçek Hostinger hesabı yerine bellekteki posta göndericisi kullanıldı; canlı SMTP teslimatı ve VPS/Dokploy dağıtımı bu kayıtla doğrulanmış sayılmaz. Yerel Compose ortamında `SMTP_PASSWORD` boş ve `mailEnabled=false`; oyuncu kaydı/girişi ile dört servis sağlığı çalışır. `ADMIN_PASSWORD` yerelde boş olduğundan yönetim/analiz girişi burada denenmedi; yönetici API testleri test parolasıyla geçti. Yönetici girişi `ADMIN_EMAIL` ve `ADMIN_PASSWORD` ortam değişkenlerine bağlıdır, seed veritabanı hesabı yoktur.

Google ile aynı e-postanın eşleştirilmesi önceki sahiplik kanıtı ve köy koruma testleriyle geçti. Otomatik parola sıfırlama bu sürüme dahil değildir. Temiz kaynak ZIP'i Git projesindeki dosyalarla üretilir; kişisel takip edilmeyen dosyalar, sırlar, veritabanları ve bağımlılıklar dışarıda kalır. Canlı SMTP için parolayı yalnızca Dokploy Environment bölümüne girip [dağıtım rehberindeki](WEB-DEPLOYMENT.md) adımları uygulayın.

## English

When SMTP is enabled, registration sends a one-hour, single-use verification link from `info@bozkurtobasi.com`. Resend from the account screen requires a session and same-origin request. SQLite stores only the SHA-256 token digest; the link places the token in a URL fragment so it does not reach the HTTP request URL. A failed resend keeps a previously delivered link usable and does not consume the daily successful-send quota. A five-second delivery bound prevents slow SMTP from holding a completed registration; the UI does not claim mail was sent when delivery failed. The From address is fixed and `MAIL_FROM` controls only a validated display name.

Tests use an in-memory sender rather than a real Hostinger mailbox; this record does not establish live SMTP delivery or a VPS/Dokploy deployment. Local Compose leaves `SMTP_PASSWORD` empty and reports `mailEnabled=false`, while player sign-in and all four services remain healthy. Local `ADMIN_PASSWORD` is unset, so admin/analytics login was not exercised in the local stack; admin API tests passed with a test password. Admin access uses the `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment values, without a seeded database account.

Matching Google/email methods passed the existing ownership-proof and village-preservation tests. Automatic password recovery is not included. The clean source ZIP contains Git project files and excludes personal untracked files, secrets, databases and dependencies. Put the real SMTP password only in Dokploy Environment and follow the [deployment guide](WEB-DEPLOYMENT.md) for a live delivery check.
