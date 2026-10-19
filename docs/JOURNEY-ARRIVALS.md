# Sefer dönüşü / Journey arrivals

## Türkçe

v2.10.0, son keşif veya sürü sevkiyatının raporunu bütün oyun ekranlarında görünür kılar. Yolculuk bittiğinde motor ödülleri zaten bir kez verir; bildirim, rapora gitmek ve kapatmak yeni bir oyun işlemi ya da ödül alma komutu göndermez.

- Oturumda gözlenen yeni dönüş “Yolculuk tamamlandı” başlığıyla görünür. İlk girişte veya yenilemede görülmemiş en son rapor nötr “Son yolculuk raporun” başlığıyla sunulur. Eski 20 rapor bir bildirim kuyruğuna dönüşmez: yalnızca en son rapor gösterilir, bütün raporlar Keşif ve sevkiyat ekranında kalır.
- Beş malzeme miktarı doğrudan kaydedilen `report.reward` değerleridir; depo sınırında sıfır ve küsuratlar korunur. `itemCount=0` eşyanın verilmediğini açıklar. Bildirim güncel fiyatlarla yeniden ödül hesabı yapmaz.
- Deneyim her katılımcı için rapordaki sefer XP'sini gösterir. 20. seviye sınırı geçerlidir; bu değer o anki XP çubuğuna eklenen miktarı veya mevcut seviyeyi yeniden hesaplamaz.
- **Raporu incele**, mevcut rapora gider ve klavye odağını taşır; **Bildirimi kapat** bildirimi kaldırır. Keşif ve sevkiyat simgesindeki 1, son raporun okunmadığını belirtir; toplam tarihçe sayısı değildir. Yeni bildirim odağı kendi üzerine çekmez.
- Okundu bilgisi cihaz/tarayıcı başına, kalıcı oyuncu koduna göre ayrı tutulur. Oyun kaydı değiştirilmez. Yerel depoda yalnızca en fazla 40 rapor kimliği (`id@startedAt`) saklanır; malzeme, e-posta veya rapor metni saklanmaz. Tarayıcı verisi temizlenirse veya başka cihazdan girilirse son rapor tekrar nötr görünebilir. Depolama engellenirse mevcut oturum belleğiyle çalışır.
- Çıkış, hesap değişimi ve gecikmiş eski oturum yanıtları başka hesabın bildirimini göstermez. Yeniden kullanılan sefer numarası başlangıç zamanı ile ayrılır. Eski plan/ekonomi alanları olmayan geçerli raporlar korunur.

[Çevrimdışı sefer önizlemesi](../preview/adventure.html) içindeki tamamlanmış yolculuk örneği aynı bileşeni kullanır. Rapor düğmesi örnek rapora odaklanır; kapatma ve oyun işlemleri kapalıdır. Ağ, hesap veya kayıt erişimi yoktur.

Yeni ENV, SQL tablosu, oyun kayıt alanı veya ödül dengesi değişikliği bulunmaz. Canlı sunucu kendi mevcut zaman ilerletme ve oturum kurallarıyla yolculuğu tamamlamaya devam eder. Bildirim sistemi çevrimdışı push/e-posta göndermez ve 20 raporun ötesinde yeni bir arşiv tutmaz.

## English

v2.10.0 makes the latest exploration or herd-escort receipt visible across game screens. The engine already grants rewards once on completion; displaying, opening or dismissing a notice sends no gameplay or reward-claim command.

- A newly observed return has a “Journey completed” heading. On first sign-in or reload, an unseen latest receipt has a neutral latest-report heading. Only the latest report is surfaced, not a backlog of 20 notices. Existing history remains available in the world screen.
- The five material amounts are saved `report.reward` values, including fractional and storage-capped zero credits. `itemCount=0` explicitly means no item was awarded. Current quotes never recompute historical rewards.
- Each participant shows the journey XP recorded in the report. The level-20 cap applies; this is not a reconstructed XP-bar delta or current level.
- **View report** navigates to and focuses the existing receipt; **Dismiss notice** removes the notice. The world icon's 1 indicates one unread latest report, not total history size. Arrival does not steal keyboard focus.
- Read receipts are local to this device/browser and scoped by permanent player code, outside the strict game save. Storage contains at most 40 report identities (`id@startedAt`), no rewards, email or report text. Clearing browser data or using another device may show a neutral latest receipt again. Blocked storage falls back to session memory.
- Logout, account changes and stale responses cannot display a previous account's notice. Start times distinguish reused journey numbers. Valid older receipts missing plan/economy fields retain their actual awards.

The completed-journey example in the [offline preview](../preview/adventure.html) uses the same component. Its report button focuses the fictional receipt; dismissal and game commands are disabled. No network, account or save access is required.

No new environment variables, SQL tables, game-save fields or reward balance changes. Existing server time/session rules still complete journeys. This feature sends no background push/email and adds no archive beyond existing history.
