# Quellen und Modellgrenzen

Alle Rohdaten liegen unverändert im Ordner [`sources/`](sources/). Die App-Daten in `dist/data/` erzeugt `scripts/prepare_data.py`. Abrufdatum aller Quellen: **11.10.2026**.

## Planetenbahnen – JPL

E. M. Standish: [Keplerian Elements for Approximate Positions of the Major Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html), Tabelle 1 (mittlere Ekliptik und Äquinoktium J2000, gültig 1800–2050). Werke der US-Regierung sind gemeinfrei. Kopie: `sources/jpl-approx_pos.html`.

- Pluto: Bahnelemente aus einer früheren Fassung derselben Tabelle; ohne Störungsrechnung, nur zur Veranschaulichung.
- Prüfung: `tests/fixtures/horizons.json` enthält heliozentrische Vektoren aus [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) für drei Daten sowie geozentrische Mondpositionen. Größte gemessene Abweichung: 0,14° (Saturn); Mond < 0,05°.
- Mond: verkürzte Störungsreihe nach Paul Schlyter, [How to compute planetary positions](https://stjarnhimlen.se/comp/ppcomp.html); eigene Implementierung.

## Körperdaten – NASA

D. R. Williams, NASA Space Science Data Coordinated Archive: [Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) und [Sun Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html). Gemeinfrei. Kopien: `sources/nasa-*.html`. Die Zahl der bekannten Monde ändert sich mit neuen Entdeckungen und gilt für das Abrufdatum.

## Sterne – Yale Bright Star Catalogue

D. Hoffleit, W. H. Warren Jr.: *The Bright Star Catalogue*, 5th Revised Ed., Yale University Observatory (1991), bereitgestellt vom [CDS, Katalog V/50](https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50). Verwendet werden J2000-Positionen, V-Helligkeit und B−V-Farbe aller Sterne bis 6,0 mag (5.080 Sterne).

## Sternbilder und Sternnamen – d3-celestial

[d3-celestial](https://github.com/ofrohn/d3-celestial) © 2015 Olaf Frohn, **BSD-3-Clause** (vollständiger Lizenztext: `sources/d3-celestial-LICENSE.txt`, mitgeliefert als `dist/data/LICENSE-d3-celestial.txt`). Übernommen: Sternbildlinien, deutsche und lateinische Sternbildnamen, deutsche Eigennamen heller Sterne. Die beiden Teile der Schlange (Serpens) wurden zu einem Eintrag zusammengeführt.

## Texturen – Solar System Scope

[Solar System Scope Textures](https://www.solarsystemscope.com/textures/) von INOVE, **CC BY 4.0**. Für ASTRA auf 2K belassen, als JPEG neu komprimiert; die Wolkentextur wurde in Graustufen umgewandelt. Pluto hat keine Textur und wird einfarbig dargestellt.

## Three.js

Three.js **0.180.0**, einschließlich OrbitControls, MIT-Lizenz. Unveränderte Bibliotheksdateien. Lizenz: `dist/vendor/LICENSE`.

## Modellgrenzen

- **Größen und Abstände:** In der kompakten Ansicht sind Abstände gestaucht (Potenzfunktion) und Planeten stark vergrößert. „Echte Abstände“ ist bei den Abständen maßstäblich, die Planeten bleiben vergrößert.
- **Innerer Aufbau:** Schichtgrenzen gerundet und schematisch. Das Innere von Jupiter, Saturn, Uranus und Neptun ist wissenschaftlich unsicher.
- **Rotation:** In der Einzelansicht beschleunigt; die Richtung (z. B. rückläufig bei Venus) stimmt.
- **Sternenhimmel:** Keine Präzession, Nutation, Eigenbewegung oder atmosphärische Refraktion; Sterne für J2000. Abweichung im Jahr 2026 bis etwa 0,4°. Dämmerungsfarben vereinfacht.
- **Phänomene:** Didaktische Animationen. Bei den Finsternissen ist die Neigung der Mondbahn dreifach überhöht.
- Die Lerntexte sind eigene, KI-unterstützt erstellte Kurzfassungen. Eine unabhängige fachredaktionelle Abnahme steht aus.

ASTRA ist ein unabhängiges Projekt von DGKN@Labs und kein Produkt der NASA, des JPL, des CDS oder der genannten Autorinnen und Autoren; es wird von ihnen weder unterstützt noch empfohlen.


## Fachliche Korrekturen in 1.0.1

Die Jahreszeiten zeigen eine im Raum feste, um 23,4° geneigte Erdachse; bei Sommeranfang ist der Nordpol zur Sonne geneigt. Quelle: NASA Space Place, [What Causes the Seasons?](https://spaceplace.nasa.gov/seasons/), geprüft 12.10.2026. Erd- und Mondkernschatten verjüngen sich von der Sonne weg. Die Darstellungen bleiben schematisch.

Venus: Rotation um die eigene Achse und Sonnentag werden getrennt erklärt. Obliquität über 90° und negatives Vorzeichen der tabellierten Rotationsperiode werden im 3D-Modell nicht doppelt als Richtungsumkehr angewendet. Körperdaten sind der hinterlegte NASA-Quellstand; insbesondere Mondzahlen werden nicht als laufend aktuell ausgegeben.

Die Himmelsansicht verwendet geozentrische Koordinaten ohne topozentrische Mondparallaxe; nahe dem Horizont kann deren Auslassung eine Abweichung bis ungefähr 1° verursachen. Die angeführten Horizons-Stichproben prüfen die geozentrischen Koordinaten und garantieren keine allgemeine Beobachtungsgenauigkeit. Planeten über dem Horizont können durch Tageslicht, Wetter und Lichtverschmutzung unsichtbar bleiben.
