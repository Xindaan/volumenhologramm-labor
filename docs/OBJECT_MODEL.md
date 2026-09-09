# Vom 3D-Objekt zum Volumenhologramm

Der neue Modus liegt unter `object.html`. Er ergänzt das vorhandene Wellen-/Gitterlabor. Start: `npm run dev`, danach `http://127.0.0.1:5197/object.html`. Beide Seiten werden mit `npm run build` in `dist/` gebaut und vom Python-Starter ausgeliefert.

## Modell und Einheiten

Skalares kohärentes Lehrmodell, keine elektromagnetische Simulation der Streuung am realen Brandenburger Tor. Die stilisierte Geometrie wird als Mikrometer-Modell behandelt: Längen in µm, Vakuumwellenlängen in nm, interne Winkel in Grad, homogenes Medium mit Index n. Zeitkonvention exp(−iωt).

Die sichtbaren Oberflächen werden durch einen orthografischen z-Puffer aus Richtung +z ermittelt. Ein Element trägt die projizierte Fläche ΔA und den vorgegebenen kohärenten ebenen Antrieb exp(ikzⱼ):

```text
Aⱼ = g ΔAⱼ exp(ikzⱼ),  g = 3 µm⁻¹
O(r) = Σⱼ Aⱼ exp(ik|r−rⱼ|) / |r−rⱼ|
k = 2πn/λ₀
```

Das ist ein Modell unabhängiger skalarer Strahler. Die gespeicherten Normalen sind Geometrieinformation; eine zusätzliche BRDF oder eine unvollständig begründete Polarisationsgewichtung wird nicht angewendet. Mehrfachstreuung zwischen Elementen fehlt. Sichtbarkeit gilt für eine einzige orthografische Richtung. Materialien und Texturen eines importierten statischen OBJ/GLTF/GLB werden nicht als Streuparameter interpretiert; importierte Geometrie wird auf 30 µm größte Ausdehnung normiert. Animierte Skelett-Meshes werden abgewiesen.

## Objektfeld: bandbegrenzte Weyl-Entwicklung

Das auslaufende skalare Greenfeld wird spektral summiert:

```text
kₒz = sqrt(k² − |q|²)
Oq = 2πi/(L² kₒz) Σⱼ g ΔAⱼ exp[−i(q·rⱼ,⊥ + (kₒz−k)zⱼ)]
O(x,y,z) = Σq Oq exp[i(q·r⊥ + kₒz z)]
```

L = 128 µm ist das gepolsterte periodische FFT-Fenster. Es werden nur vorwärts propagierende Moden bis |q|/k = 0,28 verwendet; die äußeren 10 % dieses Bands besitzen einen Kosinusauslauf. Zusätzlich gilt |q| < 0,84 π min(N, 256)/L. Der Parameter 0,28 ist **sinθ**, nicht die übliche NA = n sinθ. Die numerische Punktwelle ist deshalb bandbegrenzt und periodisch, nicht die unbeschränkte exakte Kugelwelle. Evaneszente Komponenten fehlen. Polsterung und 48-µm-Bildfeld reduzieren zyklische Randeffekte, garantieren aber keine Freiheit davon bei beliebigen Geometrien.

| Stufe | Sichtbarkeits-/Quadraturraster | Hologramm-Feld | Standardtor |
|---|---|---|---|
| LIVE | 64² | 256² komplexe Samples, Δx = 0,5 µm | 1.422 Streuelemente |
| HIGH QUALITY | 112² | 512², Δx = 0,25 µm | 4.242 Streuelemente |
| FINAL | 176² | 512², Δx = 0,25 µm | 10.610 Streuelemente |

Alle Stufen haben dasselbe Winkelband und denselben deterministischen Phasenantrieb. Die Streuerzahl hängt von Geometrie, Drehung und gewählten Gruppen ab. Es werden keine neuen Zufallsphasen gezogen. Hauptaufwand: O(N_moden × N_streuer) für die direkte spektrale Streusumme; FFT-Propagation O(N² log N). Rechnungen laufen in einem abbrechbaren Web Worker.

Die Ansicht des komplexen Felds entfernt den gemeinsamen Träger exp(ikz). Das ändert Amplitude und relative Querphase nicht; die angezeigten Re-/Im-Werte beziehen sich ausdrücklich auf diese Enveloppe.

