# Kaynak ve depo dengesi / Resource and storage balance

## Türkçe

### v2.15.0 — Genişleyen depo, aktif toplama

Her kaynak için temel kapasite **1.000**. Tek depo binası beş seviyeye geliştirilir; aşağıdaki değerler Bey Otağı katkısı hariç toplam kapasitedir. Bey Otağı 1. seviyeden sonraki her seviyede +100 ekler; en yüksek kapasite **5.000.400** olur.

| Depo seviyesi | Toplam kapasite | Sonraki seviyenin odun / taş maliyeti |
| --- | ---: | ---: |
| Henüz kurulmadı | 1.000 | 80 / 55 |
| 1 | 10.000 | 124 / 86 |
| 2 | 50.000 | 193 / 133 |
| 3 | 250.000 | 298 / 205 |
| 4 | 1.000.000 | 462 / 318 |
| 5 | 5.000.000 | Son seviye |

İnşa/yükseltme tarifeleri değişmez. Eski geçerli kapasite önce doğrulanır, sonra aynı binalarla yeni kapasite hesaplanır; eldeki malzemeler, seviyeler, köy düzeni ve görev kayıtları korunur. Depo kaldırılınca kapasite azalır; kalan kaynaklar ve %50 iade sığmıyorsa işlem engellenir, kaynak silinmez. [Kaldırma](DEMOLITION.md).

Pasif üretim önceki sürüme göre **%90 daha yavaş**; aşağıdaki değerler tek bina seviyesi içindir. Birden çok üretici ve yükseltmeler katkıları toplar; bölge bonusları korunur.

| Kaynak | Dakikada | Saatte |
| --- | ---: | ---: |
| Odun | 0,6 | 36 |
| Taş | 0,45 | 27 |
| Su | 0,7 | 42 |
| Yem | 0,6 | 36 |
| Şifalı ot | 0,3 | 18 |

Toplama ücretsiz, açık oyuncu eylemidir. Sunucu yalnızca seçilen işin sabit kazanımını verir. Bütün seçenekler ortak **90 saniye** bekler; kaynak değiştirmek veya sayfayı yenilemek beklemeyi kaldırmaz. Eski kaydedilmiş bekleme önce dolar. Yeni işlemden sonra 90 saniye uygulanır. Otomatik tekrar veya arka planda toplama yoktur.

| İş | Her başarılı işlemde kazanım |
| --- | --- |
| Karma toplama | 3 odun + 2 taş + 2 su + 2 yem |
| Odun kes | 10 odun |
| Taş çıkar | 7 taş |
| Su taşı | 8 su |
| Ot biç | 8 yem |
| Şifalı ot topla | 2 şifalı ot |

Kazanım mevcut depo boşluğuyla sınırlıdır. İşin hiçbir kaynağına yer yoksa işlem bekleme veya görev ilerlemesi başlatmaz. Sıfır kaynakla bile ücretsiz toplama yapılarak yeniden ilerlenebilir. Temel stoklar 450 odun, 350 taş, 180 su, 180 yem ve 80 ottur; beş üretici ile depo kurulabilir. Aktif toplama, savaş, İlk Nöbet ve diğer tek seferlik görevler, keşif ve sevkiyat ilerlemeyi destekler. Ekranda pasif gelir ile oyuncunun başlattığı işler ayrı açıklanır.

Çevrimdışı üretim hesabında en fazla **8 saat** korunur. Tek 1. seviye oduncu 8 saatte 288 odun üretir; altı 5. seviye oduncu 8 saatte 8.640 üretir. 5.000.000 kapasiteli boş depo bu süre içinde yalnızca bu üretimle dolmaz. Zorluk gerçek oyuncu verileriyle henüz ölçülmedi; bu sayılar kullanıcının daha yavaş ve aktif oyun isteği için belirlenmiştir.

### Uzun seferler ve diğer ödüller

Yeni seferler v2.11.0 kuralıyla **6/8/10/12 saat** sürer. Kolay/standart saat başına 30 XP, 16 odun, 10 taş ve 3 ot; zorluk 1/1,5/2 ve plan katsayıları uygulanır. İzcilik erzak indirir, süreyi değiştirmez. Su Gözü 6 saatlik kolay standart keşfi 180 XP, 96 odun, 60 taş ve 18 ot verir. Başlamış eski seferlerin süre ve ödül vaatleri korunur. [Uzun seferler](LONG-JOURNEYS.md).

