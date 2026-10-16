$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$source = Join-Path $project 'installer\CPSUniversalDownloader.iss'
$portable = Join-Path $project 'build-v1.2.3\CPSUniversalDownloader.exe'
$compilerCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')
)
$compiler = $compilerCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if (-not (Test-Path -LiteralPath $portable)) {
    throw "Build the standalone EXE first: $portable"
}
if (-not $compiler) {
    throw 'Inno Setup 6 was not found. Install JRSoftware.InnoSetup with winget, then run this script again.'
}

& $compiler $source
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }

$installer = Join-Path $project 'release\CPS-Universal-Downloader-v1.2.3-Setup.exe'
if (-not (Test-Path -LiteralPath $installer)) { throw "Installer output is missing: $installer" }
Write-Host "Per-user installer: $installer"
