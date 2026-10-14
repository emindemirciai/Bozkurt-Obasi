# Bozkurt Obası v2 · Oynanış / Gameplay

## Türkçe

### Obayı kendin kur

Yeni hesapların obası 36 boş parsel ve seviye 1 tahta çitle başlar. Başlangıç stoğu 450 odun, 350 taş, 180 su, 180 yem ve 80 ottur. **+** alanını seç, açılan menüden binayı seç: kaynak yalnızca bu son seçimde harcanır ve yapı seçtiğin parselde oluşur. Harita mobilde kendi içinde kaydırılır; sayfa genişlemez.

Oduncu, taş ocağı, kuyu, otlak ve şifa otağının her birinden en fazla altı tane yapılabilir. Bey otağı, depo, gözetleme kulesi ve sürü sığınağı birer tanedir. Kurulu binayı seçip **Binayı taşı** ile boş parsele ücretsiz taşı. **Yükselt** aynı binanın seviyesini artırır. Binalar 1–2, 3–4 ve 5. seviyelerde üç ayrı görsel kullanır. Sur beş seviyede tahta çitten güçlendirilmiş çite, taş sura ve kale suruna gelişir. Aktif çatışmada inşaat ve taşıma kapalıdır.

### Geçitte pusu

**Savaş meydanı** obanın dışındaki dağ geçididir. Üç bölüm başlığı dalgayla döner: Sisli Geçit, Kuru Dere ve Kızıl Sırt. **Yola çık** ile sürü yola girer; çakallar pusudan çıkar, kurtlar ve sürü seçilen formasyonlarına geçer, çatışma başlar. Varsayılan düzen kurtlarda hilal, sürüde yıldızdır. İlk altı saniye yürüyüş/pusu/diziliş içindir; hasar yedinci savaş adımında başlar. Çakal taktiği sunucuda rastgele seçilir. Azaltılmış hareket tercihinde geçiş animasyonları kapalıdır; hikâye ve sonuçlar aynı kalır.

### Keşif, sevkiyat ve ekipman

**Keşif ve sevkiyat** ekranında görev türü, bölge, zorluk ve katılacak kurtları seç. Kolay/normal/zor görevler en az 1/2/3 muhafız ister; seçilen her kurdun canı en az 20 olmalıdır. Aynı anda tek yolculuk yapılır. Yolculuk sürerken savaş başlatılamaz; görevdeki kurt eğitilemez veya ekipman değiştiremez. Diğer muhafızlar eğitilebilir.

| Bölge | Temel süre, kolay | Bulunan ekipman |
| --- | ---: | --- |
| Ana Yurt | 45 sn, dönüş sevkiyatı | Deri muhafız yeleği |
| Pınar | 60 sn | Deri muhafız yeleği |
| Çayır | 90 sn | İzci nişanı |
| Yayla | 120 sn | Demir boyun zırhı |
| Kadim Harabeler | 150 sn | Şifacı heybesi |

Keşif sırayla bir sonraki bölgeyi açar; tekrar keşif yapılabilir. Sevkiyat, sürüyü keşfedilmiş başka bir bölgeye taşır ve sürü canı en az 60 olmalıdır. Bölge bonusu varıştan sonra üretime uygulanır. Normal/zor, temel süre ve ödülleri 2/3 ile çarpar. İzci nişanları yolculuğu nişan başına %15, toplam en fazla %30 kısaltır.

Her yolculuğun çıkış, yol ve varış metni vardır. Görev sunucu saatine göre biter; ekranı veya tarayıcıyı açık tutmak gerekmez. Yalnızca seçilen kurtlar XP alır ve zorluğa göre 5/10/15 canlık yorgunluk yaşar. Seviye atlama can yenileyebilir. Odun, taş ve ot ödülü depo sınırına kadar eklenir; fazla kısım kaydedilmiş raporda ödül olarak gösterilmez. Her tamamlanan görev bir ekipman verir; eşya türü başına envanter sınırı 10.000'dir. Son 20 rapor saklanır. Bu sürümde görev ödülleri bölge/zorluğa göre sabittir; rastgele ganimet veya ayrı keşif çatışması yoktur.

Muhafız ekranındaki rol portreleri zırh/heybe ile ayrışır. Ekipman takmak envanterden bir adet alır, önceki parçayı geri verir. Deri yelek +3 savunma; demir zırh +2 saldırı/+6 savunma; izci nişanı +1 saldırı ve süre indirimi; şifacı heybesi +1 savunma/+3 iyileştirme sağlar. Bonuslar savaş hesabında kullanılır. Bir kurt aynı anda bir parça taşır.

### Arkadaşlarla iletişim

Oyuncu koduyla istek gönder ve arkadaşlığın kabulünü bekle. **Mesajlaş** konuşmayı açar; 1–1000 karakter düz metin gönderilir, önceki mesajlar sayfalanır. Açık konuşma beş saniyede bir yenilenir. Hediye menüsünden beş kaynak veya kuşanılmamış envanter ekipmanı seçilebilir. Tamsayı miktarı 1–10.000 aralığındadır; gönderen bakiyesi ve alıcı kapasitesi ayrıca denetlenir. Aynı isteğin tekrarında ikinci kesinti yapılmaz.

