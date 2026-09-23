$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $Root
docker compose -f infrastructure/nakama/docker-compose.yml down
