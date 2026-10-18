# Sefer hazırlığı ve bölge hikâyeleri / Adventure planning and regional stories

## Türkçe

**Keşif ve sevkiyat → Bozkırın yolları** ekranındaki bölge kartları keşif sırasını gösterir. Ana Yurt, Su Gözü, Şifalı Çayır, Yüksek Otlak ve Kadim Kalıntılar için bulunduğun, keşfettiğin, sırada keşfedebileceğin ve kilitli rotaları ayırt edebilirsin. Bir kart veya seçici yalnızca planı değiştirir; kaynak harcamaz ve sefer başlatmaz. Görev sürerken rota, plan ve muhafız seçimi kilitlenir.

### v2.6.0 — Üç görev planı

Görev türünü (keşif/sevkiyat), hedefi, zorluğu, planı ve muhafızları seç. Planlar aynı bölgenin farklı amaçlarla tekrar ziyaret edilmesini sağlar. Kartlardaki kesin değerler seçili zorluk ve kurtların ekipmanına göre hesaplanır:

| Plan | Süre ve su/yem maliyeti | Odun/taş/ot ödülü | Katılan her kurdun XP'si | Kolay/orta/zor yorgunluk |
| --- | --- | --- | --- | --- |
| Dengeli nöbet (standart) | Temel değerler | %100 | %100 | 5 / 10 / 15 can |
| İz sürme | %125 | %75 | %150 | 7 / 14 / 21 can |
| İkmal | %125 | %150 | %75 | 8 / 16 / 24 can |

Yüzdeler aynı bölge, zorluk ve ekipmandaki standart göreve göre temel katsayılardır. Maliyetler ve nihai süre yukarı; kaynak ve XP ödülleri aşağı yuvarlanır. Süre, zorluk, seçili kurtların toplam izcilik indirimi (en fazla %30) ve plan katsayısı uygulandıktan sonra tek kez yuvarlanır. Her planda bölgenin aynı ekipmanından en fazla bir adet gelir; minimum muhafız ve bölge açma koşulları değişmez.

v2.8.0 ile yeni seferlerin malzeme tabanı yarıya indirildi; XP, süre, erzak ve ekipman değişmez. Önceden başlamış seferler eski vaat edilen ödülleri korur.

Örnek: kolay Su Gözü keşfi, izci ekipmanı olmayan bir muhafızla standart planda **18 su + 23 yem, 60 sn, 30 XP, 16 odun + 10 taş + 3 ot** verir. İz sürme **23 su + 29 yem, 75 sn, 45 XP, 12 odun + 7 taş + 2 ot**; ikmal **23 su + 29 yem, 75 sn, 22 XP, 24 odun + 15 taş + 5 ot** olur. Kazançlar depoda yer olduğu varsayımıyladır. Yorgunluk önce uygulanır; seviye atlama ardından can yenileyebilir.

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

Önceki sürümde başlatılmış ve plan alanı olmayan görevler **standart** kabul edilir: bitiş zamanı, maliyet ve ödül değişmez. Aynı kural eski dönüş raporları için geçerlidir. Yeni kayıtlar seçili planı ve sunucunun atadığı `economyVersion: 2` işaretini taşır. Bu işareti olmayan eski aktif görevler ve geçmiş raporlar önceki ödül hesabıyla doğrulanır; istemci yeni görevi eski ekonomiden başlatamaz. Geçersiz plan veya kayıt işareti reddedilir. SQL tablo değişikliği veya yeni ENV anahtarı gerekmez. Dokploy'da mevcut volume'ları koruyarak dört servisi birlikte dağıtın.

[Çevrimdışı sefer önizlemesi](../preview/adventure.html) örnek durumlarla planları, rotaları, hikâyeyi, TR/EN ve açık/kahverengi koyu temayı gösterir. Gerçek hesaba veya sunucuya bağlanmaz; sefer başlatma kapalıdır. Ana sayfa için [index.html](../preview/index.html). Her ikisi de `npm run build:preview` ile yenilenir.

## English

Region cards in **Exploration and escorts → Trails of the steppe** show Homeland, Wellspring, Healing Meadow, High Pastures and Ancient Ruins. They distinguish the current location, discovered destinations, the next discoverable region and locked routes. Selecting a card or control changes the plan without spending resources or starting a mission. Route, plan and party selection lock during a journey.

### v2.6.0 — Three mission plans

Choose exploration or escort, destination, difficulty, mission plan and guardians. Plans give repeat visits different purposes. Cards show concrete values for the selected difficulty and equipment:

| Plan | Time and water/feed costs | Wood/stone/herb rewards | XP per participating wolf | Easy/normal/hard fatigue |
| --- | --- | --- | --- | --- |
| Balanced watch (standard) | Base values | 100% | 100% | 5 / 10 / 15 health |
| Trail reading (survey) | 125% | 75% | 150% | 7 / 14 / 21 health |
| Supply run | 125% | 150% | 75% | 8 / 16 / 24 health |

Percentages are base multipliers relative to the standard mission in the same region, difficulty and equipment. Costs and final duration round up; resources and XP round down. Duration rounds once after difficulty, selected guardians' combined scouting discount (up to 30%) and plan multiplier. All plans award at most one of the region's equipment item; party requirements and region unlock rules stay unchanged.

From v2.8.0, new journeys halve the material baseline; XP, duration, supplies and equipment remain. Already active journeys retain their promised old rewards.

Example: an easy Wellspring expedition with one guardian and no scouting equipment costs **18 water + 23 feed, takes 60s and yields 30 XP, 16 wood + 10 stone + 3 herbs** on standard. Survey: **23 water + 29 feed, 75s, 45 XP, 12 wood + 7 stone + 2 herbs**. Supply: **23 water + 29 feed, 75s, 22 XP, 24 wood + 15 stone + 5 herbs**. Rewards assume sufficient storage. Fatigue applies before XP; leveling can then restore health.

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

Existing missions without a plan remain **standard**, retaining their timing, costs and rewards. Old reports follow the same rule. New outings store the chosen plan and server-assigned `economyVersion: 2`. Existing active missions and reports without that marker validate against the old reward rules; clients cannot start a new journey using the old economy. Invalid plans or saved markers are rejected. No SQL table changes or new environment keys are required. Redeploy all four Dokploy services together, retaining data volumes.

The [offline journey preview](../preview/adventure.html) shows fictional plans, routes, stories, TR/EN and light/brown-dark themes. It uses no real account or server and cannot start missions. The [homepage index](../preview/index.html) is also available offline. Regenerate both with `npm run build:preview`.
