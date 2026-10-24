# Oba planlaması / Village planning

## Türkçe

**v2.17.0 Oba Hedefi:** Seçili inşa/yükseltme adımını bu cihazda oyuncuya göre sabitle; eksik malzemeleri ve 8 saat sınırına uyan yokluk öngörüsünü izle. Hedef tamamlandığında aynı seviye/adette kalır. [Hedef rehberi](VILLAGE-GOALS.md).

v2.16.0 bütün gelişim maliyetlerini kademelendirdi. Ek yapı kopyaları pahalanır; planlayıcı güncel inşa sırasını, gerçek bedeli ve kapasite engelini kullanır. Yıkımdan depoya sığmayan pay bekleyen iadede saklanır; **Bekleyen iadeyi al** ile boşluk kadarını aktar. [Tüm maliyetler](ECONOMY.md).

v2.15.0 depo paneli kapasitenin nasıl genişletildiğini gösterir: temel 1.000, depo seviyeleriyle 10.000/50.000/250.000/1.000.000/5.000.000 ve ayrıca Bey Otağı katkısı. **Depoyu genişlet**, maliyeti olan mevcut inşa/yükseltme planına yönlendirir. Toplama işini seçip açıkça başlat; bütün işler ortak 90 saniye bekler. Seçim otomatik kaynak vermez. [Güncel miktarlar](ECONOMY.md).

Ana yurt ekranındaki **Oba planlaması** paneli beş kaynağın mevcut miktarını, depo sınırını, dakikalık üretimini ve deponun tahmini dolma süresini gösterir. Mevcut bölge bonusları hesaba katılır; örneğin Yayla'da taş üretimi 1,5 katına çıkar. Üretimi olmayan ve deposu dolu kaynaklar ayrı belirtilir.

Dokuz yapı türünden birini seçerek yeni yapının veya mevcut yapının sonraki seviyesinin maliyetini inceleyebilirsin. Aynı türden birden fazla binan varsa parsel numarası ve seviyesinden istediğin kopyayı seç. Yeni bina hedefi ayrı gösterilir; ilk kopyanın son seviyede olması diğer kopyaların gelişimini engellemez. Tür sınırı dolduğunda veya o yapı türüne uygun boş yer kalmadığında yeni bina planı bunu açıklar. Gözcü kulesi planı yalnızca dört ayrılmış sur köşesini, diğer yapı planları yalnızca 36 normal parseli değerlendirir. Panel her kaynak için mevcut/gerekli miktarı, eksik miktarı ve mevcut üretimle bekleme süresini gösterir. Eksik kaynak üretilmiyorsa toplama veya üretici yapı önerilir. Maliyet depo sınırını aşıyorsa yalnızca beklemek yeterli değildir. Son seviyeye ulaşan yapı yükseltilemez.

Hedef seçmek kaynak harcamaz. **Yer seç** haritada hedef yapıya uygun boş bir yere odaklanır: kule için ayrılmış köşe, diğer yapılar için normal parsel. Bir **+** alanı ve ardından bina seçildiğinde yapı tam o konuma kurulur. **Yükselt** mevcut binayı geliştirir. Aktif savaş, kaynak eksikliği ve son seviye durumlarında düğme kapalıdır; sunucu kaynakları ve kayıt revizyonunu ayrıca doğrular. Kaynaklar güncellenirken seçim ve klavye odağı korunur. Hesaptan çıkıldığında plan seçimi sıfırlanır.

Süreler mevcut üretimin sabit kalacağını varsayan tahminlerdir. Toplama, harcama, savaş ödülleri, yeni yapılar ve yolculukta bölge değişimi bu süreleri değiştirebilir. Otomatik inşaat kuyruğu veya yapım süresi eklenmez; eski v1/v2 köy kayıtları kayıpsız v3 biçimine taşınır.

### Sabit Ana Yurt haritası

Harita alanının içinde kaydırma çubuğu yoktur; ilk görünüm bütün arsaları sığdırır. **+ / −** gerçek yakınlaştırma yapar (1×–2,5×); hedef düğmesi kamerayı ortalar ve 1× görünümüne döndürür. Yakınken sürükleyerek, iki parmakla veya harita odağındayken ok tuşlarıyla gez. Home başlangıç görünümünü geri getirir. Klavyeyle görünmeyen bir arsaya odaklanmak kamerayı o konuma getirir. Bu hareketler bina yerini, kaynakları veya kaydı değiştirmez.

Açık/yağmurlu hava, bulut, bozkır tozu ve küçük şelale suyu **dekoratiftir**; üretim ve savaş hesabına etkisi yoktur. Hava ve hareket düğmeleriyle görünümü değiştirebilirsin. Sistem hareket azaltmayı istiyorsa animasyonlar durur. Kamera ve hava tercihleri yalnızca açık ekranın yerel görünümüdür; gerçek hava durumu servisine bağlanılmaz. Çevrimdışı köy önizlemesinde de aynı kontroller çalışır.

### Yapı listesi ve kaynak açıklamaları

