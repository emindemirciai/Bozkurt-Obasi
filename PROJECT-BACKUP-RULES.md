# Project Backup Rules

Bu proje yerel Windows ortamında geliştirilir.

Bir geliştirme görevi tamamlandığında aşağıdaki teslim ve yedek akışı uygulanır:

1. Görevin gerektirdiği test, lint, type-check ve/veya build kontrollerini çalıştır.
2. Gerekli kontroller başarısızsa GitHub push veya Google Drive yedeği yapma; hatayı kullanıcıya bildir.
3. Kontroller başarılıysa repository kökündeki `push-and-backup.ps1` dosyasını çalıştır.
4. Script tamamlanana kadar bekle.
5. Script hata verirse işlemi başarılı kabul etme.
6. Başarılıysa oluşturulan tarih-saat damgalı ZIP dosyasının tam yolunu kullanıcıya bildir.

## Standart dosyalar

Repository kökünde şu dosyalar bulunur:

```text
push-and-backup.ps1
run-backup.cmd
BACKUP-STANDARD.md
PROJECT-BACKUP-RULES.md
AI-PROMPT.md
```

## Google Drive yedek kökü

```text
H:\Drive'ım\Artificial Intelligence - Projects
```

Script proje adını repository kök klasörünün adından otomatik alır.

Örnek:

```text
H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası
```

## ZIP adı

Her yedek dosyasının adında tarih ve saat zorunludur:

```text
<Proje Adı>_YYYY-MM-DD_HHMMSS.zip
```

Örnek:

```text
Bozkurt Obası_2026-10-01_031542.zip
```

## Tam yedek kuralı

Google Drive ZIP yedeğinde hiçbir proje dosyası veya klasörü hariç tutulmaz.

Yedekleme anında repository kök klasörü altında bulunan içerik eksiksiz olarak ZIP'e alınır. Buna `.git`, `node_modules`, build çıktıları, cache klasörleri, IDE dosyaları, `.env`, yerel konfigürasyonlar, üretilmiş assetler ve diğer proje dosyaları da dahil olabilir.

Boş klasörler de mümkün olduğunca korunur.

`.gitignore` yalnızca Git davranışını etkiler; Google Drive tam yedeğinin içeriğini azaltmak için kullanılmaz.

Amaç, ZIP geri açıldığında yeniden dependency, asset, build veya yerel dosya üretme zorunluluğunu en aza indiren eksiksiz bir proje yedeği oluşturmaktır.

## GitHub güvenliği

Google Drive tam yedeğinin eksiksiz olması ile GitHub'a gönderilecek içerik birbirinden ayrı değerlendirilir.

`push-and-backup.ps1`, Git tarafından gönderilmek üzere görünen `.env`, private key, certificate, credentials ve benzeri hassas dosyaları kontrol etmeye devam eder.

Hassas bir dosya GitHub'a gitmek üzereyse Git işlemi durdurulur ve kullanıcı bilgilendirilir.

Bu güvenlik kontrolü Drive ZIP yedeğinden dosya çıkarmak için kullanılmaz.

## Saklama ve boyut politikası

- Varsayılan olarak son **30** tarihli yedek tutulur.
- Maksimum ZIP boyutu limiti yoktur.
- Tek ZIP 10 GB'ı aşarsa yalnızca bilgi amaçlı uyarı verilir.
- 10 GB üzerindeki ZIP silinmez ve işlem başarısız sayılmaz.
- Kota veya internet bağlantısı için ayrıca limit varsayılmaz.

## README standardı

Projede mevcut bir `README.md` varsa, o projenin güncel README yapısını ve yazım standardını esas al.

Yeni özellik, kurulum adımı, çalışma komutu, yapı değişikliği veya teslim süreci README'de belgelenmesi gereken bir değişiklik oluşturuyorsa README'yi mevcut düzeni bozmadan güncelle.

Kurallar:

- README'nin mevcut başlık yapısını, dilini ve genel formatını koru.
- Gereksiz yere baştan yazma veya sadeleştirme.
- Yapılan değişiklikle ilgili güncel olmayan bilgi varsa düzelt.
- Yeni özellik veya yeni çalışma yöntemi README'de yer alması gerekiyorsa uygun bölüme ekle.
- Projede özel bir README standardı yoksa mevcut README'nin stilini takip et.
- README yoksa sırf bu backup sistemi için yeni README oluşturma; `BACKUP-STANDARD.md` ve `PROJECT-BACKUP-RULES.md` yeterlidir.

