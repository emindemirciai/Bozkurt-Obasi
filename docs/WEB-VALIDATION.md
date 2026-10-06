# Bozkurt Obası · doğrulama / Validation

Tarih / Date: 2026-10-06. Sürüm / Release: **v1.6.0**. Windows, Node.js 24, Docker Desktop, Playwright Chromium, Windows PowerShell 5.1.

| Kontrol / Check | Sonuç / Result |
| --- | --- |
| Kaynak ve çeviriler / Source and translations | 54 JavaScript dosyası, 344 eşleşen TR/EN anahtar / files and matching keys |
| Motor, hesap, profil, arkadaşlık, SMTP ve sürüm / Engine, accounts, profiles, friends, SMTP and release | 111 test: tümü geçti / all passed |
| Tarayıcı / Browser | 36/36 geçti / passed; kod doğrulama, profil, iki oyuncu, maden gönderimi, oyun, TR/EN, temalar ve mobil / code verification, profiles, two players, stone gifts, gameplay, languages, themes and mobile |
| Tam yedek / Full backup | PowerShell 5.1 çevrimdışı entegrasyon: 12/12 geçti / offline integration passed |
| Üretim ve tek dosya / Production and standalone | Derleme geçti; `preview/index.html` güncel, `preview/mail.html` görselli e-posta örneği / build passed; homepage and illustrated email previews |
| Biçim ve diff / Formatting and diff | `npm run format:check`, `git diff --check` geçti / passed |
| Sürüm artışı / Version increase | v1.5.0 → v1.6.0; paket, kilit, README, CHANGELOG ve geçmiş eşleşiyor / version records agree |
| Dört servis / Four services | `web`, `api`, `admin`, `analyze` derlendi; yerel sağlık ve konteyner kalıcılık kontrolleri geçti / builds, local health and container persistence passed |

Kaynak sayımı / Source count: **168 dosya, 31.585 fiziksel satır; 21.387 aktif web satırı**. Üretilen önizlemeler ve bağımlılıklar hariç / files, physical source lines and active web lines, excluding generated previews and dependencies.

## Türkçe

E-posta kaydı sınırlı yetkili bekleyen oturum oluşturur. Oyun ekranları, state/session/action, profil ve arkadaş uç noktaları kod doğrulanmadan açılmaz. Google imzalı ve doğrulanmış e-posta kimliğine güvenilir; mevcut şifre hesabına bağlama için o hesabın sahipliği ayrıca kanıtlanır. Kod 15 dakika geçerli, tek kullanımlık, oturumdaki hesaba bağlı ve tuzlu özet olarak saklanır. Beş hatalı deneme, tekrar gönderim süresi, günlük kota, SMTP hatası, hesaplar arası deneme, süre sonu ve sunucu yeniden başlatma test edildi. Başarısız SMTP, doğrulama kapısını kaldırmaz.

Görselli HTML ileti hilal muhafızlar ve yıldız sürü düzenini anlatır. PNG CID eki ve düz metin alternatifi MIME testinde kontrol edildi. SMTP göndereni `info@bozkurtobasi.com`; örnek mail önizlemesinin kodu gerçek bir hesaba ait değildir.

Profil API'si e-posta, ad soyad ve oyuncu koduna yazmayı reddeder. Takma ad ve en fazla 2 MB PNG/JPEG/GIF değişebilir. Google fotoğrafı ilk görseldir; özel yükleme sonraki Google girişinde korunur. Şifre değişimi eski şifreyi doğrular, diğer oturumları kapatır ve köyü korur. Profil açık/koyu, masaüstü/mobil görünümü incelendi; fotoğraf kaldırma ve üç logo bağlantısı test edildi.

Arkadaşlık açık kabul gerektirir. Maden (taş) transferi bakiyeyi ve alıcının depo kapasitesini kontrol eder. Her iki kayıt tek işlemde güncellenir; gönderici ve alıcının revizyonları artar. UUID ile tekrarlanan istek ikinci kez kaynak düşmez; uyuşmayan tekrar, eski revizyon ve başarısız aktarım kayıtları bozmaz. Savaş devam eder. API yeniden başlatma sonrası ilişki ve son hareketler korunur. İki ayrı tarayıcı oturumuyla istek, kabul, gönderim, alım ve arkadaşlıktan çıkarma denendi.

Nginx üretim yapılandırması Google resim origin'ine izin verir. Yalnızca profil rotası 3 MB JSON sınırını kullanır; diğer proxy rotaları 32 KB, oyun sunucusu varsayılanı 16 KB sınırını korur. Docker testi SMTP olmayan geçici volume'da bekleyen hesabın oyun erişimini reddettiğini kontrol eder, sonra yalnızca o test veritabanına doğrulanmış fixture ekleyerek kalıcılığı sınar; üretimde doğrulamayı atlayan rota/ortam anahtarı yoktur.

GitHub Linux işleri, [resmi runner listesinde](https://github.com/actions/runner-images#available-images) desteklenen Ubuntu 24.04'e sabitlendi. Önceki v1.5.0 koşusunda Linux testi başlamadan GitHub çalıştırıcı ayıramamıştı. Yeni Release yalnızca üç CI işi başarılıysa otomatik yayımlanır. Yerel başarı, GitHub çalıştırıcı kapasitesini veya canlı VPS/SMTP teslimatını garanti etmez.

## English

Email registration creates a restricted pending session. Game screens and state/session/action, profile and friend APIs stay locked until code confirmation. Signed Google identities with verified email can start through Google; linking to an existing password account also proves control of that account. Tests cover single use, 15-minute expiration, hashed storage, five-guess limits, resend cooldown/quota, failed SMTP, cross-account attempts and server restart persistence.

Illustrated HTML email embeds the crescent guardian/star herd PNG with CID and includes a plain-text alternative. MIME tests check the image part. `info@bozkurtobasi.com` remains the fixed sender. The offline mail preview uses an example code, never a real account secret.

Profile APIs reject email, full-name and player-code changes. Editable nicknames and bounded PNG/JPEG/GIF uploads persist; custom photos win over later Google pictures. Password changes prove the current secret, revoke other devices and preserve village progress. Desktop/mobile light/dark views, photo removal and every logo destination were checked.

Accepted friendship is required for atomic stone gifts. Balance, capacity, integer amount, revision and idempotency checks protect both villages. Both revisions increase, retrying cannot deduct twice, errors roll back, active battles continue, and friendship/history survive restart. Two browser sessions exercised requests, acceptance, sending, receiving and removal.

Production Nginx allows Google image origins and gives only the profile JSON route a 3 MB limit. Other proxy bodies remain bounded at 32 KB and default API bodies at 16 KB. The isolated Docker smoke test denies pending gameplay, then directly seeds its own disposable test database for persistence checks; production exposes no verification bypass route or environment flag.

Linux CI uses Ubuntu 24.04 from the [official runner list](https://github.com/actions/runner-images#available-images). The earlier v1.5.0 run failed before acquiring a Linux runner. Automatic release still requires all three validation jobs to pass. Local success cannot guarantee hosted-runner availability or live VPS/SMTP delivery.
