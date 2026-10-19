# İlk Nöbet Günlüğü / First Watch Journal

## Türkçe

v2.11.0, Görevler ekranına sekiz hedefin salt okunur zaman günlüğünü ekler. Ana Yurt kartındaki **Nöbet günlüğünü incele**, bu bölüme geçer ve başlığa klavye odağı verir. Yönlendirme ve günlüğü okumak oyun komutu göndermez, ödül vermez ve kaynak harcamaz.

| Bilgi | Anlamı |
| --- | --- |
| Hedef tamamlandı | İlk Nöbet başlangıcından hedefin ilk başarılmasına kadar geçen süre |
| Ödül alındı | Başlangıçtan ilgili ödülün gerçekten alınmasına kadar geçen süre |
| Hedef → ödül aralığı | Hedefin başarılması ile ödülün alınması arasındaki süre; henüz alınmamışsa boş |
| İlk 15 dakika | Yalnızca hedefin tamamlanma zamanı 15 dakikayı geçmiyorsa bu aralıkta sayılır |
| İlk zaferin zamanı | İlk kazanılan savaşın başlangıca göre zamanı; ilk savaş kaybedildiyse daha sonra olabilir |
| İlk savaş → ilk bakım | İlk biten savaş ile ilk kaydedilen toparlanma arasındaki süre; tamamen sağlıklı dönüş de sıfır süreyle sayılabilir |

Süreler son doğrulanmış oyun kaydındaki `updatedAt` zamanından hesaplanan **duvar saati süreleridir**; çevrimdışı zaman dahildir, aktif oynama süresi veya oyuncu araştırması sonucu değildir. Tarihler yerine başlangıca göre saat/dakika/saniye gösterilir; saniye kesri varsa milisaniye hassasiyeti korunur. Tam `900000 ms` (15:00) sınırın içindedir; `900001 ms` sonrasıdır. İlerleme veya yeni bir ödül bu gösterimden otomatik olarak doğmaz.

Erken tamamlanan hedefler kendi zamanlarıyla görünür; ödüllerin mevcut sırayla alınması gerekir. Tamamlanmış ama alınmamış ödül, kilitli sonraki hedef ve sıradaki tamamlanmamış hedef ayrı açıklanır. Eksik veya güvenilir olmayan süre `—` ile gösterilir; sıfır süre gerçek bir değer olduğundan boş sayılmaz. Zaman hesapları ilk kayıtları kullanır; sonraki zafer veya tedaviler bunları değiştirmez.

Eski köylerden tanınan başarıların zamanları kayıt geçiş anını temsil edebilir. Bu nedenle **geri dönen bütün köylerde** durumlar korunur fakat sayısal süre ve ilk 15 dakika yorumu sunulmaz. Sonraki olaylar gerçek bir zamanda oluşsa bile mevcut kayıtta zamanın kaynağı ayrı tutulmadığından bu muhafazakâr davranış sürer. Yeni bir göç, kayıt sıfırlama veya alan ekleme yapılmaz.

[Çevrimdışı İlk Nöbet önizlemesi](../preview/first-watch.html) yeni oba, ödül, savaş, toparlanma, dolu depo, tamamlanmış bölüm, önceki köy ve sınır örneklerini sabit kurgu zamanlarıyla gösterir. İnternet, hesap, depolama veya oyun kaydı erişimi yoktur. Gerçek oyunda oturum gereklidir.

Yeni ENV, SQL, ödül dengesi, analiz olayı veya veri toplama eklenmez. Günlük otomatik dışa aktarım yapmaz. Gerçek oyuncuların ilk 15 dakikasını gözlemlemek ve çevrimdışı araları ayırarak yorumlamak hâlâ ayrı bir doğrulama işidir.

## English

v2.11.0 adds a read-only journal for eight objectives to Quests. **Read the watch journal** on the village card navigates to and focuses the journal heading. Reading and navigation send no gameplay command, grant no rewards and spend no resources.

| Field | Meaning |
| --- | --- |
| Objective completed | Time from chapter start to the first recorded completion |
| Reward claimed | Time from chapter start until that reward was actually claimed |
| Completion → reward interval | Delay between completion and claiming; unavailable while unclaimed |
| First 15 minutes | Compares objective completion only, not the reward-claim time |
| First victory | Time to the first victory, which can follow an initial defeat |
| First battle → first recovery | Interval from the first finished battle to recorded recovery; a fully healthy return may count immediately without a care action |

These are **elapsed wall-clock durations** derived from the last authoritative game update, including time offline. They are not active playtime or player-research results. Relative hours/minutes/seconds replace absolute dates; subsecond values retain millisecond precision. Exactly `900000 ms` is within the first 15 minutes; `900001 ms` is after it. Displaying a time creates no progress or reward.

Early achievements keep their own timestamps while claims retain their existing sequential order. Completed rewards awaiting a claim, locked later objectives and the next incomplete objective are distinguished. Missing or unreliable timings appear as `—`; zero is a valid duration. Later battles and care never rewrite first-event times.

Returning villages may have migration-observation timestamps rather than exact historical event times. All returning records therefore retain statuses but exclude numerical durations and first-15-minute conclusions. This conservative rule also applies to later events because the save does not distinguish each timestamp's provenance. No migration, reset or new save field is introduced.

The [offline preview](../preview/first-watch.html) uses fixed fictional timestamps for beginning, reward, battle, recovery, full storage, completion, returning and boundary scenarios. It accesses no network, account, storage or saved game. The real game requires an authenticated session.

No new environment variables, SQL, economy changes, analytics events or data collection. No automatic export. Observing real players and distinguishing offline gaps remain separate validation work.
