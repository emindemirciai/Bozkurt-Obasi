# Uzun seferler / Long journeys — v2.11.0

## Türkçe

Yeni keşif ve sürü sevkiyatları, kullanıcı isteğiyle gerçek sunucu zamanında 6–12 saate uzatıldı. Süre hedef bölgeden gelir; zorluk, plan, muhafız sayısı ve izci ekipmanı bu saati değiştirmez. Ana Yurt keşif hedefi değildir; başka bölgeden sürü sevkiyatıyla dönüş 6 saattir.

| Bölge | Süre | Kolay/standart XP / kurt | Odun | Taş | Ot |
| --- | --- | ---: | ---: | ---: | ---: |
| Su Gözü | 6 saat | 180 | 96 | 60 | 18 |
| Şifalı Çayır | 8 saat | 240 | 128 | 80 | 24 |
| Yüksek Otlak | 10 saat | 300 | 160 | 100 | 30 |
| Kadim Kalıntılar | 12 saat | 360 | 192 | 120 | 36 |
| Ana Yurt'a sevkiyatla dönüş | 6 saat | 180 | 96 | 60 | 18 |

Tablo, depoda yeterli yer bulunan kolay/standart görevler için toplam vaat edilen malzemeyi ve katılan **her kurdun** nominal XP'sini gösterir. Kaynaklar saatte bir dağıtılmaz; hepsi varışta bir kez işlenir. Su ve yem sefer ödülü değil, yola çıkış maliyetidir.

- Temel XP: saat × 30. Odun: saat × 16, taş: saat × 10, ot: saat × 3.
- Kolay/orta/zor ödül katsayısı: 1 / 1,5 / 2. Minimum muhafız sayısı 1 / 2 / 3 olarak kalır.
- Standart planda XP ve malzeme ×1. İz sürmede XP ×1,5, malzeme ×0,75. İkmalde XP ×0,75, malzeme ×1,5. Nihai ödüller aşağı yuvarlanır.
- Standart su/yem tarifeleri korunur; iz sürme ve ikmal bunları ×1,25 yapar. Seçili muhafızların ekipman izciliği yola çıkış maliyetini en çok %30 indirir; nihai maliyet yukarı yuvarlanır. İndirim süre veya XP bonusu değildir.
- Yorgunluk, ekipman türü ve en fazla bir eşya, kurtların 20. seviye/899 XP sınırı değişmez. Seviye atlama eğitim puanı, azami can ve mevcut kurallarla can yeniler.

Örnek: izci ekipmanı olmayan kolay Su Gözü keşfi standartta **6 saat, 18 su + 23 yem, 180 XP, 96 odun + 60 taş + 18 ot**. Aynı 6 saatte iz sürme **23 su + 29 yem, 270 XP, 72 odun + 45 taş + 13 ot**; ikmal **23 su + 29 yem, 135 XP, 144 odun + 90 taş + 27 ot** verir.

Sefer tarayıcı kapalıyken de ilerler. Varış motor tarafından ilk sonraki sunucu okumasında gerçek bitiş zamanıyla kaydedilir; tekrar sorgulamak ödülü çoğaltmaz. Üretimin 8 saatlik çevrimdışı üst sınırı korunur, bu sınır 10/12 saatlik seferi kısaltmaz veya engellemez. Sefer sürerken yeni savaş veya başka sefer açılamaz, seçili kurtlar eğitilemez/ekipman değiştiremez; oba yapıları ve kaynak yönetimi kullanılabilir.

**Depo:** 6–12 saatlik üretim boşluğu doldurabilir. Varış anında yalnızca depoya sığan miktar eklenir; taşan malzeme ayrı sandıkta beklemez. Yüksek zorluk ve ikmal için kapasiteyi artırmak veya varıştan önce malzeme harcamak gerekebilir. Hazırlık uyarısı mevcut boşluğa göre tahmindir; gerçek tutar dönüş raporundadır.

