from __future__ import annotations

import base64
import ctypes
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from ctypes import wintypes
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlparse


APP_NAME = "CPS Universal Downloader Premium"
APP_VERSION = "1.2.4"
GITHUB_REPOSITORY = "Chuobpiseth/cps-universal-downlaoder"
GITHUB_RELEASE_API = f"https://api.github.com/repos/{GITHUB_REPOSITORY}/releases/latest"
CODECRAFT_API_BASE = "https://codecraftapi.com/v1"
SOURCE_ROOT = Path(__file__).resolve().parents[1]
BUNDLE_ROOT = Path(getattr(sys, "_MEIPASS", SOURCE_ROOT))
APP_ROOT = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else SOURCE_ROOT


def resolve_data_dir(*, frozen: bool, app_root: Path = APP_ROOT, source_root: Path = SOURCE_ROOT) -> Path:
    """Keep packaged-app state in the current Windows user's Local AppData."""
    override = os.environ.get("CPS_DATA_DIR", "").strip()
    if override:
        return Path(override).expanduser()
    if not frozen:
        return source_root / "data"
    local_app_data = os.environ.get("LOCALAPPDATA", "").strip()
    base = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
    return base / "CPS Universal Downloader"


DATA_DIR = resolve_data_dir(frozen=bool(getattr(sys, "frozen", False)))
DATA_DIR.mkdir(parents=True, exist_ok=True)


def migrate_legacy_data() -> None:
    """Copy data from older portable releases once, without overwriting newer state."""
    if not getattr(sys, "frozen", False) or os.environ.get("CPS_DATA_DIR"):
        return
    legacy = APP_ROOT / "data"
    try:
        if not legacy.is_dir() or legacy.resolve() == DATA_DIR.resolve():
            return
        for name in (
            "settings.json",
            "queue.json",
            "history.json",
            "activity-log.json",
            "workflow-recipes.json",
            "gemini-key.bin",
            "codecraft-key.bin",
            "custom-ai-key.bin",
            "download-archive.txt",
        ):
            source, destination = legacy / name, DATA_DIR / name
            if source.is_file() and not destination.exists():
                shutil.copy2(source, destination)
        for name in ("transcripts", "job-paths"):
            source, destination = legacy / name, DATA_DIR / name
            if source.is_dir() and not destination.exists():
                shutil.copytree(source, destination)
    except OSError:
        # A read-only legacy folder must never prevent the new application from starting.
        pass


migrate_legacy_data()


def version_tuple(value: str) -> tuple[int, ...]:
    numbers = re.findall(r"\d+", str(value).lstrip("vV"))
    return tuple(int(number) for number in numbers[:4]) or (0,)


def compact_format(entry: dict[str, Any]) -> dict[str, Any]:
    """Return only useful, JSON-safe format fields for the format inspector."""
    size = entry.get("filesize") or entry.get("filesize_approx")
    return {
        "id": str(entry.get("format_id") or ""),
        "label": str(entry.get("format_note") or entry.get("resolution") or entry.get("format") or "Unknown"),
        "extension": str(entry.get("ext") or ""),
        "resolution": str(entry.get("resolution") or (f'{entry.get("width")}x{entry.get("height")}' if entry.get("width") and entry.get("height") else "audio only" if entry.get("vcodec") == "none" else "—")),
        "fps": entry.get("fps"),
        "videoCodec": str(entry.get("vcodec") or "none"),
        "audioCodec": str(entry.get("acodec") or "none"),
        "hdr": str(entry.get("dynamic_range") or "SDR"),
        "bitrate": entry.get("tbr"),
        "size": size,
        "protocol": str(entry.get("protocol") or ""),
    }


def classify_download_error(lines: list[str]) -> dict[str, str]:
    text = "\n".join(lines[-30:]).lower()
    if "[facebook" in text and any(marker in text for marker in ("cannot parse data", "no video formats", "login", "log in", "age-restricted")):
        return {"code": "facebook-auth", "message": "Facebook did not expose downloadable video formats for this session.", "action": "Sign into Facebook in Edge or Chrome, select that browser in Settings, fully close it, and retry."}
    if "video is unavailable" in text or "this video is unavailable" in text or "has been removed" in text:
        return {"code": "unavailable", "message": "This video is unavailable or has been removed.", "action": "Open the link in your browser or choose another video."}
    if "sign in" in text or "cookies" in text or "login" in text:
        return {"code": "authentication", "message": "This site requires a signed-in browser session.", "action": "Choose browser cookies in Settings, close the browser, then retry."}
    if "database is locked" in text or ("cookie" in text and ("lock" in text or "could not copy" in text)):
        return {"code": "cookie-locked", "message": "Browser cookie database is locked while the browser is running.", "action": "Close your browser completely (or set browser cookies to None in Settings), then retry."}
    if "requested format is not available" in text:
        return {"code": "format", "message": "The selected format is unavailable.", "action": "Retry with Best or Auto quality."}
    if "http error 403" in text or "forbidden" in text:
        return {"code": "forbidden", "message": "The media server refused the request.", "action": "Refresh browser cookies or retry with fewer fragments."}
    if "unsupported url" in text:
        return {"code": "unsupported", "message": "This address is not supported by the current download engine.", "action": "Check for an engine update or use the direct video page URL."}
    if "timed out" in text or "connection" in text:
        return {"code": "network", "message": "The network connection was interrupted.", "action": "Retry; partial downloads resume automatically."}
    return {"code": "unknown", "message": "The download engine stopped before completion.", "action": "Open the item details, try Best quality, or refresh authentication."}


def tool_path(name: str) -> Path:
    candidates = [BUNDLE_ROOT / "tools" / name, SOURCE_ROOT / "tools" / name, SOURCE_ROOT.parent / "tools" / name]
    return next((path for path in candidates if path.exists()), candidates[0])


def frontend_path() -> Path:
    candidates = [BUNDLE_ROOT / "frontend", SOURCE_ROOT / "frontend" / "dist"]
    return next((path for path in candidates if (path / "index.html").exists()), candidates[0])


def child_process_environment() -> dict[str, str]:
    """Keep a bundled PyInstaller child from mistaking the desktop app for itself."""
    environment = os.environ.copy()
    for name in list(environment):
        if name.startswith("_PYI_") or name == "_MEIPASS2":
            environment.pop(name, None)
    return environment


def validate_url(value: str) -> str:
    value = (value or "").strip()
    if not re.match(r"^https?://[^\s]+$", value, re.IGNORECASE):
        raise ValueError("Enter a valid http:// or https:// video address.")
    return value


def looks_like_collection_url(value: str) -> bool:
    """Choose the quick flat pass only for links that are likely collections."""
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    path = parsed.path.lower().rstrip("/")
    query = parse_qs(parsed.query)
    if "list" in query:
        return True
    if host.endswith(("youtube.com", "youtu.be")):
        return any(marker in path for marker in ("/playlist", "/channel/", "/c/", "/user/", "/@", "/videos")) and "/watch" not in path
    if host.endswith(("tiktok.com", "douyin.com")):
        return any(marker in path for marker in ("/@", "/user/", "/tag/", "/music/", "/sound/", "/collection/")) and "/video/" not in path
    return any(marker in path for marker in ("/playlist/", "/channel/", "/series/", "/collection/"))


def format_selector(quality: str) -> str:
    limits = {
        "4K / 2160p": 2160, "2160p": 2160, "2160": 2160, "4k": 2160, "4K": 2160,
        "1440p": 1440, "1440": 1440, "2k": 1440, "2K": 1440,
        "1080p": 1080, "1080": 1080,
        "720p": 720, "720": 720,
        "480p": 480, "480": 480,
        "360p": 360, "360": 360,
    }
    height = limits.get(quality.strip()) if isinstance(quality, str) else None
    if height:
        return f"bv*[height<=?{height}]+ba/b[height<=?{height}]/bv*+ba/b/best"
    return "bv*+ba/b/best"


def parse_progress(line: str) -> dict[str, Any] | None:
    stage = "Downloading" if line.startswith("download:") else "Processing" if line.startswith("postprocess:") else None
    if not stage:
        if line.startswith(("[Merger]", "[ExtractAudio]", "[Metadata]", "[EmbedThumbnail]", "[VideoRemuxer]")):
            return {"stage": "Processing"}
        return None
    payload = line.split(":", 1)[1].split("|")
    match = re.search(r"([\d.]+)", payload[0]) if payload else None
    return {
        "stage": stage,
        "progress": float(match.group(1)) if match else None,
        "speed": payload[1].strip() if len(payload) > 1 else "",
        "eta": payload[2].strip() if len(payload) > 2 else "",
    }


class DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _blob(data: bytes) -> tuple[DataBlob, Any]:
    buffer = ctypes.create_string_buffer(data)
    return DataBlob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte))), buffer


def protect_secret(value: str) -> bytes:
    if os.name != "nt":
        return base64.b64encode(value.encode("utf-8"))
    source, source_buffer = _blob(value.encode("utf-8"))
    output = DataBlob()
    if not ctypes.windll.crypt32.CryptProtectData(ctypes.byref(source), APP_NAME, None, None, None, 0, ctypes.byref(output)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.pbData, output.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(output.pbData)


def unprotect_secret(value: bytes) -> str:
    if os.name != "nt":
        return base64.b64decode(value).decode("utf-8")
    source, source_buffer = _blob(value)
    output = DataBlob()
    if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(source), None, None, None, None, 0, ctypes.byref(output)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.pbData, output.cbData).decode("utf-8")
    finally:
        ctypes.windll.kernel32.LocalFree(output.pbData)


class LocalExtensionServer:
    PORT = 38473

    def __init__(self, api: "DesktopApi", token: str) -> None:
        self.api = api
        self.token = token
        self.server: ThreadingHTTPServer | None = None
        self.error = ""
        try:
            owner = self

            class Handler(BaseHTTPRequestHandler):
                def log_message(self, _format: str, *args: Any) -> None:
                    return

                def _origin(self) -> str | None:
                    origin = self.headers.get("Origin", "")
                    return origin if origin.startswith(("chrome-extension://", "extension://", "moz-extension://")) else None

                def _reply(self, status: int, payload: dict[str, Any] | None = None) -> None:
                    body = json.dumps(payload or {}).encode("utf-8") if status != 204 else b""
                    self.send_response(status)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Access-Control-Allow-Headers", "Content-Type, X-CPS-Token")
                    self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                    origin = self._origin()
                    if origin:
                        self.send_header("Access-Control-Allow-Origin", origin)
                        self.send_header("Vary", "Origin")
                    self.end_headers()
                    if body:
                        self.wfile.write(body)

                def _authorized(self) -> bool:
                    supplied = self.headers.get("X-CPS-Token", "")
                    return bool(supplied) and hmac.compare_digest(supplied, owner.token)

                def do_OPTIONS(self) -> None:
                    self._reply(204)

                def do_GET(self) -> None:
                    if not self._authorized():
                        self._reply(401, {"error": "Unauthorized"})
                    elif self.path.split("?", 1)[0] == "/status":
                        self._reply(200, {"name": APP_NAME, "version": APP_VERSION, "ready": True})
                    else:
                        self._reply(404, {"error": "Not found"})

                def do_POST(self) -> None:
                    if not self._authorized():
                        self._reply(401, {"error": "Unauthorized"})
                        return
                    path = self.path.split("?", 1)[0]
                    if path not in {"/add", "/analyze", "/download"}:
                        self._reply(404, {"error": "Not found"})
                        return
                    try:
                        length = int(self.headers.get("Content-Length", "0"))
                        if length < 1 or length > 16384:
                            raise ValueError("Invalid payload size")
                        payload = json.loads(self.rfile.read(length))
                        url = validate_url(str(payload.get("url", "")))
                        kind = "Audio" if str(payload.get("mode", "video")).lower() == "audio" else "Video"
                        quality = str(payload.get("quality") or "Best")
                        added = owner.api.add_urls([{"url": url}], {"kind": kind, "quality": quality, "format": "MP3" if kind == "Audio" else "MP4"})
                        if path == "/download":
                            owner.api.start_downloads(added["ids"])
                        self._reply(202, {"accepted": True, "count": added["count"]})
                    except Exception as exc:
                        self._reply(400, {"error": str(exc)})

            self.server = ThreadingHTTPServer(("127.0.0.1", self.PORT), Handler)
            threading.Thread(target=self.server.serve_forever, name="cps-extension-api", daemon=True).start()
        except OSError as exc:
            self.error = str(exc)

    @property
    def ready(self) -> bool:
        return self.server is not None

    def close(self) -> None:
        if self.server:
            self.server.shutdown()
            self.server.server_close()


