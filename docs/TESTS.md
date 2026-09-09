# Abnahme und erwartete Resultate

Stand: 9. September 2026. Modell zuerst implementiert und getestet, anschließend UI und Browserprüfung.

## Reproduzierbare Modelltests

`npm test` führt 17 Tests mit Node.js aus. Der Modellkern benötigt weder DOM noch WebGL oder externe Dienste.

Ausgangsgeometrie: λ₀ = 532 nm, n = 1,5, θ_r = −24°, θ_o = +24°, d = 40 µm, Δn = 0,006075077293323296, beide Amplituden 1, D = 1, T = 1 ns.

| Abnahme | Erwartung | Verifizierter Wert / Kriterium |
|---|---|---|
| A1 · parallele identische Wellen | räumlich konstante Intensität auch bei konstanter Phasendifferenz; keine separate Gitterordnung | Λ = ∞, η = 0; mehrere Raumpositionen geprüft |
| A2 · Winkel beeinflusst Λ | Λ = λ₀/[2n sin(α/2)] | Standard: 0,4359905515 µm; 4 weitere Winkel plus Intensitätsperiode |
| A3 · passende Geometrie | Δ = 0, k_d = k_o; bei ν = π/2 maximale Konversion | η = 1 innerhalb 10⁻¹⁰, auch mehrere geneigte Gitter |
| A4 · Winkelabweichung | gegenüber dem Standardpeak deutlich kleinere η | −23°: 0,06196948 = 6,196948 %; beide Richtungen geprüft |
| A5 · Wellenlängenabweichung | gegenüber dem Standardpeak deutlich kleinere η | 547 nm: 0,07919061 = 7,919061 %; beide Richtungen geprüft |
| A6 · größere Dicke | bei konstantem ν schmaleres Hauptmaximum | Winkel-FWHM 40 µm: 0,498783°; bei 80 µm etwa halb so breit; auch Spektral-FWHM getestet |
| A7 · Intuitiv/Physiker | ausschließlich Ansichtsmodus verändert sich | identische Parameter, derselbe Snapshot, identische η |

Spektral-FWHM im Standardfall: 10,400398 nm. Nicht mit einer pauschalen Winkel-/Wellenlängenformel ersetzt, sondern aus dem ausgewerteten Modellscan interpoliert. Die FWHM-Anzeige wird auf den passenden ersten Kopplungspeak begrenzt.

Zusätzliche Prüfungen:

- Direkte komplexe Feldaddition vs. ausmultiplizierte Intensität.
- Ungleiche Frequenzen: sinc-Mittelung der Belichtung; kein fiktives stationäres Zweifarbenmuster.
- Unabhängiger Snapshot, lineare Dosis-/Amplitudenabbildung, Nullmodulation.
- Kugelwelle: 1/R-Amplitude und numerischer Phasengradient.
- Unabhängige RK4-Lösung des 2×2-ODE bei passender und verstimmter Rekonstruktion; η und Flusserhaltung innerhalb 10⁻⁹.
- Rückkopplung bei ν = π, ungültige Zweiwellenbereiche und fehlende propagierende Ordnung.
- Bekannte FFT-Fouriermode, Parseval, 2D-Rücktransformation.
- Born: Nullfeld, η ∝ Δn², analytischer periodischer Planwellenkontrollfall, Tiefenkonvergenz.
- Born-Demo mit Δn = 0,00030: η ≈ 0,000713292 = 0,0713292 %. Vergleich zu 128², verdoppeltem Fenster und verdoppelter Tiefenauflösung jeweils relative Abweichung < 0,1 %.
- Starkes Winkel-Detuning erhöht das Born-Querraster auf 512²; keine künstlich effiziente aliased Ordnung.

## Browserprüfung

Ausgeführt im integrierten Chromium-Browser über http://127.0.0.1:5197/. Interaktionen erfolgten über sichtbare Buttons, Zahlenfelder, Regler und Auswahlfelder; kein direkter Eingriff in den Modellzustand.