## Belichtung und Indexrepräsentation

```text
R(r) = Aᵣ exp[i(kᵣ·r + φᵣ)]
I(r) = |O + R|²
δn(r) = β [I − |O|² − |R|²] = 2β Re(OR*)
H₊(r) = β OR*,   δn = H₊ + H₊*
```

**Zusätzliche Idealisierung:** Referenzhintergrund und Objekt-Selbstterm werden ideal kompensiert. Ein reales Material führt diese Subtraktion nicht automatisch aus. Vor der Belichtung sind vollständige Intensität I und Index-Kreuzterm getrennt sichtbar. Der β-Regler beschreibt die lineare Abbildung, keine materialspezifische Chemie.

Gespeichert werden die komplexen Fourierkoeffizienten des positiven Index-Seitenbands und der analytische Referenzträger. Damit ist eine reelle räumliche Indexmodulation im ganzen Volumen definiert. Der Snapshot enthält kein Tor-Mesh, keine Objektpunkte und kein Objektbild. Änderungen der Quelle überschreiben ihn erst bei erneuter Belichtung. Der Snapshot liegt im Sitzungsspeicher und kann als JSON exportiert werden; nach Neuladen startet der neue Modus ohne diesen Sitzungssnapshot.

Der räumliche Scanner und die transparente 3D-Vorschau interpolieren eine **zusätzliche Visualisierungsrepräsentation** von 128 × 128 × N_z komplexen Enveloppenwerten über 64 × 64 × d µm. N_z = max(17, ceil(2d[k−sqrt(k²−q_max²)]/π)+1) hält die maximale Enveloppenphase pro z-Schritt unter π/2. Der analytische Referenzträger wird dabei wieder eingesetzt. Hoher Zoom vergrößert die Darstellung, nicht die physikalische Bandbreite. Diese interpolierte Vorschau beeinflusst weder Rekonstruktion noch Effizienz oder Fokusrechnung.

## Spektrale erste Born-Rekonstruktion

Die Geometrie ist ein Transmissionshologramm mit z ∈ [0,d]. Jede Objektkomponente trägt ihr eigenes Kq = (q,kₒz) − kᵣ. Für eine ebene Lesewelle kᵢ gilt:

```text
q_d = q + kᵢ,⊥ − kᵣ,⊥
k_dz = sqrt(k_read² − |q_d|²)
Δq = kᵢz + kₒz − kᵣz − k_dz
Dq(d) = i (k₀,read² n / k_dz) Hq Aᵢ d
        × sinc(Δq d/2) exp[i(k_dz d + Δq d/2)]
```

Der sinc-Faktor ist das analytisch integrierte longitudinale Phasenmatching der jeweiligen Komponente. Die anschließende Rekombination behält komplexe Phase und geänderten Querwellenvektor. Es gibt keine zusätzliche künstliche Unschärfe, Farbverschiebung oder Bildverzerrung.

Die Näherung ist **erste Born, ausgewählte positive Hologrammordnung, undepletierte Lesewelle**. Sie ist keine einzelne Kogelnik-Effizienzformel für das gesamte Tor. Rückkopplung, Konkurrenz zwischen Ordnungen, Mehrfachstreuung sowie Null-/konjugierte Ordnung werden nicht berechnet. Der schwache ebene Grenzfall wird gegen das bisherige Zweiwellenmodell getestet.

Die quantitative η-Anzeige wird auf η < 5 % und weniger als 0,5 % spektrales Gewicht außerhalb des zugelassenen Ausgangsrasters begrenzt. Diese Schwellen sind Plausibilitätswächter, keine garantierten Fehlergrenzen. Transmittierte Leistung wird nicht behauptet. Der Dickenscan vergleicht d mit d/4 bei gleichem βd; die Leistung beider Kurven ist auf das dünne Maximum normiert. Dargestellt wird dort die gesamte spektrale Leistung im FFT-Fenster **vor** der Austrittspupille.

## Bild, Fokus, Parallaxe und Teilabdeckung

```text
E_exit = IFFT{Dq} × P(x,y)
E_focus = IFFT{FFT[E_exit] exp[−ik_z(d+z_f)]}
Beobachtungsbild = |E_focus|²
```

