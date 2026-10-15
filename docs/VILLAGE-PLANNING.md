# Oba planlaması / Village planning

## Türkçe

Ana yurt ekranındaki **Oba planlaması** paneli beş kaynağın mevcut miktarını, depo sınırını, dakikalık üretimini ve deponun tahmini dolma süresini gösterir. Mevcut bölge bonusları hesaba katılır; örneğin Yayla'da taş üretimi 1,5 katına çıkar. Üretimi olmayan ve deposu dolu kaynaklar ayrı belirtilir.

Dokuz yapı türünden birini seçerek yeni yapının veya mevcut yapının sonraki seviyesinin maliyetini inceleyebilirsin. Aynı türden birden fazla binan varsa parsel numarası ve seviyesinden istediğin kopyayı seç. Yeni bina hedefi ayrı gösterilir; ilk kopyanın son seviyede olması diğer kopyaların gelişimini engellemez. Tür sınırı dolduğunda veya boş parsel kalmadığında yeni bina planı bunu açıklar. Panel her kaynak için mevcut/gerekli miktarı, eksik miktarı ve mevcut üretimle bekleme süresini gösterir. Eksik kaynak üretilmiyorsa toplama veya üretici yapı önerilir. Maliyet depo sınırını aşıyorsa yalnızca beklemek yeterli değildir. Son seviyeye ulaşan yapı yükseltilemez.

Hedef seçmek kaynak harcamaz. **Yer seç** haritadaki parsellere götürür. Bir **+** alanı ve ardından bina seçildiğinde yapı tam o konuma kurulur. **Yükselt** mevcut binayı geliştirir. Aktif savaş, kaynak eksikliği ve son seviye durumlarında düğme kapalıdır; sunucu kaynakları ve kayıt revizyonunu ayrıca doğrular. Kaynaklar güncellenirken seçim ve klavye odağı korunur. Hesaptan çıkıldığında plan seçimi sıfırlanır.

Süreler mevcut üretimin sabit kalacağını varsayan tahminlerdir. Toplama, harcama, savaş ödülleri, yeni yapılar ve yolculukta bölge değişimi bu süreleri değiştirebilir. Otomatik inşaat kuyruğu veya yapım süresi eklenmez; eski köy kayıtları kayıpsız v2 biçimine taşınır.

### Yenilgi sonrası sürü takviyesi

**Sürü takviyesi** paneli mevcut hayvan sayısını, 24 hayvan sınırını, eksik sayıyı ve seçtiğin miktarın kaynak maliyetini gösterir. Kurulu en az bir **Otlak** gerekir; seviyesi maliyeti değiştirmez. Bir seferde 1–5 hayvan alınabilir ve miktar eksik hayvan sayısını aşamaz. Her hayvan **6 su + 12 yem** ister. Miktarı değiştirmek kaynak harcamaz; takviye düğmesi açık onaydır.

Aktif savaş veya devam eden keşif/sevkiyat sırasında takviye kapalıdır. Eski kayıtlardan taşınmış bir yolculuğun da bitmesi gerekir. Otlağın yoksa, sürü zaten 24 ise veya kaynak yetersizse panel nedeni gösterir. Sunucu tüm koşulları yeniden doğrular; başarısız istekte takviye için kaynak kesilmez ve hayvan eklenmez. Yeni hayvan başına hem mevcut hem azami can 10 artar; önceki yaralar ve panik aynı kalır. Muhafız canı, XP, eğitim puanları ve ekipmanı değişmez. Kalan hayvanların yaraları için mevcut tedavi/dinlenme seçenekleri kullanılır.

Bu özellik v2 kayıt biçimini korur; yeni veri alanı, ortam değişkeni veya servis gerektirmez.

### Çevrimdışı görsel test

