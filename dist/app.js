import {Studio} from './studio.js';
import {bodies, processes, texts, layers, SUN, CITIES, julian, helio, geocentric, altAz, moonPhase, AU_KM} from './astro.js';
const $ = id => document.getElementById(id);
const state = {mode: 'body', id: 'system', p: 0, playing: false, token: 0, date: new Date(), timePlaying: false, lines: true, names: true, cutaway: false};
let studio, facts, stars, constellations, current, updateProcess, lastSky = 0;
const saved = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
let customPlace = {name: 'Eigener Ort', lat: Number(saved('astra:lat', '52.52')), lon: Number(saved('astra:lon', '13.405'))};
if (!Number.isFinite(customPlace.lat) || Math.abs(customPlace.lat) > 90 || !Number.isFinite(customPlace.lon) || Math.abs(customPlace.lon) > 180) customPlace = {name: 'Eigener Ort', lat: 52.52, lon: 13.405};
let previousPlace = '0';
const cardinalProcess = () => ['phases', 'seasons'].includes(state.id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = (n, d = 0) => n == null ? '–' : Number(n).toLocaleString('de-DE', {maximumFractionDigits: d, minimumFractionDigits: 0});
const toast = text => { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => $('toast').hidden = true, 3500); };
async function getJSON(path) { const r = await fetch(path); if (!r.ok) throw Error(`${path}: HTTP ${r.status}`); return r.json(); }
const setFacts = rows => $('facts').innerHTML = rows.map(([label, value, wide]) => `<div class="fact ${wide ? 'wide' : ''}"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('');
const compass = az => ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest'][Math.round(az / 45) % 8];
const localValue = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const dateText = d => d.toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'});
const factURL = id => `https://nssdc.gsfc.nasa.gov/planetary/factsheet/${id}fact.html`;
const MIN = Math.max(Date.UTC(1800, 0, 1), new Date(1800, 0, 1).getTime()), MAX = Math.min(Date.UTC(2050, 11, 31, 23, 59), new Date(2050, 11, 31, 23, 59).getTime());

function place() { const v = $('place').value; if (v === 'custom') return customPlace; const [name, lat, lon] = CITIES[Number(v)] || CITIES[0]; return {name, lat, lon}; }
function setTime(date, redraw = true) {
  if (!Number.isFinite(date.getTime())) return;
  const t = Math.min(MAX, Math.max(MIN, date.getTime()));
  if (t !== date.getTime()) { setTimePlaying(false); toast('Die Bahndaten gelten von 1800 bis 2050.'); }
  state.date = new Date(t); $('when').value = localValue(state.date);
  if (!redraw) return;
  if (state.mode === 'body' && state.id === 'system') { studio?.place?.(julian(state.date)); systemFacts(); }
  if (state.mode === 'sky') drawSky();
}
function setTimePlaying(v) { state.timePlaying = v; $('time-play').textContent = v ? 'Ⅱ Zeit anhalten' : '▶ Zeit läuft'; $('time-play').setAttribute('aria-pressed', v); }
function setSpeeds(sky) {
  const opts = sky ? [['10 Min. / s', 10 / 1440], ['1 Std. / s', 1 / 24], ['6 Std. / s', .25]] : [['1 Tag / s', 1], ['1 Woche / s', 7], ['1 Monat / s', 30], ['1 Jahr / s', 365.25]];
  $('time-speed').replaceChildren(...opts.map(([t, v]) => new Option(t, v))); $('time-speed').selectedIndex = sky ? 1 : 1;
}
function setPlaying(v) { state.playing = v; $('play').textContent = v ? 'Ⅱ Pause' : '▶ Abspielen'; $('play').setAttribute('aria-pressed', v); }
function route(mode, id) { const hash = `#${mode}/${id}`; if (location.hash === hash) select(mode, id); else location.hash = hash; }
function listFor(mode) { return mode === 'sky' ? [{id: 'all', de: 'Ganzer Himmel', la: 'Rundumblick', symbol: '✦'}, ...constellations] : mode === 'process' ? processes : bodies; }
function parseRoute() {
  const [mode, id] = location.hash.slice(1).split('/'), m = ['body', 'sky', 'process'].includes(mode) ? mode : 'body';
  const ok = listFor(m).some(x => x.id === id); select(m, ok ? id : m === 'sky' ? 'all' : m === 'process' ? 'phases' : 'system');
}
function skyAlt(c) { const pl = place(), jd = julian(state.date); return c.id === 'all' ? null : altAz(c.center[0], c.center[1], jd, pl.lat, pl.lon); }
function renderList() {
  const list = listFor(state.mode), q = $('search').value.toLocaleLowerCase('de'), onlyVisible = state.mode === 'sky' && $('only-visible').checked;
  const rows = list.map(x => ({x, aa: state.mode === 'sky' ? skyAlt(x) : null})).filter(({x, aa}) => `${x.name || x.de} ${x.la || ''} ${x.kind || ''}`.toLocaleLowerCase('de').includes(q) && (!onlyVisible || !aa || aa[0] > 0));
  if (state.mode === 'sky') rows.sort((a, b) => a.x.id === 'all' ? -1 : b.x.id === 'all' ? 1 : a.x.de.localeCompare(b.x.de, 'de'));
  $('count').textContent = `${rows.length} ${state.mode === 'sky' ? 'Einträge' : state.mode === 'process' ? 'Phänomene' : 'Himmelskörper'}`;
  $('items').replaceChildren(...rows.map(({x, aa}) => {
    const b = document.createElement('button'), active = x.id === state.id; b.className = 'item' + (active ? ' active' : '') + (aa && aa[0] < 0 ? ' below' : ''); b.setAttribute('aria-pressed', String(active));
    const sub = state.mode === 'sky' ? (aa ? (aa[0] > 0 ? `${x.la} · ${Math.round(aa[0])}° hoch` : `${x.la} · unter dem Horizont`) : x.la) : state.mode === 'process' ? x.formula : x.kind;
    b.innerHTML = `<span class="symbol">${esc(x.symbol || (state.mode === 'sky' ? x.id.slice(0, 3) : '↻'))}</span><span><b>${esc(x.name || x.de)}</b><small>${esc(sub)}</small></span>`; b.onclick = () => route(state.mode, x.id); return b;
  }));
  if (!rows.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Keine Treffer. Suche oder Filter ändern.'; $('items').append(p); }
}
function noteKey() { return `astra:note:${state.mode}:${state.id}`; }
function loadNote() { try { $('note').value = localStorage.getItem(noteKey()) || ''; $('note-status').textContent = ''; } catch { $('note').value = ''; $('note-status').textContent = 'Lokaler Speicher ist nicht verfügbar.'; } }
function setLegend(entries) { $('legend').innerHTML = entries.map(([color, label]) => `<span><i style="background:${color}"></i>${esc(label)}</span>`).join(''); }
function explain(id) { const [title, a, b] = texts[id]; $('knowledge-title').textContent = title; $('explanation').innerHTML = `<p>${esc(a)}</p><div class="callout">${esc(b)}</div>`; }

function systemFacts() {
  const jd = julian(state.date), e = helio('earth', jd), m = helio('mars', jd), j = helio('jupiter', jd), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * AU_KM;
  setFacts([['Datum', state.date.toLocaleDateString('de-DE', {dateStyle: 'long'}), true], ['Erde – Sonne', `${num(Math.hypot(...e) * AU_KM / 1e6, 1)} Mio. km`], ['Licht braucht', `${num(Math.hypot(...e) * AU_KM / 299792.458 / 60, 1)} Min.`], ['Erde – Mars', `${num(dist(e, m) / 1e6, 0)} Mio. km`], ['Erde – Jupiter', `${num(dist(e, j) / 1e6, 0)} Mio. km`]]);
}
function bodyFacts(meta) {
  const f = meta.id === 'sun' ? SUN : facts[meta.id], earth = facts.earth;
  const period = f.period ? (f.period > 800 ? `${num(f.period / 365.25, 1)} Jahre` : `${num(f.period, 1)} Tage`) : null;
  const rows = [['Durchmesser', `${num(f.diameter)} km`], ['Im Vergleich', `${num(f.diameter / earth.diameter, f.diameter > earth.diameter * 3 ? 0 : 2)} × Erde`], ['Masse', `${num(f.mass, 3)} · 10²⁴ kg`], ['Schwerkraft', `${num(f.gravity, 1)} m/s²`]];
  if (meta.id === 'sun') rows.push(['Oberfläche', `${num(f.temperature)} °C`], ['Kern', `≈ ${num(f.core / 1e6, 1)} Mio. K`], ['Rotation (Äquator)', `${num(f.rotation / 24, 1)} Tage`], ['Anteil im System', '≈ 99,8 % der Masse', true]);
  else {
    rows.push([meta.id === 'moon' ? 'Abstand zur Erde' : 'Abstand zur Sonne', meta.id === 'moon' ? `${num(f.distance * 1e6)} km` : `${num(f.distance, 1)} Mio. km`], [meta.id === 'moon' ? 'Umlauf um die Erde' : 'Ein Jahr dauert', period], ['Ein Tag dauert', f.day ? (f.day > 72 ? `${num(f.day / 24, 1)} Erdtage` : `${num(f.day, 1)} Stunden`) : '–'], ['Mittlere Temperatur', f.temperature == null ? '–' : `${num(f.temperature)} °C`], ['Achsneigung', `${num(f.obliquity, 1)}°`], ['Monde', f.moons == null ? '–' : num(f.moons)]);
    if (f.rings) rows.push(['Ringsystem', 'ja']);
  }
  setFacts(rows);
}
function bodyLegend(meta) { setLegend(state.cutaway ? (layers[meta.id] || []).map(([, c, n]) => [c, n]) : []); }

function drawSky() {
  if (!studio || state.mode !== 'sky') return; const pl = place(), jd = julian(state.date);
  const tick = studio.tick; studio.sky(stars, constellations, jd, pl.lat, pl.lon, state.lines, state.names); studio.tick = tick; lastSky = performance.now();
  const ph = moonPhase(jd), vis = studio.visible.filter(v => v.alt > 0 && !['sun', 'moon'].includes(v.id)).map(v => v.name), sun = studio.visible[0];
  const sky = sun.alt > -0.8 ? 'Tag' : sun.alt > -6 ? 'Bürgerliche Dämmerung' : sun.alt > -12 ? 'Nautische Dämmerung' : sun.alt > -18 ? 'Astronomische Dämmerung' : 'Nacht';
  $('scene-subtitle').textContent = `${pl.name} · ${dateText(state.date)}`;
  if (state.id === 'all') {
    setFacts([['Ort', pl.name], ['Himmel', sky], ['Sonne', sun.alt >= 0 ? `${num(sun.alt, 0)}° hoch` : `${num(-sun.alt, 0)}° unter dem Horizont`], ['Mond', `${ph.name} · ${num(ph.fraction * 100)} %`], ['Planeten über dem Horizont', vis.length ? vis.join(', ') : 'keiner über dem Horizont', true]]);
  } else {
    const c = constellations.find(x => x.id === state.id), [alt, az] = altAz(c.center[0], c.center[1], jd, pl.lat, pl.lon);
    setFacts([['Lateinisch', c.la], ['Kürzel', c.id], ['Höhe', alt > 0 ? `${num(alt)}°` : 'unter dem Horizont'], ['Richtung', compass(az)], ['Himmel', sky, true]]);
  }
  setLegend([['#ffd56b', 'Sonne'], ['#f2f0e6', 'Mond'], ['#ff8a5c', 'Planeten'], ['#7f93ff', 'Sternbildlinien']]);
  if (state.mode === 'sky') renderList();
}

async function select(mode, id) {
  const changed = state.mode !== mode, token = ++state.token; state.mode = mode; state.id = id; state.p = 0; setPlaying(false); updateProcess = null;
  if (studio) studio.tick = () => {}; $('picked').hidden = true; if (changed) { $('search').value = ''; setTimePlaying(false); setSpeeds(mode === 'sky'); }
  const isBody = mode === 'body', isSky = mode === 'sky', isProc = mode === 'process', isSystem = isBody && id === 'system';
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
  $('explorer-title').textContent = isBody ? 'Sonnensystem' : isSky ? 'Sternenhimmel' : 'Phänomene'; $('explorer-desc').textContent = isBody ? 'Von der Sonne bis an den Rand.' : isSky ? '88 Sternbilder über deinem Ort.' : 'Was am Himmel passiert – und warum.';
  $('visible-wrap').hidden = !isSky; $('time-controls').hidden = !(isSystem || isSky); $('scale-wrap').hidden = !isSystem; $('place-wrap').hidden = !isSky;
  $('process-controls').hidden = !isProc; $('cutaway').hidden = !isBody || isSystem; $('lines').hidden = $('names').hidden = !isSky; $('rotate').hidden = isSky;
  $('scene-type').textContent = isSystem ? 'BAHNEN-STUDIO' : isBody ? 'PLANETEN-STUDIO' : isSky ? 'HIMMELS-STUDIO' : 'PHÄNOMEN-STUDIO';
  $('hint').textContent = isSky ? 'Umsehen: ziehen · Zoom: scrollen' : 'Drehen: ziehen · Zoom: scrollen / zwei Finger'; $('source-link').hidden = false; $('rotate').setAttribute('aria-pressed', 'false'); renderList(); loadNote();
  if (isBody) {
    const meta = bodies.find(b => b.id === id); current = meta; $('scene-title').textContent = meta.name; $('hero-symbol').textContent = meta.symbol;
    if (isSystem) {
      $('scene-subtitle').textContent = 'Positionen für das gewählte Datum'; explain('system'); systemFacts(); setLegend([['#f6b54a', 'Sonne'], ['#8ea2ff', 'Umlaufbahnen']]);
      $('model-note').textContent = $('scale').value === 'real' ? 'Abstände maßstäblich · Planeten stark vergrößert' : 'Abstände gestaucht · Planeten stark vergrößert';
      $('source-link').href = 'https://ssd.jpl.nasa.gov/planets/approx_pos.html'; $('attribution').innerHTML = 'Bahnelemente: JPL / E. M. Standish · Texturen: Solar System Scope, CC BY 4.0';
      studio?.system(julian(state.date), $('scale').value === 'real');
      if (studio) studio.tick = (t, dt) => { if (state.timePlaying) setTime(new Date(state.date.getTime() + dt * Number($('time-speed').value) * 864e5)); };
    } else {
      $('scene-subtitle').textContent = meta.kind; explain(id); bodyFacts(meta); bodyLegend(meta);
      $('model-note').textContent = state.cutaway ? 'Schalenaufbau schematisch · Werte gerundet' : 'Achse in Gelb · Rotation beschleunigt';
      $('source-link').href = factURL(id); $('attribution').innerHTML = `Daten: NASA ${id === 'sun' ? 'Sun' : 'Planetary'} Fact Sheet (NSSDCA), gemeinfrei${meta.tex ? ' · Textur: Solar System Scope, CC BY 4.0' : ' · Farbe schematisch (keine Textur)'}`;
      studio?.body(meta, id === 'sun' ? SUN : facts[id], state.cutaway);
    }
  } else if (isSky) {
    const c = id === 'all' ? null : constellations.find(x => x.id === id); $('scene-title').textContent = c ? c.de : 'Der Himmel über dir'; $('hero-symbol').textContent = c ? c.id : '✦';
    $('knowledge-title').textContent = c ? `Sternbild ${c.de}` : 'Was über deinem Horizont steht.';
    $('explanation').innerHTML = c ? `<p>Sternbilder sind Muster, die Menschen in zufällig nebeneinander erscheinende Sterne hineingesehen haben. Die Sterne von ${esc(c.de)} (${esc(c.la)}) sind meist unterschiedlich weit von uns entfernt.</p><div class="callout">Die Internationale Astronomische Union hat 88 offizielle Sternbilder festgelegt. Ihre Grenzen teilen den ganzen Himmel lückenlos auf; die Linien hier verbinden nur die hellen Sterne.</div>` : `<p>Der Himmel dreht sich scheinbar einmal am Tag um den Polarstern – in Wahrheit dreht sich die Erde. Stelle Ort und Zeit ein oder lass die Zeit laufen.</p><div class="callout">Helle Sterne erscheinen größer, ihre Farbe zeigt die Temperatur: bläulich ist heiß, rötlich kühler. Über dem Horizont bedeutet nicht automatisch sichtbar: Tageslicht, Wetter und Lichtverschmutzung spielen ebenfalls eine Rolle.</div>`;
    $('model-note').textContent = 'Ohne Lichtbrechung und Präzession · Sterne bis 6,0 mag';
    $('source-link').href = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50'; $('attribution').innerHTML = 'Sterne: Yale Bright Star Catalogue (5. Ausg.) · Sternbilder: d3-celestial © Olaf Frohn, BSD-3 · Positionen: JPL-Bahnelemente';
    if (studio) { drawSky(); if (c) { const [alt, az] = c.altAz || altAz(c.center[0], c.center[1], julian(state.date), place().lat, place().lon); studio.lookAt(Math.max(alt, 12), az); if (alt < 0) toast(`${c.de} steht gerade unter dem Horizont. Zeit oder Ort ändern.`); } else studio.lookAt(25, 180);
      studio.tick = (t, dt) => { if (!state.timePlaying) return; setTime(new Date(state.date.getTime() + dt * Number($('time-speed').value) * 864e5), false); if (performance.now() - lastSky > 400) { const look = studio.skyLook; drawSky(); studio.lookAt(...look); } }; }
    else $('scene-subtitle').textContent = place().name;
  } else {
    current = processes.find(x => x.id === id); $('scene-title').textContent = current.name; $('scene-subtitle').textContent = current.formula; $('hero-symbol').textContent = '';
    $('knowledge-title').textContent = 'Den Himmel verstehen.'; setFacts([['Schritte', 4], ['Modell', 'Schematisch']]); setLegend([]);
    $('model-note').textContent = id === 'eclipse' ? 'Mondbahnneigung 3-fach überhöht · Größen nicht maßstäblich' : 'Didaktische Animation · Größen und Abstände nicht maßstäblich';
    $('source-link').href = id === 'seasons' ? 'https://spaceplace.nasa.gov/seasons/' : id === 'starlife' ? 'https://science.nasa.gov/universe/stars/' : 'https://science.nasa.gov/moon/lunar-phases-and-eclipses/'; $('attribution').innerHTML = 'Eigene Lerntexte · Texturen: Solar System Scope, CC BY 4.0';
    $('steps').replaceChildren(...current.steps.map((text, i) => { const b = document.createElement('button'); b.textContent = `${i + 1}. ${text}`; b.onclick = () => { state.p = cardinalProcess() ? i / 4 : (i + .5) / 4; showProgress(); }; return b; }));
    updateProcess = studio?.process(id);
    if (studio) studio.tick = (t, dt) => { if (!state.playing) { updateProcess?.(state.p); return; } state.p = Math.min(1, state.p + dt * Number($('speed').value) / 24); showProgress(); if (state.p >= 1) setPlaying(false); };
    showProgress();
  }
  if (token !== state.token) return; $('loading').hidden = !!studio || $('loading').hidden;
}
function showProgress() {
  updateProcess?.(state.p); $('timeline').value = Math.round(state.p * 1000); $('progress').textContent = Math.round(state.p * 100) + ' %';
  const i = cardinalProcess() ? Math.round(state.p * 4) % 4 : Math.min(3, Math.floor(state.p * 4)); $('steps').querySelectorAll('button').forEach((b, k) => { b.classList.toggle('active', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  $('explanation').innerHTML = `<h3>${i + 1} / ${esc(current.steps[i])}</h3><p>${esc(current.texts[i])}</p><div class="callout">${esc(current.formula)}</div><p>Zeitleiste ziehen oder einen Schritt wählen. Abspielen zeigt den Übergang.</p>`;
}

try {
  [facts, stars, constellations] = await Promise.all([getJSON('data/facts.json'), getJSON('data/stars.json'), getJSON('data/constellations.json')]);
  $('place').replaceChildren(...CITIES.map(([n], i) => new Option(n, i)), new Option('Eigene Koordinaten …', 'custom'));
  const savedPlace = saved('astra:place', '0'); if ([...$('place').options].some(o => o.value === savedPlace)) $('place').value = savedPlace; previousPlace = $('place').value;
  $('when').min = localValue(new Date(MIN)); $('when').max = localValue(new Date(MAX));
  setSpeeds(false); setTime(new Date(), false);
  try { studio = new Studio($('viewport'), pick => { if (pick?.id && state.mode === 'body') { route('body', pick.id); return; } $('picked').textContent = pick?.label || ''; $('picked').hidden = !pick?.label; }); $('loading').hidden = true; }
  catch (e) { $('loading').textContent = '3D nicht verfügbar. WebGL aktivieren oder einen aktuellen Browser verwenden. Lerntexte und Daten bleiben nutzbar.'; console.error(e); }
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => route(b.dataset.mode, b.dataset.mode === 'sky' ? 'all' : b.dataset.mode === 'process' ? 'phases' : 'system'));
  $('search').oninput = renderList; $('only-visible').onchange = renderList;
  $('when').onchange = () => { const d = new Date($('when').value); if (!isNaN(d)) setTime(d); };
  $('now').onclick = () => setTime(new Date()); $('time-play').onclick = () => setTimePlaying(!state.timePlaying);
  $('scale').onchange = () => select(state.mode, state.id);
  $('place').onchange = () => {
    if ($('place').value === 'custom') {
      const latInput = prompt('Geografische Breite in Grad (Norden positiv):', String(customPlace.lat));
      if (latInput === null) { $('place').value = previousPlace; return; }
      const lonInput = prompt('Geografische Länge in Grad (Osten positiv):', String(customPlace.lon));
      if (lonInput === null) { $('place').value = previousPlace; return; }
      const lat = Number(latInput.trim().replace(',', '.')), lon = Number(lonInput.trim().replace(',', '.'));
      if (!latInput.trim() || !lonInput.trim() || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) { toast('Ungültige Koordinaten.'); $('place').value = previousPlace; return; }
      customPlace = {name: 'Eigener Ort', lat, lon};
      try { localStorage.setItem('astra:lat', lat); localStorage.setItem('astra:lon', lon); } catch {}
    }
    previousPlace = $('place').value;
    try { localStorage.setItem('astra:place', $('place').value); } catch {} drawSky();
  };
  $('reset').onclick = () => studio?.reset(); $('rotate').onclick = () => { if (!studio) return; studio.controls.autoRotate = !studio.controls.autoRotate; $('rotate').setAttribute('aria-pressed', studio.controls.autoRotate); };
  $('cutaway').onclick = () => { state.cutaway = !state.cutaway; $('cutaway').setAttribute('aria-pressed', state.cutaway); select(state.mode, state.id); };
  $('lines').onclick = () => { state.lines = !state.lines; $('lines').setAttribute('aria-pressed', state.lines); const l = studio?.skyLook; drawSky(); if (l) studio.lookAt(...l); };
  $('names').onclick = () => { state.names = !state.names; $('names').setAttribute('aria-pressed', state.names); const l = studio?.skyLook; drawSky(); if (l) studio.lookAt(...l); };
  $('export').onclick = () => { if (studio) studio.export($('scene-title').textContent); else toast('PNG-Export benötigt ein verfügbares 3D-Studio.'); };
  $('timeline').oninput = () => { state.p = Number($('timeline').value) / 1000; showProgress(); }; $('play').onclick = () => { if (state.p >= 1) state.p = 0; setPlaying(!state.playing); showProgress(); };
  $('note').oninput = () => { try { localStorage.setItem(noteKey(), $('note').value); $('note-status').textContent = 'Gespeichert.'; } catch { $('note-status').textContent = 'Speichern nicht möglich: Browser-Speicher gesperrt oder voll.'; } };
  $('sources-open').onclick = () => $('sources').showModal(); $('sources-close').onclick = () => $('sources').close(); window.addEventListener('hashchange', parseRoute);
  document.addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $('sources').open) return; if (e.code === 'Space' && e.target === document.body && (state.mode === 'process' || !$('time-controls').hidden)) { e.preventDefault(); (state.mode === 'process' ? $('play') : $('time-play')).click(); } if (e.key.toLowerCase() === 'r') studio?.reset(); });
  parseRoute();
} catch (e) { $('loading').textContent = 'App-Daten konnten nicht geladen werden. Bitte über HTTP starten (python start.py), nicht per Datei-Doppelklick.'; console.error(e); }

