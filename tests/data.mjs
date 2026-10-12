import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {helio, geocentric, altAz, moonPhase, siderealDeg, processes, bodies, layers, texts} from '../dist/astro.js';
const json = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const facts = json('../dist/data/facts.json'), stars = json('../dist/data/stars.json'), cons = json('../dist/data/constellations.json');
// Daten
assert.equal(Object.keys(facts).length, 10); for (const [id, f] of Object.entries(facts)) { assert.ok(f.diameter > 0 && f.mass > 0, id); }
assert.equal(facts.earth.diameter, 12756); assert.equal(facts.jupiter.diameter, 142984);
assert.ok(stars.length > 5000); for (const s of stars) { assert.ok(s[0] >= 0 && s[0] < 360 && Math.abs(s[1]) <= 90 && s[2] <= 6); }
assert.equal(stars[0][4], 'Sirius');
assert.equal(cons.length, 88); assert.equal(new Set(cons.map(c => c.id)).size, 88);
for (const c of cons) { assert.ok(c.de && c.la && c.lines.length); for (const seg of c.lines) for (const [ra, dec] of seg) assert.ok(ra >= 0 && ra < 360 && Math.abs(dec) <= 90); }
for (const b of bodies) { assert.ok(texts[b.id], b.id); if (b.id !== 'system') { assert.ok(layers[b.id], b.id); const ls = layers[b.id]; assert.equal(ls.at(-1)[0], 1); for (let k = 1; k < ls.length; k++) assert.ok(ls[k][0] > ls[k - 1][0]); } }
assert.equal(processes.length, 4); for (const p of processes) { assert.equal(p.steps.length, 4); assert.equal(p.texts.length, 4); }
// Ephemeriden gegen JPL Horizons (tests/fixtures/horizons.json)
const fx = json('./fixtures/horizons.json'), ids = {199: 'mercury', 299: 'venus', 399: 'earth', 499: 'mars', 599: 'jupiter', 699: 'saturn', 799: 'uranus', 899: 'neptune', 999: 'pluto'};
const ang = (a, b) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b))) * 180 / Math.PI;
let worst = 0;
for (const [pid, id] of Object.entries(ids)) for (const [d, v] of Object.entries(fx.vectors[pid])) {
  const jd = Date.parse(d + 'T00:00:00Z') / 864e5 + 2440587.5 - 69.2 / 86400, err = ang(helio(id, jd), v); worst = Math.max(worst, err);
  assert.ok(err < (['jupiter', 'saturn'].includes(id) ? .25 : .05), `${id} ${d}: ${err.toFixed(3)}°`);
}
for (const [d, row] of Object.entries(fx.moon)) {
  const jd = Date.parse(d + 'T00:00:00Z') / 864e5 + 2440587.5, [ra, dec] = geocentric('moon', jd);
  assert.ok(Math.abs(ra - Number(row[3])) < .15 && Math.abs(dec - Number(row[4])) < .15, `Mond ${d}`);
}
// Plausibilität: Polaris steht etwa so hoch wie die geografische Breite; Phase im gültigen Bereich
const [alt] = altAz(37.95, 89.26, 2461300.5, 52.52, 13.405); assert.ok(Math.abs(alt - 52.52) < 1, 'Polaris');
for (let jd = 2461300; jd < 2461330; jd += 3) { const p = moonPhase(jd); assert.ok(p.fraction >= 0 && p.fraction <= 1 && p.name); }
for (let latitude = -90; latitude <= 90; latitude += .5) { const aa = altAz(siderealDeg(2461300.5, 0), latitude, 2461300.5, latitude, 0); assert.ok(aa.every(Number.isFinite) && Math.abs(aa[0] - 90) < .00001, 'Zenith finite'); }
console.log(`PASS: 10 Körper, ${stars.length} Sterne, 88 Sternbilder, 4 Phänomene; Planeten vs. JPL Horizons max. ${worst.toFixed(3)}°, Mond < 0,15°`);

