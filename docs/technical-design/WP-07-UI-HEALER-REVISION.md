# WP-07 UI ve Şifacı Revizyonu

## Amaç

Alt komut gruplarını sağ alttaki olay akışından ayırmak, kurt gelişimine Şifacı yolunu eklemek ve sürü hayvanlarına hem otomatik hem kaynak kullanan tedavi mekanikleri kazandırmak.

## Arayüz

- Kategori çubuğu ve açılır komut panelleri ekranın sol altına sabitlendi.
- Sağ alttaki olay akışıyla çakışma kaldırıldı.
- Kurt grubundaki doğrudan tam iyileştirme düğmesi kaldırıldı ve yerine `Şifacıyı Seç` eklendi.
- Sürü grubuna `Sürüyü Tedavi Et` eklendi.
- Kurt gelişim popup'ına dördüncü eğitim yolu olarak `Şifacı` eklendi.

## Şifacı kurt

- Beş başlangıç kurdunun sonuncusu Şifacı Kurt olarak başlar.
- Şifacı yeşil-turkuaz renkle ayrılır ve Şifacı rütbesi 1'dir.
- Yaralı fakat baygın olmayan kurtları otomatik bulur ve tedavi eder.
- Yaralı sürü hayvanlarını otomatik bulur ve tedavi eder.
- Baygın kurtları normal kurtarma sistemiyle ayağa kaldırır; şifa baygın birimi diriltmez.
- Yakında tedavi gerektiren hedef yoksa normal savaş davranışına döner.
- Savaş bittikten sonra da yakındaki yaralıları tedavi etmeye devam eder.

## Şifacı gelişimi

Her Şifacı rütbesi:

- Uygulanan şifa miktarını artırır.
- Şifa menzilini artırır.
- Yaralı hedef algılama menzilini artırır.
- Şifa bekleme süresini azaltır.
- Sürü hayvanlarına uygulanan şifayı güçlendirir.

Şifa katkısı da XP kazandırır ve kurt popup'ında toplam şifa katkısı gösterilir.

## Sürü tedavisi

- `Sürüyü Tedavi Et`, tedavi gerektiren sürü varsa 1 şifalı bitki harcar.
- Tüm aktif yaralı sürü hayvanlarına azami canlarının bir bölümü kadar şifa uygular.
- Panik seviyelerini azaltır.
- Kayıp hayvanları diriltmez.
- Tedavi sırasında hayvan kısa süre yeşil görünür.

## Sağlık göstergeleri

Tüm birimlerin sağlık çubukları tam canda gizlenir; yalnızca yaralanınca görünür. Böylece sürü iyileştirmesi takip edilirken ekran kalabalığı artmaz.
