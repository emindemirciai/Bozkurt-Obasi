$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $Root
docker compose -f infrastructure/nakama/docker-compose.yml up -d
Write-Host "Nakama: http://127.0.0.1:7350"
Write-Host "Console: http://127.0.0.1:7351 (admin / password)"
