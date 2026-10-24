# Oyun ekonomisi / Game economy — v2.16.0

## Türkçe

### İlerleme hedefi

İlk üreticiler başlangıç erzağıyla kurulabilir; ikinci kopyalar, yükseltmeler ve gelişmiş surlar aynı oturumda arka arkaya tamamlanacak fiyatlarda değildir. Başlangıç stokları **450 odun / 350 taş / 180 su / 180 yem / 80 ot** kalır. İlk oduncu ve taş ocağı toplam 400 odun / 220 taş ister. İlk yapı ve görevlerin tek seferlik ödülleri, 90 saniyede bir ücretsiz toplama ve mevcut pasif üretim korunur. Sıfır stoktan geri dönüş mümkündür; maliyet yükseltmek ücretsiz toplama, taşıma, formasyon veya ekipman yönetimini kilitlemez.

### Depo genişletme

Her kaynak için temel kapasite **1.000**. Aşağıdaki bedel, belirtilen hedef seviyeye geçerken bir kez ödenir; kapasiteye Bey Otağı'nın en fazla 400 katkısı ayrıca eklenir. Her depo aşaması önceki kapasiteye sığar; yükseltmek için henüz sahip olunmayan kapasiteye ihtiyaç duyulmaz.

| Hedef depo seviyesi | Sonraki toplam kapasite | Odun | Taş |
| --- | ---: | ---: | ---: |
| 1 — İnşa | 10.000 | 900 | 750 |
| 2 | 50.000 | 8.000 | 6.000 |
| 3 | 250.000 | 40.000 | 30.000 |
| 4 | 1.000.000 | 200.000 | 150.000 |
| 5 | 5.000.000 | 800.000 | 650.000 |

Son depo seviyesinin toplam yatırımı **1.048.900 odun + 836.750 taş** olur. Önceki sürümde toplam 1.157 / 797 idi. Üretimi değiştirmeden kapasiteyi en üst seviyeye çıkarmak artık uzun vadeli bir hedef olur.

### Yapılar ve surlar

| Yapı | İlk kopya odun / taş |
| --- | ---: |
| Bey Otağı | 600 / 450 |
| Oduncu | 180 / 100 |
| Taş Ocağı | 220 / 120 |
| Su Kuyusu | 160 / 90 |
| Otlak | 200 / 120 |
| Şifa Otağı | 320 / 240 |
| Depo | 900 / 750 |
| Gözcü Kulesi | 500 / 400 |
| Sürü Barınağı | 420 / 300 |

Aynı türden mevcut yapı sayısına göre yeni kopyaların katsayısı **1 / 2 / 3 / 5 / 8 / 12** olur. Örneğin altıncı oduncu 2.160 odun / 1.200 taş ister. Gözcü kulesinin dört köşesi için ilk dört katsayı uygulanır. Bir yapı kaldırılırsa sıradaki inşanın fiyatı o anda kalan yapı sayısından hesaplanır; eski binanın iadesi yeniden fiyatlandırılmaz.

Depo dışındaki yapıların hedef **2 / 3 / 4 / 5** seviyelerine geçiş maliyeti ilk kopyanın temel bedelinin **6 / 30 / 150 / 750** katıdır. Kopya katsayısı yükseltmeye uygulanmaz. Örneğin bir oduncunun yükseltmeleri 1.080/600, 5.400/3.000, 27.000/15.000 ve 135.000/75.000 odun/taş ister. Yerleştirme, yapı kartı, maliyet ipucu ve planlayıcı sunucunun aynı tarifesini gösterir.

| Hedef sur seviyesi | Odun | Taş |
| --- | ---: | ---: |
| 2 | 1.800 | 1.200 |
| 3 | 12.000 | 15.000 |
| 4 | 100.000 | 120.000 |
| 5 | 1.200.000 | 1.500.000 |

Son sur beşinci depo seviyesini gerektirir. Üst seviyeler için kaynak planlayıcısı eksik malzemeyi ve kapasite engelini açıklar; depoya sığmayan bedel bir düğmeyle aşılamaz.

### Muhafızlar, savaş ve bakım

| Hedef eğitim rütbesi | Şifalı ot | Yem |
| --- | ---: | ---: |
| 1 | 40 | 80 |
| 2 | 140 | 280 |
| 3 | 450 | 900 |
| 4 | 1.400 | 2.800 |
| 5 | 4.200 | 8.400 |

Eğitim ayrıca bir yetenek puanı ister; rütbesi sıfır olan bir yolun ilk eğitimi başlangıç stoklarına sığar. Eğitim puanı birikmesi üst rütbeyi bedelsiz yapmaz.

