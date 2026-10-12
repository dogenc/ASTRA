# Prüfstand 1.0.1

Stand: 12.10.2026. Der aktuelle Actions-Lauf dokumentiert den geprüften Commit.

## Lokal erfolgreich

- `npm test`: NASA-Körperdaten, 5.080 Sterne, 88 Sternbilder, vier Phänomene, Bahnen gegen JPL-Horizons-Stichproben und Desktop-Protokollpfade.
- Die zusätzlichen Tests verwenden die echte Three.js-Geometrie: Nordpolbeleuchtung bei allen vier Jahreszeiten, Verjüngung der Schattenkegel von der Sonne weg, vier Mondphasen, acht Planeten innerhalb der initialen Ansicht bei breitem und schmalem Format, Himmelszoom und Blickrichtung nach Neuzeichnen, Beschriftungen am Horizont, Bewegungsreduktion und retrograde Rotation von Venus und Uranus.

## Automatisch auf GitHub

- Browser: alle Körper mit Schnittansichten, alle Phänomenschritte, Suche, Ortswahl, Datumseingabe und Zeitgrenzen, Kamera nach Drag/Zoom und Ebenenwechsel, abgebrochene und ungültige Koordinaten, Dezimalkomma, blockierter lokaler Speicher, Leertaste auf einem fokussierten Button, Notizen, PNG-Export und Handyansicht.
- Zehn Dokumentationsaufnahmen werden mit `scripts/gallery.cjs` direkt aus der App erzeugt und als `astra-gallery` gespeichert.
- Native Electron-Prüfung auf Windows und macOS; erst nach erfolgreichen Prüfungen werden Pakete veröffentlicht.

Der zuvor fehlgeschlagene Windows-Test betraf einen Timeout nach Neuladen. Die bereits vorhandene Korrektur des Wartekriteriums wurde übernommen; deren Actions-Lauf 38185168923 war erfolgreich. Das ist kein Ersatz für den neuen Prüflauf.

Grenzen: kein Test auf physischem iPhone/Android, kein Safari-/Firefox-Durchlauf, keine unabhängige astronomiedidaktische Begutachtung. Horizons-Tests vergleichen geozentrische Richtungen zu einzelnen Referenzterminen; sie prüfen keine durchgehend gleich genaue topozentrische Sichtvorhersage. Schematische Größen, Licht, Schatten und innere Schichten bleiben ausdrücklich vereinfachte Lernmodelle.

## Nachgewiesene native Windows-Funktion

Im [Prüflauf 38187742475](https://github.com/dogenc/ASTRA/actions/runs/38187742475) wurden unter Windows das lokale Protokoll, alle drei Bereiche, persistente Notizen und ein tatsächlich gespeicherter PNG-Export mit Dateisignatur, Bildabmessungen und gerendertem Inhalt erfolgreich geprüft. Erst die anschließende Playwright-Fensteraufnahme überschritt das Zeitlimit. Die Fensteraufnahme verwendet deshalb jetzt Electron `webContents.capturePage()` mit einer Zeitgrenze und ist ein Diagnoseartefakt. Fehler der App, ein verlorener WebGL-Kontext, fehlende Notizpersistenz oder ein fehlgeschlagener PNG-Download bleiben harte Testfehler.

Die README enthält zehn echte, visuell geprüfte Aufnahmen aus der laufenden Browserversion von ASTRA 1.0.1. Die Windows-Integration wird in der CI auf einer Software-GPU über DOM-Ereignisse geprüft; Maus- und Tastaturbedienung prüft der separate Browser-Test. Ein Durchlauf auf einem physischen Windows-Rechner steht aus.
