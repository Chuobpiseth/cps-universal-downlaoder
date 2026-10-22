# Changelog

## 1.2.8 Telegram and maximum-quality update - 2026-10-22

- Added Telegram Web media controls directly to browser extension 3.6.0; Tampermonkey is not required.
- Restricted the Telegram integration to Telegram Web and kept the generic CPS overlay off those pages to prevent duplicate controls.
- Changed automatic Best quality to select the highest-resolution video stream and merge the best available audio with FFmpeg.
- Cleared stale exact-format selections whenever a Quick Preset is selected.
- Added automatic best-audio merging when users manually select a video-only 2K or 4K stream.

## 1.2.7 TikTok compatibility hotfix - 2026-10-21

- Added automatic TikTok analysis and download retry for current HTTP 403 browser-identity blocks.
- Kept the browser Download control available when TikTok does not expose its video element to content scripts.
- Updated the browser extension to 3.5.2 without injecting into or mutating the TikTok player.
- Verified the reported TikTok link through metadata extraction and a complete MP4 download.

## 1.2.3 — 2026-10-05

- Added automatic application update checks against GitHub Releases.
- Added a Settings update card with release status, download progress, verified installation, and automatic restart.
- Required HTTPS GitHub assets and matching SHA-256 checksums before an update can run.
- Added automatic fallback to compatible Gemini Flash models when the selected model is overloaded.
- Improved Facebook authentication and restricted-video error guidance.
- Verified Facebook share/Reel redirect analysis and high-quality video/audio merging.
- Added individual removal and bulk cleanup for failed, cancelled, or paused downloads.
- Preserved queued and actively downloading items during cleanup.

