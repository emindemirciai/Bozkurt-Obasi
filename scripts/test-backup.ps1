[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourceScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\push-and-backup.ps1'))
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('bozkurt-backup-tests-' + [Guid]::NewGuid().ToString('N'))
$utf8 = New-Object Text.UTF8Encoding($false)
$script:passed = 0
$testLinks = New-Object 'System.Collections.Generic.List[string]'
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw "TEST FAILED: $Message" } }
function Write-Text([string]$Path, [string]$Value) {
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Path))
    [IO.File]::WriteAllText($Path, $Value, $script:utf8)
}
function Run([string]$Executable, [string[]]$Arguments, [string]$Directory) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $Executable
    $info.WorkingDirectory = $Directory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = New-Object Text.UTF8Encoding($false)
    $info.StandardErrorEncoding = New-Object Text.UTF8Encoding($false)
    $quoted = foreach ($argument in $Arguments) { '"' + ($argument -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"' }
    $info.Arguments = $quoted -join ' '
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        return [pscustomobject]@{ Code = $process.ExitCode; Output = $stdout.Result; Error = $stderr.Result }
    } finally { $process.Dispose() }
}
function Git([string]$Directory, [string[]]$Arguments) {
    $result = Run 'git' $Arguments $Directory
    Assert ($result.Code -eq 0) "git $($Arguments -join ' '): $($result.Error)"
    return $result.Output.Trim()
}
function New-Fixture([string]$Case) {
    $base = Join-Path $script:testRoot $Case
    $work = Join-Path $base 'Bozkurt Obası'
    $remote = Join-Path $base 'remote.git'
    $backups = Join-Path $base "Drive'ım"
    [void][IO.Directory]::CreateDirectory($work)
    [void][IO.Directory]::CreateDirectory($backups)
    [void](Git $base @('init', '--bare', '--quiet', $remote))
    [void](Git $work @('init', '--quiet', '--initial-branch=main'))
    [void](Git $work @('config', 'user.email', 'backup-test@example.invalid'))
    [void](Git $work @('config', 'user.name', 'Offline Backup Test'))
    [void](Git $work @('config', 'core.autocrlf', 'false'))
    Copy-Item -LiteralPath $script:sourceScript -Destination (Join-Path $work 'push-and-backup.ps1')
    Write-Text (Join-Path $work '.gitignore') ".env`nnode_modules/`ndist/`nlocal-data/`n"
    Write-Text (Join-Path $work 'tracked.txt') 'baseline'
    Write-Text (Join-Path $work 'move.txt') 'rename fixture'
    [void](Git $work @('add', '-A'))
    [void](Git $work @('commit', '--quiet', '-m', 'fixture baseline'))
    [void](Git $work @('remote', 'add', 'origin', $remote))
    [void](Git $work @('push', '--quiet', '-u', 'origin', 'main'))
    return [pscustomobject]@{ Work = $work; Remote = $remote; Backups = $backups; Folder = (Join-Path $backups 'Bozkurt Obası') }
}
function Backup([object]$Fixture, [string[]]$Arguments = @(), [int]$ExpectedCode = 0) {
    $argsForProcess = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $Fixture.Work 'push-and-backup.ps1'), '-BackupRoot', $Fixture.Backups) + $Arguments
    $result = Run 'powershell.exe' $argsForProcess $Fixture.Work
    Assert ($result.Code -eq $ExpectedCode) "backup exit $($result.Code), expected $ExpectedCode.`n$($result.Output)`n$($result.Error)"
    return $result
}
function Archives([object]$Fixture) {
    if (Test-Path -LiteralPath $Fixture.Folder) { return Get-ChildItem -LiteralPath $Fixture.Folder -File -Filter '*.zip' }
}
function Zip-Text([string]$Path, [string]$Name) {
    $zip = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $zip.GetEntry($Name)
        Assert ($null -ne $entry) "ZIP missing $Name"
        $reader = New-Object IO.StreamReader($entry.Open())
        try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
    } finally { $zip.Dispose() }
}
function Pass([string]$Name) { $script:passed++; Write-Host "PASS $Name" -ForegroundColor Green }
try {
    [void][IO.Directory]::CreateDirectory($testRoot)
    $fixture = New-Fixture 'default'
    Write-Text (Join-Path $fixture.Work 'new.txt') 'new tracked content'
    Write-Text (Join-Path $fixture.Work '.env') 'DUMMY_ONLY=full-backup-fixture'
    Write-Text (Join-Path $fixture.Work 'node_modules\dependency\index.js') 'ignored dependency'
    Write-Text (Join-Path $fixture.Work '.hidden.txt') 'hidden content'
    [IO.File]::SetAttributes((Join-Path $fixture.Work '.hidden.txt'), [IO.FileAttributes]::Hidden)
    [void][IO.Directory]::CreateDirectory((Join-Path $fixture.Work 'dist\empty'))
    [void](Backup $fixture)
    $zip = @(Archives $fixture)
    Assert ($zip.Count -eq 1) 'default creates one dated ZIP'
    Assert ($zip[0].Name -match '^Bozkurt Obası_\d{4}-\d{2}-\d{2}_\d{6}\.zip$') 'exact timestamp filename'
    Assert ((Git $fixture.Work @('rev-parse', 'HEAD')) -eq (Git $fixture.Remote @('rev-parse', 'refs/heads/main'))) 'default pushes commit'
    Assert ((Git $fixture.Work @('show', 'HEAD:new.txt')) -eq 'new tracked content') 'default stages new files'
    Assert ((Git $fixture.Work @('ls-files', '--', '.env')) -eq '') 'ignored secret never enters Git'
    Assert ((Zip-Text $zip[0].FullName '.env') -eq 'DUMMY_ONLY=full-backup-fixture') 'ignored .env retained'
    Assert ((Zip-Text $zip[0].FullName 'node_modules/dependency/index.js') -eq 'ignored dependency') 'ignored dependency retained'
    Assert ((Zip-Text $zip[0].FullName '.hidden.txt') -eq 'hidden content') 'hidden file retained'
    $archive = [IO.Compression.ZipFile]::OpenRead($zip[0].FullName)
    try {
        Assert ($null -ne $archive.GetEntry('.git/config')) '.git retained'
        Assert ($null -ne $archive.GetEntry('dist/empty/')) 'ignored empty directory retained'
        foreach ($entry in $archive.Entries) {
            $stream = $entry.Open()
            try { $stream.CopyTo([IO.Stream]::Null) } finally { $stream.Dispose() }
        }
    } finally { $archive.Dispose() }
    $referenceZip = $zip[0].FullName
    Pass 'default commit/push, Unicode path, hidden/ignored files, readable ZIP and empty folders'

    $headBefore = Git $fixture.Work @('rev-parse', 'HEAD')
    [void](Backup $fixture @('-BackupOnly'))
    Assert (@(Archives $fixture).Count -eq 2) 'repeat creates independent ZIP'
    Assert ((Git $fixture.Work @('rev-parse', 'HEAD')) -eq $headBefore) 'BackupOnly never commits'
    Pass 'BackupOnly verifies published HEAD and preserves previous ZIP'

    $fixture = New-Fixture 'staged'
    Write-Text (Join-Path $fixture.Work 'tracked.txt') 'reviewed staged version'
    [void](Git $fixture.Work @('add', '--', 'tracked.txt'))
    Write-Text (Join-Path $fixture.Work 'tracked.txt') 'unfinished local version'
    Write-Text (Join-Path $fixture.Work 'README - 2.md') 'unrelated local notes'
    Write-Text (Join-Path $fixture.Work '.gitignore.example') 'unrelated ignore example'
    Write-Text (Join-Path $fixture.Work 'secrets.json') '{"dummy":"local-only fixture"}'
    [void](Backup $fixture @('-StagedOnly', '-CommitMessage', 'reviewed change'))
    Assert ((Git $fixture.Work @('show', 'HEAD:tracked.txt')) -eq 'reviewed staged version') 'StagedOnly uses index content'
    Assert ((Git $fixture.Work @('ls-files', '--', 'README - 2.md', '.gitignore.example', 'secrets.json')) -eq '') 'unrelated untracked paths excluded from Git'
    $zip = @(Archives $fixture)[0]
    Assert ((Zip-Text $zip.FullName 'tracked.txt') -eq 'unfinished local version') 'ZIP includes unstaged contents'
    Assert ((Zip-Text $zip.FullName 'secrets.json') -match 'local-only fixture') 'local secret included in ZIP'
    Pass 'StagedOnly reviewed index; complete local snapshot'

    $fixture = New-Fixture 'unpublished'
    Write-Text (Join-Path $fixture.Work 'tracked.txt') 'unpublished'
    [void](Git $fixture.Work @('add', '-A'))
    [void](Git $fixture.Work @('commit', '--quiet', '-m', 'local only'))
    $localHead = Git $fixture.Work @('rev-parse', 'HEAD')
    $remoteBefore = Git $fixture.Remote @('rev-parse', 'refs/heads/main')
    [void](Backup $fixture @('-BackupOnly') 1)
    Assert (@(Archives $fixture).Count -eq 0) 'unpublished HEAD creates no ZIP'
    Assert ((Git $fixture.Work @('rev-parse', 'HEAD')) -eq $localHead) 'local HEAD unchanged'
    Assert ((Git $fixture.Remote @('rev-parse', 'refs/heads/main')) -eq $remoteBefore) 'BackupOnly never pushes'
    [void](Backup $fixture @('-BackupOnly', '-StagedOnly') 1)
    Pass 'unpublished HEAD rejected; mode switches mutually exclusive'

    $fixture = New-Fixture 'history'
    $remoteBefore = Git $fixture.Remote @('rev-parse', 'refs/heads/main')
    Write-Text (Join-Path $fixture.Work '.env') 'DUMMY_ONLY=must-not-push'
    [void](Git $fixture.Work @('add', '-f', '--', '.env'))
    [void](Git $fixture.Work @('commit', '--quiet', '-m', 'secret fixture'))
    [void](Git $fixture.Work @('rm', '--quiet', '--', '.env'))
    [void](Git $fixture.Work @('commit', '--quiet', '-m', 'remove secret fixture'))
    $result = Backup $fixture @('-StagedOnly') 1
    Assert ($result.Output -match 'hassas dosya') 'history scan detects secret'
    Assert ((Git $fixture.Remote @('rev-parse', 'refs/heads/main')) -eq $remoteBefore) 'secret history never pushed'
    Assert (@(Archives $fixture).Count -eq 0) 'history rejection creates no ZIP'
    Pass 'outgoing history secret rejected after deletion'

    $fixture = New-Fixture 'rename'
    [void][IO.Directory]::CreateDirectory((Join-Path $fixture.Work 'ğünlük dosyalar'))
    [void](Git $fixture.Work @('mv', '--', 'move.txt', 'ğünlük dosyalar/.env'))
    $before = Git $fixture.Work @('rev-parse', 'HEAD')
    $result = Backup $fixture @('-StagedOnly') 1
    Assert ($result.Output -match 'hassas dosya') 'Unicode and spaced-path secret rename detected'
    Assert ((Git $fixture.Work @('rev-parse', 'HEAD')) -eq $before) 'secret rename not committed'
    Assert (@(Archives $fixture).Count -eq 0) 'rename rejection creates no ZIP'
    Pass 'NUL paths handle Unicode and spaced-path rename'

    $fixture = New-Fixture 'push-failure'
    Write-Text (Join-Path $fixture.Remote 'hooks\pre-receive') "#!/bin/sh`nexit 1`n"
    Write-Text (Join-Path $fixture.Work 'tracked.txt') 'rejected push'
    $before = Git $fixture.Remote @('rev-parse', 'refs/heads/main')
    [void](Backup $fixture @() 1)
    Assert ((Git $fixture.Remote @('rev-parse', 'refs/heads/main')) -eq $before) 'failed push leaves remote unchanged'
    Assert (@(Archives $fixture).Count -eq 0) 'failed push creates no ZIP'
    Pass 'failed push prevents backup'

    $fixture = New-Fixture 'retention'
    [void][IO.Directory]::CreateDirectory($fixture.Folder)
    for ($index = 1; $index -le 31; $index++) {
        $path = Join-Path $fixture.Folder ('Bozkurt Obası_2000-01-{0:00}_000000.zip' -f $index)
        Copy-Item -LiteralPath $referenceZip -Destination $path
        [IO.File]::SetLastWriteTimeUtc($path, [DateTime]::UtcNow.AddDays(40 - $index))
    }
    $protected = @('other_1999-01-01_000000.zip', 'manual.zip', 'Bozkurt Obası_1999-01-01_000000.zip', '.Bozkurt Obası_existing.partial')
    foreach ($name in $protected) { Write-Text (Join-Path $fixture.Folder $name) 'protected sentinel' }
    $invalidDate = Join-Path $fixture.Folder 'Bozkurt Obası_2000-02-31_000000.zip'
    Copy-Item -LiteralPath $referenceZip -Destination $invalidDate
    [void](Backup $fixture @('-BackupOnly'))
    foreach ($day in @('01', '02')) { Assert (-not (Test-Path -LiteralPath (Join-Path $fixture.Folder "Bozkurt Obası_2000-01-${day}_000000.zip"))) "oldest $day removed by filename date" }
    Assert (Test-Path -LiteralPath (Join-Path $fixture.Folder 'Bozkurt Obası_2000-01-03_000000.zip')) 'recent valid archives retained'
    foreach ($name in $protected) { Assert (([IO.File]::ReadAllText((Join-Path $fixture.Folder $name))) -eq 'protected sentinel') "retention preserves $name" }
    Assert (Test-Path -LiteralPath $invalidDate) 'invalid date archive preserved'
    $retained = @(Get-ChildItem -LiteralPath $fixture.Folder -File | Where-Object { $_.Name -match '^Bozkurt Obası_(2000-01-|20[2-9][0-9]-)' })
    Assert ($retained.Count -eq 30) 'default retains exactly 30 dated valid archives'
    Pass 'last 30 by name date; unrelated, partial and invalid files preserved'

    $fixture = New-Fixture 'boundaries'
    [void](Backup $fixture @('-KeepBackups', '0') 1)
    [void](Backup $fixture @('-ProjectName', '..\outside') 1)
    $inside = Join-Path $fixture.Work 'inside-backups'
    [void][IO.Directory]::CreateDirectory($inside)
    $result = Run 'powershell.exe' @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $fixture.Work 'push-and-backup.ps1'), '-BackupRoot', $inside, '-BackupOnly') $fixture.Work
    Assert ($result.Code -eq 1) 'destination inside repository rejected'
    Assert (@(Archives $fixture).Count -eq 0) 'invalid parameters create no ZIP'
    Pass 'retention, project name and destination validation'

    $fixture = New-Fixture 'locked-source'
    [void][IO.Directory]::CreateDirectory($fixture.Folder)
    $previousZip = Join-Path $fixture.Folder 'Bozkurt Obası_2000-01-01_000000.zip'
    Copy-Item -LiteralPath $referenceZip -Destination $previousZip
    $sentinel = Join-Path $fixture.Folder '.another-process.partial'
    Write-Text $sentinel 'keep other partial'
    $lockedPath = Join-Path $fixture.Work 'local-data\locked.txt'
    Write-Text $lockedPath 'locked local file'
    $lock = [IO.File]::Open($lockedPath, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try { [void](Backup $fixture @('-BackupOnly') 1) }
    finally { $lock.Dispose() }
    Assert (@(Archives $fixture).Count -eq 1) 'archive failure preserves prior ZIP and publishes none'
    Assert ([IO.File]::ReadAllText($sentinel) -eq 'keep other partial') 'another process partial is untouched'
    $partials = @(Get-ChildItem -LiteralPath $fixture.Folder -Force -File -Filter '*.partial')
    Assert ($partials.Count -eq 1) 'failed archive cleans only its own partial'
    Pass 'locked source failure preserves old ZIP and cleans owned partial'

    # Corrupt content with the same filename and byte length must fail the SHA check.
    $tokens = $null
    $parseErrors = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile($sourceScript, [ref]$tokens, [ref]$parseErrors)
    $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-FullZip' }, $false)
    Invoke-Expression $definition.Extent.Text
    $corruptPath = Join-Path $testRoot 'corrupted.zip'
    $archive = [IO.Compression.ZipFile]::Open($corruptPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $entry = $archive.CreateEntry('sample.txt')
        $stream = $entry.Open()
        try { $bytes = [Text.Encoding]::UTF8.GetBytes('changed'); $stream.Write($bytes, 0, $bytes.Length) }
        finally { $stream.Dispose() }
    } finally { $archive.Dispose() }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $expectedHash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes('desired'))) }
    finally { $sha.Dispose() }
    $rejected = $false
    try { Assert-FullZip $corruptPath @([pscustomobject]@{ Name='sample.txt'; Directory=$false; Length=7L; Hash=$expectedHash }) }
    catch { $rejected = $_.Exception.Message -match 'SHA-256' }
    Assert $rejected 'same-length corrupt contents rejected by SHA-256'
    Pass 'full SHA-256 verification rejects same-length corrupt content'
    $fixture = New-Fixture 'junction'
    $external = Join-Path $testRoot 'outside-source'
    [void][IO.Directory]::CreateDirectory($external)
    Write-Text (Join-Path $external 'outside.txt') 'junction target'
    $link = Join-Path $fixture.Work 'linked-directory'
    [void](New-Item -ItemType Junction -Path $link -Target $external)
    $testLinks.Add($link)
    $before = Git $fixture.Work @('rev-parse', 'HEAD')
    $result = Backup $fixture @() 1
    Assert ($result.Output -match 'junction') 'unsupported junction rejected explicitly'
    Assert ((Git $fixture.Work @('rev-parse', 'HEAD')) -eq $before) 'link failure before commit'
    Assert (@(Archives $fixture).Count -eq 0) 'no incomplete link backup'
    Pass 'junction rejected before Git publication'
    Write-Host "`n$passed offline backup integration tests passed. No network or real project Git changes." -ForegroundColor Green
}
finally {
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^bozkurt-backup-tests-[a-f0-9]{32}$') {
        throw "Refusing cleanup outside owned temp fixture: $resolved"
    }
    foreach ($link in $testLinks) { if (Test-Path -LiteralPath $link) { [IO.Directory]::Delete($link) } }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