[`preview/village.html`](../preview/village.html), gerçek köy sahnesini ve planlama panelini örnek bir köyle gösteren tek dosyalık önizlemedir. Dosyayı tarayıcıda aç; TR/EN, açık/kahverengi koyu tema ve yapı seçimi internet olmadan çalışır. Örnek köyde bir otlak ve 20/24 hayvan vardır; takviye miktarı seçilince maliyet yenilenir. Örnek köy salt okunurdur: inşaat ve takviye kapalıdır, kaynak harcanmaz, sunucuya bağlanmaz ve hesabına/kaydına erişmez. Gerçek oyun için doğrulanmış hesapla giriş gerekir.

```bash
npm run build:preview
```

## English

The homeland **Village planning** panel displays all five resource balances, storage limits, production per minute and estimated time until full. It includes current region bonuses, such as 1.5× stone production in the Highlands. Resources without production and full stores have separate statuses.

Choose one of nine building types to inspect new construction or the next level of an existing building. When multiple copies exist, select an individual instance by its plot number and level. A separate new-building target lets you plan another copy; a maximum-level first copy does not block upgrades to others. Type limits and a lack of empty plots are explained. Each required resource shows available/required quantities, its shortfall and estimated waiting time at the current production rate. When a missing resource has no producer, gathering or a producer building is suggested. If a cost exceeds storage capacity, waiting alone cannot resolve it. Maximum-level buildings cannot be upgraded.

Choosing a target spends nothing. **Choose plot** leads to the map. Select a **+** plot, then a building to construct at that exact location; **Upgrade** improves the existing building. Active battles, shortages and maximum level disable the button; the server independently checks balances and save revisions. Resource updates preserve the selected target and keyboard focus. Signing out resets the selection.

Estimates assume current production stays fixed. Gathering, spending, battle rewards, new buildings and region changes during travel can alter them. There is no automatic construction queue or new construction duration, and old saves migrate to the v2 schema without resetting progress.

### Herd replenishment after defeat

The **Herd replenishment** panel shows the current animal count, the 24-animal limit, missing animals and the selected quantity's cost. At least one built **Pasture** is required; its level does not change the price. A batch contains 1–5 animals and cannot exceed the missing count. Each animal costs **6 water + 12 feed**. Changing the quantity spends nothing; the replenish button explicitly confirms the action.

Active battles, expeditions and escorts block replenishment. A journey migrated from an older save must also finish first. The panel explains missing pastures, a full herd and resource shortages. The server rechecks every condition; rejected replenishment requests neither deduct supplies for the purchase nor add animals. Each new animal adds 10 current and maximum health, retaining existing wounds and panic. Guardian health, XP, training points and equipment stay unchanged. Existing healing/rest options treat the remaining animals' injuries.

The feature retains save schema v2 and requires no new fields, environment variables or services.

### Offline visual test

[`preview/village.html`](../preview/village.html) is a self-contained preview of the actual village scene and planning panel using a fictional village. Open it in a browser: TR/EN, light/brown dark themes and building selection work offline. The fictional village has a pasture and 20/24 animals; selecting a replenishment quantity updates its cost. The village is read-only: construction and replenishment are disabled, no resources are spent, and it cannot contact a server or access an account/save. Actual gameplay requires a verified account session.

```bash
npm run build:preview
```

## Serbest yerleşim / Free placement

**TR:** 36 parsel, ücretsiz taşıma, beş üretici türünden altışar bina ve beş seviye sur vardır. Parsel p0–p35, 6×6 koordinatın sabit kimliğidir. Bina menüsü tür sınırı dolmuş seçenekleri gizler; kaynak eksik seçenekleri kapalı gösterir. Yapı görselleri 1/3/5 seviyelerinde değişir. Önizlemenin mimari aşama seçicisi yalnızca örnek sahneyi değiştirir.

**EN:** 36 plots, free relocation, six copies of each of five producer types, and five wall levels are available. Plot IDs p0–p35 map to fixed 6×6 coordinates. The placement menu omits types at their count limit and disables unaffordable choices. Building visuals change at levels 1/3/5. The offline architecture selector changes only the fictional scene.
