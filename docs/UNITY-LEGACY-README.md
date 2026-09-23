# Bozkurt Obası


## Güncel adlandırma

- **Oyun adı:** Bozkurt Obası
- **Tam yayın adı:** Bozkurt Obası: Ay-Yıldız Nöbeti
- **Repo / klasör adı:** `bozkurt-obasi`
- **Android paket adı:** `com.emindemirci.bozkurtobasi`
- **APK çıktısı:** `Bozkurt-Obasi-Test.apk`
- **AAB çıktısı:** `Bozkurt-Obasi.aab`
- **Windows çıktısı:** `Bozkurt-Obasi.exe`

Bu paket WP-00–WP-11 kapsamının temiz ve yeniden adlandırılmış son sürümüdür.

Unity tabanlı, web ve mobil hedefli izometrik taktiksel sürü savunma oyunu.

Bu teslim **WP-00–WP-11 + Sade Arayüz ve Şifacı Revizyonu** paketidir.

## Tamamlanan kapsam

### WP-00 — Proje temeli

- Unity 6.3 LTS proje yapısı
- C# assembly ayrımı
- URP ve Input System
- Bootstrap servis mimarisi
- Atomik yerel kayıt sistemi
- Otomatik sahne ve proje kurulum aracı
- Edit Mode test altyapısı

### WP-01 — Kamera ve kontrol

- İzometrik kamera ve yakınlaştırma
- Fare ve dokunmatik giriş
- Tekli ve çoklu kurt seçimi
- Sağ tıkla hareket komutu
- Dinamik ters-hilal kurt formasyonu
- Dolu yıldız sürü formasyonu
- Hilale dönüş komutu

### WP-02 — Sağlık ve savaş

- Kurt ve çakal sağlık sistemi
- Dünya üzerinde sağlık çubukları
- Kurtların otomatik hedef seçimi, takip ve saldırısı
- Çakalların en yakın aktif kurda saldırması
- Kurtların kalıcı olarak ölmek yerine bayılması
- Yüzde 35 canla yeniden ayağa kalkma
- Savaş durumu, zafer ve bayılma göstergeleri
- Savaşı sıfırlama ve kurtları iyileştirme araçları
- Sağlık sistemi testleri

### WP-02 Hotfix — Kurtarma etkileşimi

- Baygın kurda sağ tıklamada `RaycastAll` ile güvenilir hedef tespiti
- Görsel olarak kısmen kapanmış baygın kurtlar için ekran mesafesi yedeği
- Seçili aktif kurt yoksa en yakın aktif kurdun otomatik kurtarıcı seçilmesi
- Kurtarma emri geri bildirimi
- Kurtarma sırasında kurtarıcının mavi renkle belirtilmesi
- Yüzdelik kurtarma ilerleme göstergesi
- Dalga bittikten sonra da kurtarma işleminin devam etmesi

### WP-03 — Hilal bütünlüğü

- Sıkı, dengeli ve geniş hilal düzenleri
- Düzen değişince dinamik formasyon noktalarının yeniden hesaplanması
- Hilal bütünlüğü yüzdesi
- Baygın kurtların formasyon bütünlüğüne boşluk olarak yansıması
- Ay-Yıldız Birliği bonus durum göstergesi
- Formasyona toplu dönüş komutu


### WP-04 — Karma sürü ve yıldız sistemi

- Koyun, kuzu, keçi, oğlak, inek, buzağı, boğa ve koç birimleri
- Hayvanların yıldız merkezi ve beş kola görevlerine göre dağıtılması
- Sıkı, dengeli ve açık yıldız düzenleri
- Çakallar yaklaştığında kademeli sürü paniği
- Panikleyen hayvanların yıldızdan uzaklaşıp tehlike geçince geri dönmesi
- Yıldız bütünlüğü ve ortalama panik göstergeleri
- Boğa ve koçların yakın tehditlere doğal savunma saldırısı yapması
- Bazı çakalların kurt hattını aşarak sürüyü hedeflemesi
- Panik testi ve sürüyü toplama komutları
- Ay-Yıldız Birliği için hem hilal hem yıldız bütünlüğü şartı


### WP-05 — Çakal rolleri ve grup taktikleri

- Yağmacı, koşucu, ağır, sinsi, uluyan ve lider çakal rolleri
- Her role özel can, hasar, hız, hedef önceliği, ölçek ve renk
- Çakal liderinin kullandığı rol ve taktik altyapısı
- Sol kanat, sağ kanat, çift kanat ve sürüye toplu hücum taktikleri
- Koşucu ve sinsi çakalların kanat hazırlık noktalarından sürüye sızması
- Ağır çakalların kurt savunma hattını meşgul etmesi
- Uluyan çakalın yakın çakallara geçici hız ve hasar desteği vermesi
- Lider düştüğünde koordinasyonun bozulup doğrudan saldırıya dönmesi
- HUD üzerinde aktif taktik, lider durumu ve uluma sayısı
- Hazırlık ekranında saldırı taktiğini seçme altyapısı