**Seviye 1 · Arsa 32**, binanın 1. seviyede ve haritadaki 32. arsada olduğunu söyler; 32 üretim veya yükseltme maliyeti değildir. Kaynak maliyetleri adlarıyla görünür. Kaynağın üzerine gelince veya klavyeyle odaklanınca mevcut/gerekli miktar açıklanır; dokunmatik kullanımda kaynak adı ve maliyet zaten okunabilir. Güncel üretim ve toplama değerleri [kaynak dengesi rehberinde](ECONOMY.md).

### Bina kaldırma

Seçili bina, %50 inşaat/yükseltme malzemesi iadesi gösteren açık onay penceresiyle kaldırılır. Depo kapasitesi, savaş/yolculuk ve değişmiş bina korumaları [kaldırma rehberinde](DEMOLITION.md).

### Yenilgi sonrası sürü takviyesi

**Sürü takviyesi** paneli mevcut hayvan sayısını, 24 hayvan sınırını, eksik sayıyı ve seçtiğin miktarın kaynak maliyetini gösterir. Kurulu en az bir **Otlak** gerekir; seviyesi maliyeti değiştirmez. Bir seferde 1–5 hayvan alınabilir ve miktar eksik hayvan sayısını aşamaz. Her hayvan **30 su + 60 yem** ister. Miktarı değiştirmek kaynak harcamaz; takviye düğmesi açık onaydır.

Aktif savaş veya devam eden keşif/sevkiyat sırasında takviye kapalıdır. Eski kayıtlardan taşınmış bir yolculuğun da bitmesi gerekir. Otlağın yoksa, sürü zaten 24 ise veya kaynak yetersizse panel nedeni gösterir. Sunucu tüm koşulları yeniden doğrular; başarısız istekte takviye için kaynak kesilmez ve hayvan eklenmez. Yeni hayvan başına hem mevcut hem azami can 10 artar; önceki yaralar ve panik aynı kalır. Muhafız canı, XP, eğitim puanları ve ekipmanı değişmez. Kalan hayvanların yaraları için mevcut tedavi/dinlenme seçenekleri kullanılır.

Sürü takviyesi ek veri alanı gerektirmez; v2.16.0 genel kayıt geçişi v3 biçimini kullanır. [Geçiş rehberi](ECONOMY.md). Yeni ortam değişkeni veya servis gerekmez.

### Çevrimdışı görsel test

[`preview/village.html`](../preview/village.html), gerçek köy sahnesini ve planlama panelini örnek bir köyle gösteren tek dosyalık önizlemedir. Dosyayı tarayıcıda aç; TR/EN, açık/kahverengi koyu tema ve yapı seçimi internet olmadan çalışır. Örnek köyde bir otlak ve 20/24 hayvan vardır; takviye miktarı seçilince maliyet yenilenir. Örnek köy salt okunurdur: inşaat ve takviye kapalıdır, kaynak harcanmaz, sunucuya bağlanmaz ve hesabına/kaydına erişmez. Gerçek oyun için doğrulanmış hesapla giriş gerekir.

```bash
npm run build:preview
```

## English

**v2.17.0 Village Goal:** Pin the selected construction/upgrade step per player on this device and inspect shortages plus an eight-hour-capped absence forecast. Completion keeps the same target level/count. [Goal guide](VILLAGE-GOALS.md).

v2.16.0 adds progressive development costs. Additional building copies cost more; the planner uses the current copy count, real price and capacity constraints. Demolition overflow stays in a refund reserve; **Claim pending refund** transfers what fits. [All prices](ECONOMY.md).

The v2.15.0 storage panel explains expansion: base 1,000, storage levels 10,000/50,000/250,000/1,000,000/5,000,000 plus the hall bonus. **Expand storage** leads to the existing paid construction/upgrade plan. Choose and explicitly perform a gathering job; all jobs share a 90-second cooldown. Selecting a job never grants resources automatically. [Current quantities](ECONOMY.md).

The homeland **Village planning** panel displays all five resource balances, storage limits, production per minute and estimated time until full. It includes current region bonuses, such as 1.5× stone production in the Highlands. Resources without production and full stores have separate statuses.

Choose one of nine building types to inspect new construction or the next level of an existing building. When multiple copies exist, select an individual instance by its plot number and level. A separate new-building target lets you plan another copy; a maximum-level first copy does not block upgrades to others. Type limits and a lack of empty sites suitable for the chosen building are explained. Watchtower plans consider only the four reserved wall corners; other building plans consider only the 36 ordinary plots. Each required resource shows available/required quantities, its shortfall and estimated waiting time at the current production rate. When a missing resource has no producer, gathering or a producer building is suggested. If a cost exceeds storage capacity, waiting alone cannot resolve it. Maximum-level buildings cannot be upgraded.

Choosing a target spends nothing. **Choose plot** focuses a suitable empty site on the map: a reserved corner for a watchtower or an ordinary plot for other buildings. Select a **+** plot, then a building to construct at that exact location; **Upgrade** improves the existing building. Active battles, shortages and maximum level disable the button; the server independently checks balances and save revisions. Resource updates preserve the selected target and keyboard focus. Signing out resets the selection.

