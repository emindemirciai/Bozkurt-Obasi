# Oba Hedefi / Village Goal — v2.17.0

## Türkçe

### Uzun vadeli hedefi sabitle

Ana Yurt → Kaynaklar ve inşaat planı bölümünde bir yeni yapı, ek kopya veya belirli binanın sonraki seviyesini seç. **Hedef olarak sabitle**, o andaki hedef seviye/adedi hatırlar. Kart mevcut kaynakları, gereken bedeli, eksikleri ve depo kapasitesi engelini gösterir. Sabitleme malzeme harcamaz veya inşaat başlatmaz.

**Hedefi incele** ilgili planı seçip planlayıcıya odaklanır. Eksik odun/taş düğmesi toplama türünü seçip mevcut toplama kontrolüne götürür. Toplama için ayrıca düğmeye basılır; ortak 90 saniye bekleme korunur. İnşa/yükseltme mevcut açık onay ve sunucu denetimiyle yapılır. Hedef kaynak ayırmaz; diğer harcamalar ilerleme çubuğunu düşürebilir.

Hedeflenen seviye veya yapı sayısı sağlanınca kart **Tamamlandı** olarak kalır; bir üst seviyeye kendiliğinden geçmez. Yeni hedef için planı açıkça yeniden sabitle. Hedef bina kimliği kayıttan kaldırılmışsa veya hedefe göre daha düşük bir yapı/seviye düzeni oluşmuşsa durum açıklanır; başka kopya otomatik seçilmez. Aynı oyun kimliğine sahip güncel yapı ve seviyesi değerlendirilir; kart kalıcı tarihsel başarı kaydı değildir.

### Oyuncuya ve cihaza ait tercih

Tek hedef, kalıcı herkese açık oyuncu koduyla ayrılmış şekilde bu tarayıcıda saklanır. Yenileme ve aynı hesapla yeniden giriş hedefi yükler; çıkış etkin belleği temizler, diğer hesap kendi hedefini görür. Aynı hesabın başka cihazında ayrıca hedef seçilir. Tarayıcı verilerini silmek hedef tercihini silebilir; sunucudaki köy kaydı ayrı korunur. **Hedefi kaldır** yalnız etkin hesabın bu cihazdaki tercihini temizler; yapı yıkmaz.

Bozuk, aşırı uzun veya beklenmeyen alanlı yerel veri yok sayılır. Yerel depolama kullanılamazsa hedef açık oturumun belleğinde çalışır. Yerel kayıt e-posta, şifre, kaynak veya oyun kaydı içermez; yalnız hedef türü, bina kimliği, seviye/adet bilgilerini içerir. Veri biçimi: `bozkurt-obasi:construction-goal:v1:<kod>`, `{version:1, goal:...}`.

### Üretim öngörüsü

Hedef kartındaki **1 / 4 / 8 / 12 / 24 saat** seçimi, mevcut binalar ve bölge üretimiyle kaynakların ne kadarının depoya sığacağını tahmin eder. Tek dönüş en fazla **8 saat** üretim sayar: 12 veya 24 saat seçmek sekiz saatlik üretimi artırmaz. Sığan miktar, öngörülen stok ve kapasiteye sığmayacak üretim ayrı gösterilir. Sıfır üretim veya dolu depo için kazanım vaat edilmez.

Bu hesap sabit mevcut üretime dayanır; gelecekteki sefer dönüşü, bölge değişimi, ödül, toplama, hediye ve harcamaları kapsamaz. Gerçek bir gelir makbuzu veya kaynak kazanma işlemi değildir. Mevcut planlayıcıdaki uzun süreler **kesintisiz üretim süresi** olarak adlandırılır; birden fazla çevrimdışı dönüş gerekebilir. Örneğin ilk oduncu + taş ocağı sonrası depo için yaklaşık 23 saat 37 dakika üretim gerekirken, tek 24 saatlik yokluk sekiz saat sayılır.

### Deneme ve dağıtım

[Köy önizlemesi](../preview/village.html) hedef biriktirme/tamamlandı/kaldırıldı/boş durumlarını, süre seçimini, TR/EN ve dar ekranları kurgusal verilerle gösterir. Önizlemede sabitleme, temizleme, inşa ve toplama kapalıdır; ağ isteği veya yerel kayıt yazımı yapılmaz. Gerçek hedefler doğrulanmış oyuncu oturumu ister.

Mevcut oyun kaydı v3, v2.16.0 tarifeleri ve sunucu komutları korunur; yeni ENV, servis, SQL sütunu veya kayıt geçişi gerekmez. Web ve API'yi güncel sürümle dağıt ve veri volume'larını koru.

## English

### Pin a long-term goal

In Homeland → Resources and construction planning, select a new structure, another copy or the next level of a specific building. **Pin as goal** remembers the chosen target level/count. The card shows current materials, cost, shortages and capacity blockers. Pinning spends nothing and starts no construction.

**Review goal** selects and focuses the matching plan. A missing wood/stone button selects that gathering task and focuses the existing work control. Gathering still requires a separate click and retains the shared 90-second cooldown. Construction/upgrading uses existing explicit confirmation and server validation. The preference reserves no materials, so other spending can reduce progress.

Reaching the chosen level/count leaves the card **Completed**. Choose and pin another plan explicitly to advance the goal. A missing target ID or regressed structure/level is explained instead of selecting another copy. The current building with that game ID and level is evaluated; the card is not a permanent historical achievement record.

### Player- and device-local preference

One goal is stored in this browser, scoped by the permanent public player code. Reloading or signing into the same account restores it. Logout clears active memory; another account has its own goal. Choose separately on another device. Clearing browser data can remove the preference while the server village remains independent. **Remove goal** clears only this account's preference on this device and does not demolish a structure.

Malformed, oversized or unexpected local data is ignored. Unavailable local storage falls back to active-session memory. The record contains goal type, building ID and level/count, without email, password, balances or a game save. Key: `bozkurt-obasi:construction-goal:v1:<code>`, value `{version:1, goal:...}`.

### Production forecast

The goal card's **1 / 4 / 8 / 12 / 24 hours** selector estimates storable income from current buildings and regional rates. One return counts at most **eight hours**: choosing 12 or 24 does not increase eight-hour production. Credited estimates, projected stock and production beyond capacity are shown separately. Full stores and absent producers promise no income.

This fixed-current-rate estimate excludes future journey arrivals, location changes, rewards, gathering, gifts and spending. It is a forecast rather than an income receipt or reward action. Existing long waits are labeled **continuous production time** and may require multiple offline returns. After the first lumber camp/quarry, storage requires about 23 hours 37 minutes of production, while one 24-hour absence counts only eight hours.

### Preview and deployment

The [offline village](../preview/village.html) includes fictional saving/completed/missing/empty examples, horizons, TR/EN and narrow layouts. Pinning, clearing, construction and gathering are disabled; it makes no network requests or local writes. Actual goals require a verified player session.

Save v3, v2.16.0 prices and server commands remain; no new ENV, service, SQL column or migration is required. Deploy current matching web/API versions and preserve data volumes.
