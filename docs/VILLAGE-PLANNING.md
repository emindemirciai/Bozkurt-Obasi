# Oba planlaması / Village planning

## Türkçe

Ana yurt ekranındaki **Oba planlaması** paneli beş kaynağın mevcut miktarını, depo sınırını, dakikalık üretimini ve deponun tahmini dolma süresini gösterir. Mevcut bölge bonusları hesaba katılır; örneğin Yayla'da taş üretimi 1,5 katına çıkar. Üretimi olmayan ve deposu dolu kaynaklar ayrı belirtilir.

Dokuz yapı türünden birini seçerek yeni yapının veya mevcut yapının sonraki seviyesinin maliyetini inceleyebilirsin. Aynı türden birden fazla binan varsa parsel numarası ve seviyesinden istediğin kopyayı seç. Yeni bina hedefi ayrı gösterilir; ilk kopyanın son seviyede olması diğer kopyaların gelişimini engellemez. Tür sınırı dolduğunda veya boş parsel kalmadığında yeni bina planı bunu açıklar. Panel her kaynak için mevcut/gerekli miktarı, eksik miktarı ve mevcut üretimle bekleme süresini gösterir. Eksik kaynak üretilmiyorsa toplama veya üretici yapı önerilir. Maliyet depo sınırını aşıyorsa yalnızca beklemek yeterli değildir. Son seviyeye ulaşan yapı yükseltilemez.

Hedef seçmek kaynak harcamaz. **Yer seç** haritadaki parsellere götürür. Bir **+** alanı ve ardından bina seçildiğinde yapı tam o konuma kurulur. **Yükselt** mevcut binayı geliştirir. Aktif savaş, kaynak eksikliği ve son seviye durumlarında düğme kapalıdır; sunucu kaynakları ve kayıt revizyonunu ayrıca doğrular. Kaynaklar güncellenirken seçim ve klavye odağı korunur. Hesaptan çıkıldığında plan seçimi sıfırlanır.

Süreler mevcut üretimin sabit kalacağını varsayan tahminlerdir. Toplama, harcama, savaş ödülleri, yeni yapılar ve yolculukta bölge değişimi bu süreleri değiştirebilir. Otomatik inşaat kuyruğu veya yapım süresi eklenmez; eski köy kayıtları kayıpsız v2 biçimine taşınır.

### Çevrimdışı görsel test

[`preview/village.html`](../preview/village.html), gerçek köy sahnesini ve planlama panelini örnek bir köyle gösteren tek dosyalık önizlemedir. Dosyayı tarayıcıda aç; TR/EN, açık/kahverengi koyu tema ve yapı seçimi internet olmadan çalışır. Örnek köy salt okunurdur: inşaat kapalıdır, sunucuya bağlanmaz ve hesabına/kaydına erişmez. Gerçek oyun için doğrulanmış hesapla giriş gerekir.

```bash
npm run build:preview
```

## English

The homeland **Village planning** panel displays all five resource balances, storage limits, production per minute and estimated time until full. It includes current region bonuses, such as 1.5× stone production in the Highlands. Resources without production and full stores have separate statuses.

Choose one of nine building types to inspect new construction or the next level of an existing building. When multiple copies exist, select an individual instance by its plot number and level. A separate new-building target lets you plan another copy; a maximum-level first copy does not block upgrades to others. Type limits and a lack of empty plots are explained. Each required resource shows available/required quantities, its shortfall and estimated waiting time at the current production rate. When a missing resource has no producer, gathering or a producer building is suggested. If a cost exceeds storage capacity, waiting alone cannot resolve it. Maximum-level buildings cannot be upgraded.

Choosing a target spends nothing. **Choose plot** leads to the map. Select a **+** plot, then a building to construct at that exact location; **Upgrade** improves the existing building. Active battles, shortages and maximum level disable the button; the server independently checks balances and save revisions. Resource updates preserve the selected target and keyboard focus. Signing out resets the selection.

Estimates assume current production stays fixed. Gathering, spending, battle rewards, new buildings and region changes during travel can alter them. There is no automatic construction queue or new construction duration, and old saves migrate to the v2 schema without resetting progress.

### Offline visual test

[`preview/village.html`](../preview/village.html) is a self-contained preview of the actual village scene and planning panel using a fictional village. Open it in a browser: TR/EN, light/brown dark themes and building selection work offline. The village is read-only: construction is disabled, it cannot contact a server or access an account/save. Actual gameplay requires a verified account session.

```bash
npm run build:preview
```

## Serbest yerleşim / Free placement

**TR:** 36 parsel, ücretsiz taşıma, beş üretici türünden altışar bina ve beş seviye sur vardır. Parsel p0–p35, 6×6 koordinatın sabit kimliğidir. Bina menüsü tür sınırı dolmuş seçenekleri gizler; kaynak eksik seçenekleri kapalı gösterir. Yapı görselleri 1/3/5 seviyelerinde değişir. Önizlemenin mimari aşama seçicisi yalnızca örnek sahneyi değiştirir.

**EN:** 36 plots, free relocation, six copies of each of five producer types, and five wall levels are available. Plot IDs p0–p35 map to fixed 6×6 coordinates. The placement menu omits types at their count limit and disables unaffordable choices. Building visuals change at levels 1/3/5. The offline architecture selector changes only the fictional scene.
