#!/usr/bin/env python3
"""Build a deterministic, explicitly allowlisted distribution ZIP."""
import hashlib
import json
from pathlib import Path
import stat
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
NAME = f"volumenhologramm-labor-v{VERSION}"
FILES = [
    "README.md", "INSTALLATION.md", "start.py", "Start-macOS.command",
    "Start-Windows.cmd", "Start-Linux.sh", "docs/MODEL.md", "docs/TESTS.md",
    "public/THIRD_PARTY_NOTICES.txt", "screenshots/01-aufzeichnung.png",
    "docs/OBJECT_MODEL.md", "docs/OBJECT_TESTS.md", "screenshots/02-tor-rekonstruktion.jpg", "screenshots/04-tor-szene.jpg",
]


def main():
    if not (ROOT / "dist/index.html").is_file():
        raise SystemExit("dist/index.html fehlt. Zuerst npm run build ausführen.")
    files = [(path, ROOT / path) for path in FILES]
    files.extend((p.relative_to(ROOT).as_posix(), p) for p in sorted((ROOT / "dist").rglob("*"))
                 if p.is_file() and not any(part.startswith(".") for part in p.relative_to(ROOT).parts))
    contents = {}
    for relative, path in files:
        if not path.is_file() or path.is_symlink():
            raise SystemExit(f"Erforderliche reguläre Paketdatei fehlt: {relative}")
        data = path.read_bytes()
        if path.suffix in (".py", ".md", ".txt", ".sh", ".command", ".cmd"):
            data = data.replace(b"\r\n", b"\n")
        if path.suffix == ".cmd":
            data = data.replace(b"\n", b"\r\n")
        contents[relative] = data
    contents["SHA256SUMS.txt"] = "".join(
        f"{hashlib.sha256(data).hexdigest()}  {relative}\n"
        for relative, data in sorted(contents.items())
    ).encode("utf-8")
    output = ROOT / "artifacts"
    output.mkdir(exist_ok=True)
    archive = output / f"{NAME}.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for relative, data in sorted(contents.items()):
            info = zipfile.ZipInfo(f"{NAME}/{relative}", date_time=(2026, 9, 9, 0, 0, 0))
            info.create_system = 3
            mode = 0o755 if relative.endswith((".sh", ".command")) else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            bundle.writestr(info, data)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum = archive.with_suffix(".zip.sha256")
    checksum.write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
    print(f"Paket: {archive.relative_to(ROOT)} ({archive.stat().st_size:,} Bytes)")
    print(f"SHA-256: {digest}")
    print(f"Dateien im ZIP: {len(contents)}")


if __name__ == "__main__":
    main()