class DesktopApi:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._shutdown = threading.Event()
        self._coordinator: threading.Thread | None = None
        self._scheduled_download_ids: set[str] = set()
        self._processes: dict[str, subprocess.Popen[str]] = {}
        self._conversion_processes: dict[str, subprocess.Popen[str]] = {}
        self._gemini_cursor = 0
        self._gemini_runtime_model = ""
        self._update_state: dict[str, Any] = {
            "status": "idle", "currentVersion": APP_VERSION, "latestVersion": "",
            "available": False, "progress": 0, "message": "Updates are checked automatically.",
        }
        self._force_exit = False
        self._tray_icon: Any = None
        # Keep the native pywebview object private. Public API attributes are
        # inspected for JavaScript exposure; traversing a WinForms/WebView2
        # window is both extremely slow and can recurse through native objects.
        self._window: Any = None
        self._settings_file = DATA_DIR / "settings.json"
        self._queue_file = DATA_DIR / "queue.json"
        self._history_file = DATA_DIR / "history.json"
        self._activity_file = DATA_DIR / "activity-log.json"
        self._recipes_file = DATA_DIR / "workflow-recipes.json"
        self._key_file = DATA_DIR / "gemini-key.bin"
        self._codecraft_key_file = DATA_DIR / "codecraft-key.bin"
        self._custom_key_file = DATA_DIR / "custom-ai-key.bin"
        self.settings = {**self._default_settings(), **self._load_json(self._settings_file, {})}
        if self.settings.get("language") == "ខ្មែរ":
            self.settings["language"] = "Khmer"
        if not self.settings.get("apiToken"):
            self.settings["apiToken"] = secrets.token_urlsafe(32)
            self._write_json(self._settings_file, self.settings)
        self.queue: list[dict[str, Any]] = self._load_json(self._queue_file, [])
        self.history: list[dict[str, Any]] = self._load_json(self._history_file, [])
        self.activity: list[dict[str, Any]] = self._load_json(self._activity_file, [])
        self.recipes: list[dict[str, Any]] = self._load_json(self._recipes_file, [])
        self.conversions: list[dict[str, Any]] = []
        for item in self.queue:
            if item.get("status") in {"Downloading", "Processing", "Analyzing"}:
                item["status"] = "Waiting"
        repaired = self._repair_output_paths()
        self._save_queue()
        if repaired:
            self._save_history()
        self._extension = LocalExtensionServer(self, self.settings["apiToken"])
        self._log_activity("info", "app", "CPS Universal Downloader started.")
        threading.Thread(target=self._automatic_update_check, name="cps-update-check", daemon=True).start()

    @staticmethod
    def _default_settings() -> dict[str, Any]:
        return {
            "theme": "System",
            "language": "English",
            "saveLocation": str(Path.home() / "Downloads"),
            "conversionLocation": str(Path.home() / "Videos" / "CPS Converted"),
            "parallelDownloads": 2,
            "concurrentFragments": 8,
            "browserCookies": "None",
            "preventDuplicates": True,
            "filenameTemplate": "%(title)s [%(id)s].%(ext)s",
            "apiToken": "",
            "aiProvider": "Gemini",
            "aiFallback": True,
            "geminiModel": "gemini-2.5-flash",
            "codecraftModel": "claude-opus-4.8",
            "customApiBase": "https://api.openai.com/v1",
            "customApiModel": "",
            "embedSubtitles": False,
            "subtitleLanguage": "en",
            "sponsorBlock": False,
            "splitChapters": False,
            "updateChannel": "Stable",
        }

    @staticmethod
    def _load_json(path: Path, fallback: Any) -> Any:
        try:
            return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback
        except (OSError, json.JSONDecodeError):
            return fallback

    @staticmethod
    def _write_json(path: Path, value: Any) -> None:
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    def _save_queue(self) -> None:
        self._write_json(self._queue_file, self.queue)

    def _save_history(self) -> None:
        self._write_json(self._history_file, self.history[:500])

    def _save_activity(self) -> None:
        self._write_json(self._activity_file, self.activity[:1000])

    def _save_recipes(self) -> None:
        self._write_json(self._recipes_file, self.recipes[:50])

    def _log_activity(self, level: str, event: str, message: str, item: dict[str, Any] | None = None) -> None:
        entry = {
            "id": uuid.uuid4().hex,
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "level": level,
            "event": event,
            "message": str(message).strip()[:2000],
            "itemId": str(item.get("id") or "") if item else "",
            "title": str(item.get("title") or "") if item else "",
        }
        with self._lock:
            self.activity.insert(0, entry)
            self.activity[:] = self.activity[:1000]
            self._save_activity()

    @staticmethod
    def _actual_output_path(stored_path: str) -> str:
        target = Path(stored_path or "")
        if target.is_file():
            return str(target)
        parent = target.parent
        if not stored_path or not parent.is_dir():
            return stored_path
        identifier_match = re.search(r"\[([^\[\]]+)\](?:_[^.]*)?\.[^.]+$", target.name)
        if not identifier_match:
            return stored_path
        marker = f"[{identifier_match.group(1)}]"
        candidates = [candidate for candidate in parent.iterdir() if candidate.is_file() and marker in candidate.name]
        if not candidates:
            return stored_path
        return str(max(candidates, key=lambda candidate: candidate.stat().st_mtime))

    @staticmethod
    def _find_recent_download(directory: Path, item: dict[str, Any]) -> str:
        if not directory.is_dir():
            return ""
        stem = DesktopApi._safe_stem(str(item.get("title") or ""))
        item_id = str(item.get("id") or "")
        now = time.time()
        candidates: list[tuple[int, float, Path]] = []
        try:
            for entry in directory.iterdir():
                if entry.is_file() and not entry.name.endswith((".part", ".ytdl", ".temp")):
                    try:
                        mtime = entry.stat().st_mtime
                        if now - mtime < 900:
                            score = 0
                            if stem and stem.lower() in entry.name.lower():
                                score += 10
                            if item_id and item_id in entry.name:
                                score += 5
                            candidates.append((score, mtime, entry))
                    except OSError:
                        continue
            if candidates:
                candidates.sort(key=lambda c: (c[0], c[1]), reverse=True)
                return str(candidates[0][2])
        except Exception:
            pass
        return ""

    def _repair_output_paths(self) -> bool:
        changed = False
        for item in [*self.queue, *self.history]:
            if item.get("status") != "Completed" or not item.get("outputPath"):
                continue
            repaired = self._actual_output_path(str(item["outputPath"]))
            if repaired != item["outputPath"]:
                item["outputPath"] = repaired
                changed = True
        return changed

    def _base_args(self) -> list[str]:
        args: list[str] = []
        deno = tool_path("deno.exe")
        if deno.exists():
            args += ["--js-runtimes", f"deno:{deno}"]
        cookie_source = str(self.settings.get("browserCookies", "None")).lower()
        if cookie_source in {"chrome", "edge", "firefox"}:
            args += ["--cookies-from-browser", cookie_source]
        return args

    def _run_json(self, args: list[str], timeout: int = 120) -> dict[str, Any]:
        executable = tool_path("yt-dlp.exe")
        if not executable.exists():
            raise FileNotFoundError("The bundled yt-dlp engine is missing.")
        result = subprocess.run([str(executable), *self._base_args(), *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
        if result.returncode:
            detail = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "The download engine could not process this address."
            raise RuntimeError(detail.removeprefix("ERROR: ").strip())
        return json.loads(result.stdout)

    def bootstrap(self) -> dict[str, Any]:
        settings = dict(self.settings)
        settings["hasGeminiKey"] = bool(self._gemini_keys())
        settings["geminiKeyCount"] = len(self._gemini_keys())
        settings["hasCodecraftApiKey"] = self._codecraft_key_file.exists()
        settings["hasCustomApiKey"] = self._custom_key_file.exists()
        return {"name": APP_NAME, "version": APP_VERSION, "settings": settings, "queue": self.queue, "history": self.history, "activity": self.activity, "recipes": self.list_workflow_recipes(), "conversions": self.conversions, "updateStatus": dict(self._update_state), "toolsReady": all(tool_path(name).exists() for name in ("yt-dlp.exe", "ffmpeg.exe", "ffprobe.exe", "deno.exe")), "extensionReady": self._extension.ready}

    def get_state(self) -> dict[str, Any]:
        with self._lock:
            return {"queue": list(self.queue), "history": list(self.history), "activity": list(self.activity), "recipes": self.list_workflow_recipes(), "conversions": list(self.conversions), "updateStatus": dict(self._update_state), "running": bool(self._coordinator and self._coordinator.is_alive())}

    def _friendly_analysis_error(self, url: str, detail: str) -> str:
        host = (urlparse(url).hostname or "").lower()
        lowered = detail.lower()
        if "kisskh" in host:
            return "KissKH is not directly supported by the current media engine. If the browser extension detects an unprotected video stream, send that stream to CPS; DRM-protected or encrypted episodes cannot be downloaded."
        if host.endswith("sharepoint.com") or host in {"1drv.ms", "onedrive.live.com"}:
            if any(marker in lowered for marker in ("block download", "access denied", "forbidden", "403", "not authorized", "permission")):
                return "Microsoft allows this file to be viewed but did not authorize downloading. Ask the owner to enable download permission; CPS does not bypass SharePoint or OneDrive restrictions."
            if str(self.settings.get("browserCookies", "None")) == "None":
                return "This Microsoft link needs your signed-in browser session. In Settings, choose Edge or Chrome browser cookies, close that browser, and analyze the link again. Download still requires permission from the file owner."
        if host.endswith("douyin.com") and any(marker in lowered for marker in ("cookie", "login", "403", "captcha", "verification")):
            return "Douyin recognized the link but requires a current signed-in browser session or verification. Select browser cookies in Settings, close the browser, and retry."
        if host.endswith("facebook.com") or host.endswith("fb.watch"):
            restricted = any(marker in lowered for marker in ("cannot parse data", "no video formats", "login", "log in", "cookie", "403", "age", "not available"))
            if restricted and str(self.settings.get("browserCookies", "None")) == "None":
                return "Facebook returned a restricted or signed-out page. Sign into Facebook in Edge or Chrome, select that browser under Settings → Site authentication, save, fully close the browser, and retry the direct Reel or Watch URL."
            if restricted:
                return "Facebook did not expose downloadable formats for this session. Confirm the video plays in the selected browser account, fully close that browser so its cookies can be read, and retry. The video may also be age-, group-, region-, or owner-restricted."
        return detail

    def analyze(self, url: str) -> dict[str, Any]:
        url = validate_url(url)
        self._log_activity("info", "analyze", f"Analyzing media link: {url}")
        # Avoid the old two-request workflow: known collections use a fast flat
        # metadata pass, while ordinary video links resolve formats immediately.
        try:
            if looks_like_collection_url(url):
                info = self._run_json(["--dump-single-json", "--flat-playlist", "--yes-playlist", "--ignore-errors", "--no-warnings", "--socket-timeout", "20", "--playlist-end", "200", url], timeout=75)
                if not (info.get("entries") or []):
                    info = self._run_json(["--dump-single-json", "--yes-playlist", "--no-warnings", "--socket-timeout", "20", url], timeout=90)
            else:
                info = self._run_json(["--dump-single-json", "--no-playlist", "--no-warnings", "--socket-timeout", "20", url], timeout=90)
        except RuntimeError as exc:
            message = self._friendly_analysis_error(url, str(exc))
            self._log_activity("error", "analyze", message)
            raise RuntimeError(message) from exc
        entries = []
        for entry in info.get("entries") or []:
            if not entry:
                continue
            item_url = entry.get("webpage_url") or entry.get("url") or ""
            extractor = str(entry.get("extractor_key") or info.get("extractor_key") or "Video")
            is_youtube = extractor.lower().startswith("youtube")
            if item_url and not item_url.startswith("http") and is_youtube:
                item_url = f"https://www.youtube.com/watch?v={entry.get('id', item_url)}"
            thumbnails = entry.get("thumbnails") or []
            thumbnail = entry.get("thumbnail") or next((item.get("url") for item in reversed(thumbnails) if item and item.get("url")), "")
            # YouTube's flat playlist response often omits thumbnail objects.
            # Its stable video ID still gives us a fast preview without opening
            # and resolving all formats for every item in the playlist.
            if not thumbnail and is_youtube and entry.get("id"):
                thumbnail = f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg"
            entries.append({"url": item_url, "title": entry.get("title") or "Untitled video", "thumbnail": thumbnail, "duration": entry.get("duration"), "platform": extractor})
        formats = [compact_format(item) for item in (info.get("formats") or []) if item and item.get("format_id")]
        formats.sort(key=lambda item: ((item.get("size") or 0), (item.get("bitrate") or 0)), reverse=True)
        subtitles = []
        for source, generated in ((info.get("subtitles") or {}, False), (info.get("automatic_captions") or {}, True)):
            for language, tracks in source.items():
                extensions = sorted({str(track.get("ext") or "") for track in tracks if track.get("ext")})
                subtitles.append({"language": language, "automatic": generated, "formats": extensions})
        chapters = [{"title": item.get("title") or f"Chapter {index + 1}", "start": item.get("start_time", 0), "end": item.get("end_time")} for index, item in enumerate(info.get("chapters") or [])]
        result = {
            "url": info.get("webpage_url") or url,
            "title": info.get("title") or "Untitled video",
            "creator": info.get("uploader") or info.get("channel") or "",
            "platform": info.get("extractor_key") or "Video",
            "thumbnail": info.get("thumbnail") or (entries[0]["thumbnail"] if entries else ""),
            "duration": info.get("duration"),
            "views": info.get("view_count"),
            "description": info.get("description") or "",
            "entries": entries,
            "formats": formats[:250],
            "subtitles": subtitles,
            "chapters": chapters,
        }
        self._log_activity("success", "analyze", f"Loaded {len(entries) if entries else 1} media item(s): {result['title']}")
        return result

    def add_urls(self, items: list[dict[str, Any]], options: dict[str, Any]) -> dict[str, Any]:
        added: list[str] = []
        with self._lock:
            for source in items:
                url = validate_url(str(source.get("url", "")))
                requested_start = str(options.get("startTime") or "").strip()
                requested_end = str(options.get("endTime") or "").strip()
                duplicate = next((item for item in self.queue if item["url"].lower() == url.lower() and str(item.get("startTime") or "") == requested_start and str(item.get("endTime") or "") == requested_end and item["status"] not in {"Failed", "Cancelled"}), None)
                if duplicate:
                    continue
                identifier = uuid.uuid4().hex
                item = {
                    "id": identifier,
                    "url": url,
                    "title": source.get("title") or url,
                    "platform": source.get("platform") or "",
                    "thumbnail": source.get("thumbnail") or "",
                    "kind": options.get("kind", "Video"),
                    "quality": options.get("quality", "Best"),
                    "format": options.get("format", "MP4"),
                    "formatId": str(options.get("formatId") or ""),
                    "subtitleLanguage": str(options.get("subtitleLanguage") or self.settings.get("subtitleLanguage") or ""),
                    "embedSubtitles": bool(options.get("embedSubtitles", self.settings.get("embedSubtitles", False))),
                    "sponsorBlock": bool(options.get("sponsorBlock", self.settings.get("sponsorBlock", False))),
                    "splitChapters": bool(options.get("splitChapters", self.settings.get("splitChapters", False))),
                    "smartVertical": bool(options.get("smartVertical", False)),
                    "removeSilence": bool(options.get("removeSilence", False)),
                    "hookCaption": str(options.get("hookCaption") or "")[:500],
                    "startTime": str(options.get("startTime") or "").strip(),
                    "endTime": str(options.get("endTime") or "").strip(),
                    "saveLocation": str(options.get("saveLocation") or self.settings.get("saveLocation") or Path.home() / "Downloads"),
                    "priority": int(options.get("priority", 3)),
                    "selected": True,
                    "status": "Waiting",
                    "progress": 0,
                    "speed": "—",
                    "eta": "—",
                    "outputPath": "",
                    "error": "",
                    "recovery": None,
                    "createdAt": datetime.now().isoformat(timespec="seconds"),
                }
                self.queue.append(item)
                added.append(identifier)
            self._save_queue()
        if added:
            self._log_activity("info", "queue", f"Added {len(added)} item(s) to the download queue.")
        return {"ids": added, "count": len(added)}

    def update_queue_item(self, identifier: str, changes: dict[str, Any]) -> bool:
        allowed = {"selected", "priority"}
        with self._lock:
            item = next((entry for entry in self.queue if entry["id"] == identifier), None)
            if not item:
                return False
            for key, value in changes.items():
                if key in allowed:
                    item[key] = max(0, min(9, int(value))) if key == "priority" else bool(value)
            self._save_queue()
            return True

    def remove_queue_item(self, identifier: str) -> bool:
        with self._lock:
            item = next((entry for entry in self.queue if entry["id"] == identifier), None)
            if not item or item["status"] in {"Downloading", "Processing"}:
                return False
            self.queue.remove(item)
            self._save_queue()
            return True

    def clear_completed(self) -> int:
        with self._lock:
            before = len(self.queue)
            self.queue[:] = [item for item in self.queue if item["status"] != "Completed"]
            self._save_queue()
            return before - len(self.queue)

    def clear_stopped_downloads(self) -> int:
        with self._lock:
            removable = {"Failed", "Cancelled", "Paused"}
            before = len(self.queue)
            self.queue[:] = [item for item in self.queue if item.get("status") not in removable]
            self._save_queue()
            count = before - len(self.queue)
        if count:
            self._log_activity("info", "queue", f"Removed {count} stopped or failed download(s).")
        return count

    def clear_history(self) -> int:
        with self._lock:
            count = len(self.history)
            self.history.clear()
            self._save_history()
        self._log_activity("info", "history", f"Cleared {count} download history item(s).")
        return count

    def clear_activity_log(self) -> int:
        with self._lock:
            count = len(self.activity)
            self.activity.clear()
            self._save_activity()
        return count

    @staticmethod
    def _built_in_recipes() -> list[dict[str, Any]]:
        return [
            {"id": "builtin-social", "name": "Social-ready MP4", "description": "Download a compatible 1080p MP4 ready for editing or sharing.", "builtIn": True, "options": {"kind": "Video", "quality": "1080p", "format": "MP4", "embedSubtitles": False, "splitChapters": False}},
            {"id": "builtin-khmer", "name": "Khmer subtitle video", "description": "Download MP4 and embed the requested Khmer subtitle track when available.", "builtIn": True, "options": {"kind": "Video", "quality": "1080p", "format": "MP4", "subtitleLanguage": "km,en", "embedSubtitles": True, "splitChapters": False}},
            {"id": "builtin-music", "name": "Music archive", "description": "Extract the highest-quality MP3 audio.", "builtIn": True, "options": {"kind": "Audio", "quality": "Best", "format": "MP3", "embedSubtitles": False, "splitChapters": False}},
            {"id": "builtin-chapters", "name": "Course by chapters", "description": "Download a video and split it into chapter files.", "builtIn": True, "options": {"kind": "Video", "quality": "1080p", "format": "MP4", "embedSubtitles": False, "splitChapters": True}},
        ]

    def list_workflow_recipes(self) -> list[dict[str, Any]]:
        return [*self._built_in_recipes(), *[dict(item) for item in self.recipes]]

    def save_workflow_recipe(self, name: str, options: dict[str, Any]) -> list[dict[str, Any]]:
        clean_name = str(name).strip()[:60]
        if not clean_name:
            raise ValueError("Enter a workflow name first.")
        allowed = {"kind", "quality", "format", "subtitleLanguage", "embedSubtitles", "sponsorBlock", "splitChapters"}
        recipe = {
            "id": uuid.uuid4().hex,
            "name": clean_name,
            "description": "Your saved download, subtitle, and processing choices.",
            "builtIn": False,
            "options": {key: value for key, value in options.items() if key in allowed},
        }
        with self._lock:
            self.recipes.insert(0, recipe)
            self.recipes[:] = self.recipes[:50]
            self._save_recipes()
        return self.list_workflow_recipes()

    def delete_workflow_recipe(self, identifier: str) -> list[dict[str, Any]]:
        with self._lock:
            self.recipes[:] = [item for item in self.recipes if item.get("id") != identifier]
            self._save_recipes()
        return self.list_workflow_recipes()

    def add_clip_jobs(self, source: dict[str, Any], clips: list[dict[str, Any]], options: dict[str, Any]) -> dict[str, Any]:
        added: list[str] = []
        for clip in clips[:20]:
            clip_options = {
                **options,
                "startTime": str(clip.get("start") or ""),
                "endTime": str(clip.get("end") or ""),
                "hookCaption": str(clip.get("caption") or "") if options.get("addHookCaption") else "",
            }
            clip_source = {**source, "title": f"{source.get('title') or 'Video'} — {clip.get('title') or 'Smart clip'}"}
            result = self.add_urls([clip_source], clip_options)
            added.extend(result["ids"])
        return {"ids": added, "count": len(added)}

    def retry_failed_items(self, strategy: str = "resume") -> dict[str, Any]:
        with self._lock:
            failed = [item for item in self.queue if item.get("status") in {"Failed", "Cancelled"}]
            for item in failed:
                if strategy == "best":
                    item.update({"quality": "Best", "formatId": "", "format": "Auto"})
                elif strategy == "safe":
                    item.update({"quality": "720p", "formatId": "", "format": "MP4", "sponsorBlock": False, "concurrentFragments": 1})
                item.update({"status": "Waiting", "progress": 0, "error": "", "recovery": None, "selected": True})
            self._save_queue()
        return self.start_downloads([item["id"] for item in failed]) if failed else {"started": False, "message": "There are no failed downloads to recover."}

    def start_downloads(self, identifiers: list[str] | None = None) -> dict[str, Any]:
        with self._lock:
            chosen = set(identifiers or [])
            pending = [item for item in self.queue if item["status"] == "Waiting" and (item["id"] in chosen if chosen else item.get("selected", True))]
            pending.sort(key=lambda item: (-int(item.get("priority", 0)), item.get("createdAt", "")))
            if not pending:
                return {"started": False, "message": "Select at least one waiting item."}
            self._scheduled_download_ids.update(item["id"] for item in pending)
            if self._coordinator and self._coordinator.is_alive():
                self._log_activity("info", "download", f"Scheduled {len(pending)} additional download(s) after the active batch.")
                return {"started": True, "count": len(pending), "queued": True}
            self._stop.clear()
            self._coordinator = threading.Thread(target=self._run_download_batch, daemon=True)
            self._coordinator.start()
            self._log_activity("info", "download", f"Started {len(pending)} queued download(s).")
            return {"started": True, "count": len(pending)}

    def _run_download_batch(self) -> None:
        current = threading.current_thread()
        try:
            while not self._stop.is_set():
                with self._lock:
                    identifiers = set(self._scheduled_download_ids)
                    self._scheduled_download_ids.clear()
                    pending = [item for item in self.queue if item.get("status") == "Waiting" and item.get("id") in identifiers]
                    pending.sort(key=lambda item: (-int(item.get("priority", 0)), item.get("createdAt", "")))
                    if not pending:
                        if self._coordinator is current:
                            self._coordinator = None
                        return
                workers = max(1, min(4, int(self.settings.get("parallelDownloads", 2))))
                with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="cps-download") as pool:
                    list(pool.map(self._download_one, pending))
        finally:
            with self._lock:
                if self._coordinator is current:
                    self._coordinator = None

    def _download_one(self, item: dict[str, Any]) -> None:
        if self._stop.is_set():
            self._set_item(item, status="Cancelled")
            return
        output_dir = Path(item.get("saveLocation") or self.settings.get("saveLocation") or Path.home() / "Downloads").expanduser().resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        path_record_dir = DATA_DIR / "job-paths"
        path_record_dir.mkdir(parents=True, exist_ok=True)
        path_record = path_record_dir / f"{item['id']}.txt"
        path_record.unlink(missing_ok=True)
        fragments = max(1, min(16, int(self.settings.get("concurrentFragments", 8))))
        args = [
            str(tool_path("yt-dlp.exe")), *self._base_args(), "--newline", "--no-color", "--progress", "--no-playlist", "--continue", "--part",
            "--retries", "10", "--fragment-retries", "20", "--extractor-retries", "5", "--file-access-retries", "5",
            "--retry-sleep", "fragment:exp=1:20", "--socket-timeout", "30", "--concurrent-fragments", str(fragments),
            "--buffer-size", "64K", "--http-chunk-size", "10M", "--progress-delta", "0.2",
            "--progress-template", "download:download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
            "--progress-template", "postprocess:postprocess:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
            "--print", "before_dl:meta:title:%(title)s", "--print", "before_dl:meta:platform:%(extractor_key)s",
            "--print", "after_video:filepath:%(filepath)s",
            "--print-to-file", "after_video:%(filepath)s", str(path_record),
            "--print-to-file", "after_move:%(filepath)s", str(path_record),
            "--ffmpeg-location", str(tool_path("ffmpeg.exe").parent), "--windows-filenames", "--trim-filenames", "180", "-P", str(output_dir), "-o", self.settings.get("filenameTemplate") or "%(title)s [%(id)s].%(ext)s",
        ]
        if self.settings.get("preventDuplicates", True):
            args += ["--download-archive", str(DATA_DIR / "download-archive.txt")]
        if item.get("kind") == "Audio":
            audio_format = "best" if item.get("format") == "Original" else str(item.get("format", "MP3")).lower()
            args += ["-x", "--audio-format", audio_format, "--audio-quality", "0"]
        else:
            quality_str = str(item.get("quality", "Best"))
            format_id = str(item.get("formatId") or "").strip()
            if format_id:
                args += ["-f", f"{format_id}/bv*+ba/b/best"]
            else:
                args += ["-f", format_selector(quality_str)]
            limits = {"4K / 2160p": 2160, "2160p": 2160, "1440p": 1440, "1080p": 1080, "720p": 720, "480p": 480, "360p": 360}
            target_res = limits.get(quality_str.strip()) if isinstance(quality_str, str) else None
            if target_res:
                args += ["--format-sort", f"res:{target_res},fps"]
            video_format = str(item.get("format", "MP4"))
            if video_format != "Auto":
                args += ["--merge-output-format", video_format.lower()]
        subtitle_language = str(item.get("subtitleLanguage") or "").strip()
        if item.get("embedSubtitles") and subtitle_language:
            args += ["--write-subs", "--write-auto-subs", "--sub-langs", subtitle_language, "--embed-subs"]
        if item.get("sponsorBlock"):
            args += ["--sponsorblock-remove", "sponsor,selfpromo,interaction,intro,outro,preview"]
        if item.get("splitChapters"):
            args += ["--split-chapters"]
        start_time, end_time = str(item.get("startTime") or "").strip(), str(item.get("endTime") or "").strip()
        if start_time or end_time:
            args += ["--download-sections", f"*{start_time or '0'}-{end_time or 'inf'}", "--force-keyframes-at-cuts"]
        args.append(item["url"])
        self._set_item(item, status="Downloading", error="", recovery=None)
        self._log_activity("info", "download", f"Downloading to {output}", item)
        process: subprocess.Popen[str] | None = None
        diagnostic_lines: list[str] = []
        try:
            process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", bufsize=1, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
            with self._lock:
                self._processes[item["id"]] = process
            assert process.stdout is not None
            for raw in process.stdout:
                line = raw.strip()
                diagnostic_lines.append(line)
                diagnostic_lines[:] = diagnostic_lines[-40:]
                if line.startswith("meta:title:"):
                    self._set_item(item, title=line[11:].strip())
                elif line.startswith("meta:platform:"):
                    self._set_item(item, platform=line[14:].strip())
                elif line.startswith("filepath:"):
                    self._set_item(item, outputPath=line[9:].strip(), status="Processing")
                else:
                    update = parse_progress(line)
                    if update:
                        self._set_item(item, **{key: value for key, value in update.items() if value is not None})
                if self._stop.is_set() and process.poll() is None:
                    process.terminate()
            code = process.wait()
            if self._stop.is_set():
                self._set_item(item, status="Cancelled")
                self._log_activity("warning", "download", "Download cancelled by the user.", item)
            elif code:
                recovery = classify_download_error(diagnostic_lines)
                self._set_item(item, recovery=recovery)
                raise RuntimeError(recovery["message"])
            else:
                recorded_path = ""
                if path_record.exists():
                    try:
                        recorded_path = path_record.read_text(encoding="utf-8-sig", errors="replace").splitlines()[-1].strip()
                    except (OSError, IndexError):
                        recorded_path = ""
                final_path = self._actual_output_path(recorded_path or str(item.get("outputPath") or ""))
                if not final_path or not Path(final_path).is_file():
                    final_path = self._find_recent_download(output_dir, item)
                if final_path and (item.get("smartVertical") or item.get("removeSilence") or item.get("hookCaption")):
                    self._set_item(item, status="Processing", stage="Creating short-form clip")
                    try:
                        final_path = self._process_creator_clip(final_path, item)
                    except Exception as exc:
                        self._log_activity("warning", "clip", f"The source clip downloaded, but creator processing was skipped: {exc}", item)
                completed_at = datetime.now().isoformat(timespec="seconds")
                self._set_item(item, status="Completed", progress=100, speed="—", eta="00:00", outputPath=final_path, completedAt=completed_at)
                with self._lock:
                    self.history[:] = [entry for entry in self.history if entry.get("id") != item.get("id")]
                    self.history.insert(0, dict(item))
                    self.history[:] = self.history[:500]
                    self._save_history()
                self._log_activity("success", "download", f"Completed: {final_path or item.get('title')}", item)
        except Exception as exc:
            self._set_item(item, status="Cancelled" if self._stop.is_set() else "Failed", error=str(exc))
            if not self._stop.is_set():
                detail = " | ".join(line for line in diagnostic_lines[-6:] if line)
                self._log_activity("error", "download", f"{exc}{f' — {detail}' if detail else ''}", item)
        finally:
            path_record.unlink(missing_ok=True)
            with self._lock:
                self._processes.pop(item["id"], None)

    def retry_queue_item(self, identifier: str, strategy: str = "resume") -> bool:
        with self._lock:
            item = next((entry for entry in self.queue if entry["id"] == identifier), None)
            if not item or item.get("status") not in {"Failed", "Cancelled"}:
                return False
            if strategy == "best":
                item.update({"quality": "Best", "formatId": "", "format": "Auto"})
            elif strategy == "safe":
                item.update({"quality": "720p", "formatId": "", "sponsorBlock": False})
            item.update({"status": "Waiting", "progress": 0, "error": "", "recovery": None, "selected": True})
            self._save_queue()
        return self.start_downloads([identifier]).get("started", False)

    def _process_creator_clip(self, source_path: str, item: dict[str, Any]) -> str:
        source = Path(source_path)
        if not source.is_file():
            return source_path
        output = source.with_name(f"{source.stem}_creator.mp4")
        counter = 2
        while output.exists():
            output = source.with_name(f"{source.stem}_creator_{counter}.mp4")
            counter += 1
        video_filters: list[str] = []
        audio_filters: list[str] = []
        temporary: tempfile.TemporaryDirectory[str] | None = None
        try:
            if item.get("smartVertical"):
                video_filters.append("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2")
            caption = str(item.get("hookCaption") or "").strip()
            if caption:
                temporary = tempfile.TemporaryDirectory(prefix="cps-clip-caption-")
                caption_file = Path(temporary.name) / "caption.txt"
                caption_file.write_text(caption, encoding="utf-8")
                font = next(iter((frontend_path() / "assets").glob("KantumruyPro*.ttf")), None)
                font_part = ""
                if font:
                    font_path = str(font).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
                    font_part = f"fontfile='{font_path}':"
                text_path = str(caption_file).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
                video_filters.append(f"drawtext={font_part}textfile='{text_path}':fontcolor=white:fontsize=54:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h-(text_h*3):line_spacing=10")
            if item.get("removeSilence"):
                audio_filters.append("silenceremove=start_periods=1:start_duration=0.25:start_threshold=-45dB:stop_periods=-1:stop_duration=0.45:stop_threshold=-45dB")
            command = [str(tool_path("ffmpeg.exe")), "-hide_banner", "-y", "-i", str(source)]
            if video_filters:
                command += ["-vf", ",".join(video_filters)]
            if audio_filters:
                command += ["-af", ",".join(audio_filters)]
            command += ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output)]
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=7200, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
            if result.returncode or not output.exists():
                detail = (result.stderr.strip().splitlines() or ["FFmpeg could not create the short-form clip."])[-1]
                raise RuntimeError(detail)
            return str(output)
        finally:
            if temporary:
                temporary.cleanup()

    def _set_item(self, item: dict[str, Any], **changes: Any) -> None:
        with self._lock:
            item.update(changes)
            self._save_queue()

    def cancel_downloads(self) -> bool:
        self._stop.set()
        with self._lock:
            processes = list(self._processes.values())
            scheduled = set(self._scheduled_download_ids)
            self._scheduled_download_ids.clear()
            for item in self.queue:
                if item.get("id") in scheduled and item.get("status") == "Waiting":
                    item["status"] = "Cancelled"
            self._save_queue()
        for process in processes:
            try:
                if process.poll() is None:
                    process.terminate()
            except OSError:
                pass
        return True

    def save_settings(self, values: dict[str, Any]) -> dict[str, Any]:
        allowed = {"theme", "language", "saveLocation", "conversionLocation", "parallelDownloads", "concurrentFragments", "browserCookies", "preventDuplicates", "filenameTemplate", "aiProvider", "aiFallback", "geminiModel", "codecraftModel", "customApiBase", "customApiModel", "embedSubtitles", "subtitleLanguage", "sponsorBlock", "splitChapters", "updateChannel"}
        with self._lock:
            for key, value in values.items():
                if key in allowed:
                    if key in {"saveLocation", "conversionLocation"} and isinstance(value, str):
                        cleaned = value.strip().strip('"').strip("'")
                        if cleaned:
                            try:
                                resolved = Path(cleaned).expanduser().resolve()
                                resolved.mkdir(parents=True, exist_ok=True)
                                self.settings[key] = str(resolved)
                            except Exception:
                                self.settings[key] = cleaned
                        else:
                            self.settings[key] = value
                    else:
                        self.settings[key] = value
            self.settings["parallelDownloads"] = max(1, min(4, int(self.settings.get("parallelDownloads", 2))))
            self.settings["concurrentFragments"] = max(1, min(16, int(self.settings.get("concurrentFragments", 8))))
            self._write_json(self._settings_file, self.settings)
        key = str(values.get("geminiApiKey", "")).strip()
        if key:
            self.add_gemini_key(key)
        codecraft_key = str(values.get("codecraftApiKey", "")).strip()
        if codecraft_key:
            self._codecraft_key_file.write_bytes(protect_secret(codecraft_key))
        custom_key = str(values.get("customApiKey", "")).strip()
        if custom_key:
            self._custom_key_file.write_bytes(protect_secret(custom_key))
        result = dict(self.settings)
        result["hasGeminiKey"] = bool(self._gemini_keys())
        result["geminiKeyCount"] = len(self._gemini_keys())
        result["hasCodecraftApiKey"] = self._codecraft_key_file.exists()
        result["hasCustomApiKey"] = self._custom_key_file.exists()
        return result

    def choose_folder(self, initial_path: str = "") -> str:
        import webview
        directory = initial_path or self.settings.get("saveLocation") or str(Path.home())
        result = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG, directory=directory)
        return result[0] if result else ""

    def open_download_folder(self) -> bool:
        path = Path(self.settings.get("saveLocation") or Path.home() / "Downloads")
        path.mkdir(parents=True, exist_ok=True)
        os.startfile(path)
        return True

    def open_conversion_folder(self) -> bool:
        path = Path(self.settings.get("conversionLocation") or Path.home() / "Videos" / "CPS Converted")
        path.mkdir(parents=True, exist_ok=True)
        os.startfile(path)
        return True

    def open_external_url(self, url: str) -> bool:
        url = validate_url(url)
        if url.startswith(("http://", "https://")):
            try:
                os.startfile(url)
                return True
            except Exception:
                import webbrowser
                return webbrowser.open(url)
        return False

    def show_in_folder(self, path: str) -> bool:
        target = Path(path)
        if target.exists():
            if os.name == "nt":
                # Passing /select, and the path separately avoids Explorer
                # losing filenames whose parent folders contain spaces.
                subprocess.Popen(["explorer.exe", "/select,", str(target.resolve())], creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                subprocess.Popen(["xdg-open", str(target.parent)])
        else:
            parent = target.parent
            if parent.exists():
                os.startfile(parent)
            elif parent == Path(self.settings.get("conversionLocation") or Path.home() / "Videos" / "CPS Converted"):
                self.open_conversion_folder()
            else:
                self.open_download_folder()
        return True

    def choose_video_file(self) -> str:
        import webview
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=("Video files (*.mp4;*.mkv;*.webm;*.mov;*.avi;*.m4v)", "All files (*.*)"),
        )
        return result[0] if result else ""

    def choose_media_files(self) -> list[str]:
        import webview
        result = webview.windows[0].create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=True,
            file_types=(
                "Media files (*.mp4;*.mov;*.mkv;*.webm;*.avi;*.m4v;*.mp3;*.m4a;*.aac;*.wav;*.flac;*.ogg;*.heic;*.heif;*.jpg;*.jpeg;*.png;*.webp)",
                "All files (*.*)",
            ),
        )
        return list(result or [])

    @staticmethod
    def _conversion_arguments(target_format: str) -> list[str]:
        formats = {
            "MP4": ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
            "MOV": ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k"],
            "MKV": ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k"],
            "WEBM": ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-c:a", "libopus"],
            "MP3": ["-vn", "-c:a", "libmp3lame", "-q:a", "2"],
            "OGG": ["-vn", "-c:a", "libvorbis", "-q:a", "6"],
            "WAV": ["-vn", "-c:a", "pcm_s16le"],
            "FLAC": ["-vn", "-c:a", "flac"],
            "M4A": ["-vn", "-c:a", "aac", "-b:a", "256k"],
            "JPG": ["-frames:v", "1", "-q:v", "2"],
            "PNG": ["-frames:v", "1"],
            "GIF": ["-vf", "fps=12,scale=960:-1:flags=lanczos"],
        }
        normalized = target_format.upper()
        if normalized not in formats:
            raise ValueError("Choose a supported output format.")
        return formats[normalized]

    def start_conversions(self, paths: list[str], target_format: str) -> dict[str, Any]:
        normalized = target_format.upper()
        self._conversion_arguments(normalized)
        sources = [Path(value) for value in paths if Path(value).is_file()]
        if not sources:
            raise ValueError("Choose at least one media file to convert.")
        output_folder = Path(self.settings.get("conversionLocation") or Path.home() / "Videos" / "CPS Converted")
        output_folder.mkdir(parents=True, exist_ok=True)
        items = []
        for source in sources:
            identifier = uuid.uuid4().hex
            output = output_folder / f"{source.stem}_converted.{normalized.lower()}"
            counter = 2
            while output.exists():
                output = output_folder / f"{source.stem}_converted_{counter}.{normalized.lower()}"
                counter += 1
            item = {"id": identifier, "name": source.name, "sourcePath": str(source), "outputPath": str(output), "format": normalized, "status": "Waiting", "progress": 0, "error": "", "createdAt": datetime.now().isoformat(timespec="seconds")}
            with self._lock:
                self.conversions.insert(0, item)
            items.append(item)
            threading.Thread(target=self._run_conversion, args=(item,), name=f"cps-convert-{identifier[:8]}", daemon=True).start()
        return {"started": True, "count": len(items), "ids": [item["id"] for item in items]}

    def _conversion_duration(self, source: str) -> float:
        result = subprocess.run(
            [str(tool_path("ffprobe.exe")), "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", source],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            env=child_process_environment(),
        )
        try:
            return max(0.0, float(result.stdout.strip()))
        except ValueError:
            return 0.0

    def _run_conversion(self, item: dict[str, Any]) -> None:
        duration_seconds = self._conversion_duration(item["sourcePath"])
        command = [str(tool_path("ffmpeg.exe")), "-hide_banner", "-y", "-i", item["sourcePath"], *self._conversion_arguments(item["format"]), "-progress", "pipe:1", "-nostats", item["outputPath"]]
        try:
            with self._lock:
                item["status"] = "Converting"
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
            with self._lock:
                self._conversion_processes[item["id"]] = process
            output_lines: list[str] = []
            assert process.stdout is not None
            for line in process.stdout:
                line = line.strip()
                output_lines.append(line)
                if duration_seconds and line.startswith(("out_time_us=", "out_time_ms=")):
                    try:
                        elapsed = float(line.split("=", 1)[1]) / 1_000_000
                        with self._lock:
                            item["progress"] = min(99, round(elapsed / duration_seconds * 100, 1))
                    except ValueError:
                        pass
            code = process.wait()
            with self._lock:
                if item.get("status") == "Cancelled":
                    return
                if code == 0 and Path(item["outputPath"]).exists():
                    item.update(status="Completed", progress=100)
                else:
                    detail = next((line for line in reversed(output_lines) if line), "FFmpeg could not convert this file.")
                    item.update(status="Failed", error=detail[-500:])
        except Exception as exc:
            with self._lock:
                item.update(status="Failed", error=str(exc))
        finally:
            with self._lock:
                self._conversion_processes.pop(item["id"], None)

    def cancel_conversion(self, identifier: str) -> bool:
        with self._lock:
            item = next((value for value in self.conversions if value["id"] == identifier), None)
            process = self._conversion_processes.get(identifier)
            if item:
                item["status"] = "Cancelled"
        if process and process.poll() is None:
            process.terminate()
        return bool(item)

    def remove_conversion(self, identifier: str) -> bool:
        self.cancel_conversion(identifier)
        with self._lock:
            before = len(self.conversions)
            self.conversions = [item for item in self.conversions if item["id"] != identifier]
            return len(self.conversions) != before

    def test_site_authentication(self, url: str) -> dict[str, Any]:
        url = validate_url(url)
        info = self._run_json(["--dump-single-json", "--skip-download", "--no-warnings", "--playlist-end", "1", url], timeout=90)
        return {"connected": True, "title": info.get("title") or "Authenticated", "browser": self.settings.get("browserCookies", "None")}

    def export_browser_extension(self) -> str:
        import webview
        chosen = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG, directory=str(Path.home() / "Downloads"))
        if not chosen:
            return ""
        source = BUNDLE_ROOT / "browser-extension"
        if not source.exists():
            source = SOURCE_ROOT / "browser-extension"
        destination = Path(chosen[0]) / "CPS Browser Extension"
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(source, destination)
        return str(destination)

    def download_subtitles(self, url: str, language: str = "en", subtitle_format: str = "srt") -> dict[str, Any]:
        url = validate_url(url)
        output = Path(self.settings.get("saveLocation") or Path.home() / "Downloads")
        output.mkdir(parents=True, exist_ok=True)
        executable = tool_path("yt-dlp.exe")
        args = [str(executable), *self._base_args(), "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", language or "en", "--convert-subs", subtitle_format if subtitle_format in {"srt", "vtt"} else "srt", "--ffmpeg-location", str(tool_path("ffmpeg.exe").parent), "-P", str(output), "-o", "%(title)s [%(id)s].%(ext)s", url]
        result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
        if result.returncode:
            raise RuntimeError((result.stderr.strip().splitlines() or ["Subtitle download failed."])[-1].removeprefix("ERROR: ").strip())
        return {"saved": True, "folder": str(output)}

    def load_subtitle_text(self, url: str, language: str = "en", subtitle_format: str = "srt") -> dict[str, Any]:
        url = validate_url(url)
        chosen_format = subtitle_format if subtitle_format in {"srt", "vtt"} else "srt"
        with tempfile.TemporaryDirectory(prefix="cps-subtitle-editor-") as temporary:
            template = str(Path(temporary) / "subtitle.%(ext)s")
            args = [
                str(tool_path("yt-dlp.exe")), *self._base_args(), "--skip-download", "--write-subs", "--write-auto-subs",
                "--sub-langs", language or "en", "--sub-format", "vtt/best", "--convert-subs", chosen_format,
                "--ffmpeg-location", str(tool_path("ffmpeg.exe").parent), "-o", template, url,
            ]
            result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
            files = list(Path(temporary).glob(f"*.{chosen_format}"))
            if result.returncode or not files:
                detail = (result.stderr.strip().splitlines() or ["No subtitle track was available for that language."])[-1]
                raise RuntimeError(detail.removeprefix("ERROR: ").strip())
            text = files[0].read_text(encoding="utf-8-sig", errors="replace")
        return {"text": text, "format": chosen_format, "language": language or "en"}

    @staticmethod
    def _safe_stem(value: str) -> str:
        clean = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", str(value)).strip(" .")
        return (clean or "CPS media")[:120]

    def save_subtitle_text(self, title: str, text: str, subtitle_format: str = "srt") -> dict[str, Any]:
        chosen_format = subtitle_format if subtitle_format in {"srt", "vtt"} else "srt"
        if not str(text).strip():
            raise ValueError("The subtitle editor is empty.")
        folder = Path(self.settings.get("saveLocation") or Path.home() / "Downloads") / "CPS Subtitles"
        folder.mkdir(parents=True, exist_ok=True)
        output = folder / f"{self._safe_stem(title)}.{chosen_format}"
        counter = 2
        while output.exists():
            output = folder / f"{self._safe_stem(title)}_{counter}.{chosen_format}"
            counter += 1
        output.write_text(str(text), encoding="utf-8-sig")
        self._log_activity("success", "subtitle", f"Saved edited subtitles: {output}")
        return {"saved": True, "path": str(output)}

    def translate_subtitle_text(self, text: str, target_language: str = "Khmer", bilingual: bool = False) -> str:
        if not str(text).strip():
            raise ValueError("Load or paste subtitles before translating.")
        instruction = (
            f"Translate this subtitle file into {target_language}. Preserve every cue number and timestamp exactly. "
            + ("For every cue, keep the original line first and put the translation on the next line. " if bilingual else "Replace only the spoken text with the translation. ")
            + "Return only the complete subtitle file without Markdown fences.\n\n"
        )
        return self.ai_chat(instruction + str(text)[:180000], "", [])

    def burn_subtitle_text(self, video_path: str, title: str, text: str) -> dict[str, Any]:
        source = Path(video_path)
        if not source.is_file():
            raise ValueError("Choose a local video file first.")
        if not str(text).strip():
            raise ValueError("Load or paste subtitles first.")
        output_folder = Path(self.settings.get("conversionLocation") or source.parent)
        output_folder.mkdir(parents=True, exist_ok=True)
        output = output_folder / f"{source.stem}_subtitled.mp4"
        counter = 2
        while output.exists():
            output = output_folder / f"{source.stem}_subtitled_{counter}.mp4"
            counter += 1
        with tempfile.TemporaryDirectory(prefix="cps-burn-subs-") as temporary:
            subtitle = Path(temporary) / f"{self._safe_stem(title)}.srt"
            subtitle.write_text(str(text), encoding="utf-8-sig")
            filter_path = str(subtitle).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
            command = [str(tool_path("ffmpeg.exe")), "-hide_banner", "-y", "-i", str(source), "-vf", f"subtitles='{filter_path}'", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output)]
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=7200, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
        if result.returncode or not output.exists():
            detail = (result.stderr.strip().splitlines() or ["FFmpeg could not burn these subtitles."])[-1]
            raise RuntimeError(detail)
        self._log_activity("success", "subtitle", f"Created subtitled video: {output}")
        return {"saved": True, "path": str(output)}

    def save_creator_pack(self, title: str, content: str) -> dict[str, Any]:
        if not str(content).strip():
            raise ValueError("Generate a creator package first.")
        folder = Path(self.settings.get("saveLocation") or Path.home() / "Downloads") / "CPS Creator Packs"
        folder.mkdir(parents=True, exist_ok=True)
        output = folder / f"{self._safe_stem(title)} Creator Pack.md"
        output.write_text(str(content), encoding="utf-8-sig")
        return {"saved": True, "path": str(output)}

    def suggest_smart_clips(self, video_url: str, title: str = "", mode: str = "highlights", language: str = "en") -> list[dict[str, Any]]:
        video_url = validate_url(video_url)
        prompt = (
            f"Find 5 strong {mode} clips from this video. Each clip should be 15 to 90 seconds, make sense alone, and avoid cutting a sentence. "
            "Return ONLY a JSON array. Each object must contain title, start, end, reason, and caption. "
            "Use start/end as HH:MM:SS or MM:SS timestamps that exist in the transcript. "
            f"Video title: {title or 'Unknown'}"
        )
        raw = self.transcript_chat(prompt, video_url, [], language or "en")
        match = re.search(r"\[[\s\S]*\]", raw)
        if not match:
            raise RuntimeError("The AI could not identify reliable clip timestamps. Try Deep highlights or another subtitle language.")
        try:
            decoded = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise RuntimeError("The AI returned clip suggestions in an unreadable format. Please try again.") from exc
        clips = []
        for index, item in enumerate(decoded[:10] if isinstance(decoded, list) else []):
            if not isinstance(item, dict) or not item.get("start") or not item.get("end"):
                continue
            clips.append({
                "id": uuid.uuid4().hex,
                "title": str(item.get("title") or f"Clip {index + 1}")[:100],
                "start": str(item["start"])[:12], "end": str(item["end"])[:12],
                "reason": str(item.get("reason") or "Strong standalone moment")[:500],
                "caption": str(item.get("caption") or "")[:500], "selected": True,
            })
        if not clips:
            raise RuntimeError("No usable clip timestamps were returned.")
        return clips

    def get_system_status(self) -> dict[str, Any]:
        versions: dict[str, str] = {}
        for name in ("yt-dlp.exe", "ffmpeg.exe", "deno.exe"):
            try:
                command = [str(tool_path(name)), "--version"]
                result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
                versions[name.removesuffix(".exe")] = (result.stdout or result.stderr).splitlines()[0].strip()
            except Exception as exc:
                versions[name.removesuffix(".exe")] = f"Unavailable: {exc}"
        return {"version": APP_VERSION, "status": "Ready", "mediaSupport": versions}

    def check_updates(self) -> dict[str, Any]:
        status = self.get_system_status()
        request = urllib.request.Request("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest", headers={"Accept": "application/vnd.github+json", "User-Agent": "CPSUniversalDownloader/1.1"})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                latest = json.loads(response.read()).get("tag_name", "")
        except Exception as exc:
            raise RuntimeError(f"Could not check for engine updates: {exc}") from exc
        current = status["mediaSupport"].get("yt-dlp", "")
        return {"version": APP_VERSION, "currentSupport": current, "latestSupport": latest, "updateAvailable": bool(latest and latest not in current), "message": "A newer media-support update is available." if latest and latest not in current else "Media support is current."}

    def _set_update_state(self, **changes: Any) -> dict[str, Any]:
        with self._lock:
            self._update_state.update(changes)
            return dict(self._update_state)

    def _automatic_update_check(self) -> None:
        if self._shutdown.wait(4):
            return
        try:
            self.check_app_update(False)
        except Exception:
            # Automatic checks stay quiet; the Settings card still shows the
            # last useful state and a manual check exposes the full error.
            pass

    def check_app_update(self, manual: bool = True) -> dict[str, Any]:
        self._set_update_state(status="checking", progress=0, message="Checking GitHub for a new release…")
        request = urllib.request.Request(
            GITHUB_RELEASE_API,
            headers={"Accept": "application/vnd.github+json", "User-Agent": f"CPSUniversalDownloader/{APP_VERSION}"},
        )
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                release = json.loads(response.read())
            latest = str(release.get("tag_name") or "").lstrip("vV")
            assets = release.get("assets") or []
            installer = next((item for item in assets if str(item.get("name", "")).lower().endswith("-setup.exe")), None)
            checksum = next((item for item in assets if str(item.get("name", "")).lower().startswith("sha256sums") and str(item.get("name", "")).lower().endswith(".txt")), None)
            available = bool(latest and version_tuple(latest) > version_tuple(APP_VERSION))
            if available and not installer:
                raise RuntimeError("The newest GitHub release does not contain a Windows Setup asset.")
            message = f"Version {latest} is ready to install." if available else f"CPS Universal Downloader {APP_VERSION} is up to date."
            state = self._set_update_state(
                status="available" if available else "current",
                latestVersion=latest or APP_VERSION,
                available=available,
                progress=0,
                message=message,
                releaseName=str(release.get("name") or release.get("tag_name") or ""),
                releaseNotes=str(release.get("body") or "")[:6000],
                publishedAt=str(release.get("published_at") or ""),
                assetName=str(installer.get("name") or "") if installer else "",
                assetUrl=str(installer.get("browser_download_url") or "") if installer else "",
                assetSize=int(installer.get("size") or 0) if installer else 0,
                checksumUrl=str(checksum.get("browser_download_url") or "") if checksum else "",
            )
            if available:
                self._log_activity("info", "update", f"Application update {latest} is available.")
            return state
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return self._set_update_state(
                    status="current",
                    latestVersion=APP_VERSION,
                    available=False,
                    progress=0,
                    message=f"CPS Universal Downloader {APP_VERSION} is up to date (no releases published yet).",
                )
            state = self._set_update_state(status="error", available=False, message=f"Update check failed: {exc}")
            if manual:
                self._log_activity("error", "update", state["message"])
                raise RuntimeError(state["message"]) from exc
            return state
        except Exception as exc:
            state = self._set_update_state(status="error", available=False, message=f"Update check failed: {exc}")
            if manual:
                self._log_activity("error", "update", state["message"])
                raise RuntimeError(state["message"]) from exc
            return state

    def install_app_update(self) -> dict[str, Any]:
        with self._lock:
            state = dict(self._update_state)
        if state.get("status") in {"downloading", "installing"}:
            return state
        if not state.get("available") or not state.get("assetUrl"):
            state = self.check_app_update(True)
        if not state.get("available"):
            return state
        self._set_update_state(status="downloading", progress=0, message=f"Downloading version {state['latestVersion']}…")
        threading.Thread(target=self._download_and_install_update, args=(state,), name="cps-update-install", daemon=True).start()
        return dict(self._update_state)

    @staticmethod
    def _download_update_asset(url: str, destination: Path, progress: Any = None) -> None:
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in {"github.com", "api.github.com"}:
            raise RuntimeError("The update asset did not come from GitHub.")
        request = urllib.request.Request(url, headers={"Accept": "application/octet-stream", "User-Agent": f"CPSUniversalDownloader/{APP_VERSION}"})
        with urllib.request.urlopen(request, timeout=60) as response, destination.open("wb") as output:
            total = int(response.headers.get("Content-Length") or 0)
            received = 0
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                output.write(block)
                received += len(block)
                if progress:
                    progress(received, total)

    def _download_and_install_update(self, state: dict[str, Any]) -> None:
        update_dir = DATA_DIR / "updates"
        update_dir.mkdir(parents=True, exist_ok=True)
        installer = update_dir / str(state.get("assetName") or "CPS-Universal-Downloader-Update-Setup.exe")
        temporary = installer.with_suffix(".download")
        temporary.unlink(missing_ok=True)
        try:
            def report(received: int, total: int) -> None:
                percent = round(received * 100 / total, 1) if total else 0
                self._set_update_state(progress=percent, message=f"Downloading update… {percent:.1f}%" if total else f"Downloading update… {received // 1048576} MB")

            self._download_update_asset(str(state["assetUrl"]), temporary, report)
            with temporary.open("rb") as downloaded:
                signature = downloaded.read(2)
            if temporary.stat().st_size < 1024 * 1024 or signature != b"MZ":
                raise RuntimeError("The downloaded installer is not a valid Windows executable.")
            checksum_url = str(state.get("checksumUrl") or "")
            if not checksum_url:
                raise RuntimeError("The GitHub release is missing its SHA-256 checksum file.")
            checksum_file = update_dir / "SHA256SUMS.txt"
            self._download_update_asset(checksum_url, checksum_file)
            expected = ""
            for line in checksum_file.read_text(encoding="utf-8-sig", errors="replace").splitlines():
                fields = line.strip().split(None, 1)
                if len(fields) == 2 and Path(fields[1].strip().lstrip("* ")).name.lower() == installer.name.lower():
                    expected = fields[0].lower()
                    break
            digest = hashlib.sha256()
            with temporary.open("rb") as downloaded:
                for block in iter(lambda: downloaded.read(1024 * 1024), b""):
                    digest.update(block)
            actual = digest.hexdigest().lower()
            if not expected or not hmac.compare_digest(expected, actual):
                raise RuntimeError("The downloaded installer failed SHA-256 verification.")
            temporary.replace(installer)
            self._set_update_state(status="installing", progress=100, message="Installing the update and restarting…")
            self._log_activity("info", "update", f"Installing application update {state.get('latestVersion')}.")
            flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
            subprocess.Popen(
                [str(installer), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS"],
                close_fds=True,
                creationflags=flags,
                env=child_process_environment(),
            )
            threading.Timer(1.0, self.quit_application).start()
        except Exception as exc:
            temporary.unlink(missing_ok=True)
            self._set_update_state(status="error", available=True, message=f"Update installation failed: {exc}")
            self._log_activity("error", "update", f"Update installation failed: {exc}")

    @staticmethod
    def _api_error(exc: urllib.error.HTTPError, fallback: str) -> RuntimeError:
        try:
            detail = exc.read().decode("utf-8", "replace")
        finally:
            exc.close()
        try:
            payload = json.loads(detail)
            message = payload.get("error", {}).get("message") if isinstance(payload.get("error"), dict) else payload.get("error") or payload.get("message")
        except json.JSONDecodeError:
            message = detail
        return RuntimeError(str(message or fallback))

    @staticmethod
    def _validate_api_base(value: str) -> str:
        base = value.strip().rstrip("/")
        parsed = urlparse(base)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Enter a valid custom API base URL beginning with http:// or https://.")
        return base

    def _gemini_keys(self, transient: str = "") -> list[str]:
        if transient.strip():
            return [transient.strip()]
        if not self._key_file.exists():
            return []
        try:
            value = unprotect_secret(self._key_file.read_bytes())
            decoded = json.loads(value)
            if isinstance(decoded, list):
                return [str(key).strip() for key in decoded if str(key).strip()][:10]
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            pass
        try:
            legacy = unprotect_secret(self._key_file.read_bytes()).strip()
            return [legacy] if legacy else []
        except Exception:
            return []

    def _save_gemini_keys(self, keys: list[str]) -> None:
        unique = list(dict.fromkeys(key.strip() for key in keys if key.strip()))[:10]
        if unique:
            self._key_file.write_bytes(protect_secret(json.dumps(unique)))
        else:
            self._key_file.unlink(missing_ok=True)
        self._gemini_cursor = 0

    def list_gemini_keys_masked(self) -> list[dict[str, Any]]:
        return [{"id": hashlib.sha256(key.encode()).hexdigest()[:16], "label": f"Gemini key {index + 1}", "masked": f"••••••••{key[-4:]}"} for index, key in enumerate(self._gemini_keys())]

    def add_gemini_key(self, api_key: str) -> list[dict[str, Any]]:
        key = api_key.strip()
        if not key:
            raise ValueError("Paste a Gemini API key first.")
        keys = self._gemini_keys()
        if key not in keys and len(keys) >= 10:
            raise ValueError("You can save a maximum of 10 Gemini API keys.")
        if key not in keys:
            keys.append(key)
            self._save_gemini_keys(keys)
        return self.list_gemini_keys_masked()

    def remove_gemini_key(self, identifier: str) -> list[dict[str, Any]]:
        keys = [key for key in self._gemini_keys() if hashlib.sha256(key.encode()).hexdigest()[:16] != identifier]
        self._save_gemini_keys(keys)
        return self.list_gemini_keys_masked()

    def _ordered_gemini_keys(self, transient: str = "") -> list[str]:
        keys = self._gemini_keys(transient)
        if not keys:
            raise ValueError("Add at least one Gemini API key in Settings first.")
        start = getattr(self, "_gemini_cursor", 0) % len(keys)
        return keys[start:] + keys[:start]

    def _secret(self, transient: str, path: Path, label: str) -> str:
        if path == self._key_file:
            return self._ordered_gemini_keys(transient)[0]
        if transient.strip():
            return transient.strip()
        if path.exists():
            return unprotect_secret(path.read_bytes())
        raise ValueError(f"Add your {label} API key in Settings first.")

    def _custom_secret(self, transient: str = "") -> str:
        if transient.strip():
            return transient.strip()
        return unprotect_secret(self._custom_key_file.read_bytes()) if self._custom_key_file.exists() else ""

    def _codecraft_secret(self, transient: str = "") -> str:
        if transient.strip():
            return transient.strip()
        return unprotect_secret(self._codecraft_key_file.read_bytes()) if self._codecraft_key_file.exists() else ""

    def browser_extension_status(self) -> dict[str, Any]:
        result = {"ready": self._extension.ready, "port": LocalExtensionServer.PORT, "token": self.settings["apiToken"], "error": self._extension.error}
        if not self._extension.ready:
            return result
        request = urllib.request.Request(f"http://127.0.0.1:{LocalExtensionServer.PORT}/status", headers={"X-CPS-Token": self.settings["apiToken"]})
        try:
            with urllib.request.urlopen(request, timeout=3) as response:
                payload = json.loads(response.read())
            result.update({"connected": response.status == 200 and payload.get("ready") is True, "name": payload.get("name", APP_NAME)})
        except Exception as exc:
            result.update({"connected": False, "error": str(exc)})
        return result

    def list_ai_models(self, values: dict[str, Any] | None = None) -> list[str]:
        values = values or {}
        provider = str(values.get("aiProvider") or self.settings.get("aiProvider") or "Gemini")
        if provider == "CodeCraft":
            key = self._codecraft_secret(str(values.get("codecraftApiKey", "")))
            fallback_models = [
                "claude-opus-4.8",
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
                "gpt-4o",
                "gpt-4o-mini",
                "o1",
                "o3-mini",
                "deepseek-chat",
                "deepseek-reasoner",
                "gemini-2.0-flash",
                "gemini-1.5-pro",
            ]
            if not key:
                return fallback_models
            headers = {"Accept": "application/json", "Authorization": f"Bearer {key}"}
            request = urllib.request.Request(f"{CODECRAFT_API_BASE}/models", headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    payload = json.loads(response.read())
                models = sorted(str(item["id"]) for item in payload.get("data", []) if item.get("id"))
                if models:
                    return models
            except Exception:
                pass
            return fallback_models

        if provider == "Custom":
            key = self._custom_secret(str(values.get("customApiKey", "")))
            base = self._validate_api_base(str(values.get("customApiBase") or self.settings.get("customApiBase") or ""))
            headers = {"Accept": "application/json"}
            if key:
                headers["Authorization"] = f"Bearer {key}"
            request = urllib.request.Request(f"{base}/models", headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    payload = json.loads(response.read())
            except urllib.error.HTTPError as exc:
                raise self._api_error(exc, "Custom API model request failed.") from exc
            return sorted(str(item["id"]) for item in payload.get("data", []) if item.get("id"))

        errors = []
        for key in self._ordered_gemini_keys(str(values.get("geminiApiKey", ""))):
            request = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models?key={quote(key)}")
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    payload = json.loads(response.read())
                return sorted(item["name"].removeprefix("models/") for item in payload.get("models", []) if "generateContent" in item.get("supportedGenerationMethods", []))
            except urllib.error.HTTPError as exc:
                errors.append(str(self._api_error(exc, "Gemini model request failed.")))
            except (urllib.error.URLError, TimeoutError) as exc:
                errors.append(str(exc))
        raise RuntimeError("All saved Gemini keys failed. " + (errors[-1] if errors else ""))

    def test_ai_connection(self, values: dict[str, Any]) -> dict[str, Any]:
        provider = str(values.get("aiProvider") or self.settings.get("aiProvider") or "Gemini")
        if provider == "Florence-2":
            return {"connected": True, "provider": provider, "models": ["onnx-community/Florence-2-base"], "message": "Local Florence-2 is ready to download on first use."}
        if provider == "CodeCraft":
            key = self._codecraft_secret(str(values.get("codecraftApiKey", "")))
            if not key:
                raise ValueError("Enter or save your CodeCraft API key first (1M free tokens at https://codecraftapi.com).")
        models = self.list_ai_models(values)
        return {"connected": True, "provider": provider, "models": models, "message": f"Connected to {provider}. {len(models)} models available."}

    def _gemini_generate(self, parts: list[dict[str, Any]], timeout: int = 120) -> str:
        body = json.dumps({"contents": [{"role": "user", "parts": parts}]}).encode()
        configured = str(self.settings.get("geminiModel") or "gemini-flash-latest")
        models = list(dict.fromkeys(filter(None, (
            self._gemini_runtime_model,
            configured,
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
        ))))
        errors: list[str] = []
        keys = self._ordered_gemini_keys()
        for model in models:
            for key in keys:
                request = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model)}:generateContent?key={quote(key)}", data=body, headers={"Content-Type": "application/json"})
                try:
                    with urllib.request.urlopen(request, timeout=timeout) as response:
                        payload = json.loads(response.read())
                    text = "\n".join(str(part.get("text", "")) for part in payload["candidates"][0]["content"]["parts"] if part.get("text")).strip()
                    if not text:
                        raise RuntimeError("The AI returned no text response.")
                    self._gemini_cursor = (self._gemini_keys().index(key) + 1) % len(keys)
                    self._gemini_runtime_model = model
                    if model != configured:
                        self._log_activity("warning", "ai", f"Gemini model {configured} was unavailable; continued with {model}.")
                    return text
                except urllib.error.HTTPError as exc:
                    errors.append(f"{model}: {self._api_error(exc, 'Gemini request failed.')}")
                except (urllib.error.URLError, TimeoutError, KeyError, IndexError, RuntimeError) as exc:
                    errors.append(f"{model}: {exc}")
        raise RuntimeError("All saved Gemini keys failed. " + (errors[-1] if errors else ""))

    def _custom_generate(self, content: str | list[dict[str, Any]], timeout: int = 120) -> str:
        key = self._custom_secret()
        base = self._validate_api_base(str(self.settings.get("customApiBase") or ""))
        model = str(self.settings.get("customApiModel") or "").strip()
        if not model:
            raise ValueError("Choose a custom AI model in Settings first.")
        body = json.dumps({"model": model, "messages": [{"role": "user", "content": content}], "temperature": 0.35}).encode()
        headers = {"Content-Type": "application/json"}
        if key:
            headers["Authorization"] = f"Bearer {key}"
        request = urllib.request.Request(f"{base}/chat/completions", data=body, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read())
            text = str(payload["choices"][0]["message"]["content"]).strip()
            if not text:
                raise RuntimeError("The custom AI returned no text response.")
            return text
        except urllib.error.HTTPError as exc:
            raise self._api_error(exc, "Custom AI request failed.") from exc

    def _codecraft_generate(self, content: str | list[dict[str, Any]], timeout: int = 120) -> str:
        key = self._codecraft_secret()
        if not key:
            raise ValueError("Add your CodeCraft API key in Settings first (1M free tokens at https://codecraftapi.com).")
        model = str(self.settings.get("codecraftModel") or "claude-opus-4.8").strip()
        messages = content if (isinstance(content, list) and content and isinstance(content[0], dict) and "role" in content[0]) else [{"role": "user", "content": content}]
        body = json.dumps({"model": model, "messages": messages, "temperature": 0.35}).encode()
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
        request = urllib.request.Request(f"{CODECRAFT_API_BASE}/chat/completions", data=body, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read())
            text = str(payload["choices"][0]["message"]["content"]).strip()
            if not text:
                raise RuntimeError("The CodeCraft AI returned no text response.")
            return text
        except urllib.error.HTTPError as exc:
            raise self._api_error(exc, "CodeCraft AI request failed.") from exc

    def generate_thumbnail_prompt(self, thumbnail_url: str, title: str = "", provider_override: str = "") -> str:
        thumbnail_url = validate_url(thumbnail_url)
        prompt = (
            "Analyze this video thumbnail and write one production-ready image-generation prompt that can recreate its composition and visual impact. "
            "Describe the main subject, pose, environment, camera framing, lighting, colors, mood, depth, important objects, typography placement without copying text, and 16:9 composition. "
            f"Video title for context: {title or 'Unknown'}. Return only the detailed prompt."
        )
        provider = provider_override or str(self.settings.get("aiProvider") or "Gemini")
        if provider in {"Custom", "CodeCraft"}:
            fn = self._codecraft_generate if provider == "CodeCraft" else self._custom_generate
            return fn([
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": thumbnail_url}},
            ])

        image_request = urllib.request.Request(thumbnail_url, headers={"User-Agent": "CPSUniversalDownloader/1.0"})
        with urllib.request.urlopen(image_request, timeout=30) as response:
            mime_type = response.headers.get_content_type()
            image_data = response.read(10 * 1024 * 1024 + 1)
        if not mime_type.startswith("image/") or len(image_data) > 10 * 1024 * 1024:
            raise ValueError("The thumbnail is not a supported image or is larger than 10 MB.")
        if provider == "Florence-2":
            raise ValueError("Florence-2 runs locally in the interface. Install the local model there or enable automatic fallback.")
        return self._gemini_generate([
            {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(image_data).decode("ascii")}},
            {"text": prompt},
        ])

    def analyze_thumbnail(self, thumbnail_url: str, title: str = "", provider_override: str = "") -> str:
        thumbnail_url = validate_url(thumbnail_url)
        prompt = (
            "Act as an expert video-thumbnail art director. Review this thumbnail in a practical, specific way. "
            "Use these headings: Visual description; What works; What weakens clicks; Composition and focal point; "
            "Color, contrast, and readability; Emotional hook; Five exact improvements; Improved image-generation prompt. "
            "Do not claim to know click-through data. Do not copy logos or existing text. Make the final prompt production-ready for a 16:9 thumbnail. "
            f"Video title for context: {title or 'Unknown'}."
        )
        provider = provider_override or str(self.settings.get("aiProvider") or "Gemini")
        if provider in {"Custom", "CodeCraft"}:
            fn = self._codecraft_generate if provider == "CodeCraft" else self._custom_generate
            return fn([
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": thumbnail_url}},
            ])
        if provider == "Florence-2":
            raise ValueError("Florence-2 runs locally in the interface. Install the local model there or enable automatic fallback.")

        image_request = urllib.request.Request(thumbnail_url, headers={"User-Agent": "CPSUniversalDownloader/1.0"})
        with urllib.request.urlopen(image_request, timeout=30) as response:
            mime_type = response.headers.get_content_type()
            image_data = response.read(10 * 1024 * 1024 + 1)
        if not mime_type.startswith("image/") or len(image_data) > 10 * 1024 * 1024:
            raise ValueError("The thumbnail is not a supported image or is larger than 10 MB.")
        return self._gemini_generate([
            {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(image_data).decode("ascii")}},
            {"text": prompt},
        ])

    def download_thumbnail(self, thumbnail_url: str, title: str = "") -> dict[str, Any]:
        thumbnail_url = validate_url(thumbnail_url)
        save_dir = Path(self.settings.get("saveLocation") or Path.home() / "Downloads")
        save_dir.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(
            thumbnail_url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            content_type = response.headers.get_content_type()
            data = response.read(25 * 1024 * 1024)
        ext = ".jpg"
        if "png" in content_type:
            ext = ".png"
        elif "webp" in content_type:
            ext = ".webp"
        elif "gif" in content_type:
            ext = ".gif"
        stem = self._safe_stem(title or "video_thumbnail")[:60] or "video_thumbnail"
        filename = f"{stem}_thumbnail{ext}"
        destination = save_dir / filename
        counter = 1
        while destination.exists():
            destination = save_dir / f"{stem}_thumbnail_{counter}{ext}"
            counter += 1
        destination.write_bytes(data)
        self._log_activity("info", "thumbnail", f"Downloaded thumbnail: {destination.name}")
        return {
            "saved": True,
            "filename": destination.name,
            "path": str(destination),
            "message": f"Thumbnail saved as {destination.name}"
        }

    def thumbnail_data_url(self, thumbnail_url: str) -> str:
        thumbnail_url = validate_url(thumbnail_url)
        request = urllib.request.Request(thumbnail_url, headers={"User-Agent": "CPSUniversalDownloader/1.1"})
        with urllib.request.urlopen(request, timeout=30) as response:
            mime_type = response.headers.get_content_type()
            image_data = response.read(10 * 1024 * 1024 + 1)
        if not mime_type.startswith("image/") or len(image_data) > 10 * 1024 * 1024:
            raise ValueError("The thumbnail is not a supported image or is larger than 10 MB.")
        return f"data:{mime_type};base64,{base64.b64encode(image_data).decode('ascii')}"

    def analyze_video_meaning(self, video_url: str, title: str = "") -> str:
        video_url = validate_url(video_url)
        provider = str(self.settings.get("aiProvider") or "Gemini")
        host = (urlparse(video_url).hostname or "").lower()
        prompt = (
            "Analyze the complete video using both its visuals and audio. Explain its central meaning, purpose, main claims, story or teaching, key moments in chronological order, "
            "important facts and examples, intended audience, tone, conclusions, and practical takeaways. Include useful timestamps when possible. Do not invent details. "
            f"The displayed title is: {title or 'Unknown'}."
        )
        is_youtube = host in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
        direct_error: Exception | None = None
        if provider == "Gemini" and is_youtube:
            try:
                return self._gemini_generate([
                    {"file_data": {"file_uri": video_url}, "video_metadata": {"fps": 1}},
                    {"text": prompt},
                ], timeout=300)
            except Exception as exc:
                direct_error = exc
                if not self.settings.get("aiFallback", True):
                    raise

        # Custom providers and non-YouTube sites use a subtitle transcript. This
        # also provides a fast, useful fallback when Gemini cannot ingest the
        # public video URL directly.
        try:
            return self.transcript_chat(prompt, video_url, [], str(self.settings.get("subtitleLanguage") or "en"))
        except Exception as transcript_error:
            if direct_error:
                raise RuntimeError(f"Direct video analysis failed: {direct_error}. Transcript fallback failed: {transcript_error}") from transcript_error
            if provider == "Florence-2":
                raise RuntimeError("Florence-2 analyzes thumbnails locally, not full videos. Configure Gemini or a custom text provider for whole-video analysis.") from transcript_error
            raise

    def summarize_video(self, video_url: str, title: str = "", language: str = "en") -> str:
        video_url = validate_url(video_url)
        prompt = (
            "Create a fast, accurate summary of this video from its transcript. Use these headings: One-sentence summary; "
            "Key points; Important examples or facts; Practical takeaways; Suggested chapters with timestamps. "
            "Keep it concise, preserve names and numbers, and never invent missing details. "
            f"The displayed title is: {title or 'Unknown'}."
        )
        try:
            return self.transcript_chat(prompt, video_url, [], language or str(self.settings.get("subtitleLanguage") or "en"))
        except Exception as transcript_error:
            provider = str(self.settings.get("aiProvider") or "Gemini")
            host = (urlparse(video_url).hostname or "").lower()
            if provider == "Gemini" and host in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}:
                try:
                    return self._gemini_generate([
                        {"file_data": {"file_uri": video_url}, "video_metadata": {"fps": 0.25}},
                        {"text": prompt},
                    ], timeout=240)
                except Exception as direct_error:
                    raise RuntimeError(f"Transcript summary failed: {transcript_error}. Direct video fallback failed: {direct_error}") from direct_error
            raise

    def ai_content_package(self, video_url: str, title: str = "") -> str:
        video_url = validate_url(video_url)
        prompt = (
            "Create a complete creator package for this video. Include: a concise summary; a detailed chronological analysis with timestamps; "
            "10 strong titles; a search-friendly description; chapter suggestions; a thumbnail image prompt; 5 short social captions; and 20 relevant hashtags. "
            "Use clear Markdown headings and never invent facts. " + (f"Displayed title: {title}." if title else "")
        )
        provider = str(self.settings.get("aiProvider") or "Gemini")
        host = (urlparse(video_url).hostname or "").lower()
        is_youtube = host in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
        if provider == "Gemini" and is_youtube:
            try:
                return self._gemini_generate([{"file_data": {"file_uri": video_url}, "video_metadata": {"fps": 1}}, {"text": prompt}], timeout=360)
            except Exception:
                if not self.settings.get("aiFallback", True):
                    raise
        return self.transcript_chat(prompt, video_url, [], str(self.settings.get("subtitleLanguage") or "en"))

    def analyze_local_video(self, path: str, mode: str = "summary") -> str:
        target = Path(path)
        if not target.is_file():
            raise ValueError("Choose a local video file first.")
        if str(self.settings.get("aiProvider") or "Gemini") != "Gemini":
            raise ValueError("Local video understanding currently requires Gemini.")
        size = target.stat().st_size
        if size > 20 * 1024 * 1024:
            raise ValueError("Choose a local video under 20 MB for AI analysis.")
        mime = mimetypes.guess_type(target.name)[0] or "video/mp4"
        instruction = "Summarize the video and list its main meaning, important points, and useful timestamps." if mode == "summary" else "Deeply analyze the full video chronologically. Capture all claims, examples, visual details, speakers, conclusions, and practical takeaways with timestamps."
        return self._gemini_generate([{"inline_data": {"mime_type": mime, "data": base64.b64encode(target.read_bytes()).decode("ascii")}}, {"text": instruction}], timeout=360)

    def _transcript_for(self, video_url: str, language: str = "en") -> str:
        video_url = validate_url(video_url)
        transcript_dir = DATA_DIR / "transcripts"
        transcript_dir.mkdir(parents=True, exist_ok=True)
        key = hashlib.sha256(f"{video_url}|{language}".encode()).hexdigest()[:24]
        cached = transcript_dir / f"{key}.txt"
        if cached.exists() and cached.stat().st_size:
            return cached.read_text(encoding="utf-8")
        with tempfile.TemporaryDirectory(prefix="cps-transcript-") as temporary:
            template = str(Path(temporary) / "transcript.%(ext)s")
            args = [str(tool_path("yt-dlp.exe")), *self._base_args(), "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", language or "en", "--sub-format", "vtt", "-o", template, video_url]
            result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0, env=child_process_environment())
            files = list(Path(temporary).glob("*.vtt"))
            if result.returncode or not files:
                raise RuntimeError("No usable transcript was available. Try another subtitle language or generate subtitles first.")
            raw = files[0].read_text(encoding="utf-8", errors="replace")
        lines, previous, timestamp = [], "", ""
        for line in raw.splitlines():
            clean = re.sub(r"<[^>]+>", "", line).strip()
            if "-->" in clean:
                timestamp = clean.split("-->", 1)[0].strip().replace(".000", "")
                continue
            if not clean or clean == "WEBVTT" or re.match(r"^(Kind|Language):", clean) or clean.isdigit() or clean == previous:
                continue
            lines.append(f"[{timestamp}] {clean}" if timestamp else clean)
            previous = clean
        transcript = "\n".join(lines)[:180000]
        cached.write_text(transcript, encoding="utf-8")
        return transcript

    def transcript_chat(self, prompt: str, video_url: str, messages: list[dict[str, str]], language: str = "en") -> str:
        transcript = self._transcript_for(video_url, language)
        history = "\n".join(f"{item.get('role')}: {item.get('text')}" for item in messages[-8:])
        request = f"Answer only from the transcript. Cite timestamps when present; say when the transcript does not contain the answer.\nVIDEO TRANSCRIPT:\n{transcript}\nCONVERSATION:\n{history}\nQUESTION: {prompt}"
        return self.ai_chat(request, "", [])

    def list_gemini_models(self) -> list[str]:
        return self.list_ai_models({"aiProvider": "Gemini"})

    def ai_chat(self, prompt: str, video_url: str, messages: list[dict[str, str]]) -> str:
        preferred = str(self.settings.get("aiProvider") or "Gemini")
        providers = [preferred]
        if self.settings.get("aiFallback", True):
            providers.extend(provider for provider in ("Gemini", "CodeCraft", "Custom") if provider != preferred)
        errors = []
        for provider in providers:
            if provider == "Florence-2":
                continue
            try:
                return self._ai_chat_provider(provider, prompt, video_url, messages)
            except Exception as exc:
                errors.append(f"{provider}: {exc}")
        raise RuntimeError("No AI provider could complete the request. " + " | ".join(errors))

    def _ai_chat_provider(self, provider: str, prompt: str, video_url: str, messages: list[dict[str, str]]) -> str:
        context = f"Video link: {video_url}\n" if video_url else ""
        prior_messages = messages[:-1] if messages and messages[-1].get("role") == "You" and messages[-1].get("text") == prompt else messages
        if provider == "CodeCraft":
            key = self._codecraft_secret()
            if not key:
                raise ValueError("Add your CodeCraft API key in Settings first (1M free tokens at https://codecraftapi.com).")
            model = str(self.settings.get("codecraftModel") or "claude-opus-4.8").strip()
            conversation = [{"role": "system", "content": f"You are the CPS video assistant. Be concise and useful.\n{context}"}]
            for item in prior_messages[-12:]:
                conversation.append({"role": "user" if item.get("role") == "You" else "assistant", "content": str(item.get("text", ""))})
            conversation.append({"role": "user", "content": prompt})
            body = json.dumps({"model": model, "messages": conversation, "temperature": 0.4}).encode()
            headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
            request = urllib.request.Request(f"{CODECRAFT_API_BASE}/chat/completions", data=body, headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    payload = json.loads(response.read())
                return str(payload["choices"][0]["message"]["content"]).strip()
            except urllib.error.HTTPError as exc:
                raise self._api_error(exc, "CodeCraft AI request failed.") from exc

        if provider == "Custom":
            key = self._custom_secret()
            base = self._validate_api_base(str(self.settings.get("customApiBase") or ""))
            model = str(self.settings.get("customApiModel") or "").strip()
            if not model:
                raise ValueError("Choose a custom AI model in Settings first.")
            conversation = [{"role": "system", "content": f"You are the CPS video assistant. Be concise and useful.\n{context}"}]
            for item in prior_messages[-12:]:
                conversation.append({"role": "user" if item.get("role") == "You" else "assistant", "content": str(item.get("text", ""))})
            conversation.append({"role": "user", "content": prompt})
            body = json.dumps({"model": model, "messages": conversation, "temperature": 0.4}).encode()
            headers = {"Content-Type": "application/json"}
            if key:
                headers["Authorization"] = f"Bearer {key}"
            request = urllib.request.Request(f"{base}/chat/completions", data=body, headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    payload = json.loads(response.read())
                return str(payload["choices"][0]["message"]["content"]).strip()
            except urllib.error.HTTPError as exc:
                raise self._api_error(exc, "Custom AI request failed.") from exc

        history = "\n".join(f"{item.get('role')}: {item.get('text')}" for item in prior_messages[-10:])
        return self._gemini_generate([{"text": f"You are the CPS video assistant. Be concise and useful.\n{context}{history}\nUser: {prompt}"}], timeout=90)

    def shutdown(self) -> None:
        self._shutdown.set()
        self.cancel_downloads()
        with self._lock:
            conversion_ids = list(self._conversion_processes)
        for identifier in conversion_ids:
            self.cancel_conversion(identifier)
        self._extension.close()

    def show_window(self) -> bool:
        if self._window:
            self._window.show()
            self._window.restore()
        return True

    def quit_application(self) -> bool:
        self._force_exit = True
        self.shutdown()
        if self._tray_icon:
            self._tray_icon.stop()
        if self._window:
            self._window.destroy()
        return True


def start_tray_icon(api: DesktopApi) -> None:
    try:
        import pystray
        from PIL import Image, ImageDraw

        image = Image.new("RGBA", (64, 64), (19, 91, 224, 255))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((3, 3, 61, 61), radius=17, fill=(35, 119, 255, 255), outline=(148, 220, 255, 255), width=3)
        draw.line((32, 14, 32, 40), fill="white", width=7)
        draw.line((21, 31, 32, 42, 43, 31), fill="white", width=7, joint="curve")
        draw.line((17, 49, 47, 49), fill="white", width=6)

        def show_app(_icon: Any = None, _item: Any = None) -> None:
            api.show_window()

        def quit_app(_icon: Any = None, _item: Any = None) -> None:
            api.quit_application()

        api._tray_icon = pystray.Icon("cps-downloader", image, APP_NAME, pystray.Menu(pystray.MenuItem("Open CPS Downloader", show_app, default=True), pystray.MenuItem("Quit", quit_app)))
        threading.Thread(target=api._tray_icon.run, name="cps-system-tray", daemon=True).start()
    except Exception:
        api._tray_icon = None


def main() -> None:
    import webview

    ui = frontend_path() / "index.html"
    if not ui.exists():
        raise FileNotFoundError("The application interface has not been built. Run build-portable.ps1.")
    api = DesktopApi()
    window = webview.create_window(APP_NAME, ui.as_uri(), js_api=api, width=1360, height=880, min_size=(940, 650), background_color="#081426", text_select=True)
    api._window = window

    def close_to_tray() -> bool:
        if api._force_exit or os.environ.get("CPS_PORTABLE_SMOKE_TEST") == "1":
            api.shutdown()
            return True
        window.hide()
        return False

    window.events.closing += close_to_tray
    window.events.shown += lambda: start_tray_icon(api) if not api._tray_icon else None

    # Build verification can launch the real packaged application without
    # leaving a hidden window or background process behind.
    if os.environ.get("CPS_PORTABLE_SMOKE_TEST") == "1":
        def smoke_ready() -> None:
            engine = subprocess.run(
                [str(tool_path("yt-dlp.exe")), "--version"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=30,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                env=child_process_environment(),
            )
            extension = api.browser_extension_status()
            (DATA_DIR / "smoke-ready.json").write_text(
                json.dumps({"loaded": True, "frontend": str(ui), "version": APP_VERSION, "engineVersion": engine.stdout.strip(), "engineExitCode": engine.returncode, "extensionConnected": extension.get("connected", False)}),
                encoding="utf-8",
            )
            def finish_smoke() -> None:
                api._force_exit = True
                window.destroy()
            threading.Timer(1.0, finish_smoke).start()

        window.events.loaded += smoke_ready

    webview.start(debug=False, private_mode=False)


if __name__ == "__main__":
    main()
