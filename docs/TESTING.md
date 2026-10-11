# Prüfstand 1.0.0

Geprüft am 11.10.2026 unter Linux.

- `npm test`: erfolgreich. Daten (10 Körper, 5.080 Sterne, 88 Sternbilder, 4 Phänomene), Schalenmodelle, Bahnen gegen JPL Horizons (max. 0,144°), Mond gegen Horizons (< 0,05°), Polaris-Höhe, Desktop-Protokollpfade.
- `node tests/browser.cjs`: erfolgreich mit Playwright und headless Chromium (Software-WebGL). Desktop 1512 × 1000, Mobil 390 × 844. Alle 12 Himmelskörper inkl. Quellenlinks, Zeitsteuerung, Maßstab, innerer Aufbau, 88 Sternbilder, Suche, Ortswahl, Datumseingabe, vier Phänomene mit allen Schritten, Notizen nach Neuladen, PNG-Download, Quellen-Dialog. Keine JavaScript-Fehler, keine horizontale Überbreite auf dem Handy.
- `xvfb-run node tests/desktop.cjs`: Electron-App unter Linux erfolgreich (lokales Protokoll, Navigation, Notizen, PNG-Export).
- Neun echte Galerieaufnahmen mit `scripts/gallery.cjs` erstellt und visuell geprüft.

Grenzen: Kein Test auf physischem iPhone/Android, kein Safari-/Firefox-Durchlauf, keine unabhängige astronomiedidaktische Begutachtung. Native Windows-/macOS-Prüfung und Paketierung laufen im Release-Workflow; maßgeblich ist dessen Ergebnis.
