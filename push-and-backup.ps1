[CmdletBinding(DefaultParameterSetName = 'Default')]
param(
    [string]$CommitMessage = '',
    [string]$ProjectName = '',
    [string]$BackupRoot = "H:\Drive'ım\Artificial Intelligence - Projects",
    [ValidateRange(1, 2147483647)][int]$KeepBackups = 30,
    [Parameter(ParameterSetName = 'Staged')][switch]$StagedOnly,
    [Parameter(ParameterSetName = 'Backup')][switch]$BackupOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }

# Read native output as UTF-8 without PowerShell's line splitting. Git paths are NUL-delimited.
function Invoke-Git([string[]]$Arguments, [switch]$AllowFailure) {
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $script:GitExecutable
    $start.WorkingDirectory = $script:ProjectRoot
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $start.StandardErrorEncoding = New-Object System.Text.UTF8Encoding($false)
    $quoted = foreach ($argument in $Arguments) {
        '"' + ($argument -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
    }
    $start.Arguments = $quoted -join ' '
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $result = [pscustomobject]@{
            Code = $process.ExitCode
            Output = $outputTask.Result
            Error = $errorTask.Result
        }
        if ($result.Code -ne 0 -and -not $AllowFailure) {
            throw "git $($Arguments[0]) basarisiz ($($result.Code)): $($result.Error.Trim())"
        }
        return $result
    }
    finally { $process.Dispose() }
}

function Get-GitPaths([string[]]$Arguments) {
    $result = Invoke-Git -Arguments $Arguments
    return $result.Output.Split([char]0, [StringSplitOptions]::RemoveEmptyEntries)
}

function Test-SensitivePath([string]$RelativePath) {
    $name = ($RelativePath -split '/')[-1].ToLowerInvariant()
    if (@('.env.example', '.env.sample', '.env.template', '.env.production.example', '.env.development.example') -contains $name) {
        return $false
    }
    return ($name -eq '.env' -or $name.StartsWith('.env.') -or
        $name -match '\.(pem|key|pfx|p12|p8|jks|keystore|mobileprovision|crt|cer|der)$' -or
        $name -match '^id_(rsa|dsa|ecdsa|ed25519)(?:_sk)?$' -or
        $name -match '^service[-_]?account.*\.json$' -or
        $name -match '^(secret|secrets|credential|credentials)(\..+)?$' -or
        $name -match '^private[-_]?key(\..+)?$')
}

function Assert-SafePaths([string[]]$Paths, [string]$Context) {
    $problems = @($Paths | Where-Object { Test-SensitivePath $_ } | Sort-Object -Unique)
    if ($problems.Count -gt 0) {
        throw "GitHub hassas dosya kontrolu ($Context): $($problems -join ', '). Commit/push durduruldu."
    }
}

function Get-RemoteHead([string]$Branch) {
    $result = Invoke-Git -Arguments @('ls-remote', '--exit-code', 'origin', "refs/heads/$Branch") -AllowFailure
    if ($result.Code -eq 2) { return '' }
    if ($result.Code -ne 0) { throw "origin kontrol edilemedi: $($result.Error.Trim())" }
    $line = $result.Output.Trim()
    if ($line -notmatch '^([a-f0-9]{40,64})\s+refs/heads/') { throw 'Uzak branch SHA degeri okunamadi.' }
    return $Matches[1]
}

function Assert-SafeOutgoingHistory([string]$RemoteHead) {
    $head = Invoke-Git -Arguments @('rev-parse', '--verify', 'HEAD') -AllowFailure
    if ($head.Code -ne 0) { return }
    $arguments = @('rev-list', 'HEAD')
    if ($RemoteHead) {
        $known = Invoke-Git -Arguments @('cat-file', '-e', "${RemoteHead}^{commit}") -AllowFailure
        if ($known.Code -ne 0) { throw 'Uzak commit yerelde yok. Once git fetch origin calistirin.' }
        $arguments += @('--not', $RemoteHead)
    }
    $commits = (Invoke-Git -Arguments $arguments).Output -split '\r?\n' | Where-Object { $_ }
    foreach ($commit in $commits) {
        # Inspect each outgoing tree: adding and then deleting/renaming a secret still publishes it.
        Assert-SafePaths -Paths @(Get-GitPaths @('ls-tree', '-r', '--name-only', '-z', $commit)) -Context "commit $commit"
    }
}

