param(
    [string]$UnityPath = "C:\Program Files\Unity\Hub\Editor\6000.3.17f1\Editor\Unity.exe"
)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ProjectPath = Join-Path $RepoRoot "client"
$LogPath = Join-Path $RepoRoot "Builds\Logs\android-aab.log"
New-Item -ItemType Directory -Force (Split-Path $LogPath) | Out-Null
if (-not (Test-Path $UnityPath)) { throw "Unity bulunamadı: $UnityPath" }
& $UnityPath -batchmode -quit -projectPath $ProjectPath -executeMethod Bozkurt.Editor.BozkurtBuildPipeline.BuildAndroidAabCommandLine -logFile $LogPath
if ($LASTEXITCODE -ne 0) { throw "AAB build başarısız. Log: $LogPath" }
Write-Host "AAB hazır: $RepoRoot\Builds\Android\Bozkurt-Muhafizlari.aab"
