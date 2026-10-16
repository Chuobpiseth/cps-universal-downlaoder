# CPS Universal Downloader 1.2.3

A polished Windows video workspace for downloading authorized media, converting files, creating subtitles, and understanding videos with AI.

## Development

1. In `frontend`, run `..\..\tools\deno.exe install --frozen` and `..\..\tools\deno.exe task build`.
2. Create `.venv` and install `requirements.txt`.
3. Run `.venv\Scripts\python.exe backend\app.py`.

## Single-file release

Run `build-portable.ps1`. It compiles the UI, runs tests, and creates:

- `build-v1.2.3\CPSUniversalDownloader.exe`
- `release\CPS-Universal-Downloader-v1.2.3-Portable.exe`
- `release\CPS-Universal-Downloader-v1.2.3-Windows-x64-Single-EXE.zip`
- `release\CPS-Universal-Downloader-v1.2.3-Setup.exe`

Customers can open the standalone EXE directly or use the per-user installer. Neither format requires Python or Node. Both store personal state in `%LOCALAPPDATA%\CPS Universal Downloader`.

To build the installer after the standalone EXE, install Inno Setup 6 and run `build-installer.ps1`.

Use Settings → Browser extension to test the local bridge and export the embedded Chrome/Edge extension to a folder for **Load unpacked**.

The Premium edition is currently open to every user and does not require a license key. Its local converter handles common video, audio, and image workflows through the bundled FFmpeg engine.

AI settings support up to ten encrypted Gemini keys with automatic rotation, an OpenAI-compatible custom endpoint, and an optional Florence-2 model that downloads on first use and runs thumbnail analysis locally. Closing the window keeps active work running in the Windows system tray; use the tray menu to reopen or fully quit the app.

Download and conversion destinations are configured independently in Settings. The Convert page also shows its current destination and can open it directly; completed jobs reveal the exact output file in Explorer. Fast playlist analysis keeps the UI responsive and fills missing YouTube playlist artwork from each stable video ID.

History stores the exact final output path and automatically repairs older entries whose Unicode filenames were decoded incorrectly. The History page also contains a persistent activity log for analysis, queue, download, completion, cancellation, and error events.

Version 1.2.3 adds automatic GitHub release checks, a verified in-app installer with download progress and restart, Gemini Flash model fallback during temporary overload, clearer Facebook authentication errors, and controls for removing stopped or failed transfers from Downloads. Update installers are accepted only from this project's GitHub releases and must match the published SHA-256 checksum.

Version 1.2.2 stores each user's settings, encrypted API keys, queue, history, and logs in `%LOCALAPPDATA%\CPS Universal Downloader`, so both the standalone EXE and per-user installer preserve data across upgrades. It also repairs scheduling when the browser extension sends another video during an active batch and reports removed videos clearly.

The installer uses `%LOCALAPPDATA%\Programs\CPS Universal Downloader`, needs no administrator rights, and creates Start Menu and optional desktop shortcuts. Uninstalling the program leaves personal settings and history intact.

Analyzing a playlist or a pasted list never queues or downloads media. Playlist entries open unselected and require an explicit selection followed by **Download selected**. The former playlist/channel subscription module and its background auto-download monitor have been removed.

Playlist links are read with a fast flat metadata pass so the selectable video grid appears before individual formats are resolved. The browser extension scans standard video elements and open shadow roots on HTTP/HTTPS pages and adds a white glass Download control. Protected DRM streams are intentionally not bypassed.

Single-video links now skip the playlist probe, reducing duplicate network work during analysis. The bundled media engine identifies Douyin and SharePoint links. Signed-in browser cookies can be used for content the account is authorized to download; owner-blocked Microsoft downloads remain unavailable. KissKH has no dedicated extractor, so only unprotected streams detected by the browser extension may work.

Only download media you own or have permission to use. Site support depends on yt-dlp and each platform’s rules; the app does not bypass DRM.

The open build still has no license gate. A no-paid-server, device-bound licensing design for a future commercial edition is documented in `FREE-DEVICE-LICENSING.md`.

## Open Source & Support

CPS Universal Downloader is free and open-source software for everyone.

- **GitHub Repository**: [Chuobpiseth/cps-universal-downlaoder](https://github.com/Chuobpiseth/cps-universal-downlaoder)
- **Releases & Updates**: The application automatically checks GitHub Releases for new updates.

### Support Our Work ☕

If you enjoy using this tool and want to support our ongoing development and updates, you can buy me a coffee via **ABA KHQR** (scannable in the app's About page).

