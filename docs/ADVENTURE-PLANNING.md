# Sefer hazırlığı ve bölge hikâyeleri / Adventure planning and regional stories

## Türkçe

**Keşif ve sevkiyat → Bozkırın yolları** ekranındaki bölge kartları keşif sırasını gösterir. Ana Yurt, Su Gözü, Şifalı Çayır, Yüksek Otlak ve Kadim Kalıntılar için bulunduğun, keşfettiğin, sırada keşfedebileceğin ve kilitli rotaları ayırt edebilirsin. Bir kart veya seçici yalnızca planı değiştirir; kaynak harcamaz ve sefer başlatmaz. Görev sürerken rota, plan ve muhafız seçimi kilitlenir.

### v2.11.0 — Saatlik seferler ve üç görev planı

Görev türünü (keşif/sevkiyat), hedefi, zorluğu, planı ve muhafızları seç. Planlar aynı bölgenin farklı amaçlarla tekrar ziyaret edilmesini sağlar. Kartlardaki kesin değerler seçili zorluk ve kurtların ekipmanına göre hesaplanır:

| Plan | Süre | Su/yem maliyeti | Odun/taş/ot | XP / kurt | Kolay/orta/zor yorgunluk |
| --- | --- | --- | --- | --- | --- |
| Dengeli nöbet | Bölgeye göre 6/8/10/12 sa | ×1 | ×1 | ×1 | 5 / 10 / 15 can |
| İz sürme | Aynı sabit süre | ×1,25 | ×0,75 | ×1,5 | 7 / 14 / 21 can |
| İkmal | Aynı sabit süre | ×1,25 | ×1,5 | ×0,75 | 8 / 16 / 24 can |

Yeni seferlerin süresi Su Gözü 6, Şifalı Çayır 8, Yüksek Otlak 10, Kadim Kalıntılar 12 saattir. Ana Yurt dönüşü 6 saattir. Temel ödüller saat sayısıyla ölçeklenir; kolay/orta/zor ödül katsayısı 1/1,5/2 olur. İzci ekipmanı yalnızca yola çıkış su/yem maliyetini en fazla %30 indirir. Maliyetler yukarı, XP/malzeme ödülleri aşağı yuvarlanır. Her görevde en fazla bir bölge eşyası verilir. [Kesin tablo ve formüller](LONG-JOURNEYS.md).

v2.8.0’daki yarım malzeme hesabı yalnız eski ekonomi-2 seferleri için korunur. Yeni seferler saatlik ekonomi-3 hesabını kullanır. Başlamış eski seferlerin süre ve ödülleri değiştirilmez.

Örnek: kolay Su Gözü, izci ekipmanı olmadan standart **18 su + 23 yem, 6 saat, 180 XP, 96 odun + 60 taş + 18 ot**. İz sürme aynı 6 saatte **23 su + 29 yem, 270 XP, 72 odun + 45 taş + 13 ot**; ikmal **23 su + 29 yem, 135 XP, 144 odun + 90 taş + 27 ot**. Depoda varışta yeterli yer varsayılır; seviye atlama yorgunluk sonrasında can yenileyebilir.

### Hikâye ve dönüş raporu

Beş bölgenin keşif ve sevkiyat metinleri ayrıdır. Keşifte muhafızlar izleri ve geçitleri araştırır; sevkiyatta sürünün yolculuğunu ve hilal/yıldız düzeniyle korunmasını takip edersin. Çıkış, yol ve varış evreleri sunucu zamanına bağlı ilerler; seçili plan görev amacını açıklar. Metinler yeni bir savaş, rastgele ganimet veya ek ödül mekanizması başlatmaz.

Son 20 dönüş raporu görev türünü, bölgeyi, zorluğu, planı, katılan kurtları ve gerçekten teslim edilmiş ödülleri saklar. Bu liste bütün zamanların başarı arşivi değildir; eski raporlar sınır dolunca düşer. Bölge açma ilerlemesi ayrıca kalıcıdır. Tarayıcıyı kapatmak görevi iptal etmez.

### Yola çıkma koşulları

- Devam eden savaş veya başka yolculuk bitmiş olmalı.
- Keşif sırayla ilerler. Sevkiyat keşfedilmiş ve sürünün bulunduğundan farklı bir bölgeye yapılır.
- Kolay/orta/zor için en az 1/2/3 muhafız gerekir. Her seçilen kurdun canı en az 20 olmalı.
- Sevkiyatta sürünün canı en az 60 olmalı.
- Seçilen planın su ve yem masrafı karşılanmalı. Eksik miktarlar yukarı yuvarlanır; kaynak üretimi geldikçe güncellenir.

Hazırlık paneli başlat düğmesinin neden açık veya kapalı olduğunu gösterir. Kazanım paneli mevcut depo boşluğuna göre taşabilecek malzemeyi ve dolu ekipman envanterini belirtir. Bunlar **tahmindir**: üretim, harcama veya hediye bakiyeleri değiştirebilir. Kesin kazanım varış raporunda görünür. Depo uyarısı yola çıkmayı engellemez; sığmayan kaynak sonradan alınacak bir ödül olarak bekletilmez.

Başlat düğmesine basıldığında sunucu koşulları tekrar denetler; maliyeti bir kez düşer ve seçili planı kaydeder. Ödül yalnızca bir kez işlenir. Üretim yenilemeleri seçimleri ve klavye odağını korur. Görevdeki kurtlar eğitilemez veya ekipman değiştiremez.

Kadro hazırlığı için v2.7.0 ile eklenen [muhafız önerileri ve varış öngörüsü](ADVENTURE-PARTY.md) kullanılabilir.

