# Bozkurt Obası: Ay-Yıldız Nöbeti

**TR:** “Obanı kur, sürünü koru.” Tarayıcıda oynanabilen köy kurma ve sürü savunma oyunu. Kurtlar ve sürü savaşta çakallara bakar. Ana sayfa görselinde beş kurt, obanın önünde sürüyü doğal bir hilal düzeninde korur; dağlar, göl ve gün batımı arka planı korunur.

**EN:** “Build your village. Guard your herd.” A browser village builder and herd defense game. Wolves and the herd face the jackals in battle. The homepage artwork shows five wolves guarding the herd in a natural crescent in front of the camp, retaining the mountain, lake and sunset background.

[Görsel düzenleme kaydı ve tam istem / Artwork edit record and exact prompt](docs/HERO-ART.md)

[Gerçekçi savaş hayvanları ve tam istemler / Realistic battle animals and exact prompts](docs/BATTLE-ART.md) · [Çevrimdışı savaş görseli / Offline battlefield preview](preview/battle.html)

**Güncel sürüm / Current version: v2.8.0** · [GitHub Releases](https://github.com/emindemirciai/Bozkurt-Obasi/releases/latest) · [Sürüm geçmişi / Changelog](CHANGELOG.md) · [Sürüm oluşturma / Releasing](docs/RELEASING.md)

[Çevrimdışı görsel önizleme / Offline visual preview](preview/index.html) · [Dokploy rehberi / Deployment guide](docs/WEB-DEPLOYMENT.md) · [Hesap kaydı / Account registration](docs/ACCOUNT-SIGNIN.md) · [Görselli mail önizlemesi / Email preview](preview/mail.html) · [Şifre yenileme maili / Password reset email](preview/password-reset.html) · [Google girişi / Google sign-in](docs/GOOGLE-SIGNIN.md) · [Gizlilik / Privacy](public/privacy.html) · [Koşullar / Terms](public/terms.html) · [Doğrulama / Validation](docs/WEB-VALIDATION.md) · [Kaynak depo / Repository](https://github.com/emindemirciai/Bozkurt-Obasi)

## Türkçe

GitHub About bölümü oyun açıklamasını, `https://bozkurtobasi.com` site bağlantısını ve proje konularını içerir. Görünür sayfa alt bilgisi `© 2026 Bozkurt Obası` şeklindedir. Ana görsel alanı TR/EN'de aynı ölçüyü kullanır, masaüstünde ilk ekrana sığar ve Google girişi burada görünür; sayfa sonunda tekrar giriş düğmesi yoktur.

### Her tamamlanan iş için sürüm

`npm run release:version -- patch --tr "Türkçe değişiklik notu" --en "English change note"` komutu paket sürümünü, kilit dosyasını, oyun içi sürüm geçmişini, CHANGELOG ve README'yi birlikte ilerletir. Yeni özellikler için `minor`, uyumsuz değişiklikler için `major` kullanın. Sürüm ve notlar commit'e dahildir. `main` dalına birleşme veya push sonrasında testler ve dört servis kontrolü geçerse GitHub Actions otomatik olarak `vX.Y.Z` etiketi ve CHANGELOG'daki TR/EN notlarla Release oluşturur; temiz kaynak ZIP'i, SHA-256 ve görsel `index.html` sürüme eklenir. CI, sürümün önceki `main` kaydından ilerlemesini zorunlu tutar. [Sürüm rehberi](docs/RELEASING.md).

### Ana sayfayı önizle ve oyuna giriş yap

Savaş meydanındaki kurt, çakal, koyun ve büyükbaşlar gerçekçi saydam görsellerle çizilir. Dört WebP dosyası toplam yaklaşık 193 KiB'dir; kurtlar ve sürü çakallara bakar. [`preview/battle.html`](preview/battle.html), gerçek savaş sahnesinin tek dosyalık görsel önizlemesidir: TR/EN, açık/kahverengi koyu tema, yakınlaştırma ve gerçek motorla savaş komutlarını deneme internet olmadan kullanılabilir. Oyuncu hesabına veya oyun kaydına erişmez. `npm run build:preview` ana sayfa, savaş, admin, köy, sefer, muhafız ve İlk Nöbet önizlemelerini yeniler.

[`preview/index.html`](preview/index.html) dosyasını indirip tarayıcıda açın; internet veya sunucu gerektirmeyen, tek dosyalık **görsel ana sayfa önizlemesidir**. Oyun ekranları bu dosyada açılmaz. GitHub dosya görüntüleyicisi etkileşimli önizlemeyi çalıştırmaz. Node.js 24 ile yerel API ve kalıcı SQLite kullanmak için:

```bash
npm ci
npm run build
npm start
```

Ardından <http://127.0.0.1:3000> adresini açın. Görselli ana sayfa ve bilgi sayfaları herkese açıktır; **köye ve diğer oyun ekranlarına geçerli hesap oturumu olmadan girilemez**, doğrudan `#village` bağlantısıyla da açılamaz. Ana sayfadaki **Kayıt ol** ile e-posta/şifre hesabı oluşturabilir veya **Giriş yap** ile mevcut hesabınızı açabilirsiniz. Şifre 12–128 karakterdir. Google seçeneği için [Google istemcisini yapılandırın](docs/GOOGLE-SIGNIN.md). [Hesap rehberi](docs/ACCOUNT-SIGNIN.md). Mevcut eski misafir köyü, geçerli eski oturum çerezi varsa ilk Google girişinde hesaba bağlanabilir; tarayıcıdaki eski yerel kayıt otomatik aktarılmaz.

Oyunda 9 yapı türü, kaynak üretimi, 5 eğitilebilir muhafız, hilal/yıldız formasyonları, savaş başında rastgele belirlenen 5 çakal taktiği, hikâyeli dalga savaşları, 5 bölge, seçilen kurtlarla keşif/sevkiyat ve görevler bulunur. Görselli ana sayfa, oyun, yönetim ve analiz arayüzleri Türkçe/İngilizce ile açık/koyu temayı destekler. Koyu tema sıcak kahverengi ve toprak yüzeyleri, krem metinleri, altın vurguları ve bozkır yeşili düğme/seçili alanları kullanır; açık tema korunur. Tema seçimi cihazda hatırlanır. Oyundaki **Sürüm geçmişi** v2.8.0 ve önceki değişiklikleri gösterir. E-posta kaydı Google anahtarları olmadan çalışır. SMTP yapılandırıldığında 15 dakika geçerli, altı haneli doğrulama kodu `Bozkurtobasi.com <info@bozkurtobasi.com>` göndereninden görselli HTML e-postayla gider. Kod doğrulanmadan oyun ve oyuncu API'leri açılmaz; SMTP hatası bu kapıyı kaldırmaz. Google'ın doğruladığı hesaplar Google ile başlayabilir. Profilde ad soyad ve e-posta sabit, takma ad ve fotoğraf değiştirilebilir; özel fotoğraf Google fotoğrafından önceliklidir. Kalıcı oyuncu koduyla arkadaş isteği gönderilir, kabul edilmiş arkadaşlarla özel mesajlaşılır; depo kapasitesi dahilinde beş kaynak ve envanterdeki ekipmanlar hediye edilir. Aynı e-postaya ait Google ve şifre girişleri sahiplik doğrulanınca tek hesaba ve köye açılır. Giriş ekranındaki **Şifremi unuttum**, görselli e-postayla tek kullanımlık kod gönderir. Yeni şifre belirlenince tüm e-posta ve bağlı Google oturumları kapatılır; köy, profil ve arkadaşlar korunur. PvP ve ödeme henüz yoktur.

Köydeki **İlk adımlar** rehberi kaynak toplama, yeni yapı, ilk görev ödülü, iki eğitim ve ilk zaferi kayıtlı ilerlemeden izler. Düğmeler ilgili kontrole götürür; kendiliğinden kaynak harcamaz. Önceden tamamlanan adımlar tanınır. Yeni hilal ve bozkurt logosu masaüstü/mobil, açık/koyu tema ve favicon için SVG olarak kullanılır; [logo dosyaları ve kullanım](docs/BRAND.md).

### Serbest yerleşim, savaş ve keşif

Savaş zemini, yakınlaştırmadan bağımsız olarak ekranı tamamen doldurur; geniş ekran ve mobil görünümde kenarlarda saydam boşluk kalmaz. Yaralı kurtlar tam görünür kalır, düşük can kırmızı can çubuğuyla belirtilir. Hayvanların kontrastı ve ince gölgeleri taşlık zeminden ayrılmalarını sağlar; koyu tema yalnızca zemini karartır. [Çevrimdışı savaş önizlemesi](preview/battle.html) de aynı görünümü kullanır.

Yeni obalar 36 boş parsel ve ahşap çitle başlar. Haritadaki **+** seçildiğinde o parsele kurulabilecek binalar açılır; seçim başka bir alana kaymaz. Binalar ücretsiz taşınabilir. Oduncu, taş ocağı, kuyu, otlak ve şifa otağından altışar tane kurulabilir; diğer yapı türlerinin sınırı birdir. Binalar ve surlar beş seviyeye yükselir; mimari görünüm 1, 3 ve 5. seviyede değişir. Gerçekçi zemin, bina atlası ve rol zırhlı kurt portreleri kullanılır.

**Savaş meydanı**, obadan ayrı geçit sahnesidir: yürüyüş → çakal pususu → hilal/yıldız düzeni → çatışma. Taktik savaş başında otomatik seçilir. **Keşif ve sevkiyat** ekranında bölge, zorluk ve muhafızlar seçilir. Keşif sıradaki bölgeyi açar; sürü yalnızca keşfedilmiş bölgelere sevk edilir. Katılan kurtlar XP ve yol yorgunluğu kazanır, malzeme ve ekipman ödülleri bir kez verilir. Ayrıntılar: [Oynanış rehberi](docs/GAMEPLAY-V2.md) · [Görsel üretim kaydı](docs/ART-V2.md).

Mevcut v1 köyleri ilk yüklemede v2 biçimine geçirilir; yapılar, kaynaklar, kurtlar ve eski yolculuklar korunur. Yeni yerleştirme komutları açık parsel, yeni sevkiyatlar seçilmiş muhafız ister. Dokploy'da dört servisi birlikte **Deploy** edin; mevcut kalıcı veri volume'larını koruyun.

### Bina Kaldırma — v2.8.0

Ana Yurt'ta seçili binanın **Binayı kaldır** düğmesi, bina ve malzeme iadesini gösteren bir onay penceresi açar. İnşaat ve mevcut seviyeye kadarki yükseltme maliyetlerinin **%50'si** geri gelir; küsurat korunur. Vazgeçmek kaynak veya bina değiştirmez. Sunucu işlemi bir kez uygular ve parseli yeniden açar. Depo/Bey otağı kaldırılırken kapasite azalması hesaplanır; iadeye yer yoksa malzeme kaybetmeden önce yer açman veya kalan depo kapasitesini artırman istenir. Savaş, yolculuk veya başka oturumda değişmiş bina açıklanır. [Kaldırma rehberi](docs/DEMOLITION.md) · [Çevrimdışı köy önizlemesi](preview/village.html).

### Sabit Ana Yurt kamerası — v2.8.0

Harita kaydırma çubuğu oluşturmadan bütün arsaları gösterir. +/− ile 1×–2,5× yakınlaş; hedef düğmesiyle sıfırla. Yakınken sürükleme, iki parmak ve klavye kontrolleri kullanılabilir. Yerel açık/yağmurlu hava, bulut/toz ve şelale hareketleri eklendi; hareket kapatma ve sistemin hareket azaltma tercihi desteklenir. Bu görsel etkiler oyun dengesini değiştirmez. [Harita kontrolleri](docs/VILLAGE-PLANNING.md) · [Köy önizlemesi](preview/village.html).

### Kaynak dengesi ve anlaşılır bina bilgileri — v2.8.0

Tekrar kazanılan malzemeler azaltıldı: bina üretimi %50, toplama 7 odun + 4 taş + 4 su + 4 yem / 20 saniye; savaş ile yeni keşif/sevkiyat kaynakları yarıya inip aşağı yuvarlanır. Mevcut birikimler, başlangıç erzağı, XP, ekipman ve tek seferlik görev ödülleri korunur. Başlamış seferler eski ödülleriyle tamamlanır. Köy yapılarında **Seviye 1 · Arsa 32** binanın gelişimini ve konumunu belirtir; 32 bir maliyet değildir. Maliyetlerde kaynak adı görünür; üzerine gelince veya klavyeyle odaklanınca mevcut/gerekli miktar açıklanır. [Denge tablosu](docs/ECONOMY.md).

### Sefer Kadrosu — v2.7.0

İzcilik, dayanıklılık veya eğitim önceliğine göre muhafız ekibi önerilir. **Kadroyu seç** yalnızca kutuları değiştirir; kaynak harcamaz veya sefer başlatmaz. Seçili kurtlar için yol yorgunluğu, varış canı, XP, seviye ve eğitim puanı öngörüsü gerçek motorla hesaplanır. 20. seviye sınırı ve yetersiz can açıklanır; mevcut görevler sürerken seçim kilitlidir. [Kadro rehberi](docs/ADVENTURE-PARTY.md) · [Çevrimdışı sefer önizlemesi](preview/adventure.html).

### Bölge Hikâyeleri — v2.6.0

Keşif ve sevkiyatta **standart, iz sürme ve ikmal** planlarını karşılaştır: iz sürme daha çok kurt deneyimi, ikmal daha çok kaynak kazandırır; ikisi de daha uzun sürer, daha çok erzak ve yorgunluk getirir. Kartlar seçili bölge, zorluk ve ekipmana göre kesin değerleri gösterir. Beş bölgenin keşif ve sürü sevkiyatı için ayrı çıkış/yol/varış öyküleri vardır. Dönüş raporunda plan ve gerçekten verilen ödüller görünür; eski görevler standart olarak aynı süre/ödülle tamamlanır. [Planlar ve örnek hesap](docs/ADVENTURE-PLANNING.md) · [Çevrimdışı sefer önizlemesi](preview/adventure.html).

### Savaş Komutları — v2.5.0

Savaşın altıncı saniyesinden itibaren üç komut kullanılabilir: **Hilali sıklaştır** altı saniye boyunca kurtların ve sürünün aldığı hasarı %35, verilen hasarı %20 azaltır; **Odak saldırısı** altı saniye verilen hasarı %35 artırır, kurtların aldığı hasarı %20 artırır; **Toparlanma uluması** sürünün paniğini en fazla 20 puan azaltır. Komutlar kaynak harcamaz; aralarında ortak 12 savaş saniyesi bekleme vardır. Uluma can yenilemez ve panik sıfırken kullanılamaz.

Panel etkinin kalan süresini, komutun neden kullanılamadığını ve son üç emri gösterir. Sunucu etkileri ve beklemeyi doğrular; komut yanıtı beklenirken harita animasyonu korunur. [Komut rehberi](docs/BATTLE-COMMANDS.md) · [Çevrimdışı savaş deneme alanı](preview/battle.html). Deneme alanı gerçek motoru kullanır; hesap, sunucu veya kayıt erişimi yoktur.

### İlk Nöbet — sekiz adımlı hikâye

v2.4.0, erzak toplama → inşaat → eğitim → ilk çatışma → toparlanma → keşif → ekipman → ilk sevkiyat görevlerini tek bölümde birleştirir. Ana yurttaki hedef kartı ilgili ekrana götürür; kaynak harcamaz. Görevler ekranında hikâye, ilerleme ve ödüller görünür. Başarımlar erken tamamlanabilir; ödüller sırayla ve yalnızca bir kez alınır. Depoda yeterli yer yoksa ödül kaybolmaz, yer açılana kadar alınamaz. İlk çatışmada yenilgi hikâyeyi kilitlemez.

Mevcut köyler korunur; eski kayıttan doğrulanabilen ilerleme tanınır, geçişte ödül verilmez. Önceki dört görev kullanılmaya devam eder. [İlk Nöbet rehberi](docs/FIRST-WATCH.md) · [Çevrimdışı bölüm önizlemesi](preview/first-watch.html). Analiz paneli yeni ve geri dönen kayıtların bölüm ilerlemesini ayrı gösterir; bunlar izlenen tarayıcı/bölüm örnekleridir, kesin tekil oyuncu veya oyunu terk etme sayısı değildir.

### Muhafız gelişimi ve ekipman etkileri

Muhafız ekranında can, XP/seviye sınırı, eğitim yollarının etkileri ve mevcut ekipmana göre istatistik farkları birlikte görünür. Eğitim puanı, ot/yem, aktif savaş, görevde olma ve envanter sınırı gibi engeller açıklanır; işlem düğmeleri uygun olduğunda açılır. Kurt seçmek kaynak harcamaz. Gerçekçi portreler rolleri temsil eder; kuşanılan eşya portreyi değiştirmez, adı ve etkisi panelde gösterilir. [Muhafız rehberi](docs/GUARDIAN-PROGRESSION.md) · [Çevrimdışı muhafız önizlemesi](preview/guardians.html).

### Sefer hazırlığı ve bölge rotaları

Bölge kartlarından bulunduğun yeri, keşfedilen ve sıradaki rotaları gör; görev türü, zorluk ve muhafızlarını seç. Hazırlık paneli eksik kaynak, yetersiz muhafız/can, devam eden savaş veya yolculuk nedenlerini açıklar. Beklenen yorgunluk ve mevcut depo boşluğuna göre taşabilecek ödüller gösterilir. Planlama kaynak harcamaz; başlatma açık düğme onayı ve sunucu kontrolü ister. [Hazırlık rehberi](docs/ADVENTURE-PLANNING.md) · [Çevrimdışı sefer önizlemesi](preview/adventure.html).

### Yenilgi sonrası sürü takviyesi

Kurulu bir otlağın varsa kaybettiğin hayvanları **Sürüyü tamamla** panelinden geri kazanabilirsin. Bir işlemde 1–5 hayvan seçilir; her hayvan 6 su ve 12 yem ister, toplam sınır 24'tür. Seçim kaynak harcamaz; düğmeyle onaylandığında sunucu miktarı, kaynakları, otlağı ve devam eden savaş/yolculuğu doğrular. Yeni hayvanların canı eklenir; mevcut yaralar, panik ve muhafızların XP'si korunur. Eksik sürüyü tamamlamak tedaviden ayrıdır. [Planlama rehberi](docs/VILLAGE-PLANNING.md) ve [salt okunur köy önizlemesi](preview/village.html) maliyeti ve gereksinimleri gösterir.

### Kaynaklar ve inşaat planı

Ana yurt paneli beş kaynağın mevcut miktarını, depo sınırını, bölge bonusları dahil üretimini ve tahmini dolma süresini gösterir. Dokuz yapı arasından hedef seçerek yeni inşa veya sonraki yükseltme için eksik kaynakları ve bekleme süresini görebilirsin. Seçim kaynak harcamaz; **Yer seç** düğmesi haritaya götürür, parseldeki bina seçimi sunucuya açık konumla gönderilir. Yükseltmeler mevcut binaya uygulanır. Üretim güncellemeleri hedefi ve klavye odağını korur. [Planlama rehberi](docs/VILLAGE-PLANNING.md) ve salt okunur [köy önizlemesi](preview/village.html).

### Tek Dokploy Compose, dört servis

Dokploy'da depo `main` dalını bağlayın. Ekrandaki **Compose Path = `./docker-compose.yml`** ayarı doğrudan çalışır; `./compose.yml` aynı dört servisi içerir. Servislerin tamamı tek Compose içinde üretilir:

| Alan adı                                     | Dokploy servisi | Port | İşlev                                                                     |
| -------------------------------------------- | --------------- | ---: | ------------------------------------------------------------------------- |
| `bozkurtobasi.com` ve `www.bozkurtobasi.com` | `web`           | 3000 | Görselli ana sayfa, oyun, gizlilik/koşullar ve aynı kaynaklı `/api` proxy |
| `api.bozkurtobasi.com`                       | `api`           | 3000 | Oyun API'si ve yönetici kimlik doğrulaması                                |
| `admin.bozkurtobasi.com`                     | `admin`         | 3000 | İki dilli yönetim paneli                                                  |
| `analiz.bozkurtobasi.com`                    | `analyze`       | 3000 | Trafik kolektörü ve analiz paneli                                         |

Güncel [üretim ortamı örneğini](.env.production.example) Dokploy Environment için temel alın. Örnek, yalnızca Compose tarafından okunan değiştirilebilir anahtarları içerir; gerçek sır içermez. **`ADMIN_PASSWORD` değerini en az 12 karakterlik güçlü bir sır** olarak Dokploy'da tanımlayın. Compose'un varsayılan yönetici e-postası `info@bozkurtobasi.com`; örnek üretim ortamı, girişte kullanılan `emindemirci.ai@gmail.com` adresini `ADMIN_EMAIL` olarak ayarlar. Parola olmadan oyun ve sağlık kontrolleri çalışır, ancak yönetim/analiz girişi kapalı kalır. Parolayı Git'e, temiz kaynak ZIP'ine veya ekran görüntüsüne koymayın. `ANALYZE_AUTH_MODE=platform-admin` ve aynı Compose ağı için `ANALYZE_AUTH_API_URL=http://api:3000` varsayılan olarak hazırdır. Analiz girişinin sunucu çağrısı bu dahili adresi kullanır; panelin dış adresi HTTPS olarak kalır. Ayrı dağıtılan API için bu anahtarı erişilebilir HTTPS API adresiyle değiştirebilirsiniz. Verdiğiniz diğer `ANALYZE_*` varsayılanları da [Compose dosyasında](compose.yml) tanımlıdır. Environment veya Domains değişikliklerini **Save → Deploy** ile uygulayın.

**v2.8.0 uyumluluğu:** Dokploy'da mevcut `ADMIN_BOOTSTRAP_EMAIL` ve `ADMIN_BOOTSTRAP_PASSWORD` anahtarları da kabul edilir; yeni sürümü dağıtınca Compose bunları API'nin `ADMIN_EMAIL`/`ADMIN_PASSWORD` alanlarına aktarır. Mevcut parolayı değiştirmek veya ikinci bir parola oluşturmak gerekmez. İsterseniz anahtar adlarını doğrudan `ADMIN_EMAIL` ve `ADMIN_PASSWORD` olarak değiştirebilirsiniz. Her alan için boş olmayan birincil değer önceliklidir; yoksa ilgili `ADMIN_BOOTSTRAP_*` değeri kullanılır. Parolanın en az 12 karakter olması değişmez; bu uyumluluk veritabanında seed hesabı oluşturmaz.

Google ile girişi açmak için Google Cloud Console içinde **Web application** OAuth istemcisi oluşturup `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` değerlerini Dokploy Environment bölümüne ekleyin. `GOOGLE_REDIRECT_URIS` tam olarak `https://bozkurtobasi.com/api/auth/google/callback,https://www.bozkurtobasi.com/api/auth/google/callback` olmalı ve her iki adres Google istemcisinde izinli yönlendirme URI olarak kayıtlı olmalıdır. Anasayfadaki [gizlilik bildirimi](public/privacy.html) ve [kullanım koşulları](public/terms.html) Google marka ekranına eklenmelidir. Adımlar [Google giriş rehberinde](docs/GOOGLE-SIGNIN.md). Bu anahtarlar boşken yalnızca Google düğmesi kullanılamaz; e-posta ile kayıt/giriş kullanılabilir.

Yönetici veya analiz girişinde `admin_unavailable` (503) görülürse çalışan **API konteynerinin** `ADMIN_EMAIL` ve en az 12 karakterlik `ADMIN_PASSWORD` aldığını kontrol edin; Environment ekranında yazılı olması tek başına yeterli değildir. Genel `/api/health` yanıtının 200 olması da yönetici girişinin yapılandırıldığını göstermez. **admin.bozkurtobasi.com** 502 dönerse Domains kaydını **admin:3000** yapın; **3001 yalnızca yerel API host portudur**, Dokploy konteyner portu değildir. Kaydedip dağıtın. `/healthz` ve `/api/health` sonuçlarıyla yönlendirme ve API bağlantısını ayrı kontrol edin; sırları göstermeyen konteyner kontrolü ve **Preview Compose** ağ incelemesi [dağıtım rehberinde](docs/WEB-DEPLOYMENT.md). Nginx, API yeniden oluşturulduğunda Docker DNS adresini yeniler; analiz girişinde bağlantı hatası ve yönetici yapılandırma hatası ayrı mesajlarla gösterilir.

`game-data` volume'u `/data/game.sqlite` dosyasını, `analyze-data` volume'u `/app/data` olaylarını korur. İki veriyi de ayrıca yedekleyin. SQLite kullanan API ve analiz servisi tek replica çalışır. Giden doğrulama postası için `MAIL_PROVIDER=smtp`, Hostinger SMTP ayarları ve `MAIL_FROM` örnekte hazırdır; gerçek `SMTP_PASSWORD` değerini yalnızca Dokploy Environment bölümüne ekleyin. Gönderen adresi her zaman `info@bozkurtobasi.com` olarak sabitlenir. Yönetici hesabı ayrı `ADMIN_EMAIL` ve `ADMIN_PASSWORD` değerleriyle açılır; veritabanında seed yönetici gerekmez. Ayrıntılar [dağıtım rehberinde](docs/WEB-DEPLOYMENT.md).

Yerelde dört servisi açmak için Docker Desktop ile:

```bash
docker compose -f compose.yml -f compose.local.yml up --build -d
```

Portlar: oyun <http://127.0.0.1:3000>, API <http://127.0.0.1:3001>, yönetim <http://127.0.0.1:3002>, analiz <http://127.0.0.1:3003>. Yerelde yönetici girişi için `ADMIN_PASSWORD` ortam değişkenini Compose komutundan önce tanımlayın. Yerel Compose oyun analitiğini kapatır ve analiz panelinin auth çağrısını dahili API'ye yöneltir. Durdurmak için `docker compose -f compose.yml -f compose.local.yml down` kullanın; `down -v` kalıcı volume'ları siler.

### Trafik ve doğrulama

Docker imajları derlendikten sonra `node scripts/compose-env-smoke.mjs`, `node scripts/proxy-smoke.mjs` ve `node scripts/analyze-auth-smoke.mjs` dağıtım regresyonlarını sınar. Ağ geçidi testi, Docker'ın ayırdığı boş alt ağı açıkça tanımlayarak Linux/Docker Desktop üzerinde API'nin farklı IP'ye geçmesini zorunlu tutar. Testler bağımsız geçici ağ/konteyner kullanır ve sonunda temizler; mevcut oyuncu verilerini kullanmaz.

Üretimde oyun, `GET /api/config` üzerinden izinli kolektör adresini alır ve ana sayfa/köy/savaş/dünya/kurt/görev ekran görüntüleme ve süre olaylarını `https://analiz.bozkurtobasi.com/api/track` adresine gönderir. Oyun kaydı, kaynaklar, URL parametreleri ve oturum çerezi gönderilmez. DNT/GPC tercihleri dikkate alınır; çevrimdışı/yerel önizleme trafik üretmez. `ANALYZE_GEO_LOOKUP=true` etkinse IP konumu HTTPS üzerinden ipwho.is ile çözümlenebilir; [gizlilik bildirimi](public/privacy.html) bunu açıklar.

`npm run verify` kaynak kontrolü, motor/API testleri, üretim ve tek dosya derlemesi, tarayıcı testlerini çalıştırır. `npm run count:lines` aşağıdaki sayımı yeniler; `npm run backup` `artifacts/` altında temiz kaynak ZIP'i ve SHA-256 dosyası oluşturur. ZIP oyuncu veritabanlarını, sırları, bağımlılıkları veya Git geçmişini içermez. Güncel sonuçlar [doğrulama kaydında](docs/WEB-VALIDATION.md).

Windows tesliminde kontroller geçtikten sonra [`push-and-backup.ps1`](push-and-backup.ps1) commit/push ve **tam proje yedeğini** birlikte yapar. İncelenen dosyaları `git add -- <dosyalar>` ile hazırlayıp `.\push-and-backup.ps1 -StagedOnly -CommitMessage "feat: açıklama"` çalıştırın; varsayılan çağrı bütün görünür değişiklikleri stage eder. Yayımlanmış sürümün yeni yedeği için `-BackupOnly` kullanın. Tam ZIP, `H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası\Bozkurt Obası_YYYY-MM-DD_HHMMSS.zip` yoluna yazılır; `.git`, `node_modules`, derlemeler, yerel `.env` ve boş klasörler dahil hiçbir içerik hariç tutulmaz. İçerik doğrulanır, son 30 tarihli yedek saklanır. Bu özel Drive ZIP'i GitHub'a yüklenmez; GitHub Release temiz kaynak ZIP'ini kullanır. Drive'ın bulut eşitleme durumu masaüstü istemcisinden kontrol edilir. [Tam yedek standardı](BACKUP-STANDARD.md), [teslim kuralları](PROJECT-BACKUP-RULES.md). Repo dışındaki Docker volume'ları ayrıca yedeklenir.

### Ayrıntılı yönetim paneli

Yönetim panelinde kullanıcı arama, doğrulama/giriş yöntemi filtreleri, sayfalama ve kayıt/son giriş/etkinlik tarihleri, oyuncu kodu, köy, kaynak ve oturum ayrıntıları bulunur. **Kullanıcı ekle** normal, doğrulama bekleyen hesap oluşturur; oyuncu SMTP kodunu onaylamadan oyuna giremez. **Kalıcı silme** tam oyuncu kodunu ister ve bağlı hesap, oturum, profil, arkadaşlık, mesaj ve hediye kayıtlarını tek işlemde siler; diğer oyuncuların köyleri ve bakiyeleri korunur. Kalıcı günlükler tarih, işlem, düzey, işlemi yapan, hedef ve güvenli ayrıntıları arama/filtrelerle gösterir; parolalar ve kodlar kaydedilmez, 90 gün/100.000 kayıt saklanır. Eski olaylar ve bilinmeyen giriş tarihleri uydurulmaz. [Yönetim rehberi](docs/ADMIN.md).

[`preview/admin.html`](preview/admin.html) örnek verilerle çalışan, tek dosyalık TR/EN yönetim önizlemesidir. Arama, sayfalama, ayrıntılar ve tema/dil kontrolleri çevrimdışı çalışır; hesap değiştirme kapalıdır ve sunucuya bağlanmaz. `npm run build:preview` ana sayfa, savaş, admin, köy, sefer, muhafız ve İlk Nöbet önizlemelerini günceller.

## English

GitHub About includes the game description, `https://bozkurtobasi.com` website link and project topics. Visible page footers show `© 2026 Bozkurt Obası`. The hero uses equal TR/EN dimensions, fits the first desktop screen and displays Google sign-in there; the bottom of the page does not repeat the sign-in button.

### A version for each completed update

Run `npm run release:version -- patch --tr "Türkçe değişiklik notu" --en "English change note"` to advance the package, lockfile, in-game history, CHANGELOG and README together. Use `minor` for new features and `major` for breaking changes. Commit the version and notes with the change. After a merge or push to `main`, passing tests and all four service checks trigger an automatic `vX.Y.Z` tag and GitHub Release with this version's TR/EN CHANGELOG notes, clean source ZIP, SHA-256 and visual `index.html`. CI requires a version newer than the previous `main` revision. See the [release guide](docs/RELEASING.md).

### Preview the homepage and sign in to play

Battlefield wolves, jackals, sheep and cows use realistic transparent cutouts. The four WebP files total approximately 193 KiB; wolves and the herd face the jackals. [`preview/battle.html`](preview/battle.html) is a self-contained visual preview of the actual battlefield, with offline TR/EN, light/brown dark themes, zoom and command practice using the real engine. It does not access player accounts or game saves. `npm run build:preview` rebuilds the homepage, battlefield, admin, village, adventure, guardian and First Watch previews.

Download and open [`preview/index.html`](preview/index.html) in a browser for a self-contained **visual homepage preview**. It does not open the game. GitHub file preview cannot run its interactive content. For the SQLite-backed local server, install Node.js 24, then run `npm ci`, `npm run build`, and `npm start`. Open <http://127.0.0.1:3000>, and register/sign in with email and password from the homepage, then confirm the emailed code. SMTP is required for new email accounts; Google can also verify ownership. A password must contain 12–128 characters. Alternatively, [configure Google OAuth](docs/GOOGLE-SIGNIN.md) to use Google. See the [account guide](docs/ACCOUNT-SIGNIN.md). The homepage and information pages are public; **the village and every other game screen require a valid account session**, including direct `#village` visits. An earlier server guest village can be claimed at first sign-in if its existing cookie remains valid. Earlier browser-local saves are not uploaded automatically.

The playable release includes nine building types, resource production, five trainable guardians, crescent/star formations, five jackal tactics chosen randomly when combat begins, animated battles, five regions, and quests. The illustrated homepage, game, admin, and analytics interfaces support Turkish/English and light/dark themes. Dark mode uses warm brown and earth surfaces, cream text, gold highlights and steppe green buttons/selected areas; light mode is preserved. The theme preference is remembered on the device. The in-game **Release history** shows v2.8.0 and earlier updates. Email registration works without Google credentials. With SMTP configured, registration sends a six-digit, 15-minute verification code from `Bozkurtobasi.com <info@bozkurtobasi.com>` in illustrated HTML email. Game and player APIs stay locked until confirmation, including during SMTP failure. Google-verified accounts can start through Google. Profile email and full name are immutable; nickname and photo are editable, with custom uploads taking priority over Google pictures. Permanent player codes support accepted friendships, private messages and atomic gifts of all five materials and inventory equipment. Google and password sign-in for the same email open one account and village after ownership is confirmed. **Forgot password** sends a single-use code in illustrated email. Resetting revokes all email and linked Google sessions while preserving the village, profile and friends. PvP and payments are not yet included.

The village **First steps** guide follows gathering, construction, the first quest reward, two training actions and the first victory from saved progress. Buttons lead to the relevant control without spending resources. Previously completed steps are recognized. The new crescent-and-wolf SVG identity supports desktop/mobile, light/dark themes and the favicon; see [logo files and usage](docs/BRAND.md).

### Free placement, battles and adventures

Battlefield terrain fills the entire viewport independently of zoom, eliminating transparent gaps on wide and mobile displays. Wounded wolves stay fully visible, with a red low-health bar. Balanced animal contrast and subtle shadows separate them from rocky terrain; dark mode dims only the terrain. The [offline battle preview](preview/battle.html) uses the same rendering.

New villages start with 36 empty plots and timber fencing. Select a map **+** and a building to place it exactly there; existing buildings can move for free. Producer types support six copies each. Buildings and walls have five levels, with architectural tiers at levels 1, 3 and 5. Realistic terrain, building sprites and role-armored wolf portraits are included.

The separate battlefield follows a march, ambush, crescent/star deployment and combat. Select regions, difficulty and guardians for exploration and herd escorts; discover new regions and receive party XP, supplies and equipment once per mission. Existing v1 saves migrate without resetting progress. [Gameplay guide](docs/GAMEPLAY-V2.md) · [Artwork record](docs/ART-V2.md).

Redeploy all four Dokploy services together and retain existing persistent data volumes. No extra environment configuration is needed.

### Building Demolition — v2.8.0

The selected building's **Remove building** button opens a confirmation with its identity and material refund. **50%** of construction and upgrade costs through the current level returns, retaining fractions. Cancel changes nothing. The server removes once and frees the plot. Storage/hall removal accounts for capacity loss; insufficient space blocks removal without discarding supplies. Combat, travel and changed building confirmations are explained. [Demolition guide](docs/DEMOLITION.md) · [Offline village preview](preview/village.html).

### Fixed Homeland camera — v2.8.0

The map fits all plots without internal scrollbars. Zoom from 1× to 2.5× with +/− and reset with the target button. Drag, pinch and keyboard controls work while zoomed in. Local clear/rainy weather, drifting clouds/dust and flowing waterfall effects support a motion toggle and system reduced-motion preferences. These visual effects do not change game balance. [Map controls](docs/VILLAGE-PLANNING.md) · [Village preview](preview/village.html).

### Resource balance and clearer structure information — v2.8.0

Repeatable material income is reduced: building production by 50%; gathering gives 7 wood + 4 stone + 4 water + 4 feed every 20 seconds; battle and new expedition/escort materials are halved and rounded down. Existing balances, starter supplies, XP, equipment and one-time objective rewards remain. Ongoing journeys retain their old rewards. **Level 1 · Plot 32** identifies development and location; 32 is not a cost. Costs show resource names, with available/required quantities on hover or keyboard focus. [Balance table](docs/ECONOMY.md).

### Journey Party — v2.7.0

Suggest guardian parties for scouting, resilience or training. **Use this party** changes checkboxes without spending supplies or starting a mission. Selected guardians show travel fatigue, arrival health, XP, level and training-point forecasts using the real engine. The level-20 cap and low health are explained; active journeys lock selection. [Party guide](docs/ADVENTURE-PARTY.md) · [Offline journey preview](preview/adventure.html).

### Regional Stories — v2.6.0

Compare **standard, survey and supply** plans for exploration and escorts. Survey prioritizes guardian XP; supply prioritizes materials. Both take longer, consume more supplies and cause more fatigue. Cards show concrete values for the selected region, difficulty and equipment. Five regions have distinct departure/trail/arrival stories for exploration and herd escorts. Arrival reports record the plan and actual credited rewards; older missions complete as standard with unchanged timing and rewards. [Plans and example calculations](docs/ADVENTURE-PLANNING.md) · [Offline journey preview](preview/adventure.html).

### Battle Commands — v2.5.0

Three commands become available at battle second six: **Brace the crescent** reduces incoming guardian/herd damage by 35% and outgoing damage by 20% for six seconds; **Focused assault** increases outgoing damage by 35% and incoming guardian damage by 20% for six seconds; **Rallying howl** removes up to 20 panic points. Commands cost no resources and share a 12-battle-second cooldown. Rally does not heal and requires positive panic.

The panel shows effect duration, unavailable-action reasons and the last three orders. Effects and cooldowns are server-validated; the map keeps animating while a command response is pending. [Command guide](docs/BATTLE-COMMANDS.md) · [Offline battle sandbox](preview/battle.html). The sandbox uses the real engine without account, server or save access.

### First Watch — an eight-step story

v2.4.0 connects gathering → construction → training → first battle → recovery → exploration → equipment → first escort in one chapter. The village goal card navigates to the relevant screen without spending resources. Quests shows the story, progress and rewards. Objectives may be achieved early; rewards are claimed in order and only once. Insufficient storage blocks a claim without losing its reward. Losing the first battle does not block the story.

Existing villages are preserved. Evidence from older saves is recognized without granting migration rewards, and the four previous quests remain available. [First Watch guide](docs/FIRST-WATCH.md) · [Offline chapter preview](preview/first-watch.html). Analytics separates new and returning save cohorts; counts represent tracked browser/chapter samples, not exact unique players or confirmed abandonment.

### Guardian progression and equipment effects

The guardian screen combines health, XP/level cap, training effects and stat differences against the currently equipped item. It explains blockers including points, herbs/feed, active battles, away guardians and inventory limits; actions become available when valid. Selecting a wolf spends nothing. Realistic portraits represent roles; equipping an item changes the displayed name and effects, not the portrait. [Guardian guide](docs/GUARDIAN-PROGRESSION.md) · [Offline guardian preview](preview/guardians.html).

### Adventure preparation and region routes

Region cards show the current location, discoveries and next routes. Choose a mission, difficulty and party; readiness explains missing supplies, guardian/health requirements, active battles and journeys. Expected fatigue and possible reward overflow at current storage levels are shown. Planning spends nothing; departure needs explicit confirmation and server checks. [Preparation guide](docs/ADVENTURE-PLANNING.md) · [Offline adventure preview](preview/adventure.html).

### Replenish the herd after defeat

With a built pasture, recover lost animals through the **Herd replenishment** panel. Choose 1–5 animals per action; each costs 6 water and 12 feed, up to a total herd size of 24. Selection spends nothing. Explicit confirmation invokes server checks for quantity, resources, a pasture and active battles/journeys. New animals add their health while existing wounds, panic and guardian XP remain unchanged. Replenishment is separate from healing. The [planning guide](docs/VILLAGE-PLANNING.md) and [read-only village preview](preview/village.html) show costs and requirements.

### Resources and construction plan

The homeland panel shows all five balances, storage limits, production including region bonuses and estimated time until full. Choose from nine buildings to see shortages and waiting time for a new building or next upgrade. Selection spends nothing; Choose plot leads to the map, the final plot/building choice uses server checks, and Upgrade improves the selected existing building. Production updates preserve the target and keyboard focus. Read the [planning guide](docs/VILLAGE-PLANNING.md) or open the read-only [village preview](preview/village.html).

### Four services in one Dokploy Compose stack

Connect the private repository's `main` branch and keep the existing **Compose Path `./docker-compose.yml`**. `./compose.yml` is an identical alternative. Map both game domains to `web:3000`, `api.bozkurtobasi.com` to `api:3000`, `admin.bozkurtobasi.com` to `admin:3000`, and `analiz.bozkurtobasi.com` to `analyze:3000`. Apply Environment or Domains changes with **Save → Deploy**.

Use the current [production environment example](.env.production.example) as the starting point in Dokploy Environment. It contains only configurable keys consumed by Compose and no real secrets. Set **`ADMIN_PASSWORD` to a strong secret of at least 12 characters** in Dokploy. Compose defaults to `info@bozkurtobasi.com`; the example sets `ADMIN_EMAIL=emindemirci.ai@gmail.com` to match the sign-in address. Without the password, gameplay and health checks work, but admin and analytics login cannot succeed. Do not commit the secret. [`compose.yml`](compose.yml) includes the supplied `ANALYZE_*` defaults and `platform-admin` authentication. The default `ANALYZE_AUTH_API_URL=http://api:3000` sends server-side authentication over the same Compose network; the public panel remains HTTPS. Override it with a reachable HTTPS API URL if the API is deployed separately. `game-data` holds SQLite game progress; `analyze-data` holds analytics events. Back up both separately and keep one replica for the SQLite services. Outgoing verification mail always uses `info@bozkurtobasi.com`; add the real `SMTP_PASSWORD` only in Dokploy. The admin login uses separate `ADMIN_EMAIL` and `ADMIN_PASSWORD` settings and needs no seeded database account. Password recovery uses the same SMTP settings without additional environment keys.

**v2.8.0 compatibility:** Existing Dokploy `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` settings are also accepted. Deploying this version maps them to the API's `ADMIN_EMAIL`/`ADMIN_PASSWORD`; you do not need to change your existing password or create another one. Alternatively, rename the keys to `ADMIN_EMAIL` and `ADMIN_PASSWORD`. A nonempty primary value takes priority for each field; otherwise its `ADMIN_BOOTSTRAP_*` value is used. The 12-character minimum remains, and this compatibility does not create a database seed account.

To enable the Google sign-in option, create a **Web application** OAuth client in Google Cloud Console and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Dokploy Environment. Register both exact callback URLs listed in `GOOGLE_REDIRECT_URIS` with Google, and add the [privacy notice](public/privacy.html) and [terms](public/terms.html) to the OAuth branding setup. Follow the [Google sign-in guide](docs/GOOGLE-SIGNIN.md). With empty credentials, only Google sign-in is unavailable; email registration/sign-in remains available.

If admin or analytics sign-in returns `admin_unavailable` (503), verify that the **running API container** received `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 12 characters. Values saved in the Environment editor and a successful generic `/api/health` check do not prove admin authentication is configured. For an admin-domain 502, set its Domains entry to **admin:3000**; **3001 is only the local API host port**, not a Dokploy container port. Save and deploy. Compare `/healthz` and `/api/health` to separate routing from API connectivity; the [deployment guide](docs/WEB-DEPLOYMENT.md) includes a secret-free container check and **Preview Compose** network inspection. Nginx refreshes Docker DNS after API recreation, and analytics sign-in distinguishes connectivity failures from unavailable admin configuration.

For a local four-service preview, run `docker compose -f compose.yml -f compose.local.yml up --build -d`. Ports are game 3000, API 3001, admin 3002, analytics 3003 on loopback. Set `ADMIN_PASSWORD` in the shell first to sign in locally. The local override disables outgoing game analytics and uses the internal API for panel authentication. Stop with `docker compose -f compose.yml -f compose.local.yml down`, preserving data volumes.

### Traffic, checks and backup

After building the Docker images, run `node scripts/compose-env-smoke.mjs`, `node scripts/proxy-smoke.mjs` and `node scripts/analyze-auth-smoke.mjs` for deployment regression checks. The gateway test explicitly configures a free subnet allocated by Docker to force a different replacement API IP on Linux/Docker Desktop. These checks create and remove disposable networks/containers without using existing player data.

On production HTTPS, the site sends screen views and cumulative duration for home, village, battle, world, wolves, and quests to the bundled analytics collector. Payloads omit saves, resources, URL parameters, and session cookies. DNT/GPC are honored; the local/offline visual preview sends nothing. When enabled, geo lookup can send visitor IPs to ipwho.is over HTTPS, as described in the [privacy notice](public/privacy.html).

Run `npm run verify` for checks, tests, builds, and browser tests. Run `npm run count:lines` to refresh the table below and `npm run backup` for a clean source ZIP and SHA-256 sidecar in `artifacts/`. The ZIP includes the visual preview but excludes player data, secrets, dependencies, production build directories, and Git history. See the [validation record](docs/WEB-VALIDATION.md) and [deployment guide](docs/WEB-DEPLOYMENT.md).

On Windows, after checks pass, [`push-and-backup.ps1`](push-and-backup.ps1) commits/pushes and creates a **full project backup**. Stage reviewed files with `git add -- <files>` and run `.\push-and-backup.ps1 -StagedOnly -CommitMessage "feat: description"`; the default invocation stages every visible change. Use `-BackupOnly` to snapshot an already published revision. The full ZIP goes to `H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası\Bozkurt Obası_YYYY-MM-DD_HHMMSS.zip` with no exclusions, including `.git`, `node_modules`, builds, local `.env` and empty directories. Contents are verified and the latest 30 dated backups retained. This private Drive ZIP is separate from the clean GitHub Release archive. Check cloud sync status in the Drive desktop client. See [backup standard](BACKUP-STANDARD.md) and [delivery rules](PROJECT-BACKUP-RULES.md). Docker volumes outside the repo need separate backups.

### Detailed administrator panel

The administrator panel includes user search, verification/provider filters, pagination and details showing registration, last-login/activity dates, player codes, villages, resources and sessions. **Add user** creates a normal pending account: the player must confirm the SMTP email code before gameplay. **Permanent deletion** requires the exact player code and removes associated accounts, sessions, profiles, friendships, messages and gift records in one transaction, preserving other players' villages and balances. Persistent logs display dated actions, severity, actor, target and safe details with search/filters; secrets are excluded, retention is 90 days/100,000 entries. Historical events and unknown login dates are not fabricated. Read the [admin guide](docs/ADMIN.md).

Open [`preview/admin.html`](preview/admin.html) for a standalone, responsive TR/EN admin visual preview with fictional data. Search, pagination, details and theme/language controls work offline; account mutations are disabled and it cannot connect to a server. `npm run build:preview` rebuilds the homepage, battlefield, admin, village, adventure, guardian and First Watch previews.

## Depo yapısı / Repository layout

| Yol / Path                              | İçerik / Contents                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web/`, `shared/`                       | Görselli ana sayfa, oyun arayüzü ve kuralları / Visual homepage, game UI and rules                                                               |
| `web/assets/`, `public/`                | Ana görsel, gizlilik ve koşullar / Hero art, privacy and terms                                                                                   |
| `server/web/`                           | Oyun, Google ve yönetici API'si, SQLite / Game, Google and admin API, SQLite                                                                     |
| `services/web/`                         | Nginx oyun gateway / Nginx game gateway                                                                                                          |
| `services/admin/`                       | İki dilli yönetim arayüzü / Bilingual admin UI                                                                                                   |
| `services/analyze/`                     | MIT lisanslı analiz paneli ve kolektör / MIT analytics dashboard and collector                                                                   |
| `tests/`, `scripts/`                    | Test, önizleme, ölçüm ve ZIP / Tests, preview, metrics, and ZIP                                                                                  |
| `preview/index.html`                    | Tek dosyalık görsel ana sayfa önizlemesi; oyun için hesap oturumu gerekir / Standalone visual homepage preview; game requires an account session |
| `preview/battle.html`                   | Gerçekçi savaş sahnesi için çevrimdışı görsel önizleme / Offline visual preview of the realistic battlefield                                     |
| `preview/admin.html`                    | Örnek verilerle salt okunur yönetim önizlemesi / Read-only admin preview with fictional data                                                     |
| `preview/village.html`                  | Salt okunur köy sahnesi ve kaynak/inşaat planlaması / Read-only village scene and resource/construction planning                                 |
| `preview/adventure.html`                | Salt okunur sefer hazırlığı ve bölge rotaları / Read-only adventure preparation and region routes                                                |
| `preview/guardians.html`                | Salt okunur muhafız gelişimi ve ekipman etkileri / Read-only guardian progression and equipment effects                                          |
| `preview/first-watch.html` | İlk Nöbet hikâye görevleri ve sıradaki hedef / First Watch story quests and next objective |
| `releases.json`, `CHANGELOG.md`         | İki dilli sürüm kayıtları / Bilingual release history                                                                                            |
| `.env.production.example`               | Dokploy üretim ortamı örneği / Production environment example                                                                                    |
| `docs/GOOGLE-SIGNIN.md`                 | İki dilli Google OAuth kurulumu / Bilingual Google OAuth setup                                                                                   |
| `Assets/`, `client/`, `infrastructure/` | Korunan Unity dönemi kaynakları / Preserved Unity-era sources                                                                                    |

## Kaynak satırları / Source line counts

<!-- metrics:start -->
| Kapsam / Scope | Dosya / Files | Satır / Lines |
| --- | ---: | ---: |
| Web istemci / Web client | 34 | 13594 |
| Web sunucu / Web server | 14 | 3879 |
| Dağıtım servisleri / Deployment services | 33 | 6367 |
| Paylaşılan oyun / Shared game | 8 | 2684 |
| Web test ve araçlar / Web tests and tools | 95 | 20599 |
| Korunan Unity kaynakları / Preserved Unity sources | 75 | 10198 |
| **Toplam / Total** | **259** | **57321** |

Aktif web kaynakları / Active web source: **47123** satır / lines.
Fiziksel kaynak satırları; boş satırlar ve yorumlar dahil, üretilen önizleme, bağımlılıklar ve kilit dosyaları hariç. / Physical source lines include comments and blank lines; generated preview, dependencies, and lockfiles are excluded.
<!-- metrics:end -->

## Lisans / License

Bu depo [MIT lisansı](LICENSE) altındadır. © 2026 Emin DEMİRCİ ve MIT bildirimi sayfa kaynağında görülebilir. MIT lisansı kullanıma, değiştirmeye ve dağıtıma izin verir; telif ve izin bildirimi kopyalarda korunmalıdır. Bildirimi kaldırmak veya lisans koşulları dışında davranmak hak ihlaline yol açabilir. Analiz servisinin özgün MIT telif bildirimi [`services/analyze/LICENSE`](services/analyze/LICENSE) içinde korunur; [kaynak bildirimi](docs/ANALYZE-SOURCE.md). Üçüncü taraf bağımlılıkların kendi lisansları geçerlidir. Giriş düğmesindeki [resmî Google G simgesi](https://developers.google.com/static/identity/images/g-logo.png) Google markasıdır ve [marka yönergelerine](https://developers.google.com/identity/branding-guidelines) göre kullanılır; MIT lisansı bu simgeye uygulanmaz.

This repository is licensed under [MIT](LICENSE). The © 2026 Emin DEMİRCİ and MIT notice is visible in page source. MIT permits use, modification, and redistribution provided the copyright and permission notice is retained in copies. Removing the notice or acting outside the license terms may infringe rights. The analytics service retains its original MIT notice in [`services/analyze/LICENSE`](services/analyze/LICENSE); see the [source notice](docs/ANALYZE-SOURCE.md). Third-party dependencies retain their respective licenses. The [official Google G icon](https://developers.google.com/static/identity/images/g-logo.png) on the sign-in button is a Google brand asset used under its [branding guidelines](https://developers.google.com/identity/branding-guidelines); the repository MIT license does not apply to that icon.