Das ist ein **numerisch refokussiertes virtuelles Bild**. Ein physischer Schirm hinter dem Hologramm zeigt das virtuelle Tor ohne weitere abbildende Optik nicht direkt. Das Bild entsteht ausschließlich aus der rekonstruierten komplexen Welle.

Die reale Amplitudenmaske P auf der Austrittsfläche enthält die Hologrammapertur, die gewählte Teilabdeckung und optional eine seitlich verschobene Beobachterpupille. Ränder haben 1 µm Kosinusauslauf. „Zerbrechen“ ist in diesem Modell ein Abdecken der Austrittsfläche, kein mechanisch ausgeschnittenes Volumen mit neu berechneter innerer Randbeugung. Die Volumenlösung ist lateral periodisch/ausgedehnt; erst danach wird P angewendet.

Der Beobachter hat eine parallele Achse. Auf einer gemeinsamen Fokusebene gilt im paraxialen Schwerpunktlimit:

```text
Δx ≈ Δp [1 − (z_f+d)/(z_obj+d)]
```

Damit ergibt sich unterschiedliche relative Parallaxe für unterschiedliche Tiefen. Ein exakt fokussierter Punkt bleibt in dieser globalen Koordinatenkonvention ortsfest. Der Zweipunkt-Kontrollversuch macht den Unterschied sichtbar.

η wird nach der Pupille aus dem spektralen Vorwärtsfluss berechnet, gewichtet mit k_z/kᵢz und bezogen auf die nominale quadratische Hologrammapertur. Die Feldtreue ist |〈E,E_match〉|²/(||E||² ||E_match||²) im 48-µm-Bildfeld, bei gleicher Pupille und gleicher Fokusebene. Sie vergleicht keine Mesh-Bilder. Helligkeit bleibt bei Detuning auf die passende Aufnahme skaliert; der separate Bildbelichtungsregler ändert nur die Darstellung.

## Lokale k-Analyse und kohärenter Vergleich

Eine gaußgewichtete Fenster-FFT mit σ = 2 µm bestimmt bis zu drei echte lokale Maxima oberhalb von 3 % des stärksten Maximums. Sie sind spektrale Beiträge, keine eindeutige Zuordnung zu einzelnen Objektpunkten. Für eine ebene Welle wird nur ein Maximum ausgewiesen. Aus K folgen lokale Fringennormale, Λ = 2π/|K| und |K|/2π. Die angegebene Bragg-Bedingung 2kᵣ·K + |K|² = 0 bezieht sich auf die passende Aufnahmegeometrie. Der k-Raum-Scanner berechnet die FFT des aktuellen Schnitts nach Mittelwertabzug/Hann-Fensterung; es ist eine 2D-Schnittanalyse, kein vollständiges 3D-Spektrum.

„Zerlege das Tor“ verwendet dieselben sichtbaren Elemente und Phasen in allen Teilaufnahmen. Für die vollständigen Intensitäten gilt nach einmaligem Zählen der Referenz:

```text
|Oₛ+Oq+R|² − (|Oₛ+R|² + |Oq+R|² − |R|²) = 2 Re(Oₛ Oq*)
```

Nach der ausdrücklich verwendeten Selbsttermkompensation ist das gespeicherte positive Index-Seitenband dagegen linear im Objektfeld: H₊,gemeinsam = H₊,Säulen + H₊,Quadriga.

## Bewusst nicht modelliert

Vektorielle Maxwell-/RCWA-Rechnung, Polarisation, Reflexionshologramme, Dispersion, Absorption, Fresnel-Grenzflächen, Mehrfachstreuung, Erschöpfung der Lesewelle, exakte Rundumsichtbarkeit, BRDF/Texturen, Materialchemie, reale Fertigungsparameter und produktspezifische Verfahren.

Methodischer Bezug: Castro et al., [Spatial-spectral volume holographic systems: resolution dependence on effective thickness](https://doi.org/10.1364/AO.50.001038), Applied Optics 50, 1038–1046 (2011). Die hier implementierte selektierte Born-Lösung mit ideal kompensierter Aufzeichnung und Ausgangspupille ist oben vollständig angegeben; sie wird nicht als vollständige Implementierung dieses Artikels ausgegeben.