## Değiştirilmemesi gereken standartlar

Kullanıcı açıkça istemedikçe:

- `push-and-backup.ps1` dosyasını silme veya yeniden adlandırma.
- `run-backup.cmd` dosyasını silme veya yeniden adlandırma.
- Google Drive kök yolunu değiştirme.
- Tarih-saat zorunluluğunu kaldırma.
- Son 30 yedek politikasını değiştirme.
- ZIP içeriğine exclusion / ignore listesi ekleme.
- GitHub secret güvenlik kontrolünü kaldırma.
Standart teslim zinciri:

```text
kodla
→ test/lint/build
→ push-and-backup.ps1
→ GitHub push
→ Google Drive tam proje ZIP yedeği
→ sonucu kullanıcıya bildir
```

## İncelenen teslim kapsamı ve yayımlanmış sürüm

- Varsayılan `push-and-backup.ps1` çağrısı bütün Git değişikliklerini `git add -A` ile stage eder. İlgisiz yerel dosyalar varsa teslim dosyalarını açıkça stage edin ve `-StagedOnly` kullanın. Bu seçenek yalnızca Git commit kapsamını belirler; tam ZIP kapsamını azaltmaz.
- Projenin mevcut sürüm artışı ve TR/EN sürüm notu kuralları korunur. Gerekli testler ve build geçmeden teslim betiğini çalıştırmayın.
- `-BackupOnly`, daha önce yayımlanmış sürüm için kullanılabilir. Betik uzak branch SHA'sını doğrudan sorgular; `HEAD` eşleşmiyorsa durur. Bu mod stage, commit veya push yapmaz; tüm yerel dosyaları yedekler.
- `-BackupOnly` ve `-StagedOnly` birlikte kullanılamaz.
- Git güvenlik kontrolü indexe ve gönderilecek commit geçmişine uygulanır. Hassas dosyanın sonraki committe silinmesi veya yeniden adlandırılması önceki commitin push edilmesine izin vermez. Dosya adı denetimi, genel bir kaynak içeriği sır taramasının yerine geçmez.
- ZIP `.partial` adıyla oluşturulur; her dosyanın SHA-256 değeri yeniden okunan ZIP ile karşılaştırılır. Kaynak envanteri değişmişse başarı bildirilmez. Doğrulanmış arşiv tarihli `.zip` adına taşınır ve mevcut yedeğin üzerine yazılmaz.
- Son 30 politika sırası ZIP adındaki tarih-saattir. Yalnızca doğru proje adıyla tam eşleşen, geçerli tarihli, okunabilir normal ZIP dosyaları temizlenebilir; ilgisiz, bozuk veya geçici dosyaları silmeyin.
- Sembolik bağlantı/junction içeriği bu ZIP yöntemiyle eksiksiz korunamıyorsa sessizce atlamak yerine açık hatayla durun. Yedek hedefini repository içine veya bağlantı/junction yoluna koymayın.
- Yedek betiği değiştiğinde `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\test-backup.ps1` çevrimdışı entegrasyon testini çalıştırın.

Seçeneklerin örnekleri ve hata davranışı için [BACKUP-STANDARD.md](BACKUP-STANDARD.md) dosyasını izleyin.

## English delivery rules

Keep the existing default full-backup flow and the 30-backup policy. Run the required project checks and update the release metadata before delivery. Prefer `-StagedOnly` when unrelated local files are present: explicitly stage the reviewed release files first. `-BackupOnly` is for an already published `HEAD` and requires an exact live remote SHA match; it never commits or pushes. Both options still include every local file and directory in the Drive ZIP.

Do not bypass sensitive-filename checks on the index or outgoing commit history. Publish the dated ZIP only after per-file SHA-256 verification; preserve existing backups and unrelated files on failure. Unsupported links must fail explicitly, never be silently excluded. After editing the backup script, run the offline test command documented in [BACKUP-STANDARD.md](BACKUP-STANDARD.md).
