# Modellgleichungen, Gültigkeit und Darstellung

Diese Demo ist ein idealisiertes Physikexperiment mit ausdrücklich verschiedenen Rekonstruktionsmodellen für ebene und gekrümmte Gitter. Sämtliche Zahlen sind frei gewählte Lehrbeispiele, keine Herstellparameter eines Produkts.

## Konventionen

- Raum: µm; Zeit: fs. Die Eingabe der Vakuumwellenlänge erfolgt in nm und wird vor jeder Rechnung umgerechnet.
- n: reell, homogen und dispersionsfrei. Indexangepasste Umgebung; keine Grenzflächenbrechung oder Fresnel-Koeffizienten.
- Scheibe: 0 ≤ z ≤ d. Alle Winkel sind **intern**, gegen +z. Ebene Wellen liegen in der xz-Ebene und laufen vorwärts.
- Ebene Wellen: feste gemeinsame s-Polarisation entlang y. Kugelwelle: rein skalares Feld.
- Intensität in |E₀|²; der gemeinsame elektromagnetische Vorfaktor ist unterdrückt.

## Aufzeichnung

Mit k = 2πn/λ₀ und ω = 2πc/λ₀ gilt für jede ebene Welle

```text
k_j = k_j (sin θ_j, 0, cos θ_j)
E_j(r,t) = A_j exp[i(k_j · r + φ_j − ω_j t)]
I(r,t) = |E_r + E_o|²
       = A_r² + A_o² + 2 A_r A_o cos(Φ_o − Φ_r).
```

Bei gleicher Frequenz ist die Differenzphase zeitunabhängig. K = k_o − k_r, Λ = 2π/|K|. Für den Winkel α zwischen den Wellen gilt Λ = λ₀/[2n sin(α/2)]. Sind beide Vektoren gleich, ist die Intensität räumlich konstant, unabhängig von der konstanten Phasenverschiebung.

Die sphärische Objektwelle ist

```text
R = |r − r₀|, R₀ = |r₀|
E_o(r,t) = A_o (R₀/R) exp[i(k_o R + φ_o − ω_o t)].
```

r₀ ist ein mathematischer divergenter Objektpunkt außerhalb der Scheibe, z₀ < 0. A_o bezeichnet die Feldamplitude am Ursprung der Eintrittsebene. Die Richtung ∇Φ_o/k_o = (r−r₀)/R ist ortsabhängig. Ein globaler K-Vektor existiert nicht; im Expertenbild wird K(0) als lokale Tangente angezeigt.

## Belichtung und Indexmodulation

Das Zeitfenster [−T/2,T/2] ist um t = 0 zentriert. Mit Δω = ω_o−ω_r und sinc x = sin x/x:

```text
<I> = I_dc + 2 A_r A_o(r) sinc(Δω T/2) cos(Φ_o(r,0)−Φ_r(r,0))
δn(r) = Δn_Regler D [<I> − I_dc(r)] / 2
n(r) = n + δn(r).
```

Das Modell ist linear in der dimensionslosen Dosis D. T steuert die zeitliche Mittelung; D und T werden unabhängig variiert. Es gibt keine absolute photosensitive Empfindlichkeit. Die örtliche DC-Komponente wird explizit entfernt, auch die Kugelwellenhülle. Δn_Regler entspricht der Cosinus-Spitzenamplitude bei zwei Einheitsamplituden, gleicher Frequenz und D = 1. Bei K = 0 verbleibt höchstens ein konstanter Indexoffset, keine separate Beugungsordnung.

Bei ungleichen Wellenlängen zeigt das Livevolumen **I(r,t=0)**, das gespeicherte Volumen die zeitlich gemittelte Struktur. Die Oberfläche weist diese Unterscheidung aus. Das Zeitfenster in der UI reicht von 100 fs bis 10 ns; es ist deutlich länger als ein optischer Zyklus.

Der Snapshot enthält die analytischen Feldparameter, keine Voxelprobe. Änderungen an der Dicke schneiden/extrudieren dieselbe analytische Struktur; Änderungen an Δn skalieren ihre Amplitude. Dies simuliert weder Schrumpfung noch eine neue Materialbelichtung.

## Ebenes Transmissionsgitter: fluxnormierte SVEA

Für die Rekonstruktionswelle mit Betrag k werden die transversalen Komponenten der ausgewählten Objektordnung durch K festgelegt. Ihre longitudinale Komponente liegt auf der elastischen Dispersionsfläche:

