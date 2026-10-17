# CPS Universal Downloader 1.2.6

A polished Windows video workspace for downloading authorized media, converting files, creating subtitles, and understanding videos with multi-provider AI.

## Development

1. In `frontend`, run `..\..\tools\deno.exe install --frozen` and `..\..\tools\deno.exe task build`.
2. Create `.venv` and install `requirements.txt`.
3. Run `.venv\Scripts\python.exe backend\app.py`.

## Single-file release

Run `build-portable.ps1`. It compiles the UI, runs tests, and creates:

- `build-v1.2.6\CPSUniversalDownloader.exe`
- `release\CPS-Universal-Downloader-v1.2.6-Portable.exe`
- `release\CPS-Universal-Downloader-v1.2.6-Windows-x64-Single-EXE.zip`
- `release\CPS-Universal-Downloader-v1.2.6-Setup.exe`

Customers can open the standalone EXE directly or use the per-user installer. Neither format requires Python or Node. Both store personal state in `%LOCALAPPDATA%\CPS Universal Downloader`.

To build the installer after the standalone EXE, install Inno Setup 6 and run `build-installer.ps1`.

Use Settings → Browser extension to test the local bridge and export the embedded Chrome/Edge extension to a folder for **Load unpacked**.

The Premium edition is currently open to every user and does not require a license key. Its local converter handles common video, audio, and image workflows through the bundled FFmpeg engine.

### Multi-Provider AI Intelligence

AI settings support multiple free and high-performance providers with DPAPI encryption on Windows:
- **Groq Cloud**: 7,000 free requests/day with ultra-fast inference (300+ tok/s). Runs Meta Llama 3.2 11B/90B Vision and Llama 3.3 70B for instant chat and thumbnail prompt extraction.
- **OpenRouter**: Access free-tier vision and reasoning models (`:free` models like Llama 3.2 Vision, Gemini 2.0 Flash, DeepSeek R1).
- **Inception Labs**: Diffusion language models (dLLMs) featuring Mercury 2.5 and Mercury 2 with a 260K context window.
- **CodeCraft API**: 1,000,000 free monthly tokens across 33 popular models without a credit card.
- **Google Gemini**: Up to 10 encrypted keys with automatic rotation and overload fallback.
- **Local Florence-2**: Optional offline model running thumbnail analysis without internet.

All API keys are encrypted at rest using Windows DPAPI (`CryptProtectData`).

Download and conversion destinations are configured independently in Settings. The Convert page also shows its current destination and can open it directly; completed jobs reveal the exact output file in Explorer. Fast playlist analysis keeps the UI responsive and fills missing YouTube playlist artwork from each stable video ID.

History stores the exact final output path and automatically repairs older entries whose Unicode filenames were decoded incorrectly. The History page also contains a persistent activity log for analysis, queue, download, completion, cancellation, and error events.

Version 1.2.6 fixes YouTube HTTP 429 rate-limiting, GVS PO token issues, and "Sign in to confirm you're not a bot" errors with automatic multi-client fallback (`player_client=default,web_creator,android,ios,mweb`), intelligent in-process retry, and expanded browser cookie authentication for Brave, Opera, Vivaldi, and Chromium.

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

