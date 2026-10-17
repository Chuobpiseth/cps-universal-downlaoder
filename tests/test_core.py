import importlib.util
import io
import json
import os
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from unittest import mock
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "backend" / "app.py"
SPEC = importlib.util.spec_from_file_location("cps_react_backend", MODULE_PATH)
backend = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = backend
SPEC.loader.exec_module(backend)


class CoreTests(unittest.TestCase):
    def test_url_validation_accepts_web_urls(self):
        self.assertEqual("https://youtube.com/watch?v=abc", backend.validate_url(" https://youtube.com/watch?v=abc "))

    def test_url_validation_rejects_unsafe_protocols(self):
        for value in ("file:///secret.txt", "javascript:alert(1)", "not a url"):
            with self.assertRaises(ValueError):
                backend.validate_url(value)

    def test_quality_selector_honors_limit(self):
        selector = backend.format_selector("1080p")
        self.assertIn("height<=?1080", selector)
        self.assertIn("/best", selector)

    def test_best_quality_uses_separate_video_and_audio(self):
        self.assertEqual("bv*+ba/b/best", backend.format_selector("Best"))

    def test_progress_parser(self):
        progress = backend.parse_progress("download: 62.5%|3.2MiB/s|00:18")
        self.assertEqual(62.5, progress["progress"])
        self.assertEqual("Downloading", progress["stage"])
        self.assertEqual("Processing", backend.parse_progress("postprocess:NA%|NA|NA")["stage"])

    def test_format_inspector_shape(self):
        item = backend.compact_format({"format_id": "137", "ext": "mp4", "width": 1920, "height": 1080, "fps": 30, "vcodec": "avc1", "acodec": "none", "filesize": 1048576})
        self.assertEqual("137", item["id"])
        self.assertEqual("1920x1080", item["resolution"])
        self.assertEqual(1048576, item["size"])

    def test_recovery_classifies_authentication(self):
        recovery = backend.classify_download_error(["ERROR: Sign in to confirm your age; use cookies"])
        self.assertEqual("authentication", recovery["code"])
        self.assertIn("browser", recovery["action"])

    def test_recovery_classifies_youtube_bot_check(self):
        recovery = backend.classify_download_error([
            "WARNING: [youtube] 9Oo5AFzVLgE: Unable to download webpage: HTTP Error 429: Too Many Requests",
            "ERROR: [youtube] 9Oo5AFzVLgE: Sign in to confirm you’re not a bot. Use --cookies-from-browser"
        ])
        self.assertEqual("youtube-bot-check", recovery["code"])
        self.assertIn("429", recovery["message"])
        self.assertIn("cookies", recovery["action"].lower())

    def test_recovery_classifies_unavailable_video(self):
        recovery = backend.classify_download_error(["ERROR: This video is unavailable"])
        self.assertEqual("unavailable", recovery["code"])
        self.assertIn("removed", recovery["message"])

    def test_version_comparison_handles_release_tags(self):
        self.assertGreater(backend.version_tuple("v1.2.4"), backend.version_tuple("1.2.3"))
        self.assertEqual((1, 2, 3), backend.version_tuple("v1.2.3"))

    def test_facebook_error_explains_browser_authentication(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api.settings = {"browserCookies": "None"}
        message = api._friendly_analysis_error("https://www.facebook.com/reel/123", "Cannot parse data")
        self.assertIn("Sign into Facebook", message)
        self.assertIn("browser", message)
        recovery = backend.classify_download_error(["ERROR: [facebook] 123: No video formats found!"])
        self.assertEqual("facebook-auth", recovery["code"])

    def test_clear_stopped_downloads_keeps_active_and_waiting(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._lock = threading.RLock()
        api.queue = [{"status": "Failed"}, {"status": "Cancelled"}, {"status": "Waiting"}, {"status": "Downloading"}]
        api._save_queue = lambda: None
        api._log_activity = lambda *_args: None
        self.assertEqual(2, api.clear_stopped_downloads())
        self.assertEqual(["Waiting", "Downloading"], [item["status"] for item in api.queue])

    def test_gemini_falls_back_when_selected_model_is_overloaded(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api.settings = {"geminiModel": "gemini-overloaded"}
        api._gemini_runtime_model = ""
        api._gemini_cursor = 0
        api._ordered_gemini_keys = lambda: ["test-key"]
        api._gemini_keys = lambda: ["test-key"]
        logged = []
        api._log_activity = lambda *args: logged.append(args)

        class Response:
            def __enter__(self): return self
            def __exit__(self, *_args): return False
            def read(self): return b'{"candidates":[{"content":{"parts":[{"text":"Fallback worked"}]}}]}'

        def urlopen(request, timeout=0):
            if "gemini-overloaded" in request.full_url:
                payload = io.BytesIO(b'{"error":{"message":"This model is currently experiencing high demand."}}')
                raise urllib.error.HTTPError(request.full_url, 503, "Busy", {}, payload)
            return Response()

        with mock.patch.object(backend.urllib.request, "urlopen", side_effect=urlopen):
            self.assertEqual("Fallback worked", api._gemini_generate([{"text": "Hello"}]))
        self.assertEqual("gemini-flash-latest", api._gemini_runtime_model)
        self.assertTrue(logged)

    def test_github_release_check_finds_setup_and_checksum(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._lock = threading.RLock()
        api._update_state = {"status": "idle", "currentVersion": backend.APP_VERSION}
        api._log_activity = lambda *_args: None
        payload = {
            "tag_name": "v9.0.0", "name": "Version 9", "published_at": "2026-10-05T00:00:00Z", "body": "Release notes",
            "assets": [
                {"name": "CPS-Universal-Downloader-v9.0.0-Setup.exe", "browser_download_url": "https://github.com/example/setup.exe", "size": 100},
                {"name": "SHA256SUMS-v9.0.0.txt", "browser_download_url": "https://github.com/example/checksums.txt", "size": 100},
            ],
        }

        class Response:
            def __enter__(self): return self
            def __exit__(self, *_args): return False
            def read(self): return json.dumps(payload).encode()

        with mock.patch.object(backend.urllib.request, "urlopen", return_value=Response()):
            result = api.check_app_update()
        self.assertTrue(result["available"])
        self.assertEqual("9.0.0", result["latestVersion"])
        self.assertTrue(result["checksumUrl"].endswith("checksums.txt"))

    def test_packaged_data_dir_uses_local_appdata(self):
        with mock.patch.dict(os.environ, {"LOCALAPPDATA": r"C:\Users\Example\AppData\Local"}, clear=False):
            os.environ.pop("CPS_DATA_DIR", None)
            path = backend.resolve_data_dir(frozen=True)
        self.assertEqual(Path(r"C:\Users\Example\AppData\Local") / "CPS Universal Downloader", path)

    def test_download_batch_drains_jobs_added_while_running(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._lock = threading.RLock()
        api._stop = threading.Event()
        api._coordinator = threading.current_thread()
        api._scheduled_download_ids = {"first"}
        api.settings = {"parallelDownloads": 1}
        api.queue = [
            {"id": "first", "status": "Waiting", "priority": 0, "createdAt": "1"},
            {"id": "second", "status": "Waiting", "priority": 0, "createdAt": "2"},
        ]
        visited = []

        def download(item):
            visited.append(item["id"])
            item["status"] = "Completed"
            if item["id"] == "first":
                with api._lock:
                    api._scheduled_download_ids.add("second")

        api._download_one = download
        api._run_download_batch()
        self.assertEqual(["first", "second"], visited)
        self.assertIsNone(api._coordinator)

    def test_conversion_arguments_cover_media_outputs(self):
        self.assertIn("libx264", backend.DesktopApi._conversion_arguments("MP4"))
        self.assertIn("libmp3lame", backend.DesktopApi._conversion_arguments("MP3"))
        self.assertIn("-frames:v", backend.DesktopApi._conversion_arguments("JPG"))
        with self.assertRaises(ValueError):
            backend.DesktopApi._conversion_arguments("EXE")

    def test_child_process_environment_removes_pyinstaller_state(self):
        os.environ["_PYI_TEST_STATE"] = "parent"
        os.environ["_MEIPASS2"] = "parent"
        try:
            environment = backend.child_process_environment()
            self.assertNotIn("_PYI_TEST_STATE", environment)
            self.assertNotIn("_MEIPASS2", environment)
        finally:
            os.environ.pop("_PYI_TEST_STATE", None)
            os.environ.pop("_MEIPASS2", None)

    def test_custom_api_base_validation(self):
        self.assertEqual("https://api.openai.com/v1", backend.DesktopApi._validate_api_base("https://api.openai.com/v1/"))
        self.assertEqual("http://127.0.0.1:11434/v1", backend.DesktopApi._validate_api_base("http://127.0.0.1:11434/v1"))
        for value in ("file:///tmp/api", "javascript:alert(1)", "api.example.com/v1"):
            with self.assertRaises(ValueError):
                backend.DesktopApi._validate_api_base(value)

    def test_custom_openai_compatible_model_discovery(self):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, _format, *args):
                return

            def do_GET(self):
                body = json.dumps({"data": [{"id": "local-fast"}, {"id": "local-smart"}]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_POST(self):
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length))
                assert payload["model"] == "local-fast"
                body = json.dumps({"choices": [{"message": {"content": "Custom API reply"}}]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            api = backend.DesktopApi.__new__(backend.DesktopApi)
            api.settings = {"aiProvider": "Custom", "customApiBase": f"http://127.0.0.1:{server.server_port}", "customApiModel": "local-fast"}
            api._custom_key_file = Path("unused-key-file")
            models = api.list_ai_models({"aiProvider": "Custom", "customApiBase": f"http://127.0.0.1:{server.server_port}"})
            self.assertEqual(["local-fast", "local-smart"], models)
            reply = api.ai_chat("Hello", "", [{"role": "You", "text": "Hello"}])
            self.assertEqual("Custom API reply", reply)
            prompt = api.generate_thumbnail_prompt("https://example.com/thumbnail.jpg", "Example video")
            self.assertEqual("Custom API reply", prompt)
            review = api.analyze_thumbnail("https://example.com/thumbnail.jpg", "Example video")
            self.assertEqual("Custom API reply", review)
            api._transcript_for = lambda *_args: "00:01 Example transcript"
            self.assertEqual("Custom API reply", api.analyze_video_meaning("https://youtube.com/watch?v=abc", "Example video"))
        finally:
            server.shutdown()
            server.server_close()

    def test_video_meaning_uses_transcript_for_non_youtube_links(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api.settings = {"aiProvider": "Custom", "aiFallback": False}
        api._transcript_for = lambda *_args: "00:01 Example transcript"
        api._ai_chat_provider = lambda provider, prompt, video_url, messages: "Transcript analysis"
        self.assertEqual("Transcript analysis", api.analyze_video_meaning("https://example.com/video/123", "Example"))

    def test_playlist_analysis_uses_fast_flat_extraction(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._log_activity = lambda *_args: None
        calls = []
        api._run_json = lambda args, timeout=120: calls.append(args) or {"title": "Playlist", "extractor_key": "YoutubeTab", "entries": [{"id": "abc", "title": "Episode 1", "url": "abc", "duration": 12}]}
        result = api.analyze("https://youtube.com/playlist?list=PL123")
        self.assertEqual(1, len(calls))
        self.assertIn("--flat-playlist", calls[0])
        self.assertEqual("Episode 1", result["entries"][0]["title"])
        self.assertEqual("https://www.youtube.com/watch?v=abc", result["entries"][0]["url"])
        self.assertEqual("https://i.ytimg.com/vi/abc/hqdefault.jpg", result["entries"][0]["thumbnail"])
        self.assertEqual(result["entries"][0]["thumbnail"], result["thumbnail"])

    def test_single_video_analysis_skips_playlist_probe(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._log_activity = lambda *_args: None
        calls = []
        api._run_json = lambda args, timeout=120: calls.append(args) or {"title": "Video", "extractor_key": "Douyin", "formats": [{"format_id": "best", "ext": "mp4"}]}
        result = api.analyze("https://www.douyin.com/video/123456")
        self.assertEqual(1, len(calls))
        self.assertIn("--no-playlist", calls[0])
        self.assertNotIn("--flat-playlist", calls[0])
        self.assertEqual("Douyin", result["platform"])

    def test_sharepoint_errors_explain_permission_boundary(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api.settings = {"browserCookies": "Edge"}
        message = api._friendly_analysis_error("https://tenant.sharepoint.com/video.mp4", "HTTP Error 403: Forbidden")
        self.assertIn("did not authorize downloading", message)
        self.assertIn("does not bypass", message)
        kisskh = api._friendly_analysis_error("https://kisskh.co/Drama/Episode-1", "Unsupported URL")
        self.assertIn("not directly supported", kisskh)
        self.assertIn("DRM", kisskh)

    def test_history_path_repair_finds_unicode_output_by_media_id(self):
        folder = Path(__file__).with_name(".history-path-test")
        folder.mkdir(exist_ok=True)
        actual = folder / "សាកល្បង [video123].mp4"
        actual.write_bytes(b"test")
        try:
            broken = folder / "broken title [video123].mp4"
            self.assertEqual(str(actual), backend.DesktopApi._actual_output_path(str(broken)))
        finally:
            actual.unlink(missing_ok=True)
            folder.rmdir()

    def test_gemini_key_store_limits_and_masks_keys(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._gemini_cursor = 0
        api._key_file = Path(__file__).with_name(".gemini-key-test.bin")
        try:
            with mock.patch.object(backend, "protect_secret", lambda value: value.encode()), mock.patch.object(backend, "unprotect_secret", lambda value: value.decode()):
                masked = api.add_gemini_key("example-secret-1234")
                self.assertEqual("••••••••1234", masked[0]["masked"])
                self.assertEqual(["example-secret-1234"], api._gemini_keys())
                self.assertEqual([], api.remove_gemini_key(masked[0]["id"]))
        finally:
            api._key_file.unlink(missing_ok=True)

    def test_summary_skill_uses_transcript_grounding(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        captured = []
        api.transcript_chat = lambda prompt, url, messages, language: captured.append((prompt, url, language)) or "Concise summary"
        result = api.summarize_video("https://example.com/video", "Example", "km")
        self.assertEqual("Concise summary", result)
        self.assertIn("Key points", captured[0][0])
        self.assertEqual("km", captured[0][2])

    def test_workflow_recipes_preserve_only_supported_download_options(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._lock = threading.RLock()
        api._recipes_file = Path(__file__).with_name(".recipes-test.json")
        api.recipes = []
        try:
            recipes = api.save_workflow_recipe("Khmer workflow", {"kind": "Video", "quality": "1080p", "embedSubtitles": True, "unsafe": "ignored"})
            custom = next(item for item in recipes if not item["builtIn"])
            self.assertEqual("Khmer workflow", custom["name"])
            self.assertNotIn("unsafe", custom["options"])
            self.assertEqual(4, len(backend.DesktopApi._built_in_recipes()))
        finally:
            api._recipes_file.unlink(missing_ok=True)

    def test_smart_clip_parser_returns_queue_ready_timestamps(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api.transcript_chat = lambda *_args: '```json\n[{"title":"Hook","start":"00:10","end":"00:42","reason":"Strong opening","caption":"Watch this"}]\n```'
        clips = api.suggest_smart_clips("https://example.com/video", "Example")
        self.assertEqual("00:10", clips[0]["start"])
        self.assertEqual("00:42", clips[0]["end"])
        self.assertTrue(clips[0]["selected"])

    def test_browser_extension_bridge_requires_token_and_reports_ready(self):
        original_port = backend.LocalExtensionServer.PORT
        backend.LocalExtensionServer.PORT = 0
        bridge = None
        try:
            fake_api = mock.Mock()
            bridge = backend.LocalExtensionServer(fake_api, "test-token")
            self.assertTrue(bridge.ready)
            port = bridge.server.server_address[1]
            authorized = urllib.request.Request(f"http://127.0.0.1:{port}/status", headers={"X-CPS-Token": "test-token"})
            with urllib.request.urlopen(authorized, timeout=3) as response:
                payload = json.loads(response.read())
            self.assertTrue(payload["ready"])
            with self.assertRaises(urllib.error.HTTPError) as rejected:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/status", timeout=3)
            self.assertEqual(401, rejected.exception.code)
            rejected.exception.close()
        finally:
            if bridge:
                bridge.close()
            backend.LocalExtensionServer.PORT = original_port

    def test_smart_clip_jobs_keep_individual_ranges_and_creator_options(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        captured = []
        api.add_urls = lambda sources, options: captured.append((sources, options)) or {"ids": [str(len(captured))], "count": 1}
        result = api.add_clip_jobs(
            {"url": "https://example.com/video", "title": "Example", "platform": "Video"},
            [{"title": "Hook", "start": "00:10", "end": "00:40", "caption": "Important idea"}],
            {"kind": "Video", "format": "MP4", "smartVertical": True, "removeSilence": True, "addHookCaption": True},
        )
        self.assertEqual(1, result["count"])
        self.assertEqual("00:10", captured[0][1]["startTime"])
        self.assertEqual("00:40", captured[0][1]["endTime"])
        self.assertTrue(captured[0][1]["smartVertical"])
        self.assertEqual("Important idea", captured[0][1]["hookCaption"])

    def test_check_app_update_handles_404_cleanly(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._update_state = {}
        api._lock = threading.RLock()
        api._set_update_state = backend.DesktopApi._set_update_state.__get__(api, backend.DesktopApi)
        api._log_activity = lambda *args: None

        def fake_urlopen(*args, **kwargs):
            raise urllib.error.HTTPError("https://api.github.com/...", 404, "Not Found", {}, None)

        with mock.patch("urllib.request.urlopen", side_effect=fake_urlopen):
            state = api.check_app_update(manual=True)
            self.assertEqual("current", state["status"])
            self.assertIn("up to date", state["message"])
            self.assertFalse(state["available"])

    def test_download_thumbnail_saves_image(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._log_activity = lambda *args: None
        with tempfile.TemporaryDirectory() as temp_dir:
            api.settings = {"saveLocation": temp_dir}

            class FakeResponse:
                def __enter__(self): return self
                def __exit__(self, *args): return False
                headers = mock.Mock(get_content_type=lambda: "image/jpeg")
                def read(self, *args): return b"\xff\xd8\xff\xe0fake_jpeg_content"

            with mock.patch("urllib.request.urlopen", return_value=FakeResponse()):
                result = api.download_thumbnail("https://example.com/thumb.jpg", "Test Video Title")
                self.assertTrue(result["saved"])
                self.assertTrue(Path(result["path"]).exists())
                self.assertEqual(b"\xff\xd8\xff\xe0fake_jpeg_content", Path(result["path"]).read_bytes())

    def test_groq_openrouter_inception_models_and_generation(self):
        api = backend.DesktopApi.__new__(backend.DesktopApi)
        api._groq_key_file = Path("nonexistent-groq-key")
        api._openrouter_key_file = Path("nonexistent-openrouter-key")
        api._inception_key_file = Path("nonexistent-inception-key")
        api.settings = {
            "groqModel": "llama-3.2-11b-vision-preview",
            "openrouterModel": "meta-llama/llama-3.2-11b-vision-instruct:free",
            "inceptionModel": "mercury-2.5",
        }

        groq_models = api.list_ai_models({"aiProvider": "Groq"})
        self.assertIn("llama-3.2-11b-vision-preview", groq_models)

        openrouter_models = api.list_ai_models({"aiProvider": "OpenRouter"})
        self.assertIn("meta-llama/llama-3.2-11b-vision-instruct:free", openrouter_models)

        inception_models = api.list_ai_models({"aiProvider": "InceptionLabs"})
        self.assertIn("mercury-2.5", inception_models)

        class MockChatResponse:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self):
                return json.dumps({"choices": [{"message": {"content": "Generated reply"}}]}).encode()

        with mock.patch("urllib.request.urlopen", return_value=MockChatResponse()):
            reply = api._openai_chat_request("https://api.example.com/v1", "test-key", "test-model", "test prompt")
            self.assertEqual("Generated reply", reply)

    def test_native_clipboard_read_write(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with mock.patch.object(backend, "DATA_DIR", Path(temp_dir)):
                api = backend.DesktopApi()
                test_str = "https://youtube.com/watch?v=clip_test_123"
                if api.set_clipboard_text(test_str):
                    self.assertEqual(test_str, api.read_clipboard_text())

    def test_download_one_executes_without_name_error(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with mock.patch.object(backend, "DATA_DIR", Path(temp_dir)):
                api = backend.DesktopApi()
                item = {
                    "id": "item-123",
                    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "title": "Rick Astley",
                    "status": "Waiting",
                    "saveLocation": temp_dir,
                }
                api.queue = [item]

                class MockProcess:
                    stdout = ["meta:title: Rick Astley", "download:download: 100%|1.0MiB/s|00:00"]
                    def poll(self): return 0
                    def wait(self): return 0

                with mock.patch("subprocess.Popen", return_value=MockProcess()):
                    api._download_one(item)
                    self.assertEqual("Completed", item.get("status"))

    def test_conversion_duration_ffmpeg_fallback(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with mock.patch.object(backend, "DATA_DIR", Path(temp_dir)):
                api = backend.DesktopApi()
                dummy_result = mock.Mock()
                dummy_result.stderr = "  Duration: 00:01:30.50, start: 0.000000, bitrate: 1200 kb/s"
                dummy_result.stdout = ""
                with mock.patch("subprocess.run", return_value=dummy_result):
                    with mock.patch.object(backend, "tool_path", return_value=Path(temp_dir) / "nonexistent.exe"):
                        duration = api._conversion_duration("dummy.mp4")
                        self.assertEqual(90.5, duration)


if __name__ == "__main__":
    unittest.main()


