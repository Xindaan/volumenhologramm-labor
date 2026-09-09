#!/usr/bin/env python3
"""Serve the included browser application locally; Python standard library only."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import webbrowser


class AppHandler(SimpleHTTPRequestHandler):
    # Windows may otherwise assign an unsuitable MIME type to JavaScript modules.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "Not found")
        return None

    def log_message(self, format_string, *args):
        # Successful asset requests need not flood the launcher's terminal.
        if args and str(args[1] if len(args) > 1 else "") not in ("200", "304"):
            super().log_message(format_string, *args)


def main():
    parser = argparse.ArgumentParser(description="Volumenhologramm-Labor lokal starten")
    parser.add_argument("--port", type=int, default=5197, help="Lokaler Port (Standard: 5197)")
    parser.add_argument("--no-browser", action="store_true", help="Browser nicht automatisch öffnen")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("Der Port muss zwischen 0 und 65535 liegen.")
    app_dir = Path(__file__).resolve().parent / "dist"
    if not (app_dir / "index.html").is_file():
        print("Die fertige App fehlt: dist/index.html wurde nicht gefunden.\n"
              "Bitte das vollständige ZIP aus den GitHub Releases entpacken.\n"
              "Bei einer Quellcode-Kopie zuerst: npm ci && npm run build", file=sys.stderr)
        return 1
    handler = partial(AppHandler, directory=str(app_dir))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        print(f"Der lokale Server konnte nicht starten: {error}\n"
              "Falls der Port belegt ist: python3 start.py --port 5198", file=sys.stderr)
        return 1
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"Volumenhologramm-Labor: {url}", flush=True)
    print("Nur auf diesem Computer erreichbar. Dieses Fenster offen lassen.\n"
          "Beenden mit Strg+C. Falls sich kein Browser öffnet, die Adresse manuell öffnen.", flush=True)
    opener = None
    if not args.no_browser:
        opener = threading.Timer(0.3, webbrowser.open, args=(url,))
        opener.daemon = True
        opener.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nLabor beendet.")
    finally:
        if opener:
            opener.cancel()
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
