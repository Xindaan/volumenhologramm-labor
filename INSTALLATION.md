# Installation und Start

## Variante A: fertiges Paket – empfohlen zum Ausprobieren

Benötigt werden ein aktueller Browser mit WebGL 2 und **Python 3.9 oder neuer**. Node.js, npm, ein GitHub-Konto und eine Internetverbindung während der Nutzung sind nicht erforderlich.

1. Unter [GitHub Releases](https://github.com/Xindaan/volumenhologramm-labor/releases/latest) das Paket **`volumenhologramm-labor-v1.1.0.zip`** herunterladen. Die automatisch von GitHub angebotenen Dateien „Source code“ enthalten dagegen den Quellcode.
2. Das ZIP **vollständig entpacken**. Alle Dateien und der Ordner `dist` müssen zusammenbleiben. Nichts direkt aus der ZIP-Vorschau starten.
3. Falls Python noch fehlt, Python 3 von [python.org](https://www.python.org/downloads/) installieren. Unter Windows die Option zum Hinzufügen zu PATH aktivieren, sofern angeboten.
4. Den passenden Startweg verwenden:

| System | Start |
|---|---|
| Windows | `Start-Windows.cmd` doppelklicken. Alternativ im Paketordner: `py -3 start.py`. |
| macOS | `Start-macOS.command` öffnen. Alternativ im Terminal im Paketordner: `python3 start.py`. |
| Linux | Im Paketordner: `sh Start-Linux.sh` oder `python3 start.py`. |

Der Start öffnet normalerweise den Standardbrowser. Falls nicht: **[http://127.0.0.1:5197/](http://127.0.0.1:5197/)** manuell öffnen. Das Terminalfenster während der Benutzung offen lassen; **Strg+C** beendet den Server.

Falls macOS das heruntergeladene `.command`-Skript nicht direkt öffnet, funktioniert der oben genannte Terminal-Aufruf mit `python3 start.py`. Es müssen keine globalen Sicherheitseinstellungen geändert werden.

### Was wird gestartet?

`start.py` ist ein kleiner Server aus der Python-Standardbibliothek. Er liest nur die fertig gebaute Anwendung in `dist/`, bindet ausschließlich an `127.0.0.1` und macht keine ausgehenden Netzwerkabfragen. JavaScript-Module und der Rechen-Worker benötigen einen HTTP-Ursprung: **`index.html` per Doppelklick (`file://`) ist kein unterstützter Startweg.**

Die Oberfläche, die 3D-Bibliothek und die Modellrechnung liegen vollständig im Paket. Python dient nur zum lokalen Ausliefern der Dateien. Die numerische Rechnung läuft im Browser.

**Zwei Labormodi:** `index.html` enthält das Wellen-/Gitterlabor; über **3D-Objekt** bzw. `http://127.0.0.1:5197/object.html` öffnet sich das neue Objektlabor. Beide gehören zum selben Paket. Für dessen HIGH-/FINAL-Rechnungen einige Sekunden bis mehrere zehn Sekunden einplanen, abhängig vom Rechner und Modell. LIVE startet automatisch. Nur das ursprüngliche Wellenlabor stellt den Snapshot nach Neuladen wieder her; das Objektlabor speichert ihn im Arbeitsspeicher der Sitzung.

### Häufige Startprobleme

| Meldung / Beobachtung | Lösung |
|---|---|
| Python nicht gefunden | Python 3 installieren; danach das Terminal neu öffnen. Unter Windows `py -3 --version`, unter macOS/Linux `python3 --version` prüfen. |
| Port 5197 ist belegt | Vorherigen Laborserver beenden oder `python3 start.py --port 5198` starten. Unter Windows entsprechend `py -3 start.py --port 5198`. Die ausgegebene Adresse öffnen. |
| `dist/index.html` fehlt | Release-ZIP vollständig entpacken. Bei einem Quellcode-Download stattdessen Variante B verwenden. |
| Browserfenster öffnet sich nicht | Die im Terminal ausgegebene lokale Adresse manuell öffnen. |
| 3D-Ansicht meldet fehlendes WebGL 2 | Einen Browser mit verfügbarer Hardwarebeschleunigung/WebGL 2 verwenden. Schnittansicht, Modell und Scans bleiben ohne 3D nutzbar. |
| Ein alter Aufzeichnungszustand erscheint | Das Labor stellt seinen letzten Snapshot aus der lokalen Browserablage wieder her. **Reset** setzt den Versuch zurück. |

## Variante B: aus dem Quellcode bauen

Voraussetzungen: **Node.js 22.12 oder neuer** mit npm. Git ist nur zum Klonen nötig; alternativ den Quellcode über „Code → Download ZIP“ laden und entpacken. Der erste `npm ci`-Lauf benötigt normalerweise Internet zum Laden der Entwicklungsabhängigkeiten.

```bash
git clone https://github.com/Xindaan/volumenhologramm-labor.git
cd volumenhologramm-labor
npm ci
npm run dev
```

Danach **http://127.0.0.1:5197/** öffnen. Für einen Produktionsbuild:

```bash
npm run build
npm run preview
```

Vor `preview` einen laufenden Entwicklungsserver mit Strg+C beenden, da beide standardmäßig denselben Port nutzen. Alternativ kann der fertige Build mit `python3 start.py` gestartet werden. Nur für diesen Python-Start ist Python zusätzlich zu Node nötig.

## Prüfen und ein neues Weitergabepaket erstellen

```bash
npm run check
npm test
npm run package
npm run test:package
```

`npm run package` prüft Syntax und Physiktests, baut die App und erstellt anschließend unter `artifacts/` ein versioniertes ZIP plus SHA-256-Prüfsumme. Dafür wird zusätzlich Python 3 unter dem Kommando `python3` benötigt. Ist auf Windows nur `py` verfügbar, stattdessen diese Befehle verwenden:

```bat
npm run check
npm test
npm run build
py -3 scripts/package_release.py
py -3 -m unittest discover -s tests -p "test_*.py" -v
```

`test:package` entpackt das ZIP in ein isoliertes Testverzeichnis und prüft den mitgelieferten Server sowie HTML, JavaScript, CSS und den Worker über HTTP. Die Tests verwenden automatisch freie Ports und öffnen keinen Browser.

Ein Quellcode-Checkout enthält weder `node_modules` noch `dist`. Das fertige Release-ZIP enthält `dist` und braucht deshalb keinen npm-Build.
