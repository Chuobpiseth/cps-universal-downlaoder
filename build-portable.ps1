$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$parent = Split-Path $project -Parent
$deno = Join-Path $parent 'tools\deno.exe'
$python = 'python'
$venv = Join-Path $project '.venv'
$frontend = Join-Path $project 'frontend'
$dist = Join-Path $project 'build-v1.2.5'
$release = Join-Path $project 'release'
$appName = 'CPSUniversalDownloader.exe'

if (-not (Test-Path -LiteralPath $deno)) { throw "Deno is missing: $deno" }
if (-not (Test-Path -LiteralPath (Join-Path $parent 'tools\yt-dlp.exe'))) { throw 'The shared downloader tools are missing.' }

Push-Location $frontend
try { & $deno install --frozen; if ($LASTEXITCODE -eq 0) { & $deno task build } } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'React build failed.' }

if (-not (Test-Path -LiteralPath (Join-Path $venv 'Scripts\python.exe'))) {
    & $python -m venv $venv
}
$venvPython = Join-Path $venv 'Scripts\python.exe'
& $venvPython -m pip install --disable-pip-version-check -r (Join-Path $project 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }

& $venvPython -m unittest discover -s (Join-Path $project 'tests') -v
if ($LASTEXITCODE -ne 0) { throw 'Python tests failed.' }

if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dist, $release | Out-Null

$icon = Join-Path $project 'assets\app_icon.ico'
$versionInfo = Join-Path $project 'assets\version_info.txt'
$entry = Join-Path $project 'backend\app.py'
$frontendDist = Join-Path $frontend 'dist'
$tools = Join-Path $parent 'tools'

& $venvPython -m PyInstaller --noconfirm --clean --windowed --onefile `
    --name 'CPSUniversalDownloaderReact' `
    --icon $icon `
    --version-file $versionInfo `
    --runtime-tmpdir '.cps-runtime' `
    --distpath $dist `
    --workpath (Join-Path $project 'build-temp') `
    --specpath (Join-Path $project 'build-temp') `
    --collect-all webview `
    --add-data "$frontendDist;frontend" `
    --add-data "$tools;tools" `
    --add-data "$(Join-Path $project 'browser-extension');browser-extension" `
    $entry
if ($LASTEXITCODE -ne 0) { throw 'Portable executable build failed.' }

$portable = Join-Path $dist $appName
Move-Item -LiteralPath (Join-Path $dist 'CPSUniversalDownloaderReact.exe') -Destination $portable
$releaseExe = Join-Path $release 'CPS-Universal-Downloader-v1.2.5-Portable.exe'
Copy-Item -LiteralPath $portable -Destination $releaseExe -Force

$zip = Join-Path $release 'CPS-Universal-Downloader-v1.2.5-Windows-x64-Single-EXE.zip'
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -LiteralPath $portable -DestinationPath $zip -CompressionLevel Optimal
Write-Host "Single-file portable app: $portable"
Write-Host "Shareable portable app: $releaseExe"
Write-Host "Release archive: $zip"
