"""Serve ASTRA locally without dependencies or a build step."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import webbrowser

LOGO = """
 █████╗  ███████╗ ████████╗ ██████╗   █████╗
██╔══██╗ ██╔════╝ ╚══██╔══╝ ██╔══██╗ ██╔══██╗
███████║ ███████╗    ██║    ██████╔╝ ███████║
██╔══██║ ╚════██║    ██║    ██╔══██╗ ██╔══██║
██║  ██║ ███████║    ██║    ██║  ██║ ██║  ██║
╚═╝  ╚═╝ ╚══════╝    ╚═╝    ╚═╝  ╚═╝ ╚═╝  ╚═╝
   W E L T R A U M A T L A S  ·  3 D  ·  O P E N  S O U R C E
"""

URL = 'http://127.0.0.1:8769'

def main():
    root = Path(__file__).resolve().parent / 'dist'
    if not (root / 'index.html').is_file():
        raise SystemExit('Bitte zuerst die gesamte ZIP-Datei entpacken.')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', 8769), partial(SimpleHTTPRequestHandler, directory=str(root)))
    except OSError:
        raise SystemExit('Port 8769 ist belegt. Beende einen bereits laufenden ASTRA-Start und versuche es erneut.')
    try:
        print(LOGO)
    except UnicodeEncodeError:
        print('ASTRA · Weltraumatlas in 3D')
    print(f'ASTRA: {URL} — Beenden mit Strg+C')
    print('Nur auf diesem Computer erreichbar.')
    webbrowser.open(URL)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
