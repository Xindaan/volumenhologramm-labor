# Abnahme des 3D-Objektlabors

Stand: 9. September 2026, Version 1.1.0. Numerik in µm, Vakuumwellenlängen in nm, interne Winkel. Ausführen mit `npm test`; nur die neuen Modell- und Scannerprüfungen mit `npm run test:object`.

Die ursprünglichen 17 Modelltests bleiben erhalten. 11 neue Objekttests decken alle zehn angeforderten Abnahmekriterien ab; vier zusätzliche Scanner-/Samplingtests prüfen die Visualisierungsgrenzen. Insgesamt 32 Modelltests.

## Analytische und numerische Abnahme

| Kriterium | Tatsächlich geprüfter Fall | Erwartung und Ergebnis |
|---|---|---|
| 1 · Einzelpunkt | Punkt bei z = −110; komplexe Felder an drei räumlichen Messorten gegen die direkte Kugelwellensumme | Relative Fehler unter 2 % (etwa 1,54 %, 0,86 %, 0,36 %). Endliches Winkelband/periodisches Fenster erklären die Abweichung. Rekonstruktion hat ihr Fokusmaximum bei 110 µm. Bestanden. |
| 2 · Zwei Punkte | Einzelbeiträge und gemeinsame Aufnahme bei x = ±5, unterschiedlichen Tiefen | Komplexe Summe bis 10⁻¹² konsistent; Intensität enthält einen nicht verschwindenden Kreuzterm. Bestanden. |
| 3 · Ebene Welle | Einzelne Fouriermode, schwache Indexkopplung, 0°, 0,5°, 1° Detuning | Spektrale Born-Leistung stimmt auf weniger als 2 × 10⁻⁸ absolut mit dem schwachen Grenzfall des vorhandenen Zweiwellenmodells überein. Bestanden. |
| 4 · Tiefe | Punkte bei derselben Querposition, z = −100 und −145 | Getrennte korrekte Fokusmaxima; auch bei gemeinsamer Aufzeichnung Intensitätsmaxima an beiden Tiefen mehr als doppelt so hoch wie dazwischen. Bestanden. |
| 5 · Parallaxe | Tiefen 100/155, gemeinsame Fokusebene 125, d = 40, Pupille von −10 nach +10 verschoben | Gegenläufige Schwerpunktverschiebungen, jeweils > 2 µm. Abweichung vom paraxialen Ausdruck Δp[1−(z_f+d)/(z_obj+d)] < 0,65 µm. Bestanden. |
| 6 · Teilapertur | Zwei laterale Punkte x = ±7, volle und linke Hälfte einer 64-µm-Pupille | Beide Objektpunkte bleiben vorhanden; Leistung der halben Pupille zwischen 30 % und 70 % der vollen. Bestanden. |
| 7 · Wellenlänge | 557 statt 532 nm | Geänderte komplexe Wellenfront, Feldüberlappung < 0,85, geringere Effizienz. Bestanden. |
| 8 · Winkel und Volumen | 14° statt 12°, sowie d = 10/80 µm | Geänderte Wellenfront und geringere Effizienz. Normalisierter Verstimmungsfaktor bei d = 80 kleiner als 60 % des Werts bei d = 10. Bestanden. |
| 9 · Ohne Mesh rekonstruieren | Nach Belichtung Streuerliste löschen und ursprüngliche Objektkoeffizienten überschreiben | Dasselbe Bild bitweise reproduziert. Snapshot enthält keine Punkte/Geometrie. Importprüfung: `reconstruction.mjs` importiert ausschließlich `waves.mjs`, keine Geometrie und keinen Renderer. Bestanden. |
| 10 · Konvergenz | 256² → 512² bei gleichem Winkelband; Tor-Quadratur 64² → 112² → 176² | Feldabweichung des reinen Rasterwechsels < 10⁻¹⁰. Quadratur konvergiert: 1−Feldtreue gegenüber FINAL fällt von 0,034556 auf 0,009980. Bestanden. |

Zusätzlich bestanden: jede Objektgruppe liefert Streuer; β = 0 ergibt kein Rekonstruktionsfeld; Scanner vor/nach Aufzeichnung stimmt bei Referenzphase 73° und geneigtem Schnitt auf 10⁻¹⁰ überein; Modulationsfaktor 0 ergibt δn = 0; eine ebene Welle erzeugt genau ein lokales Spektralmaximum. Bei λ = 480 nm, n = 1,7 bleibt das Winkelband zwischen LIVE und HIGH gleich. Die Tiefenabtastung der Vorschau verfeinert sich mit d und begrenzt den maximalen Enveloppenphasenschritt auf π/2.

## Was LIVE gegenüber FINAL verliert