- Savaş erzağı: **60 + 12 × (dalga − 1) su**, **80 + 16 × (dalga − 1) yem**.
- Kampta dinlenme: **100 su + 125 yem**; mevcut iyileştirme etkileri korunur.
- Sürü tedavisi: **15 şifalı ot**.
- Sürü tamamlama: hayvan başına **30 su + 60 yem**, işlem başına 1–5 ve toplam 24 hayvan sınırı; otlak gerekir.
- Savaş emirleri, ekipman takıp çıkarma, formasyon seçimi, bina taşıma ve arkadaşlara mesaj ücretsiz kalır. Hediyelerde gönderilen miktar gönderenden düşer; sistem yeni kaynak üretmez.

### Sefer hazırlığı

Yeni keşif/sevkiyatlar 6/8/10/12 saat sürer. Su/yem hazırlığı ayrı ayrı aşağıdaki formülle hesaplanıp son aşamada yukarı yuvarlanır:

**saat × (12 su veya 16 yem) × (1 + bölge sırası × 0,15) × zorluk × amaç × kadro × izcilik**

Bölge sırası Ana Yurt 0, Su Gözü 1, Çayır 2, Yüksek Otlak 3, Kalıntılar 4; zorluk 1/1,5/2; standart amaç 1, iz sürme/ikmal 1,25; kadro 1 + 0,2 × (kurt sayısı − 1). İzcilik indirimi önceki gibi en fazla %30'dur. Süre, XP, malzeme ve ekipman ödülleri değişmez.

Tek kurtla kolay standart Su Gözü: **83 su + 111 yem**, 6 saat, 180 XP, 96 odun + 60 taş + 18 ot. Aynı göreve beş kurt 150 su + 199 yem ister. Kadro ve amaç seçimi yalnızca önizlemedir; açık yola çıkışla ücret alınır. Yeni sefer ekonomi sürümü 4'tür; başlamış 1/2/3 sürümlü seferler ve geçmiş raporların vaatleri korunur.

### Kazanım ve süre varsayımları

Tek bina seviyesi saatte 36 odun, 27 taş, 42 su, 36 yem veya 18 ot üretir. Çevrimdışı hesap en fazla **8 saat** işler. Aktif işlerin ortak **90 saniye** beklemesi vardır: karma 3 odun + 2 taş + 2 su + 2 yem; odun 10; taş 7; su 8; yem 8; ot 2. Otomatik toplama yoktur; tüm kazanımlar depo boşluğuyla sınırlanır.

Altı son seviye taş ocağının toplamı 810 taş/saat eder. Son surun 1.500.000 taşını yalnız bu üretimle biriktirmek yaklaşık **1.852 üretim saati** gerektirir; günde tek sekiz saatlik çevrimdışı pencereyle yaklaşık **232 gün**. Aktif işler ve ödüller bu süreyi kısaltır; diğer harcamalar uzatır. Bu bir matematiksel üst aşama örneğidir, oyuncu seansı ölçümü veya ilerleme süresi garantisi değildir. Erken üretici ve orta seviyeler çok daha küçük bütçeler kullanır.

### Eski kayıtlar ve iadeler

Kayıt biçimi v3, her yapının eski tarife kapsamındaki seviyelerini ve ilk inşa sırasını saklar. Eski v1/v2 köyleri tam doğrulama sonrası aktarılır; mevcut stoklar, seviyeler, köy düzeni, kurtlar, görevler ve seferler sıfırlanmaz. Eski ucuz seviyelere yeni tarife üzerinden geriye dönük borç veya yüksek iade uygulanmaz.

Kaldırma **gerçekte ödenmiş toplam yatırımın tam %50'sini** verir. Mevcut stoklar küçülen kapasiteye sığmalıdır. İadenin sığan kısmı depoya, fazlası kalıcı **bekleyen iadeye** geçer; malzeme silinmez. **Bekleyen iadeyi al**, yalnız depoda boşluk kadarını taşır; kalanı sonraki işlem için korur. Bu pay depoyu yükseltmeden pahalı bir bedel ödemek için kullanılamaz. İşlemler sunucu revizyonu ile bir kez uygulanır. [Kaldırma rehberi](DEMOLITION.md).

Yeni ENV, servis veya SQL tablo alanı gerekmez; kayıt JSON'u otomatik göç eder. Dokploy'da web/API'yi aynı sürümle dağıtın ve veri volume'larını koruyun. [Önizleme](../preview/village.html).

## English

### Progression and storage

Starter supplies remain **450 wood / 350 stone / 180 water / 180 feed / 80 herbs**. The first lumber camp plus quarry cost 400 wood / 220 stone; free gathering, initial quests and passive output remain available even after resources reach zero. Later copies and levels require saving and planning.

| Target storage level | Capacity after purchase | Wood | Stone |
| --- | ---: | ---: | ---: |
| 1 — Build | 10,000 | 900 | 750 |
| 2 | 50,000 | 8,000 | 6,000 |
| 3 | 250,000 | 40,000 | 30,000 |
| 4 | 1,000,000 | 200,000 | 150,000 |
| 5 | 5,000,000 | 800,000 | 650,000 |

