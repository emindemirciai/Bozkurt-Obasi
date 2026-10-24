# Sur Nöbeti / Wall Watch — v2.14.0

## Türkçe

Surun dört köşesinde **yalnızca gözcü kulesine ayrılmış dört sabit yer** vardır. Sabit olan kulelerin konumudur; kuleler kendiliğinden hazır gelmez. Yeni obada bu alanlar boştur. Köşedeki **+** işaretini seçerek gözcü kulesi inşa edebilirsin. Bu alanlara başka bina yapılamaz veya taşınamaz; gözcü kuleleri de köy içindeki normal parsellere kurulamaz.

**36 normal parselin tamamı korunur.** Dört kule yeri (`t0`–`t3`) bunlara ek olarak surun dört köşesinde bulunur. Önceki sürümlerde oyuncunun malzeme harcayarak kurduğu kuleler, bina kimliği ve seviyesi korunarak boş köşe yerlerine aktarılır. Kaynak yeniden harcanmaz; diğer binalar yerinde kalır ve kulelerin boşalttığı normal parseller yeniden kullanılabilir. Önceki ücretsiz dekoratif sur kuleleri artık çizilmez.

İlk gözcü kulesi **500 odun + 400 taş** ister; sonraki üç kopya sırasıyla 2 / 3 / 5 kat bedel öder. İnşa edilmiş kule kendi köşesinde kalır; **taşınamaz**, 1–5 seviyeleri arasında **yükseltilebilir** ve açık onayla **kaldırılabilir**. Kaldırma, inşaat/yükseltme tarifesinin toplamının tam yarısını iade eder. İadenin depoya sığmayan payı bekleyen iadeye ayrılır; mevcut stoklar küçülen kapasiteye sığmıyorsa kaldırma engellenir. Kaynak veya iade eksiltilmez. Boşalan köşe yine yalnızca kuleye ayrılmış olur. Aktif savaşta inşaat, yükseltme ve kaldırma kapalıdır; aktif yolculuk da kaldırmayı engeller.

Kule görseli **kendi seviyesine** göre değişir: 1–2 ahşap, 3–4 taş, 5 kale. Sur yükseltmesi kuleyi ücretsiz yükseltmez. Sur, kapı ve iki nöbetçinin görünümü sur seviyesine bağlı kalır. Savaş desteğini inşa edilmiş en yüksek kule seviyesi belirler; kule seviyeleri toplanmaz. Kule yoksa kule desteği de yoktur. İki insan nöbetçi bağımsız birlik değildir.

Bey Otağı diğer binalardan %28 büyük gösterilir; kaidesi, flaması ve ad etiketi ana yapıyı belirginleştirir. Tıklama alanı komşu parselleri kapatmaz.

Dağ eteği, üst kenarda ırmağın kaynağından sola doğru orantılı uzanır. Sağ üstteki kayalık şelale, surların sağ dışından akan doğal kıyılı ırmağı besler. Gerçekçi zemin sabit dünya koordinatlarına bağlıdır; yakınlaştırırken yapı/sur/su ilişkisi kaymaz. Dekoratif katmanlar yapı tıklamalarını engellemez.

Harita üzerindeyken **fare tekerleği** ile yakınlaş/uzaklaş; Ctrl gerekmez. Ekrandaki **+/−**, klavyedeki **+/−**, iki parmakla yakınlaştırma, yakınlaşınca sürükleme ve **Home** ile sıfırlama kullanılabilir. Klavye kontrolleri harita veya haritadaki bir denetim odaktayken çalışır. Tekerlek haritanın dışındayken sayfa normal kayar; haritanın içinde kaydırma çubuğu oluşmaz.

**Açık / Yağmur** yerel görsel hava durumudur. Su, bulut, yağmur ve ışık üretim veya savaşı etkilemez. Duraklatma ve azaltılmış hareket tercihi animasyonları durdurur. Yeni SQL alanı, ENV değişkeni veya servis gerekmez.

Çevrimdışı önizleme dört boş kule yeriyle açılır. **Ayrılmış kule yerleri** seçicisi örnek kuleleri gösterir; **Kulelerin kendi seviyesi** seçicisi surdan bağımsız görünümünü değiştirir. Bu salt okunur örnek kaynak harcamaz veya hesap kaydını değiştirmez.

[Çevrimdışı köy](../preview/village.html) · [Sur görselleri ve istemler](FORTIFICATION-ART.md) · [Dağ/ırmak görseli ve istem](VILLAGE-TERRAIN-ART.md)

## English

The wall corners provide **four fixed sites reserved exclusively for watchtowers**. The locations are fixed; the towers do not come prebuilt. New villages start with these sites empty. Select a corner **+** to build a watchtower. Other buildings cannot be built or moved there, and watchtowers cannot be built on ordinary village plots.

**All 36 ordinary plots remain.** The four tower sites (`t0`–`t3`) are additional positions at the wall corners. Watchtowers paid for in earlier releases move into free corner sites while retaining their building IDs and levels. No resources are charged again; other buildings stay in place, and the ordinary plots vacated by towers become available. The former free decorative corner towers are no longer rendered.

The first watchtower costs **500 wood + 400 stone**; the next three copies cost 2 / 3 / 5 times that recipe. Once built it stays at its corner: it **cannot move**, can be **upgraded** through levels 1–5 and can be **demolished** after explicit confirmation. Demolition refunds exactly half the total construction/upgrade recipe cost. Refund overflow goes to the refund reserve; existing stock exceeding reduced capacity still blocks removal. No resource or credit is discarded. The vacated corner remains reserved for a tower. Active combat blocks construction, upgrades and demolition; an active journey also blocks demolition.

A tower's appearance follows **its own level**: timber at 1–2, stone at 3–4 and castle at 5. Upgrading walls does not upgrade towers for free. The wall, gate and two sentries retain their wall-level appearance. Defense support uses the highest built watchtower level rather than adding levels together; no built towers means no tower support. Human sentries are not independent units.

The Chief's Hall is drawn 28% larger with a distinctive foundation, standard and label. Its click target does not cover neighboring plots.

Rocky foothills extend proportionately left across the upper edge from the river source. A northeastern waterfall feeds the river along the outside of the right wall, with natural banks. Terrain stays in world coordinates so zoom preserves building, wall and river alignment. Decorative layers never intercept building clicks.

Use the **mouse wheel** over the map to zoom without Ctrl. On-screen **+/−**, keyboard **+/−**, touch pinch, dragging while zoomed and **Home** to reset remain available. Keyboard controls require map/control focus. Outside the map, the wheel scrolls the page normally; the map has no internal scrollbars.

**Clear / Rain** controls local visual weather. Water, clouds, rain and sunlight do not change production or battle. Pause and reduced-motion preferences stop animation. No new SQL fields, environment variables or services are required.

The offline preview opens with four empty tower sites. **Reserved tower sites** displays sample towers; **Towers’ own level** changes their appearance independently of the walls. This read-only example spends no resources and never changes account saves.

[Offline village](../preview/village.html) · [Fortification artwork and prompts](FORTIFICATION-ART.md) · [Foothills/river artwork and prompt](VILLAGE-TERRAIN-ART.md)
