# Web yol haritası / Web roadmap

## Türkçe

**Yön:** Bozkurt Obası: Ay-Yıldız Nöbeti'ni 3B model üretimine bağımlı olmayan, tarayıcıda çalışan bir köy kurma ve sürü savunma oyunu olarak geliştirmek. Köy üretimi ve gelişimi kalıcı ilerlemeyi taşır; savaşlarda bozkurtların hilali ve sürünün yıldızı oyunun görsel kimliğini korur. Eski Unity dosyaları tarihsel kaynak olarak saklanır; web oyunu ayrı bir uygulamadır.

**v1.7.0:** İlk adımlar ve SVG kimliğine ek olarak doğrulanmış profiller, arkadaşlık ve maden aktarımı kullanılabilir. Görselli e-posta koduyla şifre kurtarma, bütün cihaz oturumlarını kapatıp aynı köyü korur. Tam Drive yedeği teslim standardıdır.

**v1.10.0:** Ayrıntılı yönetim paneli, kullanıcı ekleme/silme ve kalıcı günlüklerin ardından köye kaynak ve inşaat planlama paneli eklendi. Beş kaynağın üretim/depo durumunu ve dokuz yapının eksik maliyetlerini mevcut üretim üzerinden görebilirsin. Hedef seçmek kaynak harcamaz; inşa/yükseltme açık düğme onayıyla mevcut sunucu komutunu kullanır. Salt okunur köy önizlemesi çevrimdışı TR/EN ve tema desteği sunar.

**v2.1.0:** Serbest 36 parsel, gelişen surlar/binalar, hikâyeli savaş, beş bölgede keşif/sevkiyat, muhafız ekipmanı ve arkadaş mesaj/hediyeleri hazır. Bölge kartları ve sefer hazırlık kontrolü, ilk oyun döngüsünde rotayı ve gereksinimleri açıklıyor; çevrimdışı sefer önizlemesi teslim paketinde.

**v2.2.0:** Yenilgi sonrası sürü takviyesi tamamlandı. Kurulu otlakta su/yem karşılığında bir işlemde 1–5 hayvan eklenir; sürü 24'ü aşamaz. Ortak hazırlık hesabı kaynakları ve savaş/yolculuk engellerini açıklar; mevcut yaralar, panik ve muhafız ilerlemesi korunur. Köy önizlemesinde takviye maliyeti salt okunur olarak incelenebilir.

**v2.3.0:** Muhafız gelişim ekranı eğitim etkileri, seviye sınırı, ekipman istatistik karşılaştırmaları ve işlem engelleriyle detaylandırıldı. Rol portrelerinin ekipmanla değişmediği açıkça belirtilir. Gerçek bileşeni kullanan TR/EN çevrimdışı muhafız önizlemesi, hazır/erzak eksik/seferde/seviye sınırı durumlarını gösterir. Oyun dengesi ve kayıt biçimi korunur.

**v2.4.0:** İlk Nöbet bölümü sekiz bağlantılı görevi, sıradaki hedef kartını ve tek seferlik sıralı ödülleri ekler. Eski kayıtlar korunur; erken başarımlar sayılır, yenilgi hikâyeyi kilitlemez. Yeni/geri dönen bölüm örnekleri analizde trafik sayılarından ayrı izlenir. Başlangıç bölümü oyuncularla doğrulanmaya hazırdır. [Bölüm rehberi](FIRST-WATCH.md).

**v2.5.0:** Aktif savaşta üç taktik komut, ortak bekleme süresi, komut geçmişi ve kesintisiz görsel geri bildirim eklendi. Gerçek motorlu çevrimdışı savaş deneme alanı ile seçenekler hesap açmadan incelenebilir. [Komut rehberi](BATTLE-COMMANDS.md).

**v2.6.0:** Bölge Hikâyeleri; standart, iz sürme ve ikmal planlarını süre/erzak/XP/malzeme/yorgunluk karşılaştırmasıyla ekler. Beş bölgenin keşif ve sevkiyat öyküleri ayrıdır; üç yolculuk evresi ve planlı dönüş raporları görünür. Eski görevler aynı süre ve ödülle standart olarak tamamlanır. [Sefer rehberi](ADVENTURE-PLANNING.md). Sonraki adım: İlk Nöbet, savaş komutları ve plan tercihlerini gerçek oyuncuların ilk 15 dakikasında gözlemlemek; bu verilere göre maliyet/ödül dengesini düzenlemek. Henüz oyuncu araştırması yapılmış sayılmaz.

**v2.7.0:** Sefer Kadrosu; izcilik, dayanıklılık ve eğitim öncelikli ekip önerileriyle seçili muhafızların varış canı/XP/seviye öngörüsünü ekler. Öneriyi uygulamak yerel seçimi değiştirir; kaynak harcama ve yola çıkış sunucu onayı ister. Yeni denge veya ödül kuralı eklenmez. [Kadro rehberi](ADVENTURE-PARTY.md). Gerçek oyuncu gözlemi ve buna dayalı denge çalışması halen sıradaki adımdır.

