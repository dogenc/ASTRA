"""Bereitet die Rohdaten aus sources/ für die App in dist/data/ auf.

Quellen (alle im Ordner sources/ unverändert abgelegt):
- NASA Planetary Fact Sheet (NSSDCA, D. R. Williams) – gemeinfrei (US Government Work)
- Yale Bright Star Catalogue, 5th rev. (Hoffleit & Warren, CDS V/50)
- d3-celestial (Olaf Frohn, BSD-3-Clause): Sternbildlinien, -namen und Sternnamen
"""
import gzip, html, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'sources', ROOT / 'dist' / 'data'
OUT.mkdir(parents=True, exist_ok=True)


def factsheet():
    raw = (SRC / 'nasa-planetary-factsheet.html').read_text('latin-1')
    table = []
    for tr in re.findall(r'<tr.*?</tr>', raw, re.S | re.I):
        tds = re.findall(r'<t[dh].*?>(.*?)</t[dh]>', tr, re.S | re.I)
        cells = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', td))).strip() for td in tds]
        if len(cells) >= 11:
            table.append(cells)
    rows = {
        'Mass': 'mass', 'Diameter': 'diameter', 'Density': 'density', 'Gravity': 'gravity',
        'Escape Velocity': 'escape', 'Rotation Period': 'rotation', 'Length of Day': 'day',
        'Distance from Sun': 'distance', 'Perihelion': 'perihelion', 'Aphelion': 'aphelion',
        'Orbital Period': 'period', 'Orbital Velocity': 'velocity', 'Orbital Inclination': 'inclination',
        'Orbital Eccentricity': 'eccentricity', 'Obliquity to Orbit': 'obliquity', 'Mean Temperature': 'temperature',
        'Surface Pressure': 'pressure', 'Number of Moons': 'moons', 'Ring System?': 'rings',
        'Global Magnetic Field?': 'magnetic',
    }
    ids = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
    data = {i: {} for i in ids}
    for cells in table:
        key = next((v for k, v in rows.items() if cells[0].startswith(k)), None)
        if not key:
            continue
        for body, value in zip(ids, cells[1:11]):
            value = value.replace(',', '').replace('*', '')
            if key in ('rings', 'magnetic'):
                data[body][key] = value.lower().startswith('yes')
            elif value.lower() == 'unknown':
                data[body][key] = None
            else:
                try:
                    data[body][key] = float(value)
                except ValueError:
                    data[body][key] = value
    assert data['earth']['diameter'] == 12756 and data['jupiter']['mass'] == 1898, data['earth']
    return data


def stars():
    names = json.loads((SRC / 'starnames.json').read_text('utf-8'))
    by_hd = {}
    for v in names.values():
        hd = re.sub(r'\D', '', v.get('hd', ''))
        name = re.sub(r'\s+', ' ', v.get('de') or v.get('name') or '').strip()
        if hd and name:
            by_hd[hd] = name
    out = []
    for line in gzip.open(SRC / 'bsc5-catalog.gz', 'rt', encoding='latin-1'):
        if not line[75:77].strip() or not line[102:107].strip():
            continue
        ra = (int(line[75:77]) + int(line[77:79]) / 60 + float(line[79:83]) / 3600) * 15
        dec = (int(line[84:86]) + int(line[86:88]) / 60 + int(line[88:90]) / 3600) * (-1 if line[83] == '-' else 1)
        mag = float(line[102:107])
        if mag > 6.0:
            continue
        bv = float(line[109:114]) if line[109:114].strip() else 0.6
        star = [round(ra, 4), round(dec, 4), round(mag, 2), round(bv, 2)]
        name = by_hd.get(line[25:31].strip())
        if name and mag < 2.6:
            star.append(name)
        out.append(star)
    out.sort(key=lambda s: s[2])
    return out


def constellations():
    meta = {f['id']: f for f in json.loads((SRC / 'constellations.json').read_text('utf-8'))['features']}
    clean = lambda t: re.sub(r'\s+', ' ', t).strip()
    merged = {}
    for f in json.loads((SRC / 'constellations.lines.json').read_text('utf-8'))['features']:
        p = meta[f['id']]['properties']
        lon, lat = meta[f['id']]['geometry']['coordinates']
        lines = [[[round(x % 360, 3), round(y, 3)] for x, y in seg] for seg in f['geometry']['coordinates']]
        if f['id'] in merged:  # Serpens besteht aus zwei Teilen (Kopf und Schwanz)
            merged[f['id']]['lines'] += lines
            continue
        merged[f['id']] = {'id': f['id'], 'de': clean(p.get('de') or p['name']), 'la': clean(p['la']), 'rank': int(p['rank']),
                           'center': [round(lon % 360, 2), round(lat, 2)], 'lines': lines}
    out = list(merged.values())
    out.sort(key=lambda c: c['de'])
    return out


if __name__ == '__main__':
    facts, st, co = factsheet(), stars(), constellations()
    (OUT / 'facts.json').write_text(json.dumps(facts, ensure_ascii=False, separators=(',', ':')), 'utf-8')
    (OUT / 'stars.json').write_text(json.dumps(st, ensure_ascii=False, separators=(',', ':')), 'utf-8')
    (OUT / 'constellations.json').write_text(json.dumps(co, ensure_ascii=False, separators=(',', ':')), 'utf-8')
    print(f'{len(facts)} Körper · {len(st)} Sterne bis 6,0 mag · {len(co)} Sternbilder')