function Assert-NoReparseAncestors([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Yedek hedefinde baglanti/junction desteklenmiyor: $cursor"
            }
        }
        $parent = [IO.Directory]::GetParent($cursor)
        if ($null -eq $parent) { break }
        $cursor = $parent.FullName
    }
}

function Get-SourceInventory([string]$Root) {
    $pending = New-Object 'System.Collections.Generic.Stack[string]'
    $pending.Push($Root)
    $items = New-Object 'System.Collections.Generic.List[object]'
    while ($pending.Count -gt 0) {
        foreach ($item in Get-ChildItem -LiteralPath $pending.Pop() -Force) {
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Tam ZIP baglanti/junction koruyamiyor; hicbir dosya atlanmadi, islem durduruldu: $($item.FullName)"
            }
            $relative = $item.FullName.Substring($Root.Length).TrimStart('\').Replace('\', '/')
            $length = 0L
            if ($item.PSIsContainer) { $relative += '/'; $pending.Push($item.FullName) }
            else { $length = $item.Length }
            $items.Add([pscustomobject]@{
                Name = $relative; Path = $item.FullName; Directory = $item.PSIsContainer
                Length = $length; Modified = $item.LastWriteTimeUtc; Hash = ''
            })
        }
    }
    if ($items.Count -eq 0) { throw 'Yedeklenecek proje icerigi bulunamadi.' }
    return $items.ToArray()
}

function Assert-UnchangedInventory([object[]]$Expected) {
    $current = @(Get-SourceInventory $script:ProjectRoot)
    if ($current.Count -ne $Expected.Count) { throw 'Yedekleme sirasinda proje dosya/klasor listesi degisti. Yeniden deneyin.' }
    $byName = New-Object 'System.Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
    foreach ($item in $current) { $byName.Add($item.Name, $item) }
    foreach ($item in $Expected) {
        if (-not $byName.ContainsKey($item.Name)) { throw "Yedekleme sirasinda yol degisti: $($item.Name)" }
        $now = $byName[$item.Name]
        if (-not $item.Directory -and ($now.Length -ne $item.Length -or $now.Modified -ne $item.Modified)) {
            throw "Yedekleme sirasinda dosya degisti: $($item.Name)"
        }
    }
}

function Write-FullZip([object[]]$Inventory, [IO.Stream]$Stream) {
    $archive = New-Object IO.Compression.ZipArchive($Stream, [IO.Compression.ZipArchiveMode]::Create, $true)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        foreach ($item in $Inventory) {
            $entry = $archive.CreateEntry($item.Name, [IO.Compression.CompressionLevel]::Optimal)
            if ($item.Modified.Year -ge 1980 -and $item.Modified.Year -le 2107) {
                $entry.LastWriteTime = [DateTimeOffset]$item.Modified
            }
            if ($item.Directory) { continue }
            # Deny writers while reading: the recorded SHA and archived bytes use the same open file.
            $source = [IO.File]::Open($item.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
            try {
                if ($source.Length -ne $item.Length) { throw "Dosya boyutu degisti: $($item.Name)" }
                $item.Hash = [BitConverter]::ToString($sha.ComputeHash($source))
                $source.Position = 0
                $target = $entry.Open()
                try { $source.CopyTo($target) }
                finally { $target.Dispose() }
            }
            finally { $source.Dispose() }
        }
    }
    finally { $archive.Dispose(); $sha.Dispose() }
}

function Assert-FullZip([string]$Path, [object[]]$Inventory) {
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        if ($archive.Entries.Count -ne $Inventory.Count) { throw 'ZIP girdi sayisi proje envanteriyle eslesmiyor.' }
        $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
        foreach ($entry in $archive.Entries) {
            if (-not $seen.Add($entry.FullName)) { throw "ZIP tekrarli yol iceriyor: $($entry.FullName)" }
        }
        foreach ($item in $Inventory) {
            $entry = $archive.GetEntry($item.Name)
            if ($null -eq $entry -or $entry.Length -ne $item.Length) { throw "ZIP eksik/boyutu farkli: $($item.Name)" }
            if ($item.Directory) { continue }
            $stream = $entry.Open()
            try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)) }
            finally { $stream.Dispose() }
            if ($hash -ne $item.Hash) { throw "ZIP SHA-256 dogrulamasi basarisiz: $($item.Name)" }
        }
    }
    finally { $archive.Dispose(); $sha.Dispose() }
}

