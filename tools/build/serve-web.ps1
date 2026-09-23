param([int]$Port = 8080)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$WebRoot = Join-Path $RepoRoot "Builds\WebGL"
if (-not (Test-Path (Join-Path $WebRoot "index.html"))) {
    throw "WebGL build bulunamadı. Önce build-web.ps1 çalıştırın."
}
$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) { throw "Python bulunamadı. Docker/Nginx ile çalıştırabilirsiniz." }
python (Join-Path $PSScriptRoot "serve_web.py") --root $WebRoot --port $Port