Beim Standardtor werden 1.422 / 4.242 / 10.610 sichtbare Streuelemente in LIVE / HIGH / FINAL benutzt. Feine Pferdebeine, Stäbe, Kanten und schmale Tiefenstrukturen sind am empfindlichsten gegenüber der groben Oberflächenquadratur. Die sechs Säulen sind deutlich stabiler. Die Übereinstimmungszahlen oben beziehen sich auf komplexe Spektren, nicht auf einen subjektiven Bildschärfewert. FINAL ist eine feinere numerische Referenz, kein Beweis einer exakten Lösung.

Gruppenschalter rasterisieren die jeweils sichtbare Geometrie erneut; dadurch kann die Streuerzahl beim Weglassen einer Gruppe auch steigen, weil sich die Begrenzungsbox der festen Quadratur verkleinert. Der Vergleich „Zerlege das Tor“ verwendet dagegen dieselben zuvor sichtbaren Elemente in allen Teilaufnahmen, damit kohärente Summen exakt vergleichbar bleiben.

## Browserprüfung des Produktionsbuilds

Mit dem lokalen Python-Starter über HTTP und dem In-App-Browser geprüft. Numerische Ergebnisse wurden aus sichtbaren Status-/Messfeldern gelesen; Bilddarstellungen zusätzlich visuell kontrolliert.

- Aufnahme des Standardtors: 1.422 Streuer / 65.536 komplexe Feldsamples; Quelle danach aus, Aufzeichnungsparameter gesperrt, Feldtreue zum passenden Fall 100 %.
- Passender Fall η = 0,1090 %; +2° horizontal η = 0,0104 %, Feldtreue 0,3 %. Bei 557 nm η = 0,0932 %, Feldtreue 8,9 %. Keine automatische Bildaufhellung bei Verstimmung.
- Fokus zwischen Säulen (130 µm) und Quadriga (142 µm) gewechselt. Die Bildansicht wird aus der Wellenfront neu berechnet.
- Linke Hälfte: η = 0,0522 %, weiterhin das ganze Tor sichtbar; rechte/kleine/bewegliche Pupillen werden im selben Wellenmodell angewendet.
- Lokaler Scanner-Klick liefert mehrere Beiträge (Beispiel Λ ≈ 1,69 / 1,25 / 2,63 µm); Fourieransicht, Zoom, geneigter Schnitt, Schnittöffnung und Wechsel zum Spektralscan bei d = 80 bedient.
- „Zerlege das Tor“: vier tatsächliche Interferenzmuster und Rekonstruktionen sowie die kohärente Differenz nebeneinander berechnet und visuell kontrolliert. Säulen und Quadriga erscheinen getrennt und gemeinsam aus ihren jeweiligen Feldern.
- Erneute Aufnahme nach Reset/Neuladen auch in mobiler Ansicht erfolgreich: η = 0,1090 %, Objektwelle aus.
- Layout bei 1280 × 720 und 390 × 844 kontrolliert: kein horizontaler Überlauf, auch bei geöffneter mobiler Parameterleiste.
- Zweipunkt-Parallaxevorlage belichtet, Beobachterpupille von −22 nach +22 µm bewegt, beide optischen Beiträge sichtbar. Die 3D-Bildebene zeigt nach expliziter RGBA-Texturübertragung dasselbe numerische Raster wie die Schnittansicht.
- Synthetische lokale OBJ- und GLTF-Testmodelle über den Dateidialog geladen: jeweils 2.048 Streuer / 256² Samples. Loader und eingebettete GLTF-Daten bleiben lokal.
- LIVE, HIGH QUALITY und FINAL im Browser berechnet: 1.422 / 4.242 / 10.610 Streuelemente, 256² / 512² / 512² Feldsamples. Auch der FINAL-Snapshot wurde rekonstruiert.
- Rascher Gruppenwechsel zusammen mit Feldebenenänderung reproduziert und korrigiert: Der neue Entwurf wird vollständig berechnet und der Belichtungsbutton wieder freigegeben. Zahlenfelder aktualisieren jetzt wie Schieberegler über das Eingabeereignis.

- Bestehendes Wellen-/Gitterlabor erneut aufgezeichnet und gelesen: passender ebener Fall weiterhin η = 100 %, keine Konsolenfehler.
- Browserkonsole des Objektlabors im abschließenden Durchlauf ohne Fehler oder Warnungen. Syntaxprüfung, Produktionsbuild, alle 32 Modelltests und die vier Prüfungen des entpackten Weitergabepakets bestanden.

Belegbilder: [3D-Vergleichsszene](../screenshots/04-tor-szene.jpg), [numerische Rekonstruktion und Scanner](../screenshots/02-tor-rekonstruktion.jpg). Die Originalgeometrie ist im Szenenbild ausschließlich im ausdrücklich beschrifteten Vergleich eingeblendet.

Die vollständigen Gleichungen und Näherungen stehen in [OBJECT_MODEL.md](OBJECT_MODEL.md). Die Paketprüfung `npm run test:package` kontrolliert beide HTML-Einstiegspunkte, beide Rechen-Worker, alle ausgelieferten Assets und die Prüfsummen im tatsächlich entpackten ZIP.
