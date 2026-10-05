# AI Project Backup Standard

Bu standart, yerel Windows projelerinde **GitHub teslimi + Google Drive tam proje yedeği** oluşturur.

## Standart dosyalar

Her Git repository kök dizinine şu dosyalar eklenir:

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

Script proje adını bulunduğu repository kök klasörünün adından otomatik alır.

Örneğin proje kökü:

```text
C:\Projects\Bozkurt Obası
```

ise ilk başarılı yedeklemede şu klasör otomatik oluşturulur:

```text
H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası
```

## Yedek dosya adı

Her ZIP dosyasında tarih ve saat zorunludur:

```text
<Proje Adı>_YYYY-MM-DD_HHMMSS.zip
```

Örnek:

```text
Bozkurt Obası_2026-10-01_031542.zip
```

## Tam yedek politikası

Google Drive ZIP yedeğinde hiçbir proje dosyası veya klasörü yeniden üretilebilir, gereksiz, cache, dependency veya build çıktısı kabul edilerek atlanmaz.

Yedekleme anında repository kökünün altında ne bulunuyorsa ZIP'e alınır. Buna örneğin şunlar da dahildir:

```text
.git
node_modules
dist
build
coverage
cache klasörleri
IDE klasörleri
.env dosyaları
sertifikalar / anahtarlar
yerel konfigürasyonlar
üretilmiş assetler
diğer tüm proje dosya ve klasörleri
```

Boş klasörler de ZIP içine klasör girdisi olarak eklenir.

`.gitignore` yalnızca Git davranışını etkiler; Google Drive tam yedeğinin içeriğini azaltmaz.

Bu yaklaşımın amacı, ZIP açıldığında projeyi yeniden dosya üretmek zorunda kalmadan mümkün olduğunca eksiksiz geri yükleyebilmektir.

> Tam yedek hassas dosyalar içerebilir. ZIP dosyası şifrelenmez.

## GitHub güvenliği

Google Drive tam yedeği tüm proje içeriğini kapsarken GitHub push tarafında hassas dosya güvenliği korunur.

Script, Git indexindeki ve uzak branch üzerinde henüz bulunmayan commitlerdeki `.env`, private key, certificate, credentials ve benzeri hassas dosya adlarını denetler. Bir dosyayı sonraki committe silmek veya yeniden adlandırmak önceki committeki sırrı güvenli hale getirmez; bu geçmiş de push öncesinde engellenir. Git yolları NUL ayırıcıyla okunur; Türkçe karakterler ve dosya adındaki ok işaretleri denetimi atlatmaz. Bu kontrol dosya adı temellidir; sıradan kaynak dosyalarına yazılmış tüm sırları tespit eden genel bir içerik tarayıcısı değildir.

Bu kontrol Drive tam yedeğini filtrelemek için kullanılmaz.

## İşlem sırası

1. Git ve repository kontrol edilir.
2. `origin` ve aktif branch belirlenir.
3. GitHub'a gidebilecek hassas dosyalar kontrol edilir.
4. `git add -A` çalıştırılır.
5. Değişiklik varsa commit oluşturulur.
6. Aktif branch GitHub'a push edilir.
7. Push başarısızsa Drive yedeği oluşturulmaz.
8. Push başarılıysa Drive proje klasörü oluşturulur.
9. Repository kökünün tam içeriği geçici `.partial` dosyasına alınır; her dosyanın SHA-256 değeri ZIP yeniden okunarak doğrulanır. Dosya/klasör envanteri ve kaynak dosya boyutları/değişiklik zamanları yeniden kontrol edilir. Doğrulamadan sonra arşiv tarih-saat damgalı `.zip` adına taşınır; mevcut ZIP üzerine yazılmaz.
10. Varsayılan olarak dosya adındaki tarih-saat sırasına göre son **30** doğrulanabilir yedek tutulur. Yalnızca bu proje klasöründeki tam ad biçimine ve geçerli tarihe uyan normal ZIP dosyaları adaydır. Silinecek eski arşivlerin içeriği önce okunabilirlik kontrolünden geçer. Farklı isimli dosyalar, bozuk ZIP'ler, bağlantılar ve başka işlemlere ait `.partial` dosyaları korunur.

## Boyut politikası

Maksimum yedek boyutu limiti yoktur.

ZIP dosyası 10 GB'ı aşarsa yalnızca bilgi amaçlı uyarı verilir. Yedekleme durdurulmaz, ZIP silinmez ve işlem başarısız sayılmaz.

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

## Manuel kullanım

```powershell
.\push-and-backup.ps1
```

Özel commit mesajı:

```powershell
.\push-and-backup.ps1 -CommitMessage "feat: sistem güncellendi"
```

Farklı yedek adedi:

```powershell
.\push-and-backup.ps1 -KeepBackups 40
```

Farklı Drive kökü:

```powershell
.\push-and-backup.ps1 -BackupRoot "D:\Yedekler"
```

Projeye özel görünen ad:

