# Bina kaldırma / Building demolition — v2.16.0

## Türkçe

Ana Yurt'ta kaldırmak istediğin binayı seç ve **Binayı kaldır** düğmesine bas. Açılan uyarı, bina adını, seviyesini, parselini, malzeme iadesini ve varsa depo kapasitesi değişimini gösterir. İlk klavye odağı **Vazgeç** üzerindedir. Kaldırma ancak açıkça onayladığında sunucuya gönderilir.

**Vazgeç**, kapatma, Escape ve pencere dışına tıklama hiçbir bina veya kaynağı değiştirmez. İstek işlenirken ikinci onay ve kapatma kilitlenir. Başarılı işlem binayı kaldırır, parseli yeniden inşa için açar ve iadeyi bir kez ekler. Aynı türdeki diğer binalar etkilenmez. Taşıma ücretsiz olarak kullanılmaya devam eder.

### İade hesabı

İade, binanın temel inşaat maliyeti ile mevcut seviyesine kadar yapılan yükseltmelerin toplam maliyetinin **tam %50'sidir**. Her seviyenin satın alındığı tarife korunur; yeni pahalı tarifeler eski yatırıma uygulanmaz. Yarım malzemeler korunur ve yerel sayı biçimiyle gösterilir.

| Örnek | İnşaat + yükseltme toplamı | İade |
| --- | --- | --- |
| Yeni ilk kopya, Seviye 1 Oduncu | 180 odun + 100 taş | 90 odun + 50 taş |
| Yeni ilk kopya, Seviye 2 Oduncu | 1.260 odun + 700 taş | 630 odun + 350 taş |
| Eski Seviye 1 → yeni tarifeyle Seviye 2 Oduncu | 1.140 odun + 625 taş | 570 odun + 312,5 taş |

v3 kaydı yapı başına eski tarife seviyelerini ve inşa sırasını saklar. Eski v1/v2 kayıtları doğrulanarak aktarılır; köy sıfırlanmaz. Yeni kopya ve yükseltmeler güncel tarifeyi öder. Kaldırma geçmiş inşaat sayısını, tamamlanmış görevleri, kurtları veya ekipmanları geri almaz. Yeniden inşa normal maliyetiyle yeni bir işlemdir.

### Depo ve işlem korumaları

- Aktif savaş veya yolculuk sırasında kaldırma yapılamaz.
- Depo kaldırılırsa kendi seviyesinin kapasite katkısı kalkar: seviyeler 1–5 için **9.000 / 49.000 / 249.000 / 999.000 / 4.999.000**. Temel 1.000 ve kalan Bey Otağı katkısı korunur.
- Bey otağı kaldırılırsa yükseltilmiş her seviye için kazanılan **100** kapasite kaldırılır; temel 1.000 kapasite korunur.
- Mevcut beş kaynak işlem sonrası kapasiteye sığmalıdır; stok fazlası varsa kaldırma engellenir. İadenin kendisi boşluğa sığmazsa sığan pay hemen depoya, kalan pay kalıcı bekleyen iadeye geçer. Böylece pahalı depo boşaltıldıktan sonra da kaldırılabilir. Ana Yurt üzerindeki **Bekleyen iadeyi al** düğmesi, mevcut boşluk kadarını aktarır; kalanı saklar. Kaynak veya iade eksiltilmez, otomatik tahsilat yapılmaz.
- Başka bir oturum binayı değiştirir, taşır, kaldırır veya yeni inşaat yaparsa eski onay geçersizleşir. Pencereyi kapatıp güncel binayı tekrar seç.
- Sunucu iadeyi kendisi hesaplar. İstemcinin değiştirdiği iade miktarı veya eski kayıt sürümüyle gelen tekrar, ikinci ödeme oluşturmaz.

Üretim devam ederken kapasite ve uygunluk güncellenir; onay düğmesi kendiliğinden çalışmaz. Başarısız işlem otomatik tekrarlanmaz.

### Önizleme ve dağıtım

[Çevrimdışı köy önizlemesi](../preview/village.html) kurmaca bir binanın onay penceresini ve iade hesabını gösterir. Onay kapalıdır; gerçek bina, kaynak veya hesap değiştirmez. TR/EN ve açık/kahverengi koyu tema desteklenir.

Yeni ENV veya servis gerekmez. Dokploy'da güncel sürümü dört servisle dağıt ve mevcut volume'ları koru. [Oba planlaması](VILLAGE-PLANNING.md) · [Ana sayfa index](../preview/index.html).

## English

Select the intended building in Homeland and press **Remove building**. The warning shows its name, level, plot, refund and any storage-capacity change. Initial keyboard focus is on **Cancel**. Only explicit confirmation submits removal to the server.

Cancel, close, Escape and backdrop clicks do not change buildings or balances. Pending requests block repeated confirmation and dismissal. Success removes only that instance, frees its plot and credits the refund once. Other buildings of the same type remain. Free relocation is still available.

### Refund calculation

The refund is **exactly 50%** of base construction cost plus all upgrade costs through the current level, using the recipe actually paid for each level. New higher prices never inflate historical investment. Half units are retained and displayed with localized numbers.

| Example | Construction + upgrade total | Refund |
| --- | --- | --- |
| New first copy, Level 1 Lumber camp | 180 wood + 100 stone | 90 wood + 50 stone |
| New first copy, Level 2 Lumber camp | 1,260 wood + 700 stone | 630 wood + 350 stone |
| Legacy Level 1 → current-price Level 2 Lumber camp | 1,140 wood + 625 stone | 570 wood + 312.5 stone |

Save v3 retains historical price levels and construction ordinal for each building. Validated v1/v2 saves migrate without a village reset; subsequent copies and upgrades pay current prices. Removing a building does not reverse historical build counts, completed objectives, guardians or equipment. Rebuilding is a new purchase at its normal cost.

### Capacity and transaction safeguards

- Active combat or a journey blocks removal.
- Removing storage removes its level contribution: **9,000 / 49,000 / 249,000 / 999,000 / 4,999,000** for levels 1–5. Base capacity 1,000 and the remaining hall bonus stay.
- Removing the hall loses **100** capacity per upgraded level; base capacity remains 1,000.
- All five existing balances must fit reduced capacity; existing excess blocks demolition. The refund itself is split between available storage and a persistent refund reserve, so an emptied expensive warehouse can still be removed. **Claim pending refund** in the homeland transfers only what fits and preserves the rest. No credit is lost or claimed automatically.
- Another session changing, moving or replacing the building, or constructing a new one, invalidates the old confirmation. Close the dialog and inspect the current building again.
- The server computes the refund. Forged refund values and stale/repeated commands cannot create a second payout.

Production updates capacity readiness without automatically confirming. Failed requests are not retried automatically.

### Preview and deployment

The [offline village preview](../preview/village.html) shows the dialog and refund for a fictional building. Confirmation is disabled and cannot affect real buildings, balances or accounts. TR/EN and light/brown-dark themes are supported.

No new environment variables or services are required. Redeploy all four Dokploy services while retaining data volumes. [Village planning](VILLAGE-PLANNING.md) · [Homepage index](../preview/index.html).