function Test-ReadableZip([string]$Path, [switch]$ReadContents) {
    $archive = $null
    try {
        $archive = [IO.Compression.ZipFile]::OpenRead($Path)
        if ($archive.Entries.Count -eq 0) { return $false }
        foreach ($entry in $archive.Entries) {
            if ($ReadContents) {
                $stream = $entry.Open()
                try { $stream.CopyTo([IO.Stream]::Null) }
                finally { $stream.Dispose() }
            }
        }
        return $true
    }
    catch { return $false }
    finally { if ($null -ne $archive) { $archive.Dispose() } }
}

function Remove-OldBackups([string]$Folder, [string]$Name, [int]$Keep) {
    $pattern = '^' + [regex]::Escape($Name) + '_(\d{4}-\d{2}-\d{2}_\d{6})\.zip$'
    $candidates = @(Get-ChildItem -LiteralPath $Folder -File -Force | Where-Object {
        if (($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $_.Name -notmatch $pattern) { return $false }
        $stamp = [DateTime]::MinValue
        if (-not [DateTime]::TryParseExact($Matches[1], 'yyyy-MM-dd_HHmmss', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$stamp)) { return $false }
        Test-ReadableZip $_.FullName
    } | Sort-Object Name -Descending)
    foreach ($old in ($candidates | Select-Object -Skip $Keep)) {
        # Recheck the exact immediate child and its contents immediately before deleting a single file.
        $path = [IO.Path]::GetFullPath($old.FullName)
        if ([IO.Path]::GetDirectoryName($path) -ne $Folder -or -not (Test-ReadableZip $path -ReadContents)) {
            Write-Warning "Eski yedek dogrulanamadi, korundu: $path"
            continue
        }
        $current = Get-Item -LiteralPath $path -Force
        if (($current.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Yedek yolu baglantiya donustu: $path" }
        Remove-Item -LiteralPath $path -Force
        Write-Host "Eski yedek silindi: $($old.Name)"
    }
}

$partialPath = $null
$partialOwned = $false
try {
    $script:ProjectRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
    if (-not $ProjectName) { $ProjectName = [IO.Path]::GetFileName($script:ProjectRoot) }
    if ([string]::IsNullOrWhiteSpace($ProjectName) -or $ProjectName -in @('.', '..') -or
        $ProjectName.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0 -or
        $ProjectName -match '[. ]$|^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)') {
        throw 'ProjectName tek bir gecerli Windows klasor adi olmali.'
    }
    if (-not [IO.Path]::IsPathRooted($BackupRoot) -or -not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
        throw "Yedek kok klasoru bulunamadi veya mutlak yol degil: $BackupRoot"
    }
    $BackupRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $BackupRoot).ProviderPath).TrimEnd('\')
    $folder = [IO.Path]::GetFullPath((Join-Path $BackupRoot $ProjectName)).TrimEnd('\')
    if ([IO.Path]::GetDirectoryName($folder) -ne $BackupRoot -or
        $folder.Equals($script:ProjectRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $folder.StartsWith($script:ProjectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Yedek hedefi repository disinda ve yedek kokunun dogrudan altinda olmali.'
    }
    Assert-NoReparseAncestors $folder
    $script:GitExecutable = @(Get-Command git -CommandType Application -ErrorAction Stop)[0].Source
    $top = (Invoke-Git @('rev-parse', '--show-toplevel')).Output.Trim().Replace('/', '\').TrimEnd('\')
    if ($top -ne $script:ProjectRoot) { throw 'Betik Git repository kokunde bulunmali.' }
    $branch = (Invoke-Git @('symbolic-ref', '--quiet', '--short', 'HEAD')).Output.Trim()
    [void](Invoke-Git @('remote', 'get-url', 'origin'))
    $remoteHead = Get-RemoteHead $branch
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    # Fail before publishing if the full local tree contains a link this ZIP format cannot restore.
    [void](Get-SourceInventory $script:ProjectRoot)

    if ($BackupOnly) {
        $head = (Invoke-Git @('rev-parse', 'HEAD')).Output.Trim()
        if (-not $remoteHead -or $head -ne $remoteHead) { throw 'BackupOnly icin HEAD uzak branch ile tam ayni olmali. Once teslim/push tamamlanmali.' }
        Write-Ok 'Yayinlanmis HEAD dogrulandi; Git degistirilmeden tam yerel yedek alinacak.'
    }
    else {
        Write-Step 'Git hassas dosya ve gonderilecek commit kontrolu'
        Assert-SafeOutgoingHistory $remoteHead
        if (-not $StagedOnly) {
            $pending = @(Get-GitPaths @('ls-files', '--cached', '--others', '--exclude-standard', '-z'))
            $present = @($pending | Where-Object { Test-Path -LiteralPath (Join-Path $script:ProjectRoot $_) })
            Assert-SafePaths $present 'calisma alani'
            [void](Invoke-Git @('add', '-A'))
        }
        Assert-SafePaths @(Get-GitPaths @('ls-files', '--cached', '-z')) 'index'
        $diff = Invoke-Git @('diff', '--cached', '--quiet') -AllowFailure
        if ($diff.Code -notin @(0, 1)) { throw "Git index kontrolu basarisiz: $($diff.Error.Trim())" }
        if ($diff.Code -eq 1) {
            if (-not $CommitMessage) { $CommitMessage = 'backup: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') }
            [void](Invoke-Git @('commit', '-m', $CommitMessage))
        }
        Assert-SafeOutgoingHistory $remoteHead
        Write-Step 'GitHub push'
        [void](Invoke-Git @('push', 'origin', "HEAD:refs/heads/$branch"))
        $head = (Invoke-Git @('rev-parse', 'HEAD')).Output.Trim()
        if ((Get-RemoteHead $branch) -ne $head) { throw 'Push sonrasi uzak HEAD dogrulanamadi. Yedek olusturulmadi.' }
        Write-Ok "GitHub push dogrulandi: $head"
    }

    [void][IO.Directory]::CreateDirectory($folder)
    Assert-NoReparseAncestors $folder
    $inventory = @(Get-SourceInventory $script:ProjectRoot)
    $partialPath = Join-Path $folder ('.' + $ProjectName + '_' + [Guid]::NewGuid().ToString('N') + '.partial')
    Write-Step "Tam ZIP olusturuluyor ve her dosyanin SHA-256 degeri dogrulaniyor ($($inventory.Count) girdi)"
    $output = [IO.File]::Open($partialPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $partialOwned = $true
    try { Write-FullZip $inventory $output }
    finally { $output.Dispose() }
    Assert-UnchangedInventory $inventory
    Assert-FullZip $partialPath $inventory
    Assert-UnchangedInventory $inventory
    # File.Move never overwrites an existing backup, including a concurrent run's archive.
    while ($true) {
        $backupPath = Join-Path $folder ($ProjectName + '_' + (Get-Date -Format 'yyyy-MM-dd_HHmmss') + '.zip')
        if (Test-Path -LiteralPath $backupPath) { Start-Sleep -Milliseconds 200; continue }
        try { [IO.File]::Move($partialPath, $backupPath); break }
        catch { if (Test-Path -LiteralPath $backupPath) { Start-Sleep -Milliseconds 200 } else { throw } }
    }
    $partialOwned = $false
    $backupItem = Get-Item -LiteralPath $backupPath
    Write-Ok "Tam yedek dogrulandi: $backupPath"
    Write-Host ('ZIP boyutu: {0:N2} MB' -f ($backupItem.Length / 1MB))
    if ($backupItem.Length -gt 10GB) { Write-Warning 'ZIP 10 GB uzerinde; yedek basarili, boyut siniri yok.' }
    Remove-OldBackups $folder $ProjectName $KeepBackups
    Write-Ok "Son $KeepBackups tarihli yedek korunuyor."
    Write-Host "GitHub: origin/$branch ($head)"
    Write-Host "Yedek: $backupPath"
    exit 0
}
catch {
    if ($partialOwned -and $partialPath -and (Test-Path -LiteralPath $partialPath)) {
        Remove-Item -LiteralPath $partialPath -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[HATA] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
