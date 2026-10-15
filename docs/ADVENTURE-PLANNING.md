# Sefer hazırlığı / Adventure preparation

## Türkçe

**Keşif ve sevkiyat → Bozkırın yolları** ekranındaki bölge kartları keşif sırasını gösterir. Ana Yurt, Su Gözü, Şifalı Çayır, Yüksek Otlak ve Kadim Kalıntılar için bulunduğun, keşfettiğin, sırada keşfedebileceğin ve kilitli rotaları ayırt edebilirsin. Bir kart veya bölge seçicisi yalnızca planı değiştirir; kaynak harcamaz ve sefer başlatmaz. Görev sürerken rota ve muhafız seçimi kilitlenir.

Hazırlık paneli **Seferi başlat** düğmesinin neden açık veya kapalı olduğunu gösterir:

- Devam eden savaş veya başka yolculuk bitmiş olmalı.
- Keşif sırayla ilerler. Sevkiyat keşfedilmiş ve sürünün bulunduğundan farklı bir bölgeye yapılır.
- Kolay/orta/zor için en az 1/2/3 muhafız gerekir. Her seçilen kurdun canı en az 20 olmalı.
- Sevkiyatta sürünün canı en az 60 olmalı.
- Su ve yem masrafı karşılanmalı. Eksik miktarlar yukarı yuvarlanarak gösterilir; kaynak üretimi geldikçe güncellenir.

Zorluk mevcut sunucu kurallarına göre maliyet, süre, XP, ödül ve yorgunluğu değiştirir. Seçili kurtların izci ekipmanı süreyi kısaltır; ödülü değiştirmez. Görev sonunda her katılan kurt kolay/orta/zorda 5/10/15 can yorgunluğu alır; seviye atlama can yenileyebilir. Kazanım paneli mevcut depo boşluğuna göre sığmayabilecek malzemeyi ve dolu ekipman envanterini belirtir. Bunlar **tahmindir**: yolculuk boyunca üretim, harcama veya hediye bakiyeleri değiştirebilir. Kesin kazanım varış raporunda görünür. Depo uyarısı yola çıkmayı engellemez.

Hazırlık görünümü kayıt değiştirmez. Başlat düğmesine açıkça basıldığında mevcut API bütün koşulları tekrar denetler; kaynakları bir kez düşer ve görevi kaydeder. Üretim güncellemeleri seçimleri ve klavye odağını korur. Aynı kayıt biçimi, maliyetler ve bölge açma kuralları devam eder.

[`preview/adventure.html`](../preview/adventure.html) tek dosyalık, internetsiz görsel önizlemedir. Örnek durumlarda rota, zorluk, kurtlar, TR/EN ve açık/koyu tema denenebilir. Sefer başlatma kapalıdır; hesap, sunucu, gerçek köy veya analiz bağlantısı yoktur. `npm run build:preview` bütün önizlemelerle birlikte bu dosyayı üretir.

## English

The region cards in **Exploration and escorts → Trails of the steppe** show progression through Homeland, Wellspring, Healing Meadow, High Pastures and Ancient Ruins. They distinguish the current location, discovered destinations, the next discoverable region and locked routes. Selecting a card or dropdown only changes the plan; it spends nothing and starts no mission. Route and party selection remain locked during a journey.

The readiness panel explains whether **Begin journey** is available:

- Any ongoing battle or journey must finish.
- Exploration unlocks routes in order. Escorts need a discovered destination different from the herd's current location.
- Easy/normal/hard require at least 1/2/3 guardians, each with at least 20 health.
- Escorts require at least 60 herd health.
- Water and feed costs must be covered. Shortages round up and refresh as production arrives.

Difficulty affects costs, duration, XP, rewards and fatigue under existing server rules. Scout equipment worn by selected guardians shortens duration without changing rewards. Each participant loses 5/10/15 health to travel fatigue on easy/normal/hard; leveling may restore health. The reward panel warns when supplies may exceed the current free storage or the equipment inventory is full. These are **estimates**: production, spending and gifts can change balances during travel. The arrival report gives actual credited rewards. Storage warnings do not block departure.

Planning never mutates the save. Explicit departure uses the existing API, which checks all conditions again, deducts supplies once and saves the journey. Production refreshes preserve choices and keyboard focus. Save format, costs and region unlock rules are unchanged.

[`preview/adventure.html`](../preview/adventure.html) is a standalone offline visual preview with fictional scenarios. Try routes, difficulty, guardians, TR/EN and light/dark themes. Starting missions is disabled; no account, server, real village or analytics connection is used. `npm run build:preview` generates it with the other previews.
