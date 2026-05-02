$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$targetDir = if ($env:AIDERDESK_EXTENSIONS_DIR) {
  $env:AIDERDESK_EXTENSIONS_DIR
} else {
  Join-Path $HOME ".aider-desk\extensions"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

Get-ChildItem -Path (Join-Path $rootDir "packages\extensions\extensions") -Directory -Filter "helpy-*" | ForEach-Object {
  $destination = Join-Path $targetDir $_.Name
  if (Test-Path $destination) {
    Remove-Item -Recurse -Force -LiteralPath $destination
  }
  Copy-Item -Recurse -Force -LiteralPath $_.FullName -Destination $destination
}

Write-Host "Helpy extensions installed to: $targetDir"
Write-Host "Restart AiderDesk, or wait for extension hot reload."
Write-Host ""
Write-Host "Installed:"
Get-ChildItem -Path $targetDir -Directory -Filter "helpy-*" | Sort-Object Name | ForEach-Object {
  Write-Host "  - $($_.Name)"
}
