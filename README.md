# Volumenhologramm-Labor – Licht schreibt Licht in Materie

Interaktive Browser-Anwendung für Aufzeichnung, Volumengitter und Bragg-selektive Rekonstruktion. **Neu in 1.1: vom räumlichen Brandenburger Tor über das kohärente Objektfeld zum fokussierbaren Hologrammbild.** Modell und numerische Rekonstruktion laufen vollständig im Browser; die Born-Rechnung in einem Web Worker. Keine externe Rechen-API, keine nachgeladenen Schriftarten oder Medien.

**[Direkt online ausprobieren](https://xindaan.github.io/volumenhologramm-labor/) · [Zum 3D-Objektlabor](https://xindaan.github.io/volumenhologramm-labor/object.html)**

Die Onlineversion benötigt keine Installation. GitHub Pages liefert die statischen App-Dateien; geladene Objektmodelle und die Berechnung bleiben im Browser. Für die Nutzung ohne Internet gibt es weiterhin das lokale Downloadpaket.

![Interferenzstruktur im transparenten Volumen](screenshots/01-aufzeichnung.png)

## Herunterladen und starten

**Zum Ausprobieren:** Unter [Releases](https://github.com/Xindaan/volumenhologramm-labor/releases/latest) das fertige **`volumenhologramm-labor-v1.1.0.zip`** laden und vollständig entpacken. Benötigt werden nur **Python 3.9 oder neuer** und ein Browser mit WebGL 2.

- **Windows:** `Start-Windows.cmd` öffnen.
- **macOS:** `Start-macOS.command` öffnen; alternativ im Paketordner `python3 start.py` ausführen.
- **Linux:** im Paketordner `sh Start-Linux.sh` ausführen.

Der Starter öffnet den Browser auf **http://127.0.0.1:5197/**. Terminal offen lassen; Strg+C beendet den Server. Alle Dateien einschließlich `dist/` zusammenlassen. Die HTML-Datei allein reicht nicht aus. Nach dem Download und der Python-Installation funktioniert das Paket ohne Internetverbindung.

**[Vollständige Installationsanleitung und Hilfe bei Startproblemen](INSTALLATION.md)**

## Aus dem Quellcode entwickeln

Node.js 22.12 oder neuer mit npm; zum Klonen außerdem Git:

```bash
git clone https://github.com/Xindaan/volumenhologramm-labor.git
cd volumenhologramm-labor
npm ci
npm run dev
```

Öffnen: **http://127.0.0.1:5197/**. `npm ci` lädt die festgeschriebenen Abhängigkeiten. Der Server bindet ausschließlich an die lokale Loopback-Adresse. Port 5197 muss frei sein. Im Git-Repository sind `dist/` und `node_modules/` nicht enthalten; das Release-ZIP enthält bereits den fertigen Build.

```bash
npm test         # analytische und numerische Modelltests
npm run check   # Syntaxprüfung der Oberflächenmodule
npm run build   # vollständig lokales Produktionsbundle in dist/
npm run preview # Produktionsbundle auf Port 5197; vorher dev beenden
npm run package # Tests, Build und fertiges ZIP in artifacts/; benötigt python3
npm run test:package # entpacktes Paket, Startserver, Assets und Prüfsummen prüfen
```

Die fertige `dist/`-Anwendung kann auch von einem anderen lokalen HTTP-Server ausgeliefert werden. ES-Module und Worker benötigen HTTP; `file://` ist kein unterstützter Startweg.

GitHub Pages veröffentlicht den geprüften `dist/`-Build nach erfolgreichen Prüfungen auf Linux, macOS und Windows. Der Workflow läuft bei Änderungen an `main`; Pull Requests veröffentlichen keine Website. Relative Asset-Pfade erlauben denselben Build lokal und unter `/volumenhologramm-labor/`.

## Ein Versuch in zwei Minuten

### Neues 3D-Objektlabor

Oben **3D-Objekt** wählen oder **http://127.0.0.1:5197/object.html** öffnen. Der Prozessregler führt durch Objekt → Objektwelle → Referenz → Interferenz → Belichtung → Rekonstruktion.

1. Säulen, Gebälk und Quadriga einzeln schalten. Das komplexe Objektfeld sowie sein Amplituden-/Phasenbild werden aus den sichtbaren Oberflächen neu berechnet. LIVE verwendet beim Standardtor **1.422 Streuelemente und 256² komplexe Feldsamples**.
2. Im **Hologramm-Scanner** hineinzoomen, schneiden und drehen. Ein Klick zeigt lokale k-Komponenten; **k-Raum** berechnet das Spektrum des aktuellen Schnitts.
3. **Hologramm belichten**. Die Objektwelle wird abgeschaltet. Das optische Bild entsteht aus einem unabhängigen Index-Snapshot; der Rekonstruktionskern hat keinen Zugriff auf Mesh oder Streuerliste.
4. **Säulen fokussieren** und **Quadriga fokussieren** vergleichen. Die Bildebene wird numerisch durch die rekonstruierte Welle bewegt. **Originalgeometrie zum Vergleich** blendet das Mesh ausdrücklich separat ein.
5. Winkel um +2° ändern: beim Standardversuch sinkt η von etwa 0,1090 % auf 0,0104 %. **Aufzeichnungsgeometrie treffen** setzt die Lesewelle zurück. Wellenlänge, Dicke, Apertur und seitliche Beobachterpupille wirken ebenfalls auf die Wellenrechnung.
6. **Linke Hälfte** abdecken: große Teile des ganzen Tors bleiben sichtbar. **Zwei Tiefen: Parallaxe ausprobieren** bietet einen einfachen Kontrollversuch. **Zerlege das Tor** vergleicht kohärente gemeinsame Aufnahmen mit addierten Einzelintensitäten.

HIGH QUALITY und FINAL verfeinern Feldraster bzw. Oberflächenquadratur; die aktuelle Zahl steht in der Szene. Ein lokales statisches OBJ, GLTF oder GLB lässt sich in der linken Leiste laden. Zugehörige Dateien gemeinsam auswählen; Materialien und Texturen sind keine Streuparameter. Reset stellt das Tor wieder her. Der Index-Snapshot dieses Modus bleibt bis zum Neuladen im Arbeitsspeicher und kann als JSON exportiert werden.

Das Modell ist eine **bandbegrenzte skalare Weyl-Streusumme mit spektraler erster Born-Rekonstruktion der positiven Ordnung**. Es verwendet ausdrücklich eine ideal kompensierte Indexaufzeichnung und eine Maske auf der Austrittsfläche. Die Bildansicht ist ein numerisch refokussiertes virtuelles Bild. Details und Grenzen: [Objektmodell](docs/OBJECT_MODEL.md), [Abnahmetests](docs/OBJECT_TESTS.md).

![Numerische Rekonstruktion des Brandenburger Tors](screenshots/02-tor-rekonstruktion.jpg)

### Bisheriges Wellen- und Gitterlabor

1. Im Ausgangszustand schneiden sich ebene Aufzeichnungswellen bei internen Winkeln −24° und +24°, λ₀ = 532 nm, n = 1,5. Das 40 µm dicke Volumen enthält Fringen mit Λ ≈ 0,436 µm.
2. Volumen durch Ziehen drehen, am Mausrad zoomen. Alternativ das fokussierte 3D-Canvas mit Pfeiltasten drehen. xz-, xy- oder yz-Schnitt wählen, verschieben und das Volumen am Schnitt öffnen.
3. **Struktur aufzeichnen**, dann **Hologramm lesen**. Die Objektwelle ist aus. Das gespeicherte Gitter rekonstruiert bei passender Beleuchtung die ebene Objektwelle.
4. Den internen Rekonstruktionswinkel auf −23° setzen: η fällt von 100 % auf etwa 6,2 %. Zahlenfelder akzeptieren Punkt oder Komma; Werte wirken sofort. **Aufzeichnungsgeometrie treffen** stellt den passenden Winkel und die passende Wellenlänge wieder her.
5. Auf 547 nm verstimmen: η ≈ 7,9 %. Mit **λ** den Spektralscan öffnen. Auch ein Klick in den Scan verstellt die Beleuchtung.
6. d auf 80 µm setzen und **ν = π/2 einstellen**: Die Spitzenkonversion bleibt bei 100 %, die Winkel-FWHM sinkt von etwa 0,499° auf 0,249°. Die gestrichelte Vergleichskurve hält ν konstant, indem sie d/4 und 4Δn verwendet.
7. **Physiker** ergänzt Vektoren, Phasenfehler, Kopplungsparameter und Gültigkeitsschranken. Es bleibt derselbe physikalische Zustand.

Für die Kugelwelle: zur Aufzeichnung zurückkehren, **Kugelwelle** wählen und den virtuellen Punkt einstellen. Die Demo stellt dabei einen kleinen Modulationsfaktor von 0,00030 ein. Nach erneutem Aufzeichnen/Lesen ersetzt ein **numerisch berechnetes komplexes Austrittsfeld** den ebenen Effizienzscan. Phase ist zyklische Farbe, Helligkeit der relative Feldbetrag. Winkel und Wellenlänge wirken auf das Volumenintegral. Die Born-Näherung berechnet keine transmittierte Restleistung.

Auf schmalen Bildschirmen öffnet **Parameter öffnen** die Einstellungen. Die Modelldokumentation ist über **Modell & Grenzen** bzw. am Seitenende über **Näherungen lesen** erreichbar.

## Aufzeichnung und Daten

Im Wellen-/Gitterlabor wird eine unabhängige Kopie der analytischen Feldparameter einschließlich Belichtungszeit, Dosis und Index aufgezeichnet. Das speichert die gesamte räumliche Funktion statt eines groben Voxelbildes. Änderungen an den Aufzeichnungswellen überschreiben diesen Snapshot erst bei erneuter Aufzeichnung. d und Δn bleiben bewusst als Parameterexperimente veränderbar. Das neue Objektlabor speichert stattdessen komplexe Index-Seitenbandkoeffizienten; seine gesonderte Näherung ist oben verlinkt.

Im Wellen-/Gitterlabor wird der Snapshot zusätzlich unter einem anwendungsspezifischen Schlüssel in der lokalen Browserablage gespeichert und beim Neuladen wiederhergestellt. Im Speicherschritt kann er als JSON exportiert werden. Reset setzt den Versuch zurück und entfernt ausschließlich diesen Anwendungssnapshot. Es gibt keine Übertragung an einen Server.

## Physikalische Dokumentation und Abnahme

- [Modellgleichungen und Näherungen](docs/MODEL.md)
- [Testfälle, erwartete Resultate und Browserprüfung](docs/TESTS.md)
- [3D-Objektfeld, Indexaufzeichnung und spektrale Born-Rekonstruktion](docs/OBJECT_MODEL.md)
- [Zehn Abnahmekriterien des Objektlabors und Konvergenz](docs/OBJECT_TESTS.md)
- Vollständige ausführbare Tests: [Modelltests im Quellcode](https://github.com/Xindaan/volumenhologramm-labor/blob/main/tests/model.test.mjs)
- Direkt in der Anwendung: **Modell & Grenzen**

Bewusst nicht enthalten: Materialchemie, reale Fertigung, Absorption, Dispersion, Fresnel-Grenzflächen, Reflexionshologramme, vollständige Maxwell-/RCWA-Rechnung und produktspezifische Verfahren.

## Aufbau des Quellcodes

| Datei | Aufgabe |
|---|---|
| `src/model.mjs` | Einheiten, komplexe Felder, Belichtungsmittelung, Snapshot, Zweiwellenmodell, Scans |
| `src/fft.mjs` | Vorwärts-/inverse komplexe FFT und 2D-Transformation |
| `src/born.mjs` | Selektierte Vorwärts-Born-Rekonstruktion mit endlicher Rechenapertur |
| `src/born-worker.js` | Numerik außerhalb des UI-Threads; alte Rechnungen werden abgebrochen |
| `src/volume.js` | WebGL-Raymarching, exakte ebene Phasenflächen, Schnitte, schematische Wellen |
| `src/charts.js` | Analytische Schnittansicht, Scans, Austrittsfeld und k-Diagramm |
| `src/main.js` | Gemeinsamer Modellzustand, Bedienelemente und lokale Speicherung |
| `src/documentation.js` | Vollständige eingebettete Modelldokumentation |
| `src/object/geometry.mjs` | Tor-Mesh, Gruppen, orthografische Sichtbarkeit und Flächenquadratur |
| `src/object/waves.mjs` | Kohärente Weyl-Streusumme, komplexe Spektren und Angular-Spectrum-Propagation |
| `src/object/reconstruction.mjs` | Unabhängige Indexaufzeichnung, Born-Volumenintegral, Pupille, Refokussierung; ohne Geometriezugriff |
| `src/object/inspection.mjs` | Räumlicher Scanner, lokale Fenster-FFT und Volumenselektivität |
| `src/object/labor-worker.js` | Abbrechbare numerische Arbeitsaufträge |
| `object.html`, `src/object/main.js`, `src/object/scene.js` | Objektlabor, Prozessablauf und 3D-Vorschau |
| `start.py`, `Start-*` | Lokaler HTTP-Server und Starter für das fertige Paket |
| `scripts/package_release.py` | Versioniertes ZIP mit Dateimanifest und SHA-256-Prüfsummen |
| `tests/test_distribution.py` | Prüfung des tatsächlich entpackten Weitergabepakets |

Abhängigkeiten: Three.js 0.180.0, Vite 7.3.6. Die Modelltests selbst nutzen ausschließlich Node.js-Bordmittel; Starter und Pakettests ausschließlich die Python-Standardbibliothek. Der Lizenzhinweis für das mitgelieferte Three.js liegt unter [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt).

Das Release-ZIP enthält den Browser-Build, Starter, Anleitungen, Modelldokumentation, ein Vorschaubild und `SHA256SUMS.txt`. Zusätzlich wird eine Prüfsumme des gesamten ZIPs veröffentlicht. Für Änderungen am Modell oder an der Oberfläche den Quellcode aus diesem Repository verwenden.