Estimates assume current production stays fixed. Gathering, spending, battle rewards, new buildings and region changes during travel can alter them. There is no automatic construction queue or new construction duration, and old v1/v2 saves migrate to schema v3 without resetting progress.

### Fixed Homeland map

The map viewport has no internal scrollbars and initially fits all plots. **+ / −** change the actual camera zoom (1×–2.5×); the target button recenters and restores 1×. When zoomed in, drag, pinch or focus the map and use arrow keys to explore. Home restores the initial view. Keyboard focus on an offscreen plot brings it into view. Camera movement does not move buildings, spend resources or change saved progress.

Clear/rainy weather, clouds, steppe dust and a small flowing waterfall are **decorative** and do not affect production or battles. Weather and motion buttons control the display. System reduced-motion preferences stop animations. Camera/weather choices only affect the open local view; no live weather service is contacted. The offline village preview uses the same controls.

### Structure list and resource explanations

**Level 1 · Plot 32** means the structure is level 1 on map plot 32; 32 is neither output nor upgrade cost. Resource costs include readable names. Hover or keyboard focus explains available/required quantities; touch users can already read the resource and cost. Current production and gathering values are in the [resource balance guide](ECONOMY.md).

### Building demolition

Remove the selected building through explicit confirmation showing a 50% construction/upgrade material refund. Capacity, combat/travel and changed-target safeguards are covered in the [demolition guide](DEMOLITION.md).

### Herd replenishment after defeat

The **Herd replenishment** panel shows the current animal count, the 24-animal limit, missing animals and the selected quantity's cost. At least one built **Pasture** is required; its level does not change the price. A batch contains 1–5 animals and cannot exceed the missing count. Each animal costs **30 water + 60 feed**. Changing the quantity spends nothing; the replenish button explicitly confirms the action.

Active battles, expeditions and escorts block replenishment. A journey migrated from an older save must also finish first. The panel explains missing pastures, a full herd and resource shortages. The server rechecks every condition; rejected replenishment requests neither deduct supplies for the purchase nor add animals. Each new animal adds 10 current and maximum health, retaining existing wounds and panic. Guardian health, XP, training points and equipment stay unchanged. Existing healing/rest options treat the remaining animals' injuries.

Herd replenishment needs no additional save fields; the overall v2.16.0 migration uses schema v3. See the [migration guide](ECONOMY.md). No new environment variables or services are required.

### Offline visual test

[`preview/village.html`](../preview/village.html) is a self-contained preview of the actual village scene and planning panel using a fictional village. Open it in a browser: TR/EN, light/brown dark themes and building selection work offline. The fictional village has a pasture and 20/24 animals; selecting a replenishment quantity updates its cost. The village is read-only: construction and replenishment are disabled, no resources are spent, and it cannot contact a server or access an account/save. Actual gameplay requires a verified account session.

```bash
npm run build:preview
```

## Serbest yerleşim / Free placement

**TR — v2.14.0:** 36 normal parsel, bunlar arasında ücretsiz bina taşıma, beş üretici türünden altışar bina ve beş seviye sur vardır. Parsel p0–p35, 6×6 koordinatın sabit kimliğidir. Bunlara ek dört sabit köşe yeri (t0–t3) yalnızca oyuncunun kaynakla inşa ettiği gözcü kulelerine ayrılır; başka bina kabul etmez. Kuleler taşınamaz, yükseltilebilir ve %50 malzeme iadesiyle onaydan sonra kaldırılabilir. Kaldırılan kulenin yeri yine yalnızca kule içindir. Normal parsellerde kule kurulamaz. Bina menüsü yalnızca seçili yere uygun türleri sunar; tür sınırı dolmuş seçenekleri gizler, kaynak eksik seçenekleri kapalı gösterir. Planlayıcı da uygun yer grubundaki boş alanı denetler. Yapı görselleri kendi 1/3/5 seviyelerinde değişir. Önizlemenin mimari aşama seçicisi örnek sur/normal yapıları, ayrı kule seviyesi seçicisi örnek kuleleri değiştirir; gerçek hesaba etkisi yoktur.

**EN — v2.14.0:** There are 36 ordinary plots with free relocation between them, six copies of each of five producer types and five wall levels. Plot IDs p0–p35 map to fixed 6×6 coordinates. Four additional fixed corner sites (t0–t3) accept only watchtowers built by the player using resources; no other building may use them. Towers cannot move, but can be upgraded or demolished with confirmation and a 50% material refund. A demolished tower leaves a tower-only site. Watchtowers cannot be built on ordinary plots. The placement menu offers only types suitable for the chosen site, omits types at their count limit and disables unaffordable choices. The planner also checks availability within the appropriate site group. Buildings change appearance at their own levels 1/3/5. The offline architecture selector changes sample walls/ordinary buildings, while the separate tower-level selector changes sample towers; neither affects actual accounts.
