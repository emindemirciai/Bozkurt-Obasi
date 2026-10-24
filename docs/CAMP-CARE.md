# Kamp Bakımı / Camp Care — v2.16.0

## Türkçe

**Ana Yurt**, **Savaş Meydanı** ve **Muhafızlar** ekranlarında Kamp Bakımı paneli, kaynak harcamadan önce yaraları ve iki bakım seçeneğinin gerçek sonucunu gösterir. Bir seçenek seçili veya uygun göründüğü için kendiliğinden uygulanmaz; yalnızca ilgili düğmeye açıkça bastığında mevcut oyun komutu sunucuya gider.

| Seçenek | Maliyet | Kurtlar | Sürü | Panik |
| --- | --- | --- | --- | --- |
| Sürüyü tedavi et | 15 ot | Değişmez | En fazla +75 can | En fazla −25 puan |
| Kampta dinlen | 100 su + 125 yem | Bütün kurtlar kendi azami canına ulaşır | En fazla +25 can | En fazla −30 puan |

Can azami değeri aşmaz; panik sıfırın altına inmez. Örneğin sürü 220/240 can ve 10 panikteyse tedavi sonunda 240/240 can ve 0 panik olur: gerçekten kazanılan can **20**, panik azalması **10** gösterilir. Dinlenme de sürüyü her zaman tamamen iyileştirmez. Bakım anlıktır; bekleme sayacı veya çevrimdışı otomatik iyileşme eklenmez. Kurt XP'si, eğitim puanı ve ekipmanı değişmez.

### Ne zaman kullanılabilir?

- Aktif savaş iki seçeneği de kapatır.
- Sürünün canı tam ve paniği sıfırsa sürü tedavisi gereksizdir; kurtların yaralı olması tedavi seçeneğini açmaz.
- Dinlenme için kurtlarda/sürüde yara veya panik bulunmalı; devam eden keşif, sevkiyat ya da eski kayıttan gelen yolculuk bitmiş olmalıdır.
- Sürü tedavisi yolculuk sırasında da kullanılabilir. Dinlenmek için Ana Yurt bölgesinde olmak zorunlu değildir; yolculuğun bitmiş olması gerekir.
- Gerekli ot veya su/yem eksikse panel kaynağı ve eksik miktarı açıklar. Üretim geldiğinde uygunluk güncellenir; düğme kendiliğinden basılmaz, mevcut odak ve muhafız seçimi korunur.

Kayıp hayvanlar tedavi veya dinlenmeyle geri gelmez. Hayvan sayısı için panelin altındaki **Sürü takviyesi** kullanılır; mevcut yaralar ve kayıplar ayrı durumlardır. [Takviye rehberi](VILLAGE-PLANNING.md).

### İlk Nöbet ve eski kayıtlar

İlk Nöbet'in **Toparlan** yönlendirmesi, mevcut yaralar ve kaynaklara göre uygun bakım düğmesine gider. İkisi de kapalıysa açıklamaya odaklanır. Yönlendirme bakım satın almaz. Çatışma sonrası başarılı bir bakım, sürü tamamen iyileşmemiş olsa bile önceki kural uyarınca toparlanma hedefini tamamlar.

v2.16.0 bakım etkilerini korur; tedavi 15 ot, dinlenme 100 su + 125 yem ister. Bakım için ek kayıt alanı gerekmez; genel v3 kayıt geçişi [ekonomi rehberinde](ECONOMY.md) açıklanır. Yeni SQL tablosu veya ENV gerekmez. Sunucu her komutta koşulları ve kayıt sürümünü yeniden doğrular; reddedilen bakım işlemi için kaynak düşülmez. Mevcut köyler ve görevler korunur.

[Çevrimdışı muhafız ve bakım önizlemesi](../preview/guardians.html), örnek kayıtlar üzerinde TR/EN ve açık/kahverengi koyu temada paneli gösterir; bakım, eğitim ve ekipman düğmeleri salt okunur durumdadır. Sunucuya, gerçek hesaba veya tarayıcı kaydına erişmez. [Ana sayfa index](../preview/index.html).

## English

The **Camp Care** panel in Homeland, Battlefield and Guardians explains injuries and the actual outcome of both care options before supplies are spent. Eligibility never performs care automatically; only an explicit button click sends the existing command to the server.

| Option | Cost | Guardians | Herd | Panic |
| --- | --- | --- | --- | --- |
| Treat herd | 15 herbs | Unchanged | Up to +75 health | Up to −25 points |
| Rest at camp | 100 water + 125 feed | Every guardian reaches its own maximum health | Up to +25 health | Up to −30 points |

Health caps at the current maximum and panic cannot fall below zero. A herd at 220/240 health and 10 panic ends treatment at 240/240 and zero panic: the forecast shows an actual gain of **20 health** and **10 panic points** removed. Rest does not necessarily fully heal the herd. Care is immediate; this does not add a timer or automatic offline healing. Guardian XP, training points and equipment remain unchanged.

### Availability

- Active combat blocks both options.
- A full-health, zero-panic herd does not need treatment; guardian injuries alone do not make herd treatment useful.
- Rest requires an injured guardian/herd or panic, and any active expedition, escort or legacy journey must finish first.
- Herd treatment remains available during travel. Rest does not require the Homeland region; it requires no ongoing journey.
- Missing herbs or water/feed are explained by resource and shortfall. Production refreshes eligibility without clicking a button or replacing the focused control/selected guardian.

Care does not restore lost animals. Use the existing **Herd replenishment** panel beneath care to replace losses; missing animals and wounds are distinct. [Replenishment guide](VILLAGE-PLANNING.md).

### First Watch and existing saves

The First Watch **Recover** direction focuses an eligible care option based on injuries and supplies, or focuses the explanation when neither is available. Navigation does not purchase care. Any successful postcombat care still completes the recovery objective under existing rules, even when the herd remains partially injured.

v2.16.0 preserves care effects; treatment costs 15 herbs and rest costs 100 water + 125 feed. Care needs no additional save fields; the [economy guide](ECONOMY.md) explains the overall save-v3 migration. No new SQL tables or environment variables are required. Every command is rechecked by the server against conditions and save revision; a rejected care purchase spends no supplies. Existing villages and objectives remain.

The [offline guardian and care preview](../preview/guardians.html) shows fictional records in TR/EN and light/brown-dark themes. Care, training and equipment buttons are read-only. It cannot access a server, real account or browser save. [Homepage index](../preview/index.html).
