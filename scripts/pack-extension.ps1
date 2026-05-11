$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$extensionDir = Join-Path $repoRoot "chrome-extension"
$distDir = Join-Path $repoRoot "dist"
$manifestPath = Join-Path $extensionDir "manifest.json"

if (-not (Test-Path $manifestPath)) {
  throw "Extension manifest was not found at $manifestPath"
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$safeName = ($manifest.name -replace "[^a-zA-Z0-9.-]+", "-").Trim("-").ToLowerInvariant()
$zipPath = Join-Path $distDir "$safeName-v$($manifest.version).zip"

if (-not (Test-Path $distDir)) {
  New-Item -ItemType Directory -Path $distDir | Out-Null
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath
}

Compress-Archive -Path (Join-Path $extensionDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Packed Chrome extension:"
Write-Host $zipPath
