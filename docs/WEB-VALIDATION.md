# Bozkurt Obası · doğrulama / Validation

Tarih / Date: 2026-09-30. Sürüm / Release: **v1.3.0**. Windows, Node.js 24.16.0, Docker Desktop 29.8.0, Playwright Chromium.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| Kaynak ve çeviriler / Source and translations | 40 JavaScript dosyası, 262 eşleşen TR/EN anahtar / files and matching keys |
| Motor, hesap API'si, OAuth ve sürüm araçları / Engine, account API, OAuth and release tools | 89/89 geçti / passed |
| Tarayıcı / Browser | 31/31 geçti / passed; kayıt, giriş, aynı köyde iki yöntem, oturum kapısı, masaüstü, mobil, tema ve önizleme / registration, sign-in, linked village, access gate, desktop, mobile, theme and preview |
| Üretim ve tek dosya / Production and single-file builds | Geçti / passed; `preview/index.html` yeniden üretildi / regenerated |
| Biçim ve diff / Formatting and diff | npm run format:check ve git diff --check geçti / passed |
| Sürüm artışı / Version increase | v1.2.5 → v1.3.0; paket, kilit, README, CHANGELOG ve geçmiş eşleşiyor / all version records agree |
| Dört servis / Four services | `web`, `api`, `admin`, `analyze` imajları derlendi; yerel sağlık ve hesap kapısı kontrolü geçti / images built; local health and account gate passed |
| Konteyner kalıcılığı / Container persistence | Salt-okunur, root olmayan API konteynerinde kayıt → köy inşası → yeniden başlatma → yeniden giriş → aynı köy → çıkış geçti / read-only non-root API container registration, village, restart, sign-in and logout passed |
| Kaynak sayımı / Source count | 148 dosya, 27.900 fiziksel satır; 17.702 aktif web satırı / files, physical lines, active web lines |

## Türkçe

E-posta ve şifreyle kayıt/giriş, Google anahtarları yerelde boşken çalışıyor. Şifre rastgele tuzlu scrypt özetiyle sunucuda saklanıyor. Köy çıkış, yeniden giriş ve konteyner yeniden başlatma sonrasında korunuyor. Geçersiz veya çıkış yapılmış çerez oyun API'sini açmıyor. Google ile başlayıp şifre ekleme ve önce şifreyle girip aynı doğrulanmış Google e-postasını bağlama akışları yalnızca test sunucusundaki imzalı Google taklidiyle doğrulandı. Eşleştirmede mevcut Google köyü korunuyor; eski e-posta köyünün kaynakları karıştırılmıyor. Anonim Google girişi mevcut bir şifre hesabıyla karşılaşırsa önce şifreyle giriş isteniyor.

Masaüstü ve mobil giriş/kayıt ekranları görsel olarak incelendi. Koyu kahverengi, krem ve bozkır yeşili palet ile TR/EN ana sayfa ölçüleri korundu. Yerel Compose dört servis sağlıklı. `ADMIN_PASSWORD` yerelde boş olduğu için yönetici/analiz oturumu burada denenmedi; GitHub CI test parolasıyla bu akışı çalıştırır. E-posta doğrulama iletisi, SMTP ve otomatik şifre sıfırlama henüz yok. Bu nedenle e-posta hesabı önceden açılmışsa, Google e-posta sahibinin o hesabın şifresini bilmeden otomatik eşleştirme yapması mümkün değil. Şifreler ve eski oturumlar otomatik silinmiyor.

Bu kayıt canlı VPS dağıtımını doğrulamaz. Dokploy'da dört servisi yeniden dağıtın; alan adı-servis-port eşlemesini ve Google kullanacaksanız OAuth anahtarlarını [dağıtım rehberine](WEB-DEPLOYMENT.md) göre denetleyin. Bu commit'in CI, Docker ve Release sonucu [GitHub Actions](https://github.com/emindemirciai/Bozkurt-Obasi/actions/workflows/web-ci.yml) üzerinde görülebilir.

## English

Email/password registration and sign-in work locally without Google credentials. The server stores a randomly salted scrypt hash. The account village survives sign-out, sign-in and a container restart. Invalid or logged-out cookies cannot access the game API. Google-first password setup and email-first linking to the same verified Google address passed with a signed mock provider confined to the test server. Linking retains an existing Google village without blending resources from the previous email save. Anonymous Google sign-in for an existing password account prompts the user to sign in with that password first.

Desktop and mobile account screens were visually reviewed. The brown, cream and steppe-green dark palette and TR/EN hero geometry remain intact. All four local Compose services are healthy. Local `ADMIN_PASSWORD` is unset, so admin/analytics sign-in was not tested here; GitHub CI exercises it with a test password. Verification email delivery, SMTP and automated password recovery are not yet available. A verified Google email owner cannot automatically link an address previously registered by someone else without knowing that account's password. Passwords and all old sessions are not automatically cleared.

This record does not confirm a live VPS deployment. Redeploy all four services in Dokploy and check the domain/service/port mappings and optional Google credentials against the [deployment guide](WEB-DEPLOYMENT.md). This commit's CI, Docker and Release results are visible in [GitHub Actions](https://github.com/emindemirciai/Bozkurt-Obasi/actions/workflows/web-ci.yml).
