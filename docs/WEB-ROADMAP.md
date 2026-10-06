# Web yol haritası / Web roadmap

## Türkçe

**Yön:** Bozkurt Obası: Ay-Yıldız Nöbeti'ni 3B model üretimine bağımlı olmayan, tarayıcıda çalışan bir köy kurma ve sürü savunma oyunu olarak geliştirmek. Köy üretimi ve gelişimi kalıcı ilerlemeyi taşır; savaşlarda bozkurtların hilali ve sürünün yıldızı oyunun görsel kimliğini korur. Eski Unity dosyaları tarihsel kaynak olarak saklanır; web oyunu ayrı bir uygulamadır.

**v1.7.0:** İlk adımlar ve SVG kimliğine ek olarak doğrulanmış profiller, arkadaşlık ve maden aktarımı kullanılabilir. Görselli e-posta koduyla şifre kurtarma, bütün cihaz oturumlarını kapatıp aynı köyü korur. Tam Drive yedeği teslim standardıdır.

**Güncel web sürümü:** Oynanabilir köy, kaynak üretimi, inşaat/gelişim, muhafız ve formasyon tercihleri, çakallarla savaş, Türkçe/İngilizce arayüz, çevrimdışı görsel ana sayfa önizlemesi ve SQLite üzerinde Google veya e-posta hesabına bağlı ilerleme. Ana sayfa herkese açık; köy ve oyun ekranları geçerli hesap oturumu ister. Dağıtım yolu GitHub → Docker → Dokploy; yerel önizleme, testler, satır sayımı ve temiz ZIP teslim zincirine dahildir. Eş zamanlı oyuncuların ayrı köyleri vardır; paylaşılan dünya veya oyuncular arası savaş bu sürümün özelliği değildir.

1. **Oynanış doğrulaması:** İnşaat maliyetleri, üretim süreleri, savaş güçlüğü ve yenilgi sonrası toparlanmayı gerçek oyuncularla deneyin. Küçük bir oyun günlüğüyle ilk 15 dakikada nerede takılındığını kaydedin. Bu aşama yeni içerikten önce oyunun temel döngüsünü doğrular.
2. **Hesap ve devamlılık:** Mevcut Google girişini canlı istemciyle doğrulayın; önceki misafir köylerinin bağlanmasını, cihazlar arası kaydı ve veritabanı geri yüklemeyi deneyin. SMTP doğrulama postasının gerçek sağlayıcıda teslimini sınayın. Kodla şifre kurtarma hazırdır. Canlı SMTP teslimini ve cihazlar arası yeniden girişi deneyin; hesap verisi silme sonraki adımdır.
3. **Dünya ve topluluk:** Bölge haritası, keşif, mevsimler ve kooperatif savunma tasarlayın. Ortak dünya gerektiğinde PostgreSQL, sunucuda zamanlama, WebSocket olayları, idempotent komutlar ve yük testlerini ekleyin. Mevcut tek sunucu SQLite tasarımını birden fazla replica ile çalıştırmayın.
4. **İçerik ve yayın:** Özgün 2B çizimler, sesler, erişilebilirlik, mobil dokunmatik kullanım ve dil kapsamını tamamlayın. Lisans kayıtlarını tutun. Mağaza geliri eklenecekse yalnızca kozmetik ürünler kullanın; savaş gücü satmayın.

Her aşamanın teslimi: çalışan yerel sürüm, güncel TR/EN README, gerçek test sonuçları, kaynak satır sayısı, tek dosyalık görsel önizleme ve temiz kaynak ZIP'i ile bütün yerel dosyaları içeren doğrulanmış Drive ZIP'i. Canlı sunucu yedekleri ayrı tutulur. İlk hedef küçük, geri bildirim alınabilen bir web oyunu; eski Unity WP-00–WP-11 kapsamının tamamını tek sürümde taşımak değildir.

## English

**Direction:** Develop Bozkurt Obası: Ay-Yıldız Nöbeti as a browser village-building and herd-defense game that does not depend on producing 3D models. Village production supports long-term progression; crescent-shaped wolf defense and the star-shaped herd preserve its visual identity. Unity files remain as historical source material; the web game is a separate application.

**v1.7.0:** First steps and the SVG identity now accompany verified profiles, accepted friendships and stone gifts. Illustrated email codes recover passwords, revoke device sessions and preserve the same village. Full Drive backups remain part of delivery.

**Current web release:** A playable village, production, construction/progression, guardian and formation choices, jackal battles, Turkish/English interface, an offline visual homepage preview, and Google- or email-linked progress in SQLite. The homepage is public; the village and game screens require a valid account session. Delivery uses GitHub → Docker → Dokploy and includes local previews, tests, line counts, and clean source archives. Concurrent players have independent villages; a shared world and PvP are outside this release.

1. **Validate play:** Test construction costs, production timing, combat difficulty, and recovery after defeat with players. Observe where players get stuck during their first 15 minutes before expanding content.
2. **Accounts and continuity:** Verify Google sign-in with a live client, test earlier guest-village claims and cross-device progress, and rehearse database restoration. Confirm SMTP verification delivery with the live provider. Code-based password recovery is implemented. Verify live SMTP delivery and cross-device sign-in; account-data deletion is next.
3. **World and community:** Design regions, exploration, seasons, and cooperative defense. A shared world requires PostgreSQL, server scheduling, WebSocket events, idempotent commands, and load testing. Do not scale the current SQLite design to multiple replicas.
4. **Content and release:** Complete original 2D art/audio, accessibility, touch controls, and localization. Track asset licenses. If monetization is introduced, sell cosmetics without selling combat advantages.

Each milestone delivers a working local build, updated TR/EN README, actual test results, source line counts, a standalone visual preview, a clean source ZIP, and a verified Drive ZIP containing all local project files. Live player-data backups remain separate. Start with a small web game suitable for feedback; the entire former Unity WP-00–WP-11 scope is not claimed as migrated.