### WP-06 — Savaş hazırlığı, XP ve kurt gelişimi

- Savaş başlamadan önce çakal taktiğini seçme
- Ayrı `Savaşı Başlat` komutu
- Hazırlık sırasında kurtların ve çakalların birbirine saldırmaması
- Seçilen taktiğin savaş boyunca sabit kalması
- Hasar, çakal yenme, kurtarma ve dalga başarısından XP kazanımı
- Kurtların ayrı ayrı seviye atlaması
- Seviye atlayınca eğitim puanı kazanılması
- Muhafız, Avcı ve Lider eğitim yolları
- Eğitimlerin can, hasar, hedef algılama ve kurtarma süresini etkilemesi
- XP ve eğitim durumunun dalga sıfırlanınca korunması
- Seçili kurdun seviye, XP ve eğitim rütbelerinin ekranda gösterilmesi


### WP-07 — Göç ve yaşayan dünya

- Rota seçimi ve ay-yıldız düzeninde göç
- Sürü başka bir konumdayken savaş başlatma
- Savaş alanını sıfırlamadan yeni dalga hazırlama
- Su, yem ve şifalı bitki kaynakları
- Gece-gündüz ve temel hava sistemi

### WP-07 UI ve Şifacı Revizyonu — Sade ekran, şifa ve sürü tedavisi

- Büyük metin blokları yerine sol üstte üç satırlık kompakt durum paneli
- Sağ altta son olayları kayan biçimde gösteren küçük olay akışı
- Kurt, Çakal, Sürü, Dünya ve Savaş komutlarının ayrı açılır gruplara ayrılması
- Alt komut gruplarının olay penceresiyle çakışmaması için ekranın soluna alınması
- Çakal taktiklerinin Doğrudan, Sol, Sağ, Çift Kanat ve Sürü Hücumu olarak doğrudan seçilmesi
- Kurt seçildiğinde açılan ayrı gelişim penceresi
- Muhafız, Avcı, Lider ve Şifacı eğitim yollarının yalnızca gelişim penceresinde gösterilmesi
- Başlangıç grubunda yeşil tonla ayrılan bir Şifacı Kurt
- Şifacının yaralı aktif kurtları ve sürü hayvanlarını otomatik tedavi etmesi
- Şifacı becerisi geliştikçe şifa gücü, menzili ve uygulama sıklığının artması
- Sürü menüsünde 1 şifalı bitki kullanan `Sürüyü Tedavi Et` komutu
- Tedavi edilen sürü hayvanlarında kısa yeşil görsel geri bildirim
- Can çubuklarının yalnızca birim yaralandığında görünmesi
- Saha üzerinde yalnızca çoklu seçim dikdörtgeninin kalması



### WP-08 — Kamp, Ana Yurt ve yapı sistemi

- Başlangıç bölgesinde kalıcı Ana Yurt
- Göç rotasında geçici kamp kurma
- Odun ve taş kaynakları
- Su, yem, şifa, odun ve taş depolama kapasiteleri
- İyileştirme Alanı, Erzak Deposu, Su ve Yem Oluğu, Sürü Korunağı ve Gözcü Noktası
- Kamp çevresindeki boş yuvalara otomatik yapı yerleştirme
- İyileştirme Alanı ve Korunak ile pasif tedavi
- Su ve Yem Oluğu ile kamp üretimi
- Erzak Deposu ile kapasite geliştirme
- Kampta dinlenerek kurt ve sürüyü toparlama
- Kamp dinlenmesinde baygın kurtları yeniden ayağa kaldırma


### WP-09 — Görevler, anlatıcı olayları ve görev sonuçları

- Birbirini takip eden üç ana görev zinciri
- Aynı anda etkin iki yan görev
- Konuma ulaşma, kaynak toplama, savaş kazanma, kamp kurma, yapı kurma, sürü tedavisi ve Şifacı eğitimi hedefleri
- Görev ilerlemesinin oyun eylemleriyle otomatik güncellenmesi
- Görev grubundan açılan sade görev penceresi
- Takip edilen görevi değiştirme
- Kısa süreli anlatıcı mesajları
- Görev tamamlanınca ayrı sonuç ve ödül penceresi
- Su, yem, şifalı bitki, odun, taş ve tüm kurtlara XP ödülleri
- Ay-Yıldız Birliği aktifken savaş kazanma hedefi
- Görev çalışma mantığı için Edit Mode testleri

## Gereksinimler

Unity Hub üzerinden **Unity 6000.3.17f1** yükleyin. Gerekli modüller:

- Windows Build Support
- Web Build Support
- Android Build Support, SDK, NDK ve OpenJDK
- iOS için macOS üzerinde iOS Build Support ve Xcode

