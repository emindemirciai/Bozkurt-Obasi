# Sur Nöbeti / Wall Watch — v2.12.0

## Türkçe

Bey Otağı diğer bina görsellerinden yaklaşık %30 büyük bir ana yapı olarak, belirgin zemin ve ad etiketiyle gösterilir. Bu görsel vurgu arsasını, maliyetini veya savaş hesabını değiştirmez.

Ana Yurt'ta en fazla **dört gözetleme kulesi** kurulabilir. Surun iç köşeleri arsa 1, 6, 31 ve 36'dır (`p0`, `p5`, `p30`, `p35`). Boş köşenin **+** düğmesi normal inşaat menüsünü açar ve kuleyi önerir. Bir köşede mevcut bina varsa korunur; kuleyi başka boş arsaya da kurabilirsin. Oyun yeni kuleyi otomatik yerleştirmez, taşımaz veya ücretsiz oluşturmaz.

Her kule **100 odun + 70 taş** başlangıç maliyetine sahiptir. Dört kule sınırı sunucuda denetlenir; başarısız beşinci deneme kaynak harcamaz. Kurulu kuleyi seçerek mevcut **Yükselt**, **Binayı taşı**, **Binayı kaldır** işlemlerini kullan. Beş seviye ve üç mimari aşama vardır: seviyeler 1–2, 3–4 ve 5. Kaldırma açık onay ister, mevcut tarifelerin toplamının yarısını iade eder ve depo/kapasite kontrollerine tabidir.

Savaş desteğini **en yüksek seviyeli kule** belirler. Dört kulenin seviyeleri toplanmaz; tek kuledeki önceki azami savunma desteği korunur. Bir kule kaldırılırsa kalanların en yükseği kullanılır. Kapının önündeki iki insan nöbetçi ve kapı görsel çevre unsurlarıdır; bağımsız eğitilebilir birlik veya ek savaş bonusu değillerdir.

Surun ön sol bölümünde gerçek geçiş açıklığı, yaklaşma yolu, seviyeye göre ahşap/taş kapı ve sağlı sollu nöbetçiler vardır. Kapı görünümü surun 1–2 / 3–4 / 5. seviye aşamalarını izler. Köyün sağ dışında kıvrılan ırmak, şelale, köpük ve kıyı ayrıntıları bulunur. Suyun ve nöbetçilerin dekoratif katmanları bina/arsa tıklamalarını engellemez.

Haritanın sağ üstündeki **Açık / Yağmur** düğmesi yerel görsel hava durumunu değiştirir; bu gerçek konum hava tahmini değildir. Yağmur, bulut ve su üretimi veya savaş sonucunu etkilemez. Duraklatma su ve atmosfer hareketlerini durdurur; cihazın azaltılmış hareket tercihi de uygulanır. Yakınlaştırma aynı sabit alanda çalışır, haritanın içinde kaydırma çubuğu oluşmaz. Bu ayarlar oyun kaydını değiştirmez.

Eski köyler, kuleler ve 36 arsalık düzen korunur. Yeni kayıt alanı, SQL geçişi, servis veya ENV gerekmez. [Çevrimdışı köy önizlemesi](../preview/village.html), gerçek çizim ve kamera bileşenlerini kullanır; hesapsız denenebilir ve kaynak harcamaz.

## English

The Chief’s Hall is an approximately 30% larger landmark with distinctive ground and name markers. This visual emphasis changes neither its plot, cost nor combat calculation.

The Homeland supports **up to four watchtowers**. Inner corner plots are 1, 6, 31 and 36 (`p0`, `p5`, `p30`, `p35`). An empty corner's **+** opens the regular construction menu with a tower recommendation. Existing corner buildings remain and towers may also use other free plots. Nothing is automatically placed, moved or granted for free.

Each tower starts at **100 wood + 70 stone**. The server enforces four towers; a rejected fifth costs nothing. Select a tower to use existing upgrade, move and remove actions. Five levels use three visual tiers: 1–2, 3–4 and 5. Removal requires confirmation and refunds half the cumulative recipes, subject to existing capacity/storage guards.

Defense support uses the **highest tower level**, rather than summing all towers. The former single-tower maximum remains. Removing a tower uses the strongest remaining one. The two human sentries and gate are visual surroundings rather than trainable units or extra combat bonuses.

A real opening, approach path, evolving wooden/stone gate and two flanking sentries occupy the front-left wall. Gate visuals follow wall tiers 1–2 / 3–4 / 5. A river curves outside the right wall, with a waterfall, foam and bank details. Decorative water/guard layers do not intercept construction targets.

Use **Clear / Rain** at the map's top right to change local visual weather; this is not a location-based forecast. Weather does not affect production or combat. Pause stops water and atmosphere animations; reduced-motion preferences also apply. Zoom remains inside the fixed viewport without internal scrollbars. Camera/weather settings do not mutate game saves.

Existing villages, towers and all 36 plots remain. No new save fields, SQL migrations, services or environment keys. The [offline village preview](../preview/village.html) reuses the real rendering/camera components without accounts or resource spending.