### Eski kayıtlar ve önizleme

Önceki sürümde başlatılmış ve plan alanı olmayan görevler **standart** kabul edilir: bitiş zamanı, maliyet ve ödül değişmez. Aynı kural eski dönüş raporları için geçerlidir. Yeni kayıtlar seçili planı ve sunucunun atadığı `economyVersion: 3` işaretini taşır. İşaretsiz, 1 ve 2 sürümlü başlamış görevler eski bitiş/ödüllerini korur. Bu işareti olmayan eski aktif görevler ve geçmiş raporlar önceki ödül hesabıyla doğrulanır; istemci yeni görevi eski ekonomiden başlatamaz. Geçersiz plan veya kayıt işareti reddedilir. SQL tablo değişikliği veya yeni ENV anahtarı gerekmez. Dokploy'da mevcut volume'ları koruyarak dört servisi birlikte dağıtın.

[Çevrimdışı sefer önizlemesi](../preview/adventure.html) örnek durumlarla planları, rotaları, hikâyeyi, TR/EN ve açık/kahverengi koyu temayı gösterir. Gerçek hesaba veya sunucuya bağlanmaz; sefer başlatma kapalıdır. Ana sayfa için [index.html](../preview/index.html). Her ikisi de `npm run build:preview` ile yenilenir.

## English

Region cards in **Exploration and escorts → Trails of the steppe** show Homeland, Wellspring, Healing Meadow, High Pastures and Ancient Ruins. They distinguish the current location, discovered destinations, the next discoverable region and locked routes. Selecting a card or control changes the plan without spending resources or starting a mission. Route, plan and party selection lock during a journey.

### v2.11.0 — Fixed-hour journeys and three plans

Choose exploration or escort, destination, difficulty, mission plan and guardians. Plans give repeat visits different purposes. Cards show concrete values for the selected difficulty and equipment:

| Plan | Duration | Water/feed cost | Materials | XP / wolf | Easy/normal/hard fatigue |
| --- | --- | --- | --- | --- | --- |
| Standard | 6/8/10/12 hr by destination | ×1 | ×1 | ×1 | 5 / 10 / 15 health |
| Survey | Same fixed duration | ×1.25 | ×0.75 | ×1.5 | 7 / 14 / 21 health |
| Supply | Same fixed duration | ×1.25 | ×1.5 | ×0.75 | 8 / 16 / 24 health |

New journeys take 6/8/10/12 hours for Wellspring/Healing Meadow/High Pastures/Ancient Ruins; returning to Homeland takes 6 hours. Base rewards scale with hours, then easy/normal/hard multiplies by 1/1.5/2. Scouting reduces departure water/feed costs by at most 30%, never duration. Costs round up; final XP/materials round down. At most one regional item is awarded. [Exact table](LONG-JOURNEYS.md).

The v2.8.0 half-material formula remains for existing economy-2 departures. New journeys use economy-3 fixed-hour rewards; existing deadlines and rewards remain unchanged.

Example: easy Wellspring without scouting equipment takes **6 hours**: standard **18 water + 23 feed, 180 XP, 96 wood + 60 stone + 18 herbs**. Survey: **23 water + 29 feed, 270 XP, 72 wood + 45 stone + 13 herbs**. Supply: **23 water + 29 feed, 135 XP, 144 wood + 90 stone + 27 herbs**. Rewards assume storage space at arrival. Level-ups may restore health after fatigue.

### Story and arrival reports

Each region has different exploration and escort stories. Exploration follows guardians investigating tracks and passages; escorts follow the herd protected by crescent wolves and a star formation. Departure, trail and arrival stages follow server time, with plan-specific purpose. Narrative does not trigger additional combat, random loot or extra rewards.

The latest 20 reports retain mission type, region, difficulty, plan, party and actual credited rewards. This is a recent journal rather than an all-time achievement archive; older entries fall off at the limit. Unlocked regions persist separately. Closing the browser does not cancel the journey.

### Departure requirements

- Any ongoing battle or journey must finish.
- Exploration unlocks routes in order. Escorts need a discovered destination different from the herd's location.
- Easy/normal/hard require at least 1/2/3 guardians, each with at least 20 health.
- Escorts require at least 60 herd health.
- The selected plan's water/feed costs must be covered. Shortages round up and refresh as production arrives.

The readiness panel explains whether departure is available. Reward warnings estimate overflow against current storage and equipment limits. Production, spending or gifts can change balances during travel; the arrival report records actual credits. Storage warnings do not block departure; excess materials are not held as claimable rewards.

Explicit departure checks conditions on the server, deducts supplies once and saves the plan. Completion awards once. Production refreshes preserve controls and keyboard focus. Away guardians cannot train or change equipment.

For party preparation, v2.7.0 adds [guardian suggestions and arrival forecasts](ADVENTURE-PARTY.md).

### Older saves and preview

Existing missions without a plan remain **standard**, retaining their timing, costs and rewards. Old reports follow the same rule. New outings store the chosen plan and server-assigned `economyVersion: 3`. Existing active missions and reports without that marker validate against the old reward rules; clients cannot start a new journey using the old economy. Invalid plans or saved markers are rejected. No SQL table changes or new environment keys are required. Redeploy all four Dokploy services together, retaining data volumes.

The [offline journey preview](../preview/adventure.html) shows fictional plans, routes, stories, TR/EN and light/brown-dark themes. It uses no real account or server and cannot start missions. The [homepage index](../preview/index.html) is also available offline. Regenerate both with `npm run build:preview`.