Arkadaşlığı kaldırınca konuşma ve transfer erişimi kapanır. Kayıtlar veritabanında kalır; yönetici hesabı tamamen sildiğinde o oyuncuya ait iki yönlü mesaj/hediye kayıtları da silinir. Yönetici işlem günlüğünde mesajın gönderildiği görülür, metni görülmez. Mesajlar uçtan uca şifreli değildir; sunucuda SQLite içinde saklanır.

### Dağıtım ve kayıt geçişi

Oyun kaydı `version: 2` kullanır. `shared/legacy-v1.mjs` önceki sürümün doğrulama kurallarını sabit tutar; yalnızca geçerli v1 kayıtları kopyalanarak taşınır. Kaynaklar, bina konum/seviyeleri, görevler, kurtlar, savaş ve devam eden eski yolculuk korunur. Yeni sur/envanter/keşif alanları eklenir. Bozuk kayıt sessizce boş köyle değiştirilmez. API'de yeni `build` isteği `plotId` ister; eski `travel` yerine seçilmiş `wolfIds` ile `caravan` kullanılır.

Yeni ortam değişkeni veya servis gerekmez. Dokploy'da mevcut veri volume'larını koruyup dört servisi birlikte yeniden dağıtın. [Köy önizlemesi](../preview/village.html), [savaş önizlemesi](../preview/battle.html) ve [ana sayfa index](../preview/index.html) internet olmadan açılır; oyuncu hesabını değiştirmez.

## English

### Build your own village

New accounts start with 36 empty plots, level-one timber fencing and 450 wood, 350 stone, 180 water, 180 feed and 80 herbs. Choose a map **+**, then a building. Only the final choice spends resources and it uses that exact plot. The map scrolls within its own area on narrow screens.

Each producer type (lumber, quarry, well, pasture, healer) supports six copies. Hall, warehouse, watchtower and shelter are unique. Select a placed building and **Move building** to relocate it freely; upgrades improve that instance. Buildings have five levels and three visual tiers (1–2, 3–4, 5). Walls progress from timber fencing through reinforced palisades and stone to castle ramparts. Active combat blocks construction and relocation.

### Trail, ambush and formations

The **Battlefield** is a separate mountain pass. Three chapter titles rotate with waves: Misty Pass, Dry Creek and Red Ridge. **Take the trail** starts the march, surprise jackal ambush, formation deployment and combat. Defaults are crescent wolves and a star-shaped herd. The first six ticks are narrative deployment; damage begins at tick seven. The server randomly chooses a jackal tactic. Reduced-motion settings disable transitions without changing the story or results.

### Exploration and herd escorts

Select mission type, region, difficulty and guardians. Easy/normal/hard require at least one/two/three wolves with 20 or more health. Only one journey runs at a time. Battles wait for its return; away guardians cannot train or change equipment. Exploration unlocks the next region in order; it can be repeated. An escort moves the herd to another discovered region and requires 60 herd health. Destination production bonuses apply after arrival.

Easy base times are Homeland return 45s, Spring 60s, Meadow 90s, Highlands 120s and Ancient Ruins 150s. Normal/hard multiply time and rewards by two/three. Scout insignia reduce travel time by 15% each, capped at 30%. Every journey has departure, mid-route and arrival text. Server time governs completion, including offline time. Only selected wolves earn XP and suffer 5/10/15 travel fatigue; leveling may restore health. Wood, stone and herb rewards respect warehouse limits. Each completed journey yields one regional equipment item unless its 10,000-item inventory limit is full. The last 20 reports show actual credited rewards. Rewards are fixed by region/difficulty in this version; there is no random loot roll or separate expedition combat.

Role portraits distinguish armored guardians and equipped scouts/healers. A wolf can wear one inventory item: leather vest +3 defense; iron guard +2 attack/+6 defense; scout insignia +1 attack and travel reduction; healer satchel +1 defense/+3 healing. Swapping returns the old item to inventory. Bonuses affect combat calculations.

### Messages and gifts

Accepted friends can exchange plain-text messages of 1–1,000 characters and page through history. An open conversation refreshes every five seconds. Gift any of the five materials or unequipped inventory items, using integer quantities 1–10,000. Server transactions validate sender balance, recipient capacity and save revision; retrying the same request never deducts twice.

Removing a friendship blocks conversation and transfer access. Records remain until deletion; permanently deleting a player also removes that player's incoming/outgoing message and gift records. Administrator audit logs record the send action without the message text. Messages are stored in server SQLite and are not end-to-end encrypted.

### Save migration and deployment

Schema version 2 clones and upgrades validated v1 saves while retaining positions, levels, balances, guardians, quests, battle state and pending old journeys. Frozen validation in `shared/legacy-v1.mjs` prevents future rules from invalidating legitimate old saves. Invalid records are never silently replaced by a new village. New `build` commands require `plotId`; replace legacy `travel` with `caravan` and explicit `wolfIds`.

No new environment variables or services are required. Redeploy all four Dokploy services together while retaining existing data volumes. The standalone [village](../preview/village.html), [battlefield](../preview/battle.html) and [homepage](../preview/index.html) previews work offline and cannot change player accounts.
