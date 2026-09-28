# Sürüm geçmişi / Changelog

Sürüm kayıtları [`releases.json`](releases.json) ile aynı içeriktedir; oyun içindeki **Sürüm geçmişi / Release history** bölümü bu kaynaktan beslenir. Yeni bir iş tamamlandığında sürümü, iki dilde değişiklikleri, doğrulamayı, README satır sayısını ve temiz kaynak ZIP'ini birlikte güncelleyin.

Release entries match [`releases.json`](releases.json); the in-game **Release history** reads that file. After each completed update, advance the version and update both languages, validation, README line count, and clean source ZIP together.

## v1.2.4 — 2026-09-28

**TR**

- Ana sayfa görselinde beş muhafız kurt, obanın önünde sürüyü hilal düzeninde koruyacak şekilde yerleştirildi; yüzleri çakallara dönük kaldı.
- Dağlar, göl, gün batımı ve oba arka planı korundu; görselin 1672×941 ölçüsü, TR/EN eşit boyutları ve ilk ekrandaki Google girişi değişmedi.

**EN**

- Repositioned five guardian wolves in the homepage artwork into a crescent in front of the camp, protecting the herd and facing the jackals.
- Preserved the mountains, lake, sunset and camp background; retained the 1672×941 artwork size, equal TR/EN layout and first-screen Google sign-in.

## v1.2.3 — 2026-09-28

**TR**

- Ana sayfa, gizlilik ve koşullar sayfalarının alt bilgilerindeki MIT etiketi kaldırıldı; alt bilgi artık © 2026 Bozkurt Obası şeklindedir.

**EN**

- Removed the MIT label from the homepage, privacy and terms page footers; the footer now reads © 2026 Bozkurt Obası.

## v1.2.2 — 2026-09-28

**TR**

- main güncellemelerinde başarılı test ve dört servis kontrolünden sonra otomatik Git etiketi ve TR/EN GitHub Release yayını eklendi.
- Sürümler temiz kaynak ZIP, SHA-256 ve görsel index.html ile teslim edilir; güncel sürüm README ve GitHub Releases bölümünde görünür.
- Tek komutla sürüm kayıtlarını birlikte ilerleten araç, sürüm artışını zorunlu tutan CI kontrolü ve güvenli tekrar yayın desteği eklendi.
- GitHub About açıklaması, site bağlantısı ve proje konuları eklendi; görünür sayfa alt bilgilerindeki kişi adı kaldırıldı.
- Ana sayfa görseli TR/EN dil değişiminde aynı ölçüde kalır ve masaüstünde ilk ekrana sığar; sayfa sonundaki tekrarlanan Google girişi kaldırıldı.

**EN**

- Added automatic Git tags and TR/EN GitHub Releases after successful tests and four-service checks on main updates.
- Releases include a clean source ZIP, SHA-256 and visual index.html; the current version appears in README and GitHub Releases.
- Added one-command version updates, a CI version-increase requirement and safe publishing retries.
- Added the GitHub About description, website link and project topics; removed the personal name from visible page footers.
- Homepage artwork keeps the same size across TR/EN and fits the first desktop screen; removed the repeated Google sign-in at the bottom of the page.

## v1.2.1 — 2026-09-28

**TR**

- Oyun API'sinde oturumsuz erişim engeli ve çıkış sırasında geciken yanıtlar test edildi; analiz oturum çözümlemesini bekler.
- Ana sayfa görseli, sahne bütünüyle görünür olacak şekilde ana görsel alanına yayıldı.
- Üst menüdeki **Obaya gir** düğmesi kaldırıldı. Köy ve diğer oyun ekranları, doğrudan URL ile açıldığında da geçerli Google oturumu gerektirir.
- Google istemcisi yapılandırılmadan oyun açılmaz; çevrimdışı `preview/index.html` yalnızca görsel ana sayfa önizlemesi sunar.

**EN**

- Tested unauthenticated game API denial and delayed responses after logout; analytics waits for session resolution.
- Expanded the homepage artwork across the hero area so the entire scene remains visible.
- Removed the header **Enter village** button. The village and other game screens now require a valid Google session, including direct URL visits.
- Game access remains closed until the Google client is configured; offline `preview/index.html` provides a visual homepage preview only.

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
