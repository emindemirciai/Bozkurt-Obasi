# Yönetim paneli / Administrator panel

## Türkçe

`https://admin.bozkurtobasi.com` alan adı Dokploy'da `admin:3000` servisine bağlanır. Giriş mevcut `ADMIN_EMAIL` / `ADMIN_PASSWORD` veya bunlara aktarılan `ADMIN_BOOTSTRAP_*` ayarlarını kullanır. Yönetici, oyuncu hesaplarından ayrıdır; panel yeni bir yönetici hesabı oluşturmaz.

### Kullanıcılar

Genel bakış kayıtlı kullanıcı, doğrulanmış/bekleyen hesap ve giriş yöntemi sayılarını gösterir. Kullanıcı listesinde ad, e-posta, bağımsız oyuncu kodu, kayıt tarihi, son etkinlik ve doğrulama durumu yer alır. Arama, giriş yöntemi/doğrulama filtresi ve sayfalama kullanılabilir. Ayrıntılar köy ilerlemesi, kaynaklar, muhafızlar ve aktif oturum tarihlerini gösterir. Son giriş, bu sürümden itibaren gerçek başarılı girişlerde kaydedilir; eski hesaplarda bilinmeyen tarih gösterilir, tarih uydurulmaz.

**Kullanıcı ekle** tam ad, e-posta ve 12–128 karakterlik parola ister. Parola mevcut oyuncu girişleriyle aynı tuzlu scrypt yöntemiyle saklanır; listede veya günlükte gösterilmez. E-posta/Google kimliği mevcutsa ikinci hesap oluşturulmaz. Yeni hesap doğrulama bekler; oyuncu giriş yaptığında mevcut SMTP üzerinden kod alır ve onaylamadan oyuna giremez.

**Kalıcı silme**, ayrıntı penceresinde ilgili oyuncu kodunun aynen yazılmasını gerektirir. Tek işlem, e-posta ve ilişkili Google hesabını, köy kayıtlarını, oturumları, doğrulama/şifre kurtarma kodlarını, profil fotoğrafını, arkadaşlıkları ve bu oyuncuya bağlı maden hareketlerini siler. Diğer oyuncuların köyleri ve kaynak bakiyeleri korunur; geçmişte tamamlanmış maden gönderimleri geri alınmaz. Eski oturumlarla giriş yapılamaz. Aynı e-postayla sonraki kayıt yeni köy ve yeni oyuncu kodu oluşturur. Bu işlem mevcut veritabanı içindir; önceki özel yedek arşivlerini veya gönderilmiş e-postaları yeniden yazmaz.

Silme sırasında başlamış bir Google girişinin hesabı geri oluşturmasını önlemek için Google kimliğinin yalnızca SHA-256 özetiyle 10 dakika geçerli koruma kaydı oluşturulur. Süresi dolan kayıtlar sonraki Google girişi veya hesap silmede temizlenir. Eski giriş tamamlanamaz; silme sonrasında başlatılan yeni bir Google girişine izin verilir. Ham Google kimliği bu koruma kaydında tutulmaz.

### İşlem günlüğü

Tarih, işlem adı, bilgi/uyarı/hata düzeyi, işlemi yapan ve hedef ayrı sütunlardır. Kullanıcı ekleme/silme, yönetici giriş/çıkış/başarısız denemeler, oyuncu kaydı/girişi/doğrulaması, profil ve parola işlemleri, arkadaşlık/maden işlemleri ve oyun eylemleri kaydedilir. Sistem hataları yalnızca güvenli hata koduyla görünür. Parola, oturum anahtarı, doğrulama kodu, IP, profil fotoğrafı ve ham istek içerikleri kaydedilmez.

Günlükler kalıcı oyun veritabanında saklanır, en fazla 90 gün ve 100.000 kayıt tutulur. Önceki sürümlerde tutulmamış olaylar geriye dönük oluşturulmaz. Silinen kullanıcının eski günlüklerinde oyuncu kimliği anonimleştirilir; silme kaydı işlem ve adet bilgilerini korur. Arama, işlem/düzey filtresi ve sayfalama vardır. Yönetim uç noktaları yetkili oturum ve değişikliklerde aynı origin/JSON kontrollerini gerektirir.

## English

Map `https://admin.bozkurtobasi.com` to `admin:3000` in Dokploy. Sign in with existing `ADMIN_EMAIL` / `ADMIN_PASSWORD`, including the supported `ADMIN_BOOTSTRAP_*` mapping. The administrator remains separate from player accounts; this panel does not create administrator credentials.

### Users

Overview shows registered, verified/pending and sign-in-method counts. Search/filter/paginate users by name, email, permanent player code, registration date, activity and verification status. Details include villages, resources, guardians and active-session dates. Last login is recorded only for real successful sign-ins starting with this version; historical unknown dates are not invented.

**Add user** requires a full name, email and 12–128-character password. The existing salted scrypt format is shared with normal player sign-in. Passwords never appear in lists or logs. Existing email/Google identities cannot be overwritten. A new account remains pending; signing in sends the verification code through existing SMTP, and gameplay stays locked until confirmation.

**Permanent deletion** requires entering the exact player code in the details dialog. One transaction removes the email/associated Google accounts, villages, sessions, verification/recovery challenges, avatar/profile, friendships and associated stone-transfer records. Other players' villages and resource balances remain unchanged; completed transfers are not refunded. Old sessions cannot access the account. A later registration receives a new village and player code. Deletion covers the current database; earlier private backups and already-delivered email are not rewritten.

To prevent an in-progress Google sign-in from resurrecting a deleted account, a guard valid for ten minutes stores only a SHA-256 digest of the Google identity. Expired guards are cleaned on subsequent Google sign-in or account deletion. Earlier flows fail; fresh sign-in started after deletion can create a new account. No raw Google identity is retained by this guard.

### Activity log

Each entry separates timestamp, action, info/warning/error level, actor, target and safe details. It covers administrator and player account activity, profile/password changes, friendships, stone gifts, game commands and safe system error codes. Passwords, tokens, verification codes, IPs, avatar bytes and raw request bodies are excluded.

Logs persist in the game database for at most 90 days/100,000 entries. Events not captured by older versions are not fabricated. Deletion anonymizes player references in earlier entries, while an anonymous deletion event retains operation counts. Search, action/level filters and pagination are available. Administrator routes require a valid admin session and same-origin JSON mutation checks.