**v2.8.0:** Eksik bina kaldırma akışı eklendi. Seçili örnek, %50 inşaat/yükseltme iadesi ve açık onayla kaldırılır; kapasite, eski onay ve tekrar ödeme korumaları sunucuda denetlenir. Boşalan parsel yeniden kullanılabilir. [Kaldırma rehberi](DEMOLITION.md). Üretim ve tekrar eden malzeme ödülleri yaklaşık yarıya, toplama aralığı 20 saniyeye çekildi; eski birikimler ve başlamış seferlerin ödülleri korunur. Yapı listesinde seviye/arsa ve maliyet kaynakları açıklandı. [Denge tablosu](ECONOMY.md). Ana Yurt sabit kamera, gerçek yakınlaştırma ve azaltılmış hareketi destekleyen hava/şelale efektleri kazandı.

**Güncel web sürümü:** Oynanabilir köy, kaynak üretimi, inşaat/gelişim, muhafız ve formasyon tercihleri, çakallarla savaş, Türkçe/İngilizce arayüz, çevrimdışı görsel ana sayfa önizlemesi ve SQLite üzerinde Google veya e-posta hesabına bağlı ilerleme. Ana sayfa herkese açık; köy ve oyun ekranları geçerli hesap oturumu ister. Dağıtım yolu GitHub → Docker → Dokploy; yerel önizleme, testler, satır sayımı ve temiz ZIP teslim zincirine dahildir. Eş zamanlı oyuncuların ayrı köyleri vardır; paylaşılan dünya veya oyuncular arası savaş bu sürümün özelliği değildir.

1. **Oynanış doğrulaması:** İnşaat maliyetleri, üretim süreleri, savaş güçlüğü ve yenilgi sonrası toparlanmayı gerçek oyuncularla deneyin. Küçük bir oyun günlüğüyle ilk 15 dakikada nerede takılındığını kaydedin. Tamamlanan otlak takviyesinin maliyetini ve yenilgi sonrası yeniden savaşa hazırlanma süresini oyuncularla doğrulayın; tedavi kalan sürünün yaralarını, takviye kaybedilen hayvanları karşılar. Bu aşama yeni içerikten önce oyunun temel döngüsünü doğrular.
2. **Hesap ve devamlılık:** Mevcut Google girişini canlı istemciyle doğrulayın; önceki misafir köylerinin bağlanmasını, cihazlar arası kaydı ve veritabanı geri yüklemeyi deneyin. SMTP doğrulama postasının gerçek sağlayıcıda teslimini sınayın. Kodla şifre kurtarma ve yönetici tarafından kalıcı hesap silme hazırdır. Canlı SMTP teslimini ve cihazlar arası yeniden girişi deneyin.
3. **Dünya ve topluluk:** Mevcut bölge/keşif döngüsünü oyuncularla doğrulayın; sonraki içerik için mevsimler ve kooperatif savunma tasarlayın. Ortak dünya gerektiğinde PostgreSQL, sunucuda zamanlama, WebSocket olayları, idempotent komutlar ve yük testlerini ekleyin. Mevcut tek sunucu SQLite tasarımını birden fazla replica ile çalıştırmayın.
4. **İçerik ve yayın:** Özgün 2B çizimler, sesler, erişilebilirlik, mobil dokunmatik kullanım ve dil kapsamını tamamlayın. Lisans kayıtlarını tutun. Mağaza geliri eklenecekse yalnızca kozmetik ürünler kullanın; savaş gücü satmayın.

Her aşamanın teslimi: çalışan yerel sürüm, güncel TR/EN README, gerçek test sonuçları, kaynak satır sayısı, tek dosyalık görsel önizleme ve temiz kaynak ZIP'i ile bütün yerel dosyaları içeren doğrulanmış Drive ZIP'i. Canlı sunucu yedekleri ayrı tutulur. İlk hedef küçük, geri bildirim alınabilen bir web oyunu; eski Unity WP-00–WP-11 kapsamının tamamını tek sürümde taşımak değildir.

## English

**Direction:** Develop Bozkurt Obası: Ay-Yıldız Nöbeti as a browser village-building and herd-defense game that does not depend on producing 3D models. Village production supports long-term progression; crescent-shaped wolf defense and the star-shaped herd preserve its visual identity. Unity files remain as historical source material; the web game is a separate application.

**v1.7.0:** First steps and the SVG identity now accompany verified profiles, accepted friendships and stone gifts. Illustrated email codes recover passwords, revoke device sessions and preserve the same village. Full Drive backups remain part of delivery.