Savaş malzeme ödülleri v2.8.0 oranını korur: üçüncü dalga 37 odun, 24 taş, 6 ot, 10 yem; katılan her kurt 50 XP kazanır. İlk Nöbet ve önceki görev ödülleri bir kez alınır. Bu sürüm yeni ENV, servis, SQL tablo alanı veya kayıt sıfırlaması gerektirmez. [Köy planlaması](VILLAGE-PLANNING.md) · [Görsel önizleme](../preview/village.html).

## English

### v2.15.0 — Expandable storage and active gathering

Base capacity is **1,000 per resource**. One storage building upgrades through five levels. Totals below exclude the hall bonus: each hall upgrade beyond level 1 adds 100, for a maximum **5,000,400** capacity.

| Storage level | Total capacity | Next level wood / stone cost |
| --- | ---: | ---: |
| Not built | 1,000 | 80 / 55 |
| 1 | 10,000 | 124 / 86 |
| 2 | 50,000 | 193 / 133 |
| 3 | 250,000 | 298 / 205 |
| 4 | 1,000,000 | 462 / 318 |
| 5 | 5,000,000 | Maximum |

Construction and upgrade recipes remain unchanged. Migration first validates the previous capacity, then recalculates it from the same buildings; balances, levels, layout and journey records remain. Demolishing storage reduces capacity; if remaining resources and the 50% refund cannot fit, removal is blocked without discarding resources. [Demolition](DEMOLITION.md).

Passive output is **90% slower than the previous release**. The figures below are per building level; multiple producers and upgrades add their output, and region bonuses remain.

| Resource | Per minute | Per hour |
| --- | ---: | ---: |
| Wood | 0.6 | 36 |
| Stone | 0.45 | 27 |
| Water | 0.7 | 42 |
| Feed | 0.6 | 36 |
| Herbs | 0.3 | 18 |

Gathering is free and explicitly initiated by the player. The server grants only the selected job's fixed reward. Every option shares a **90-second** cooldown; changing jobs or reloading cannot bypass it. Saved older deadlines are honored before the next successful action starts 90 seconds. No automatic repetition or background collection runs.

| Job | Reward per successful action |
| --- | --- |
| Mixed gathering | 3 wood + 2 stone + 2 water + 2 feed |
| Logging | 10 wood |
| Quarrying | 7 stone |
| Water hauling | 8 water |
| Feed gathering | 8 feed |
| Herb foraging | 2 herbs |

Rewards respect available storage. If none of a job's rewards fit, it starts neither a cooldown nor quest progress. Free gathering allows recovery even from zero resources. Starter supplies remain 450 wood, 350 stone, 180 water, 180 feed and 80 herbs, sufficient for five producers and storage. Gathering, battles, one-time story quests, expeditions and escorts support active progression; the interface distinguishes passive income from player actions.

Offline production remains capped at **8 hours**. One level-1 lumber camp produces 288 wood in eight hours; six level-5 camps produce 8,640, insufficient to fill an empty 5,000,000 store in that time. These numbers implement the requested slower, more active economy; they have not been calibrated against live player sessions.

### Long journeys and other rewards

New journeys retain the v2.11.0 **6/8/10/12-hour** rules. Easy/standard rewards per hour: 30 XP, 16 wood, 10 stone and 3 herbs, multiplied by difficulty 1/1.5/2 and purpose. Scouting discounts supplies without shortening time. A six-hour easy standard Wellspring expedition yields 180 XP, 96 wood, 60 stone and 18 herbs. Existing journeys keep their promised durations and rewards. [Long journeys](LONG-JOURNEYS.md).

Battle loot retains its v2.8.0 rate: wave three gives 37 wood, 24 stone, 6 herbs and 10 feed; each guardian receives 50 XP. First Watch and earlier quest rewards remain one-time claims. No new environment variable, service, SQL column or village reset is required. [Village planning](VILLAGE-PLANNING.md) · [Visual preview](../preview/village.html).
