"""Import original licensed maps; create genuine 4K derivatives for smaller GPUs.
Network access is explicit (--fetch). --verify only checks bundled bytes offline.
"""
import argparse, hashlib, io, json, pathlib, urllib.request
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parents[1]
TEX = ROOT / 'dist/tex'
SOURCES = {
 'mercury.jpg': '8k_mercury.jpg', 'venus.jpg': '4k_venus_atmosphere.jpg',
 'earth.jpg': '8k_earth_daymap.jpg', 'earth-clouds.jpg': '8k_earth_clouds.jpg',
 'mars.jpg': '8k_mars.jpg', 'jupiter.jpg': '8k_jupiter.jpg', 'saturn.jpg': '8k_saturn.jpg',
 'saturn-ring.png': '8k_saturn_ring_alpha.png', 'sun.jpg': '8k_sun.jpg', 'moon.jpg': '8k_moon.jpg',
 'milkyway.jpg': '8k_stars_milky_way.jpg',
}
def sha(data): return hashlib.sha256(data).hexdigest()
def fetch():
 records = []
 for name, source in SOURCES.items():
  url = 'https://www.solarsystemscope.com/textures/download/' + source
  req = urllib.request.Request(url, headers={'User-Agent': 'ASTRA/1.0.2 (licensed texture import)'})
  with urllib.request.urlopen(req, timeout=60) as response: data = response.read(40_000_001)
  assert len(data) < 40_000_001, 'Source exceeds import limit'
  original = Image.open(io.BytesIO(data)); original.load()
  assert original.width in (4096, 8192), (name, original.size)
  assert original.width == original.height * 2 or name == 'saturn-ring.png', (name, original.size)
  for level in ['hq', '4k']:
   image = original.copy()
   if level == '4k' and image.width > 4096:
    image = image.resize((4096, round(image.height * 4096 / image.width)), Image.Resampling.LANCZOS)
   output = TEX / level / name; output.parent.mkdir(parents=True, exist_ok=True)
   transformation = 'original'
   if level == 'hq' and len(data) <= 11_900_000: output.write_bytes(data)
   elif level == 'hq':
    # Preserve genuine 8K detail while keeping each GitHub API request below its byte limit.
    for quality in [95, 92, 90, 88, 85]:
     buffer = io.BytesIO(); image.save(buffer, format='JPEG', quality=quality, subsampling=2, optimize=True)
     if len(buffer.getvalue()) <= 11_900_000:
      output.write_bytes(buffer.getvalue()); transformation = f'JPEG quality {quality}, chroma 4:2:0, original 8K dimensions'; break
    else: raise ValueError('Source cannot fit import limit')
   elif name.endswith('.png'): image.save(output, optimize=True); transformation = 'PNG 4K derivative'
   else:
    image = image.convert('L' if name == 'earth-clouds.jpg' else 'RGB')
    image.save(output, quality=95, subsampling=0, optimize=True); transformation = 'JPEG quality 95 / 4K downsample where applicable'
   encoded = output.read_bytes()
   records.append({'path': str(output.relative_to(ROOT)), 'width': image.width, 'height': image.height,
    'bytes': len(encoded), 'sha256': sha(encoded), 'source': url, 'source_sha256': sha(data),
    'license': 'CC-BY-4.0', 'creator': 'INOVE / Solar System Scope',
    'transformation': transformation})
  print(f'{name}: original {original.width}×{original.height}', flush=True)
 (TEX / 'manifest.json').write_text(json.dumps({'retrieved': '2026-10-12', 'textures': records}, ensure_ascii=False, indent=2) + '\n')
def verify():
 manifest = json.loads((TEX / 'manifest.json').read_text())
 assert len(manifest['textures']) == len(SOURCES) * 2
 for record in manifest['textures']:
  file = ROOT / record['path']; data = file.read_bytes()
  assert len(data) == record['bytes'] and sha(data) == record['sha256'], file
  image = Image.open(io.BytesIO(data)); image.verify()
  assert image.size == (record['width'], record['height']), file
  assert image.width <= (8192 if '/hq/' in record['path'] else 4096)
 print('PASS textures: dimensions, decodability, checksums and source attribution')
if __name__ == '__main__':
 parser = argparse.ArgumentParser(); parser.add_argument('--fetch', action='store_true'); parser.add_argument('--verify', action='store_true')
 args = parser.parse_args()
 if args.fetch: fetch()
 if args.verify or args.fetch: verify()
