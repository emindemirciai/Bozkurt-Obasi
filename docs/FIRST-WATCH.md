# İlk Nöbet / First Watch — v2.4.0

## Türkçe

Oba yeni bir güne hazırlanırken sürü geçitte beklenmedik bir çakal pususuyla karşılaşır. Kurtlar hilal, sürü yıldız düzenini alır. İlk çatışmanın ardından yaralar sarılır, yeni bir rota keşfedilir ve muhafızların koruduğu ilk sevkiyat yola çıkar.

### Görevler

| Sıra | Hedef | Tamamlanma koşulu | Ödül |
| --- | --- | --- | --- |
| 1 | Erzak | Bir kez kaynak topla | 20 odun, 10 taş |
| 2 | Obayı kur | Seçtiğin parsele bir bina inşa et | 15 su, 15 yem |
| 3 | Muhafızı hazırla | Bir kurda bir eğitim ver | 8 ot, 12 yem |
| 4 | İlk çatışma | Bir savaşı zafer veya yenilgiyle tamamla | 25 su, 30 yem |
| 5 | Toparlan | Çatışmadan sonra dinlen veya sürüyü tedavi et; tamamen sağlıklı dönüş de sayılır | 8 ot, 12 su |
| 6 | Yeni izler | Bir keşfi tamamla | 10 ot, 15 yem |
| 7 | İlk ekipman | Bir muhafıza ekipman kuşandır | 25 odun, 15 taş |
| 8 | Güvenli varış | Keşfedilmiş farklı bir bölgeye sevkiyatı tamamla | 40 odun, 25 taş, 10 ot |

Ana yurttaki küçük kart sıradaki alınmamış görev ödülünü ve hedefi gösterir. Yönlendirme düğmesi yalnızca ilgili ekrana geçer; inşaat, savaş, eğitim veya sevkiyat kendiliğinden başlamaz. Görevler ekranı bölümün tamamını ve mevcut dört eski görevi birlikte sunar. Türkçe/İngilizce ve açık/kahverengi koyu tema desteklenir.

Hedefler erken yapılabilir, fakat sekiz ödül sırayla alınır. Tamamlanmış bir hedef sonradan geri alınmaz: ekipmanı çıkarmak veya muhafızın yeniden yaralanması ilerlemeyi silmez. Depo herhangi bir ödül kaynağını tam alamıyorsa işlem engellenir; bir kısmı verilmez ve ödül kaybolmaz. İlgili kaynağı harcayarak veya depoyu yükselterek yer açın. İlk savaşta yenilgi bölüm akışını durdurmaz; kesilip yeniden hazırlığa döndürülen savaş tamamlanmış sayılmaz.

Toparlanma yönlendirmesi v2.9.0 ile uygun [Kamp Bakımı](CAMP-CARE.md) seçeneğine odaklanır; uygun seçenek yoksa nedenini gösterir. Bu geçiş tedavi/dinlenme satın almaz.

### Kayıt geçişi

Bölüm, mevcut v2 köy kaydına `firstWatch` alanı ekler. Önceki v1 ve v2 kayıtları sunucuda doğrulanıp geçirilir. Kaynaklar, yapılar, kurtlar, ekipman, arkadaş verileri ve eski görev ödülleri sıfırlanmaz. Sayaç, mevcut ekipman, olay günlüğü veya sefer geçmişiyle doğrulanabilen eski başarımlar tanınır. Tarihçeden düşmüş ve doğrulanamayan geçmiş eylemler tahmin edilmez. Geçiş kendi başına ödül vermez. Bölümdeki tarihler yeni sürümün gözlem zamanıdır; eski eylemlere kesin tarih atfedilmez.

Ödül alma sunucunun mevcut revizyon korumasını kullanır. Aynı ödülün tekrarı, sırası gelmemiş hedef veya eski revizyon reddedilir. İlerleme SQLite kaydında kalır ve yeniden başlatma sonrasında devam eder. Yeni ortam anahtarı veya SQL tablo değişikliği gerekmez. Dört servisi birlikte dağıtın; kalıcı volume'ları koruyun.

### Ölçüm ve önizleme

Mevcut analiz ayarları açıkken HTTPS istemcisi sabit hedef kodlarını, alınmış ödül kodlarını, ilk zafer göstergesini ve yeni/geri dönen kayıt grubunu iletir. Olay oyun kaydını, kaynakları, e-postayı, hesap kimliğini veya özel mesajları içermez. DNT/GPC tercihleri korunur. Tarayıcı/bölüm için aynı olay güncellenir; yinelenen durumlar yeni trafik görüntülemesi sayılmaz. İzlenen örnekler kesin oyuncu sayısı değildir; farklı cihaz veya temizlenen tarayıcı verileri ayrı örnek oluşturabilir. Sıradaki hedef sayısı kesin terk etme olarak yorumlanmamalıdır.

`npm run build:preview` ile üretilen [preview/first-watch.html](../preview/first-watch.html), gerçek arayüz bileşeninin sunucusuz görsel önizlemesidir. Örnek durumlar hesap veya oyun kaydını değiştirmez. Gerçek oyunda oturum gereklidir: `http://127.0.0.1:3000/#quests`.

## English

As the village prepares for the day, jackals ambush the herd in the pass. Guardians form a crescent and the herd a star. After the first encounter, the pack recovers, scouts a route and escorts its first shipment.

The chapter has eight objectives: collect once; construct any building on a chosen plot; train a guardian once; finish a battle (win or loss); rest/heal after combat or return completely healthy; complete an expedition; equip a guardian; complete a caravan to a different explored region. Rewards, in order: 20 wood/10 stone; 15 water/15 feed; 8 herbs/12 feed; 25 water/30 feed; 8 herbs/12 water; 10 herbs/15 feed; 25 wood/15 stone; 40 wood/25 stone/10 herbs.

The village next-goal card navigates without spending or starting commands. Quests shows all chapter steps alongside the four existing quests. Objectives can be achieved early, but rewards are claimed sequentially and once. Achievements persist after equipment removal or later injuries. A reward that cannot fit entirely in storage stays pending without partial grants or loss. An interrupted battle returned to preparation is not a finished battle. Losing a finished battle does not block progression.

From v2.9.0, the recovery direction focuses an eligible [Camp Care](CAMP-CARE.md) option or its blocker explanation. Navigation never purchases care.

The additive `firstWatch` field is migrated from validated v1/v2 saves without resetting villages, resources, guardians, items or old claims. Previous activity is recognized only from available counters, logs, equipment and mission history; unobservable history is not guessed. Inferred timestamps reflect migration observation time, not exact historical dates. Migration grants no resources. Existing revision checks prevent repeated claims, out-of-order claims and stale writes. SQLite persistence survives restart. No new environment keys or SQL tables are required; deploy all four services while preserving volumes.

When existing HTTPS analytics is enabled, a minimal snapshot sends allowlisted objective/claim codes, first-victory status and new/returning cohort. It excludes saves, resources, email/account identifiers and private messages; DNT/GPC is respected. One browser/chapter event is updated and excluded from page-view totals. Samples are not exact unique players: another device or cleared storage may create a new sample. Pending objectives are not confirmed abandonment.

[preview/first-watch.html](../preview/first-watch.html) is a standalone visual preview built from the actual component by `npm run build:preview`. It never changes an account or saved game. The real game at `http://127.0.0.1:3000/#quests` requires sign-in.