```text
k_d,parallel = k_i,parallel + K_parallel
k_d,z = +sqrt(k² − |k_d,parallel|²)
Δ = k_i,z + K_z − k_d,z
c_i = k_i,z/k, c_d = k_d,z/k

Δn_eff = |Δn_Regler D A_r A_o sinc(Δω T/2)|
κ = π Δn_eff / (λ₀ sqrt(c_i c_d))
ν = κd, ξ = Δd/2

η = ν² sinc²(sqrt(ν² + ξ²))
T₀ = 1 − η.
```

Die beiden Hüllen sind auf z-Fluss normiert. Nach einer Phasentransformation wird die langsame Kopplung durch das hermitesche System

```text
d/dz [a] = i [ Δ/2   κ  ] [a]
     [b]     [  κ  −Δ/2 ] [b],   a(0)=1, b(0)=0
```

beschrieben. Die Norm |a|²+|b|² ist erhalten. Das exakt gelöste System liefert die obige Effizienz. Die Test-Suite integriert dasselbe ODE unabhängig per RK4. Durch die Flussnormierung ist kein weiterer Richtungskosinusfaktor in η erforderlich.

Näherungen: sinusförmiges reelles Phasengitter, zwei Vorwärtsordnungen, konstante Kopplung, n² ≈ n₀²+2n₀δn, vernachlässigte zweite Hüllenableitungen, lateral unendliches ebenes Gitter, nahe Bragg. Das ist eine **explizit definierte Kogelnik-artige Zweiwellen-SVEA mit elastischer Ausgangsrichtung**, kein Anspruch auf die vollständige Grenzflächenlösung oder eine wortgleiche Implementierung jeder historischen Formel.

Bei Δ = 0 gilt η = sin²ν. Die Voreinstellung erfüllt ν = π/2. Eine beliebig starke Modulation garantiert keine maximale Effizienz: Rückkopplung bei ν = π und Nebenmaxima bei Detuning sind Teil des Modells. Es wird keine künstliche monotone Gaußkurve eingesetzt.

### Modellschranken

```text
Q = 2π λ₀ d / (nΛ²)
ρ = λ₀² / (n Δn_eff Λ²)
```

Quantitative Anzeige nur für Q ≥ 10, ρ ≥ 10, |Δ|/k ≤ 0,1, c_i,c_d ≥ 0,25 und eine propagierende Ordnung. Diese Schranken sind Diagnosehilfen, keine rigorose Fehlergarantie. Ungültige Scanabschnitte werden ausgelassen. Ohne räumliche bzw. wirksame Modulation ist η = 0 ein separat behandelter Grenzfall.

Der Dickenvergleich hält ν mit d/4 und 4Δn fest. Somit wird die Akzeptanzbreite verglichen, ohne zugleich die nominelle Bragg-Konversion zu ändern. Die echte dünne Grenzfläche mit vielen Beugungsordnungen benötigt Raman–Nath/RCWA; diese Demo extrapoliert das Zweiwellenmodell nicht als vollwertige Dünngittertheorie.

## Kugelwelle: ausgewählter Vorwärts-Born-Kanal

Aus der reellen gespeicherten Modulation wird die objekttragende komplexe Komponente ausgewählt:

```text
δn_+ = (Δn_Regler D / 2) sinc(Δω T/2) A_r A_o(r)
        exp[i(Φ_o(r,0)−Φ_r(r,0))].
```

Die konjugierte Gegenordnung wird in diesem Kanal nicht mitgerechnet. Für die ungeschwächte einfallende Einheitswelle E_i berechnet die Demo den vorwärts auslaufenden skalaren Helmholtz-Green-Operator:

```text
E_d_tilde(q_parallel,d) = i k₀² n / q_z
  × integral_0^d exp[i q_z(d−z)] FFT_xy{W(x,y) δn_+(r) E_i(r)} dz

q_z = +sqrt((nk₀)² − |q_parallel|²).
```

Eine inverse 2D-FFT liefert das komplexe Austrittsfeld. Die gemittelte Leistung wird im Fourier-Raum mit q_z/k_i,z gewichtet und auf den z-Fluss einer Einheitswelle durch 6 × 4,5 µm bezogen. FFT-Konvention: Vorwärts unnormiert, invers 1/N pro Achse. Parseval und Normierung sind unabhängig getestet.

Die Born-Näherung enthält **keine Depletion**. Deshalb wird keine transmittierte Restleistung ausgegeben und insbesondere nicht eine scheinexakte Bilanz T = 1−η behauptet. Der graue Strahl ist die ungeschwächte Modellbeleuchtung. Die Oberfläche ersetzt im Kugelmodus den ebenen Effizienzscan durch das tatsächlich berechnete Austrittsfeld; Detuning geht in das Volumenintegral ein.