## Mevcut projeyi güncelleme

1. Unity'yi tamamen kapatın.
2. Güncelleme ZIP'ini çıkartın.
3. ZIP içindeki `bozkurt-obasi` klasörünü mevcut proje klasörünün üzerine kopyalayın.
4. Windows sorarsa **Hedefteki dosyaları değiştir** seçeneğini kullanın.
5. Unity Hub'dan aynı `client` klasörünü açın.
6. WP-11 sahnesi otomatik oluşmazsa `Bozkurt > Project > Run Current Setup (WP-11 Çevrim İçi Temel)` seçin.
7. `Assets/_Project/Scenes/00_Bootstrap.unity` sahnesini açın ve Play'e basın.

## Kontroller

- Kamera: `WASD` veya ok tuşları
- Yakınlaştırma: Fare tekerleği
- Mobil yakınlaştırma: İki parmakla sıkıştırma
- Kurt seçimi: Sol tık veya kısa dokunma
- Çoklu seçim: Fareyle seçim kutusu; `Shift` ile seçime ekleme
- Hareket: Sağ tık; mobilde uzun basma
- Kurtarma: Baygın kurdun üzerine sağ tık. Seçili aktif kurt varsa en yakını, yoksa en yakın aktif kurt otomatik gider.
- Alt komut çubuğu: `Kurt`, `Çakal`, `Sürü`, `Dünya`, `Kamp`, `Görev`, `Savaş`
- Kurt formasyonu: `Kurt` menüsünden Sıkı/Dengeli/Geniş Hilal; `Şifacıyı Seç` ile şifacıya hızlı geçiş
- Sürü formasyonu: `Sürü` menüsünden Sıkı/Dengeli/Açık Yıldız; `Sürüyü Tedavi Et` 1 şifalı bitki kullanır
- Çakal taktiği: `Çakal` menüsünden taktiği doğrudan seçin
- Dünya işlemleri: `Dünya` menüsünden rota, göç ve kaynak
- Kamp işlemleri: `Kamp Kur`, `Yapı Seç`, `Yapıyı Kur`, `Kampta Dinlen`
- Görev işlemleri: `Görev` düğmesinden ana/yan görevleri açın; `Takip Edileni Değiştir` ile aktif hedefi değiştirin
- Savaş işlemleri: `Savaş` menüsünden yeni dalga, başlatma ve sıfırlama
- Kurt gelişimi: Tek bir kurt seçildiğinde açılan pencereden Muhafız, Avcı, Lider veya Şifacı eğitimi verin

## Depo düzeni

- `client/`: Unity projesi
- `server/`: Nakama TypeScript servisleri için ayrılan alan
- `infrastructure/`: Docker, PostgreSQL ve Dokploy yapılandırmaları için ayrılan alan
- `docs/`: Tasarım ve teknik belgeler

### WP-10 — Kayıt, platform buildleri ve dağıtım

- Kayıt şeması v2 ve eski kayıt migrasyonu
- Kurt gelişimi/canı, sürü durumu, dünya kaynakları, rota, kamp/yapılar ve görev ilerlemesi
- Atomik kayıt ile önceki sağlam dosyanın yedek tutulması
- 20 saniyede bir, uygulama duraklatıldığında ve sahneden çıkarken otomatik kayıt
- Unity menüsünden WebGL, Android APK, Android AAB ve Windows build
- PowerShell tek komut build araçları
- Brotli uyumlu Nginx, Docker ve Dokploy paketi
- GitHub Actions üzerinde elle başlatılan WebGL/APK/AAB build akışı

## WP-10 kullanım

Unity içinden `Bozkurt > Build` menüsünü kullanabilir veya depo kökünde:

```powershell
.\tools\build\build-web.ps1
.\tools\build\serve-web.ps1
.\tools\build\build-android-apk.ps1
```

Web Docker yayını:

```powershell
docker compose -f infrastructure/web/docker-compose.yml up -d --build
```

### WP-11 — Çevrim içi temel

- Resmî Nakama Unity SDK 3.21.1
- İsteğe bağlı misafir cihaz hesabı
- Kullanıcı adı ve görünen ad güncelleme
- Kullanıcı adıyla arkadaşlık isteği
- Arkadaşlık durumlarını listeleme
- Yerel kaydı Nakama Storage Engine'e yükleme
- Daha yeni bulut kaydını yerel cihaza indirme
- Sunucu çalışmazsa tek oyunculu oyuna devam etme
- Docker Compose ile yerel Nakama 3.39.0 + PostgreSQL 16

Yerel sunucuyu başlatmak için:

```powershell
.\tools\server\start-nakama.ps1
```

Unity ana menüsünde **Çevrim İçi** düğmesine basarak bağlantıyı test edin.
