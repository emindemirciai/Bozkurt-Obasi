# Kaynak dengesi / Resource balance — v2.8.0

## Türkçe

Amaç, sürekli gelen kaynakları azaltarak inşaat ve sefer seçimlerini daha önemli hale getirmek. Bu ayar kullanıcı isteği üzerine yapılmıştır; gerçek oyuncu oturumlarıyla henüz ölçülmüş bir zorluk hedefi değildir.

| Tekrarlanan kaynak | Önce | v2.8.0 |
| --- | --- | --- |
| Oduncu, seviye başına / dakika | 12 odun | 6 odun |
| Taş ocağı, seviye başına / dakika | 9 taş | 4,5 taş |
| Su kuyusu, seviye başına / dakika | 14 su | 7 su |
| Otlak, seviye başına / dakika | 12 yem | 6 yem |
| Şifacı, seviye başına / dakika | 6 ot | 3 ot |
| Kaynak topla | 14 odun + 9 taş + 8 su + 8 yem / 8 sn | 7 odun + 4 taş + 4 su + 4 yem / 20 sn |
| Savaş zaferi | Eski dalga ödülü | Her malzemenin yarısı, aşağı yuvarlanır |
| Yeni keşif / sevkiyat | Bölge × zorluk × plan malzemeleri | Aynı hesabın yarısı, aşağı yuvarlanır |

Üretim kesirli ilerler ve bölge bonusları geçerlidir. Örneğin Yüksek Otlak'ta 1. seviye taş ocağı 4,5 × 1,5 = **6,75 taş/dakika** üretir. Üçüncü dalga zaferi **37 odun + 24 taş + 6 ot + 10 yem** verir; her kurt hâlâ 50 XP alır. Yeni kolay Su Gözü standart keşfi **16 odun + 10 taş + 3 ot** ve katılan kurt başına 30 XP verir. Depoda yer yoksa mevcut taşma kuralları uygulanır; panel gerçek kazanımı gösterir.

Mevcut malzemeler, başlangıç erzağı, inşaat/yükseltme tarifeleri, çevrimdışı üretim süresi sınırı, kurt XP'si, ekipman, görev süreleri ve erzak maliyetleri değişmez. İlk Nöbet ve önceki görevlerin tek seferlik ödülleri aynı kalır. Eski toplama bekleme zamanları dolana kadar korunur; sonraki toplama 20 saniyelik yeni beklemeyi başlatır.

Başlamış keşif/sevkiyatlar **önceden vaat edilen ödüllerle** biter. Eski dönüş raporları geçerliliğini korur. Sunucu yalnızca yeni görevleri yeni ekonomi işaretiyle kaydeder; istemci eski ödül kuralını seçemez. Köy sıfırlaması, SQL tablo değişikliği, yeni servis veya ENV gerekmez.

Bina kaldırmanın %50 iadesi gelir indirimi değildir: [inşaat ve tüm yükseltmelerin maliyet toplamından](DEMOLITION.md) hesaplanır. Alıp kaldırmak kâr oluşturmaz. [Köy planlaması](VILLAGE-PLANNING.md) · [Sefer örnekleri](ADVENTURE-PLANNING.md) · [Çevrimdışı index](../preview/index.html).

## English

Repeatable materials are reduced so construction and journey choices carry more weight. This tuning follows the user's request; it has not yet been calibrated against observed player sessions.

| Repeatable source | Before | v2.8.0 |
| --- | --- | --- |
| Lumber camp, per level / minute | 12 wood | 6 wood |
| Quarry, per level / minute | 9 stone | 4.5 stone |
| Well, per level / minute | 14 water | 7 water |
| Pasture, per level / minute | 12 feed | 6 feed |
| Healer, per level / minute | 6 herbs | 3 herbs |
| Gather resources | 14 wood + 9 stone + 8 water + 8 feed / 8s | 7 wood + 4 stone + 4 water + 4 feed / 20s |
| Battle victory | Previous wave loot | Half of each material, rounded down |
| New expedition / escort | Region × difficulty × plan materials | Half that calculation, rounded down |

Production retains fractional progress and region bonuses. A level-1 Highlands quarry produces 4.5 × 1.5 = **6.75 stone/minute**. A wave-3 victory grants **37 wood + 24 stone + 6 herbs + 10 feed**; each guardian still receives 50 XP. A new easy standard Wellspring expedition grants **16 wood + 10 stone + 3 herbs**, plus 30 XP per participant. Existing storage-overflow rules apply and reports show actual credits.

Existing balances, starter resources, construction/upgrade recipes, offline-production time caps, guardian XP, equipment, journey duration and supply costs remain. First Watch and earlier one-time quest rewards remain. Saved gathering deadlines are honored; the next gather starts the new 20-second cooldown.

Ongoing expeditions/escorts complete with **their previously promised rewards**. Older arrival reports remain valid. Only new journeys receive the server-assigned current-economy marker; clients cannot choose old rewards. No village reset, SQL table migration, new service or environment variable is required.

A building's 50% demolition refund is separate from income balancing: it uses [base construction plus all upgrade recipes](DEMOLITION.md). Buying and removing a structure cannot generate profit. [Village planning](VILLAGE-PLANNING.md) · [Journey examples](ADVENTURE-PLANNING.md) · [Offline index](../preview/index.html).