Base capacity is 1,000; the hall adds up to 400. Each storage purchase fits the previous capacity. Total investment to level 5 is **1,048,900 wood + 836,750 stone**, compared with 1,157 / 797 previously.

### Buildings and walls

| Building | First copy wood / stone |
| --- | ---: |
| Hall | 600 / 450 |
| Lumber camp | 180 / 100 |
| Quarry | 220 / 120 |
| Well | 160 / 90 |
| Pasture | 200 / 120 |
| Healer lodge | 320 / 240 |
| Storage | 900 / 750 |
| Watchtower | 500 / 400 |
| Shelter | 420 / 300 |

Additional copies use multipliers **1 / 2 / 3 / 5 / 8 / 12** based on the current owned count. Towers use the first four multipliers. Removing a building changes the next construction quote; its historical refund is never repriced. Non-storage upgrades to levels **2 / 3 / 4 / 5** cost the first-copy base recipe multiplied by **6 / 30 / 150 / 750**, without the copy multiplier. Lumber upgrades therefore cost 1,080/600, 5,400/3,000, 27,000/15,000 and 135,000/75,000 wood/stone.

| Target wall level | Wood | Stone |
| --- | ---: | ---: |
| 2 | 1,800 | 1,200 |
| 3 | 12,000 | 15,000 |
| 4 | 100,000 | 120,000 |
| 5 | 1,200,000 | 1,500,000 |

The final wall tier requires level-5 storage. Shared authoritative recipes drive the placement picker, building cards, tooltips and planner; capacity shortages are visible.

### Guardians, combat and care

| Target training rank | Herbs | Feed |
| --- | ---: | ---: |
| 1 | 40 | 80 |
| 2 | 140 | 280 |
| 3 | 450 | 900 |
| 4 | 1,400 | 2,800 |
| 5 | 4,200 | 8,400 |

Training still consumes one skill point; the first rank of an untrained path fits starter supplies. Battle supplies cost **60 + 12 × (wave − 1) water** and **80 + 16 × (wave − 1) feed**. Camp rest costs **100 water + 125 feed**; herd treatment costs **15 herbs**; replacements cost **30 water + 60 feed per animal**, with the existing pasture, batch and herd limits. Care effects remain unchanged. Tactical orders, moving buildings, formations, equipment management and messaging remain free; gifts transfer the sender's existing resources/items.

### Journeys

New journeys preserve their 6/8/10/12-hour duration and XP/material/item rewards. Supplies are rounded up once from **hours × (12 water or 16 feed) × (1 + region rank × 0.15) × difficulty × purpose × party × scouting**. Region ranks are 0–4; difficulty is 1/1.5/2; purpose is 1 for standard or 1.25 for survey/supply; party is 1 + 0.2 × (wolf count − 1); scouting discounts at most 30%.

One wolf on an easy standard Wellspring journey costs **83 water + 111 feed**, taking six hours for 180 XP, 96 wood, 60 stone and 18 herbs. Five wolves cost 150 water + 199 feed. Selection is a preview; explicit departure spends the supplies. New outings use economy version 4, while historical versions 1/2/3 retain their promises and reports.

### Income and pacing assumptions

Per building level, hourly production remains 36 wood, 27 stone, 42 water, 36 feed or 18 herbs. Offline progress is capped at eight hours. Explicit gathering shares a 90-second cooldown: mixed 3 wood + 2 stone + 2 water + 2 feed; focused wood 10, stone 7, water 8, feed 8 or herbs 2. Storage room caps incoming materials; nothing gathers automatically.

Six level-5 quarries produce 810 stone/hour. The final wall's 1,500,000 stone takes about **1,852 production hours** from that source alone, or **232 days** with one eight-hour offline window per day. Active work/rewards shorten this; other spending extends it. This is a mathematical late-game example, not measured player pacing or a guarantee. Early producers and middle tiers use much smaller budgets.

### Migration and refunds

Save format v3 records each building's historical price levels and construction ordinal. Fully validated v1/v2 saves migrate without resetting resources, buildings, layout, wolves, objectives or outings. Old purchases are neither charged retroactively nor refunded at inflated new prices.

Demolition refunds **exactly 50% of actual investment**. Existing balances must fit reduced capacity. The refund is split into available storage and a persistent **refund reserve**; no credit is discarded. **Claim pending refund** moves only what currently fits and leaves the remainder. Reserved credits cannot bypass storage to pay an otherwise unaffordable price. Revision checks protect once-only processing. [Demolition](DEMOLITION.md).

No new ENV variable, service or SQL column is needed; persisted JSON migrates automatically. Deploy matching web/API versions and keep existing data volumes. [Village preview](../preview/village.html).