Başlamış eski seferler uzatılmaz ve ödülleri değiştirilmez: işaretsiz / 1 / 2 sürümlü kayıtlar aynı bitiş ve tarifeyle tamamlanır. Sunucu yeni görevleri `economyVersion: 3` olarak işaretler; istemci eski kısa süreyi seçemez. Eski geçmiş raporlar ve değiştirilmiş ekipmanla geri dönen yeni raporlar geçerli kalır. Yeni kayıt alanı, SQL tablo geçişi, servis veya ENV yoktur.

[Hazırlık ve planlar](ADVENTURE-PLANNING.md) · [Kadro gelişimi](ADVENTURE-PARTY.md) · [Çevrimdışı sefer önizlemesi](../preview/adventure.html). Bu denge kullanıcı isteğini uygular; gerçek oyuncularla ölçülmüş bir optimum olarak sunulmaz.

## English

New exploration and herd escorts now take 6–12 hours of authoritative server time, following the user's request. Destination sets the duration; difficulty, plan, party size and scouting equipment do not change it. Homeland cannot be explored; returning there by escort takes 6 hours.

| Region | Duration | Easy/standard XP / wolf | Wood | Stone | Herbs |
| --- | --- | ---: | ---: | ---: | ---: |
| Wellspring | 6 hours | 180 | 96 | 60 | 18 |
| Healing Meadow | 8 hours | 240 | 128 | 80 | 24 |
| High Pastures | 10 hours | 300 | 160 | 100 | 30 |
| Ancient Ruins | 12 hours | 360 | 192 | 120 | 36 |
| Escort returning to Homeland | 6 hours | 180 | 96 | 60 | 18 |

The table shows total promised material rewards with enough storage and nominal XP **per participating wolf** on easy/standard. Rewards are credited once on arrival, not paid hourly. Water/feed are departure costs rather than journey rewards.

- Base XP: hours × 30. Wood: hours × 16; stone: hours × 10; herbs: hours × 3.
- Easy/normal/hard reward multipliers: 1 / 1.5 / 2; party minima remain 1 / 2 / 3.
- Standard XP/materials ×1. Survey XP ×1.5, materials ×0.75; supply XP ×0.75, materials ×1.5. Final rewards round down.
- Existing base water/feed costs remain; survey/supply multiply them by 1.25. Worn scouting equipment reduces departure supplies by at most 30%, then final costs round up. It does not shorten travel or increase XP.
- Fatigue, regional item choice, the one-item limit and level-20/899-XP cap remain. Level-ups retain existing training-point and health effects.

Example: easy Wellspring with no scouting equipment takes **6 hours**, costing **18 water + 23 feed**, and gives **180 XP, 96 wood + 60 stone + 18 herbs** on standard. Survey takes the same 6 hours: **23 water + 29 feed, 270 XP, 72 wood + 45 stone + 13 herbs**. Supply: **23 water + 29 feed, 135 XP, 144 wood + 90 stone + 27 herbs**.

Journeys continue while the browser is closed. On the next server read after the deadline, the engine records the actual scheduled arrival and awards once. The existing eight-hour offline-production cap remains and does not cap or block 10/12-hour travel. New battles/journeys are unavailable until arrival, and selected wolves cannot train or change gear; village construction/resource management remain available.

**Storage:** passive production can fill it during 6–12 hours. Only resources fitting at arrival are credited; excess is not kept in a separate chest. Higher difficulty/supply runs may require upgraded storage or spending before arrival. Planning warnings estimate current free space; the arrival report records actual credits.

Existing departures retain their promised deadlines and rewards: unmarked/version-1/version-2 records finish unchanged. Only new server-created departures receive `economyVersion: 3`; clients cannot choose old short journeys. Existing history remains valid, including gear changes after newer arrivals. No new save field, SQL migration, service or environment variable.

[Preparation](ADVENTURE-PLANNING.md) · [Party progression](ADVENTURE-PARTY.md) · [Offline preview](../preview/adventure.html). This implements the requested tuning and is not claimed as an optimum measured with real players.
