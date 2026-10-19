# Sefer Kadrosu / Journey Party — v2.7.0

## Türkçe

**Keşif ve sevkiyat** ekranında bölge, zorluk ve görev planından sonra muhafız ekibini hazırlayabilirsin. Yeni kadro önerileri yalnızca yerel seçimi değiştirir. Kaynak harcama veya yolculuk başlatma için yine **Seferi başlat** düğmesine basılması ve sunucunun onayı gerekir.

### Üç öncelik

| Öneri | Seçim kuralı |
| --- | --- |
| İzcilik | Kuşanılmış ekipmanın izcilik bonusu yüksek kurtlar önce gelir; eşitlikte can oranı değerlendirilir. |
| Dayanıklılık | Yol yorgunluğundan sonra daha çok canı kalacak kurtlar önce gelir. |
| Eğitim | 20. seviyenin altındaki ve sonraki seviyeye daha az XP kalan kurtlar önce gelir. Kadro için gerekiyorsa üst seviyedeki kurtlar da kullanılabilir. |

Öneriler kurtların adına veya rol portresine göre yetenek varsaymaz; kayıtlı ekipman, can ve seviyelerini kullanır. Eşitlikler tutarlı biçimde çözülür. Aynı kurtlar birden fazla önceliğe uygun olabilir; farklı önerilerin aynı ekibi göstermesi mümkündür.

Önerilen sayı mevcut seçimin sayısını korur, zorluğun gerektirdiği minimumun altına inmez: kolay/orta/zorda en az 1/2/3 kurt. Kutularla daha fazla kurt seçersen öneriler bu sayıyı kullanır. Canı 20'nin altında olanlar önerilmez. Yeterli uygun muhafız yoksa eksik sayı açıklanır; eksik kadro kendiliğinden uygulanmaz. Savaş veya yolculuk sürerken kadro değiştirme kapalıdır. Rota kilidi, sürü canı ve erzak koşulları ayrıca hazırlık panelinde denetlenir.

Kartlar önerilen kurtları, sabit rota süresini ve gerçek erzak maliyetini gösterir. v2.11.0’da izci ekipmanı su/yem maliyetini en fazla %30 azaltır; 6/8/10/12 saatlik süreyi değiştirmez. Görev planları da süreyi değiştirmeden XP/malzeme/erzak ve yorgunluğu değiştirir. [Saatlik ödül tablosu](LONG-JOURNEYS.md).

### Varış öngörüsü

Seçilen her muhafızın mevcut canı, yol yorgunluğundan sonraki canı ve XP/seviye kazanımından sonraki beklenen durumu görünür. Hesap gerçek oyun kurallarını kullanır: önce yorgunluk uygulanır (can en az 1 kalır), ardından görev XP'si eklenir. Her seviye 1 eğitim puanı ve 6 azami can kazandırır; seviye artışında 18 can yenilenir, azami can aşılamaz. Bu nedenle bir muhafız yol yorgunluğuna rağmen daha yüksek canla dönebilir.

Üst sınır 20. seviyedir. Bu seviyede biriken XP 899'u geçmez; panel nominal görev XP'si ile gerçekten eklenebilecek XP'yi ayırt eder. Uygun olmayan veya seçimi eksik muhafızlar için uyarı gösterilir. Bu bir öngörüdür; kesin sonuç sunucunun tamamladığı görev ve dönüş raporudur. Kadroyu incelemek kayıt veya ödül oluşturmaz.

### Önizleme ve dağıtım

[Çevrimdışı sefer önizlemesi](../preview/adventure.html), kurmaca kurtlarla önerileri ve varış hesabını denemeyi sağlar. TR/EN ve açık/kahverengi koyu tema desteklenir. Yolculuk başlatma kapalıdır; gerçek hesaba bağlanmaz.

Yeni servis, ENV anahtarı, API eylemi veya kayıt geçişi gerekmez. Mevcut görevler ve ödüller aynı kurallarla sürer. Dokploy'da dört servisi güncel sürümle dağıt; veri volume'larını koru. [Görev planları ve hikâyeler](ADVENTURE-PLANNING.md) · [Muhafız gelişimi](GUARDIAN-PROGRESSION.md).

## English

In **Exploration and escorts**, prepare guardians after selecting destination, difficulty and mission plan. Party suggestions change the local selection only. Spending supplies and starting a journey still require explicit **Begin journey** confirmation and server approval.

### Three priorities

| Suggestion | Selection rule |
| --- | --- |
| Scouting | Prefer higher scouting bonuses from worn equipment, then healthier wolves by health ratio. |
| Resilience | Prefer wolves with more health remaining after travel fatigue. |
| Training | Prefer guardians below level 20 with less XP needed for the next level. Capped guardians can fill remaining places when necessary. |

Suggestions use saved equipment, health and progression rather than assuming abilities from names or portraits. Ties are deterministic. The same guardians can suit several priorities, so different suggestions may produce identical parties.

Party size keeps the current selected count and never falls below difficulty requirements: at least 1/2/3 wolves on easy/normal/hard. Select extra checkboxes to increase the suggested count. Wolves below 20 health are ineligible. If too few guardians qualify, the panel explains the shortage and does not silently apply an incomplete party. Battles and ongoing journeys lock party changes. Route unlocks, herd health and supplies remain separate checks in the readiness panel.

Cards show the proposed guardians, fixed route duration and actual supplies. From v2.11.0, scouting discounts water/feed by at most 30% while keeping 6/8/10/12-hour travel fixed. Plans change XP/materials/supplies and fatigue without changing duration. [Hourly reward table](LONG-JOURNEYS.md).

### Arrival forecast

Each selected guardian shows current health, health after travel fatigue and the expected result after XP/level progression. It follows the real engine: fatigue first, leaving at least 1 health, then mission XP. Each level awards 1 training point, adds 6 maximum health and restores 18 health, capped at the new maximum. A level-up can therefore leave a guardian healthier than at departure.

The cap is level 20 with at most 899 stored XP. The panel distinguishes nominal mission XP from XP that can actually be credited. Ineligible or missing party entries are explained. This is a forecast; server completion and the arrival report determine the actual outcome. Inspecting parties does not create saves or rewards.

### Preview and deployment

The [offline journey preview](../preview/adventure.html) offers fictional guardians for exploring suggestions and arrival forecasts in TR/EN and light/brown-dark themes. It cannot start missions or connect to real accounts.

No new service, environment key, API action or save migration is required. Existing missions and reward rules continue. Redeploy all four Dokploy services while preserving data volumes. [Mission plans and stories](ADVENTURE-PLANNING.md) · [Guardian progression](GUARDIAN-PROGRESSION.md).