```powershell
.\push-and-backup.ps1 -ProjectName "Bozkurt Obası"
```

## İncelenen dosyalarla teslim ve yayımlanmış sürümü yedekleme

Varsayılan çağrı `git add -A`, gerekiyorsa commit ve push yapmaya devam eder. Yalnızca incelenip önceden stage edilmiş dosyaları teslim etmek için:

```powershell
git add -- push-and-backup.ps1 BACKUP-STANDARD.md PROJECT-BACKUP-RULES.md
.\push-and-backup.ps1 -StagedOnly -CommitMessage "chore: tam yedek standardı"
```

`-StagedOnly` yeni dosyaları kendiliğinden stage etmez; yalnızca mevcut index commit edilir. Stage edilmemiş yerel dosyalar ve değişiklikler tam Drive ZIP'ine yine dahildir. Projenin sürüm artışı, sürüm notları ve gerekli testleri teslimden önce tamamlanmalıdır.

Zaten yayımlanmış bir sürümü yeniden yedeklemek için:

```powershell
.\push-and-backup.ps1 -BackupOnly
```

`-BackupOnly`, `origin` üzerindeki aktif branch'i doğrudan sorgular ve uzak SHA ile yerel `HEAD` tam eşleşirse yedekler. Stage, commit veya push yapmaz. Yerel takip referansının eski kalmasına güvenmez. Tam ZIP yine yedekleme anındaki bütün yerel dosyaları içerir; yayımlanmamış çalışma dosyaları da bu yerel anlık görüntünün parçasıdır. `-BackupOnly` ve `-StagedOnly` birlikte kullanılamaz.

## Hata ve bütünlük davranışı

- Push veya uzak SHA doğrulaması başarısızsa ZIP oluşturulmaz.
- ZIP doğrulanana kadar `.partial` olarak kalır; başarısız işlem yalnızca kendisinin oluşturduğu geçici dosyayı kaldırır. Önceki başarılı ZIP'ler korunur.
- Aynı saniyede bir yedek zaten varsa yeni tarih-saat adı beklenir; üzerine yazılmaz.
- Kaynak dosyalar yedekleme sırasında değişirse işlem başarısız olur. Değişiklikler tamamlandıktan sonra yeniden çalıştırın.
- Bu ZIP yöntemi sembolik bağlantı/junction hedeflerini ve bağlantı özelliklerini eksiksiz geri yükleyemez. Böyle bir yol bulunursa dosyayı sessizce atlamak yerine işlem Git tesliminden önce açık hatayla durur. Hiçbir exclusion listesi uygulanmaz.
- Proje adı tek bir geçerli klasör adı olmalıdır; hedef repository dışında ve belirtilen yedek kökünün doğrudan altında olmalıdır. Hedefteki bağlantı/junction yolları kabul edilmez.
- `KeepBackups` pozitif tam sayıdır; varsayılan değer **30** olarak kalır.
- PowerShell dosyası Windows PowerShell 5.1'de Türkçe yolun doğru okunması için UTF-8 BOM ile saklanır.

## Çevrimdışı entegrasyon testi

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\test-backup.ps1
```

Testler yalnızca kendilerine ait geçici klasörlerde yerel Git depoları ve bare remote oluşturur. İnternete, gerçek GitHub branch'ine veya Drive yedeklerine yazmaz. Varsayılan teslim, stage edilmiş içerik, yayımlanmış SHA, gizli/ignore edilmiş dosyalar, boş klasörler, hassas commit geçmişi, yeniden adlandırma, push hatası, saklama sınırları ve bağlantı hataları kontrol edilir.

## English usage summary

The default `push-and-backup.ps1` flow still stages all Git changes, commits when needed, pushes the active branch, and creates a complete local project ZIP after confirming the remote SHA. The default destination remains `H:\Drive'ım\Artificial Intelligence - Projects\<project folder name>`, with the latest **30** dated backups retained. No file or directory is excluded from the full ZIP, including ignored secrets, dependencies, Git metadata and empty folders.

Use `-StagedOnly` to commit only an already reviewed Git index. Use `-BackupOnly` to archive an already published `HEAD` without staging, committing or pushing; the script verifies the actual remote branch SHA. These switches are mutually exclusive and never reduce the ZIP contents. Complete the project's tests, version bump and release notes before delivery.

Git checks inspect sensitive filenames in the index and every outgoing commit, including secrets subsequently renamed or deleted. This is a filename guard, not a general source-content secret scanner. ZIP files are published only after every archived file passes SHA-256 verification and the source inventory remains stable. An existing backup is never overwritten. Failed archive creation removes only its own temporary file; retention preserves unrelated files, invalid archives and partial files. Unsupported symbolic links/junctions fail explicitly before publication rather than silently producing an incomplete backup.

Run the offline Windows PowerShell integration suite with `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\test-backup.ps1`. It uses disposable local Git repositories and bare remotes; it never contacts GitHub or writes to the real Drive backup folder.
