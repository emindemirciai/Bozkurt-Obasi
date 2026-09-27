# Sürüm geçmişi / Changelog

Sürüm kayıtları [`releases.json`](releases.json) ile aynı içeriktedir; oyun içindeki **Sürüm geçmişi / Release history** bölümü bu kaynaktan beslenir. Yeni bir iş tamamlandığında sürümü, iki dilde değişiklikleri, doğrulamayı, README satır sayısını ve temiz kaynak ZIP'ini birlikte güncelleyin.

Release entries match [`releases.json`](releases.json); the in-game **Release history** reads that file. After each completed update, advance the version and update both languages, validation, README line count, and clean source ZIP together.

## v1.2.0 — 2026-09-27

**TR**
- Kurtların ve sürünün çakallara baktığı özgün görselle desteklenen ana sayfa, hikâye ve oyuna hızlı giriş eklendi.
- Google ile güvenli giriş, mevcut sunucu misafir köyünü hesaba bağlama, cihazlar arası sürdürme ve çıkış eklendi. Google anahtarları yalnızca sunucu ortamında tutulur.
- Türkçe/İngilizce gizlilik bildirimi ve kullanım koşulları; Google Cloud ve Dokploy kurulum rehberi eklendi.
- Trafik analizinde ana sayfa ölçümü eklendi ve IP konum çözümlemesindeki şifresiz HTTP yedeği kaldırıldı.

**EN**
- Added a visual homepage with original artwork showing the wolves and herd facing the jackals, a story section, and direct game entry.
- Added secure Google sign-in, linking of an existing server guest village, cross-device progress, and sign-out. Google credentials remain server-side.
- Added Turkish/English privacy notice and terms, plus Google Cloud and Dokploy setup guidance.
- Added homepage analytics and removed the plaintext HTTP fallback for IP geolocation.
## v1.1.0 — 2026-09-26

**TR**
- Oyun, yönetim ve analiz ekranları için açık/koyu tema seçimi eklendi.
- Oyun içine güncel sürümü gösteren Türkçe/İngilizce sürüm geçmişi eklendi.
- Kaynak görüntüsünde © 2026 Emin DEMİRCİ ve MIT lisans bildirimi görünür hale getirildi. MIT, telif ve lisans bildirimi korunduğu sürece kullanım, değiştirme ve dağıtıma izin verir; bu koşula uymayan kullanım hak ihlaline yol açabilir.
- Dört servisli Dokploy için paylaşılabilir, sır içermeyen üretim ortamı örneği ve dağıtım açıklamaları eklendi.

**EN**
- Added light/dark theme selection across the game, admin, and analytics screens.
- Added an in-game Turkish/English release history showing the current version.
- Made the © 2026 Emin DEMİRCİ and MIT license notice visible in page source. MIT permits use, modification, and redistribution when the copyright and license notice are preserved; use outside those terms may infringe rights.
- Added a shareable, secret-free production environment example and deployment guidance for the four-service Dokploy stack.

## v1.0.0 — 2026-09-25

**TR**
- Oynanabilir tarayıcı köy kurma, üretim, kurt muhafızları ve sürü savunması.
- Hareketli savaş sahnesi ve savaş başladığında beş seçenekten rastgele gelen çakal taktiği.
- Tek Compose içinde `web`, `api`, `admin` ve kullanıcının Analyze Your Site kaynağından uyarlanan `analyze`.
- Türkçe/İngilizce arayüz, çevrimdışı oynanabilir index, testler, MIT lisansı ve kaynak ZIP'i.

**EN**
- Playable browser village builder with production, wolf guardians, and herd defense.
- Animated battle scene and one of five randomly selected jackal tactics at battle start.
- One Compose stack for `web`, `api`, `admin`, and `analyze`, adapted from the user's Analyze Your Site source.
- Turkish/English interface, playable offline index, tests, MIT license, and source ZIP.