| Verhalten | Prüfschritt / Beobachtung |
|---|---|
| Start und 3D | Volumen gerendert, echte räumliche Phasenflächen und separater Schnitt sichtbar; keine WebGL-/Konsolenfehler |
| A1 in der Oberfläche | Objektwinkel = Referenzwinkel → konstantes helles Volumen und konstantes Schnittbild; Λ = ∞, Effizienzscan = 0 |
| Aufzeichnen / Lesen | gespeicherte Indexstruktur, Objektwelle aus, η = 100,0 %, T = 0,0 % |
| Winkel-Detuning | Zahlenfeld −23° → η = 6,2 %, T = 93,8 % |
| Ansichtswechsel | Physikermodus ergänzt k-Diagramm, Detuning und η bleiben unverändert |
| Spektral-Detuning | 547 nm → η = 7,9 %; Umschalten auf λ aktualisiert den Scan |
| Dicke | 80 µm und ν = π/2 → Winkel-FWHM 0,25° statt 0,50° |
| Schnitt | xy-Schnitt gewählt, Schnittposition per Tastatur verschoben, Volumen am Schnitt geöffnet |
| Snapshot-Isolation | nach Aufzeichnung den Entwurfs-Objektwinkel geändert; alte Rekonstruktion bleibt η = 100 % |
| Persistenz | Neuladen stellt den gespeicherten Zustand wieder her |
| Responsive Ansicht | 390 × 844: kein horizontaler Seitenüberlauf; Parameter öffnen/schließen, Zahlenwerte ändern und Modelldialog bedienen |
| Nullmodulation | Δn = 0: konstantes Schnittbild und η = 0 |
| Kugelwelle | Born-Feld 256² × 337, η = 0,071 %, transmittierte Leistung ausdrücklich nicht berechnet; ebener Scan tatsächlich ausgeblendet |

Während der Prüfung korrigiert: direkte Zahlenfelder auf sofortige Eingabeübernahme umgestellt; SVG-Sichtbarkeit über das tatsächliche `hidden`-Attribut statt einer unwirksamen HTML-Eigenschaft; Nullmodulation in der Schnittansicht; Aktualisierung der räumlichen Phasenflächen bei geändertem n. Betroffene Verhaltensweisen erneut geprüft.

## Prüfgrenzen

Die Browserprüfung ist eine konkrete manuelle/agentengeführte Abnahme und kein behaupteter flächendeckender Playwright-CI-Lauf. Die Konvergenztests belegen die angegebenen Kontrollfälle; sie garantieren keine gleichbleibende Genauigkeit für jeden möglichen Parametersatz. Die Zweiwellen-Schranken sowie Born-Grenzen sind in [MODEL.md](MODEL.md) dokumentiert.

Bei der ursprünglichen lokalen Entwicklung erfolgte Pass A durch Quelltext-/Änderungsumfangsprüfung im isolierten Projektordner. Pass B umfasst Modelltests und die Browserinteraktionen. `npm run check` und `npm run build` prüfen zusätzlich Syntax und Produktionsbundle.

## Weitergabepaket prüfen

Nach `npm run package` führt `npm run test:package` vier zusätzliche Python-Tests aus:

| Prüffall | Erwartung |
|---|---|
| Paketinhalt und Integrität | Alle internen SHA-256-Prüfsummen sowie die ZIP-Prüfsumme stimmen; Worker und Lizenzhinweis enthalten; keine Entwicklungsabhängigkeiten oder lokalen Protokolle; Unix-Starter ausführbar, Windows-Starter mit CRLF |
| Entpackter Start und HTTP-Auslieferung | Start aus einem anderen Arbeitsverzeichnis und einem Pfad mit Leerzeichen gelingt; HTML und sämtliche Build-Assets stimmen bytegenau; JavaScript-MIME-Typ passt; Quelldateien und Verzeichnislisten werden nicht ausgeliefert |
| Unvollständiger Download | Fehlt `dist/index.html`, endet der Starter mit Fehlercode 1 und einem konkreten Hinweis auf Release-ZIP oder Build |
| Start ohne Namensauflösung | Der ausschließlich lokale Server startet auch dann, wenn eine Reverse-DNS-Abfrage fehlschlagen würde; die Adresse wird direkt verwendet |

Der GitHub-Workflow führt Syntax-, Modell-, Build- und Paketprüfungen unter Linux, macOS und Windows aus. Diese automatischen Tests prüfen den Python-Starter und die Paketdateien; sie ersetzen keine interaktive Browserprüfung oder einen Doppelklicktest der Betriebssystem-Starter.
