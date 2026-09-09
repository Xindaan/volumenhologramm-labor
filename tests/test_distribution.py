import hashlib
import importlib.util
import json
from pathlib import Path
import queue
import re
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
ARCHIVE = ROOT / "artifacts" / f"volumenhologramm-labor-v{VERSION}.zip"


class DistributionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (ROOT / ".test-tmp").mkdir(exist_ok=True)
        cls.temporary = tempfile.TemporaryDirectory(prefix="package with spaces-", dir=ROOT / ".test-tmp")
        cls.directory = Path(cls.temporary.name)
        with zipfile.ZipFile(ARCHIVE) as archive:
            archive.extractall(cls.directory)
        cls.package = cls.directory / f"volumenhologramm-labor-v{VERSION}"

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_complete_package_and_checksums(self):
        for line in (self.package / "SHA256SUMS.txt").read_text().splitlines():
            expected, name = line.split("  ", 1)
            self.assertEqual(hashlib.sha256((self.package / name).read_bytes()).hexdigest(), expected)
        expected = ARCHIVE.with_suffix(".zip.sha256").read_text().split()[0]
        self.assertEqual(hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(), expected)
        with zipfile.ZipFile(ARCHIVE) as archive:
            names = archive.namelist()
            self.assertFalse(any(x in name for name in names for x in ["node_modules", ".DS_Store", "codex_learning_log", ".env", "../"]))
            self.assertTrue(any(name.endswith("dist/index.html") for name in names))
            self.assertTrue(any("born-worker-" in name for name in names))
            self.assertTrue(any(name.endswith("THIRD_PARTY_NOTICES.txt") for name in names))
            for info in archive.infolist():
                if info.filename.endswith((".command", ".sh")):
                    self.assertEqual((info.external_attr >> 16) & 0o111, 0o111)
                if info.filename.endswith(".cmd"):
                    data = archive.read(info)
                    self.assertIn(b"\r\n", data)
                    self.assertNotIn(b"\n", data.replace(b"\r\n", b""))

    def test_extracted_launcher_and_all_browser_assets(self):
        # Run outside the package directory: resolution must use __file__, not cwd.
        process = subprocess.Popen(
            [sys.executable, str(self.package / "start.py"), "--no-browser", "--port", "0"],
            cwd=self.directory, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        first_line = queue.Queue()
        reader = threading.Thread(target=lambda: first_line.put(process.stdout.readline()), daemon=True)
        reader.start()
        try:
            line = first_line.get(timeout=10)
            if not line:
                self.fail(process.stderr.read())
            match = re.search(r"http://127\.0\.0\.1:\d+/", line)
            self.assertIsNotNone(match, line)
            url = match.group()
            with urllib.request.urlopen(url, timeout=5) as response:
                html = response.read().decode()
                self.assertIn("Volumenhologramm-Labor", html)
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
            for file in sorted((self.package / "dist").rglob("*")):
                if not file.is_file():
                    continue
                with self.subTest(file=file.name):
                    relative = file.relative_to(self.package / "dist").as_posix()
                    with urllib.request.urlopen(url + relative, timeout=5) as response:
                        self.assertEqual(response.read(), file.read_bytes())
                        if file.suffix == ".js":
                            self.assertEqual(response.headers.get_content_type(), "text/javascript")
            for path in ["start.py", "README.md", "assets/"]:
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(url + path, timeout=5)
                self.assertEqual(error.exception.code, 404)
        finally:
            process.terminate()
            process.communicate(timeout=5)

    def test_missing_build_has_actionable_error(self):
        incomplete = self.directory / "missing-app"
        incomplete.mkdir(exist_ok=True)
        launcher = incomplete / "start.py"
        launcher.write_bytes((self.package / "start.py").read_bytes())
        result = subprocess.run([sys.executable, str(launcher), "--no-browser"],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 1)
        self.assertIn("dist/index.html", result.stderr)
        self.assertIn("npm ci && npm run build", result.stderr)

    def test_local_server_needs_no_reverse_dns(self):
        spec = importlib.util.spec_from_file_location("packaged_launcher", self.package / "start.py")
        launcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(launcher)
        with patch("socket.getfqdn", side_effect=AssertionError("Lokaler Start darf kein Reverse-DNS benötigen")):
            with launcher.LocalServer(("127.0.0.1", 0), launcher.AppHandler) as server:
                self.assertEqual(server.server_name, "127.0.0.1")
                self.assertGreater(server.server_port, 0)


if __name__ == "__main__":
    unittest.main()
