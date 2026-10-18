# Bina kaldırma / Building demolition — v2.8.0

## Türkçe

Ana Yurt'ta kaldırmak istediğin binayı seç ve **Binayı kaldır** düğmesine bas. Açılan uyarı, bina adını, seviyesini, parselini, malzeme iadesini ve varsa depo kapasitesi değişimini gösterir. İlk klavye odağı **Vazgeç** üzerindedir. Kaldırma ancak açıkça onayladığında sunucuya gönderilir.

**Vazgeç**, kapatma, Escape ve pencere dışına tıklama hiçbir bina veya kaynağı değiştirmez. İstek işlenirken ikinci onay ve kapatma kilitlenir. Başarılı işlem binayı kaldırır, parseli yeniden inşa için açar ve iadeyi bir kez ekler. Aynı türdeki diğer binalar etkilenmez. Taşıma ücretsiz olarak kullanılmaya devam eder.

### İade hesabı

İade, binanın temel inşaat maliyeti ile mevcut seviyesine kadar yapılan yükseltmelerin toplam maliyetinin **tam %50'sidir**. Her yükseltmenin mevcut oyun tarifi kullanılır; yarım malzemeler korunur ve arayüzde yerel sayı biçimiyle gösterilir.

| Örnek | İnşaat + yükseltme toplamı | İade |
| --- | --- | --- |
| Seviye 1 Oduncu | 60 odun + 25 taş | 30 odun + 12,5 taş |
| Seviye 2 Oduncu | 153 odun + 64 taş | 76,5 odun + 32 taş |

İnşaat/yükseltme tarifesi esas alınır; geçmiş kayıtlarda ayrı bir harcama defteri yoktur. Kayıt geçişi veya köy sıfırlaması gerekmez. Kaldırma geçmiş inşaat sayısını, tamamlanmış görevleri, kurtları veya ekipmanları geri almaz. Yeniden inşa normal maliyetiyle yeni bir işlemdir.

### Depo ve işlem korumaları

- Aktif savaş veya yolculuk sırasında kaldırma yapılamaz.
- Depo kaldırılırsa kapasite bina seviyesi başına **250** azalır.
- Bey otağı kaldırılırsa yükseltilmiş her seviye için kazanılan **100** kapasite kaldırılır; temel 500 kapasite korunur.
- İade ve mevcut beş kaynak, işlem sonrası kapasiteye sığmalıdır. Sığmayan kaynak ve miktarı pencerede açıklanır. Önce yer aç veya kalan depo kapasitesini artır; kaynaklar otomatik silinmez veya iade eksiltilmez.
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

The refund is **exactly 50%** of base construction cost plus all upgrade costs through the current level, using the game's cost recipes. Half units are retained and displayed with localized numbers.

| Example | Construction + upgrade total | Refund |
| --- | --- | --- |
| Level 1 Lumber camp | 60 wood + 25 stone | 30 wood + 12.5 stone |
| Level 2 Lumber camp | 153 wood + 64 stone | 76.5 wood + 32 stone |

Values follow construction/upgrade recipes; older saves do not retain a separate spending ledger. No save migration or village reset is required. Removing a building does not reverse historical build counts, completed objectives, guardians or equipment. Rebuilding is a new purchase at its normal cost.

### Capacity and transaction safeguards

- Active combat or a journey blocks removal.
- Removing storage loses **250** capacity per building level.
- Removing the hall loses **100** capacity per upgraded level; base capacity remains 500.
- All five current resource balances plus the refund must fit the resulting capacity. The dialog explains overflow by resource/amount. Make room or increase remaining capacity first; resources and refunds are never silently discarded.
- Another session changing, moving or replacing the building, or constructing a new one, invalidates the old confirmation. Close the dialog and inspect the current building again.
- The server computes the refund. Forged refund values and stale/repeated commands cannot create a second payout.

Production updates capacity readiness without automatically confirming. Failed requests are not retried automatically.

### Preview and deployment

The [offline village preview](../preview/village.html) shows the dialog and refund for a fictional building. Confirmation is disabled and cannot affect real buildings, balances or accounts. TR/EN and light/brown-dark themes are supported.

No new environment variables or services are required. Redeploy all four Dokploy services while retaining data volumes. [Village planning](VILLAGE-PLANNING.md) · [Homepage index](../preview/index.html).