**v1.10.0:** Following the detailed admin panel, user creation/deletion and persistent logs, the village now has a resource and construction planning panel. View production/storage for five resources and shortages for nine building targets at current rates. Choosing a target spends nothing; explicit build/upgrade confirmation uses the existing server command. A read-only village preview supports offline TR/EN and themes.

**v2.1.0:** Free construction across 36 plots, evolving walls/buildings, narrative battles, five-region exploration/escorts, guardian equipment and friend messages/gifts are implemented. Region cards and mission readiness explain routes and requirements in the initial play loop; an offline adventure preview is included.

**v2.2.0:** Herd replenishment after defeat is implemented. A built pasture permits batches of 1–5 animals for water/feed, up to 24 animals. Shared readiness explains costs and battle/journey restrictions; existing wounds, panic and guardian progression are preserved. The village preview includes read-only replenishment quotes.

**v2.3.0:** Guardian progression now explains training effects, the level cap, equipment stat comparisons and action blockers. Role portraits are explicitly distinguished from equipped items. An offline TR/EN guardian preview reuses the actual component with ready/low-supplies/away/level-cap examples. Game balance and save format are preserved.

**v2.4.0:** First Watch adds eight connected objectives, a next-goal card and ordered one-time rewards. Older saves are preserved, early achievements count, and defeat does not block the story. New/returning chapter samples are measured separately from traffic totals. The opening chapter is ready for player validation. [Chapter guide](FIRST-WATCH.md).

**v2.5.0:** Active combat adds three tactical commands, a shared cooldown, order history and continuous visual feedback. An offline sandbox runs the real engine so the choices can be explored without an account. [Command guide](BATTLE-COMMANDS.md).

**v2.6.0:** Regional Stories adds standard, survey and supply plans with time/supply/XP/material/fatigue comparisons. Five regions have distinct exploration and escort narratives, three journey stages and plan-aware arrival reports. Older missions complete as standard with unchanged timing and rewards. [Journey guide](ADVENTURE-PLANNING.md). Next: observe First Watch, combat commands and plan choices during real players' first 15 minutes, then tune costs and rewards from that evidence. Player research has not yet been completed.

**v2.7.0:** Journey Party adds scouting/resilience/training suggestions and arrival health/XP/level forecasts. Applying a suggestion changes local selection; spending and departure require server approval. No balance or reward rules are added. [Party guide](ADVENTURE-PARTY.md). Real player observation and evidence-based balance work remain the next step.

**v2.8.0:** Adds the missing building-removal flow. Explicit confirmation removes the selected instance with a 50% construction/upgrade refund; server checks protect capacity, stale confirmations and duplicate payouts. Freed plots can be rebuilt. [Demolition guide](DEMOLITION.md). Production and repeatable material rewards are roughly halved, with a 20-second gathering interval; existing balances and ongoing journey rewards remain. Structure lists clarify level/plot and cost resources. [Balance table](ECONOMY.md). Homeland adds a fixed camera, actual zoom and weather/waterfall effects respecting reduced motion.

**Current web release:** A playable village, production, construction/progression, guardian and formation choices, jackal battles, Turkish/English interface, an offline visual homepage preview, and Google- or email-linked progress in SQLite. The homepage is public; the village and game screens require a valid account session. Delivery uses GitHub → Docker → Dokploy and includes local previews, tests, line counts, and clean source archives. Concurrent players have independent villages; a shared world and PvP are outside this release.

1. **Validate play:** Test construction costs, production timing, combat difficulty, and recovery after defeat with players. Observe where players get stuck during their first 15 minutes before expanding content. Validate the implemented pasture replenishment costs and time needed to prepare for another battle with players; healing treats remaining animals while replenishment replaces lost animals.
2. **Accounts and continuity:** Verify Google sign-in with a live client, test earlier guest-village claims and cross-device progress, and rehearse database restoration. Confirm SMTP verification delivery with the live provider. Code-based password recovery and permanent admin-directed account deletion are implemented. Verify live SMTP delivery and cross-device sign-in.
3. **World and community:** Validate the implemented region/exploration loop with players; design seasons and cooperative defense for later content. A shared world requires PostgreSQL, server scheduling, WebSocket events, idempotent commands, and load testing. Do not scale the current SQLite design to multiple replicas.
4. **Content and release:** Complete original 2D art/audio, accessibility, touch controls, and localization. Track asset licenses. If monetization is introduced, sell cosmetics without selling combat advantages.

Each milestone delivers a working local build, updated TR/EN README, actual test results, source line counts, a standalone visual preview, a clean source ZIP, and a verified Drive ZIP containing all local project files. Live player-data backups remain separate. Start with a small web game suitable for feedback; the entire former Unity WP-00–WP-11 scope is not claimed as migrated.
