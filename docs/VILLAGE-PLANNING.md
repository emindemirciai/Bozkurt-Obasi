# Oba planlaması / Village planning

## Türkçe

Ana yurt ekranındaki **Oba planlaması** paneli beş kaynağın mevcut miktarını, depo sınırını, dakikalık üretimini ve deponun tahmini dolma süresini gösterir. Mevcut bölge bonusları hesaba katılır; örneğin Yayla'da taş üretimi 1,5 katına çıkar. Üretimi olmayan ve deposu dolu kaynaklar ayrı belirtilir.

Dokuz yapıdan birini seçerek yeni yapının veya mevcut yapının sonraki seviyesinin maliyetini inceleyebilirsin. Panel her kaynak için mevcut/gerekli miktarı, eksik miktarı ve mevcut üretimle bekleme süresini gösterir. Eksik kaynak üretilmiyorsa toplama veya üretici yapı önerilir. Maliyet depo sınırını aşıyorsa yalnızca beklemek yeterli değildir. Son seviyeye ulaşan yapı yükseltilemez.

Hedef seçmek kaynak harcamaz. Açıkça **İnşa et** veya **Yükselt** düğmesine basmak, oyunun mevcut sunucu komutunu çalıştırır. Aktif savaş, kaynak eksikliği ve son seviye durumlarında düğme kapalıdır; sunucu kaynakları ve kayıt revizyonunu ayrıca doğrular. Kaynaklar güncellenirken seçim ve klavye odağı korunur. Hesaptan çıkıldığında plan seçimi sıfırlanır.

Süreler mevcut üretimin sabit kalacağını varsayan tahminlerdir. Toplama, harcama, savaş ödülleri, yeni yapılar ve yolculukta bölge değişimi bu süreleri değiştirebilir. Otomatik inşaat kuyruğu veya yapım süresi eklenmez; köy kayıt biçimi ve oyun ekonomisi korunur.

### Çevrimdışı görsel test

[`preview/village.html`](../preview/village.html), gerçek köy sahnesini ve planlama panelini örnek bir köyle gösteren tek dosyalık önizlemedir. Dosyayı tarayıcıda aç; TR/EN, açık/kahverengi koyu tema ve yapı seçimi internet olmadan çalışır. Örnek köy salt okunurdur: inşaat kapalıdır, sunucuya bağlanmaz ve hesabına/kaydına erişmez. Gerçek oyun için doğrulanmış hesapla giriş gerekir.

```bash
npm run build:preview
```

## English

The homeland **Village planning** panel displays all five resource balances, storage limits, production per minute and estimated time until full. It includes current region bonuses, such as 1.5× stone production in the Highlands. Resources without production and full stores have separate statuses.

Choose one of nine buildings to inspect the cost of a new building or the next level of an existing one. Each required resource shows available/required quantities, its shortfall and estimated waiting time at the current production rate. When a missing resource has no producer, gathering or a producer building is suggested. If a cost exceeds storage capacity, waiting alone cannot resolve it. Maximum-level buildings cannot be upgraded.

Choosing a target spends nothing. Explicitly pressing **Build** or **Upgrade** sends the existing authoritative game command. Active battles, shortages and maximum level disable the button; the server independently checks balances and save revisions. Resource updates preserve the selected target and keyboard focus. Signing out resets the selection.

Estimates assume current production stays fixed. Gathering, spending, battle rewards, new buildings and region changes during travel can alter them. There is no automatic construction queue or new construction duration, and the save schema and game economy remain unchanged.

### Offline visual test

[`preview/village.html`](../preview/village.html) is a self-contained preview of the actual village scene and planning panel using a fictional village. Open it in a browser: TR/EN, light/brown dark themes and building selection work offline. The village is read-only: construction is disabled, it cannot contact a server or access an account/save. Actual gameplay requires a verified account session.

```bash
npm run build:preview
```