### Numerische Apertur und Abtastung

- Periodisches FFT-Fenster: 24 × 24 µm. Wechselwirkungsbereich: 6 × 4,5 µm.
- W ist ein separierbares Fenster mit flachem Zentrum und Kosinusanstieg innerhalb je 0,75 µm vom Aperturrand. Es glättet die **numerische Wechselwirkungsapertur**, nicht eine materialspezifische Rezeptur. Der Nenner der Effizienz bleibt die volle rechteckige Referenzfläche.
- Standard: 256²; adaptiv 512² bei großer transversaler Quellphasensteigung. Abschätzung aus ∇(Φ_o−Φ_r+Φ_i), ergänzt um Bandreserve des Randfensters. Über 512² wird mit einer Modellgrenzenmeldung abgebrochen.
- Mindestens 64 Tiefenscheiben, Δz ≤ 0,3 µm und ein konservativ abgeschätzter maximaler Phasenschritt ≤ π/2. Im Standardfall 337 Scheiben.
- Zugelassen: q_z/k ≥ 0,25. Evaneszente und zu flache Vorwärtsanteile werden verworfen. Der verworfene Quellspektrumsanteil wird im Expertenmodus ausgewiesen.
- η ≤ 10 % und verworfener Quellspektrumsanteil < 1 % sind Anzeigeschranken, keine allgemeine Born-Fehlerschätzung. Außerhalb werden nur das diagnostische Feld und eine Warnung gezeigt.
- Die Demo-Geometrie wird mit anderem Querraster, doppelter Tiefenauflösung und doppeltem Fenster verglichen. Andere Parameter können größere Diskretisierungsfehler besitzen; für Präzisionsarbeit ist eine eigene Konvergenzprüfung notwendig.

## Bedeutung der Visualisierung

Die 3D-Ansicht ist ein 6 × 4,5 × d µm großer Ausschnitt. z ist geometrisch komprimiert. 256 analytische Feldabfragen pro Sehstrahl ergeben das transparente Volumen. Zusätzlich werden bei ebenen Gittern exakte Flächen gleicher relativer Phase mit der Box und dem aktiven Schnitt geschnitten (bis 100 Flächen; darüber keine Dezimation mit falscher Periode).

Leuchten und Transparenz sind eine illustrative Transferfunktion, keine Streulicht- oder Augenbeobachtungssimulation. Der separate Schnitt benutzt denselben CPU-Feldkern, 480 × 240 Pixel. Die Intensitätsskala ist fest 0…4 |E₀|²; größere Werte sättigen farblich. Die Indexschnitt-Farbskala ist automatisch skaliert und beziffert; bei δn = 0 wird ein konstantes Bild dargestellt. Extrem feine/schräge Fringen können die Displayabtastung überschreiten; der xy-Schnitt ist dann hilfreicher.

Die äußeren Strahlen und ausgewählten Wellenfronten sind **schematisch** und nicht an die komprimierte Boxmetrik gebunden. Sie zeigen Richtungen und im ebenen Modus berechnete Leistungsanteile; keine reale optische Zeitskala. Die im k-Diagramm dargestellten Vektoren sind die tatsächlichen internen Vektoren. Die Born-Ansicht zeigt zyklische Phase und relativen Feldbetrag, nicht ein auf einen Schirm projiziertes Intensitätsbild.

## Bewusst nicht simuliert

Materialchemie, photosensitive Rezepturen, Sättigung, Entwicklung, Diffusion, Schrumpfung, reale Herstellung, Absorption, n(λ), Fresnel-Koeffizienten, äußere Ein-/Auskopplung, diffuse Streuung, Speckle, Rauschen, endliche räumliche Kohärenz, volle Vektorpolarisation, Mehrfachreflexionen, Reflexionshologramme, volle RCWA, Wärme-/Mechanikeffekte oder produktspezifische Sicherheitsmerkmale und Verfahren.

## Referenzen

- [H. Kogelnik, *Coupled Wave Theory for Thick Hologram Gratings*, Bell System Technical Journal 48, 2909–2947 (1969)](https://doi.org/10.1002/j.1538-7305.1969.tb01198.x): Grundlage der Zweiwellen-Näherung.
- [M. Fally, J. Klepp, Y. Tomita, *An experimental study to discriminate between the validity of diffraction theories for off-Bragg replay* (2012, revidiert 2014)](https://arxiv.org/abs/1203.5714): Bedeutung der elastischen Ausgangsrichtung bei Detuning.

Die hier verwendete Flussnormierung und die Grenzen der Implementierung sind oben eigenständig spezifiziert.
