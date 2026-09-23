# Web yol haritası / Web roadmap

## Türkçe

**Yön:** Bozkurt Obası: Ay-Yıldız Nöbeti'ni 3B model üretimine bağımlı olmayan, tarayıcıda çalışan bir köy kurma ve sürü savunma oyunu olarak geliştirmek. Köy üretimi ve gelişimi kalıcı ilerlemeyi taşır; savaşlarda bozkurtların hilali ve sürünün yıldızı oyunun görsel kimliğini korur. Eski Unity dosyaları tarihsel kaynak olarak saklanır; web oyunu ayrı bir uygulamadır.

**Bu ilk web sürümü:** Oynanabilir köy, kaynak üretimi, inşaat/gelişim, muhafız ve formasyon tercihleri, çakallarla savaş, Türkçe/İngilizce arayüz, çevrimdışı önizleme ve SQLite üzerinde sunucu kontrollü misafir ilerlemesi. Dağıtım yolu GitHub → Docker → Dokploy; yerel önizleme, testler, satır sayımı ve temiz ZIP teslim zincirine dahildir. Eş zamanlı oyuncular birbirinden bağımsız misafir köylerine sahiptir; paylaşılan dünya veya oyuncular arası savaş bu sürümün özelliği değildir.

1. **Oynanış doğrulaması:** İnşaat maliyetleri, üretim süreleri, savaş güçlüğü ve yenilgi sonrası toparlanmayı gerçek oyuncularla deneyin. Küçük bir oyun günlüğüyle ilk 15 dakikada nerede takılındığını kaydedin. Bu aşama yeni içerikten önce oyunun temel döngüsünü doğrular.
2. **Hesap ve devamlılık:** E-posta/kimlik sağlayıcılı hesap, misafir hesabını bağlama, çok cihazlı kayıt, hesap silme, parola/oturum kurtarma ve veritabanı geri yükleme provası ekleyin. Kimlik doğrulama kurulmadan kalıcı hesap sahipliği vaat etmeyin.
3. **Dünya ve topluluk:** Bölge haritası, keşif, mevsimler ve kooperatif savunma tasarlayın. Ortak dünya gerektiğinde PostgreSQL, sunucuda zamanlama, WebSocket olayları, idempotent komutlar ve yük testlerini ekleyin. Mevcut tek sunucu SQLite tasarımını birden fazla replica ile çalıştırmayın.
4. **İçerik ve yayın:** Özgün 2B çizimler, sesler, erişilebilirlik, mobil dokunmatik kullanım ve dil kapsamını tamamlayın. Lisans kayıtlarını tutun. Mağaza geliri eklenecekse yalnızca kozmetik ürünler kullanın; savaş gücü satmayın.

Her aşamanın teslimi: çalışan yerel sürüm, güncel TR/EN README, gerçek test sonuçları, kaynak satır sayısı, tek dosyalık görsel önizleme ve temiz kaynak ZIP'i. Canlı sunucu yedekleri ayrı tutulur. İlk hedef küçük, geri bildirim alınabilen bir web oyunu; eski Unity WP-00–WP-11 kapsamının tamamını tek sürümde taşımak değildir.

## English

**Direction:** Develop Bozkurt Obası: Ay-Yıldız Nöbeti as a browser village-building and herd-defense game that does not depend on producing 3D models. Village production supports long-term progression; crescent-shaped wolf defense and the star-shaped herd preserve its visual identity. Unity files remain as historical source material; the web game is a separate application.

**Initial web release:** A playable village, production, construction/progression, guardian and formation choices, jackal battles, Turkish/English interface, offline preview, and server-controlled guest progress stored in SQLite. Delivery uses GitHub → Docker → Dokploy and includes local previews, tests, line counts, and clean source archives. Concurrent players have independent guest villages; a shared world and PvP are outside this release.

1. **Validate play:** Test construction costs, production timing, combat difficulty, and recovery after defeat with players. Observe where players get stuck during their first 15 minutes before expanding content.
2. **Accounts and continuity:** Add identity-based accounts, guest linking, cross-device progress, deletion, recovery, and tested database restoration. Do not promise recoverable account ownership before authentication exists.
3. **World and community:** Design regions, exploration, seasons, and cooperative defense. A shared world requires PostgreSQL, server scheduling, WebSocket events, idempotent commands, and load testing. Do not scale the current SQLite design to multiple replicas.
4. **Content and release:** Complete original 2D art/audio, accessibility, touch controls, and localization. Track asset licenses. If monetization is introduced, sell cosmetics without selling combat advantages.

Each milestone delivers a working local build, updated TR/EN README, actual test results, source line counts, a standalone visual preview, and a clean source ZIP. Live player-data backups remain separate. Start with a small web game suitable for feedback; the entire former Unity WP-00–WP-11 scope is not claimed as migrated.
