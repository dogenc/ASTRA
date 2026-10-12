const {chromium} = require('playwright'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const root = path.resolve(__dirname, '..'), results = path.join(root, 'test-results'); fs.mkdirSync(results, {recursive: true});
const server = require('node:child_process').spawn('python3', ['-m', 'http.server', '8773', '--bind', '127.0.0.1', '--directory', path.join(root, 'dist')], {stdio: 'ignore'});
process.on('exit', () => server.kill());
(async () => {
 for (let i = 0; i < 50; i++) { try { await fetch('http://127.0.0.1:8773'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
 const browser = await chromium.launch({executablePath: process.env.ASTRA_CHROMIUM || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist']});
 try {
  for (const config of [{name: 'retina', width: 1512, height: 1000, dpr: 2}, {name: 'mobile', width: 430, height: 932, dpr: 3, touch: true}]) {
   const context = await browser.newContext({viewport: {width: config.width, height: config.height}, deviceScaleFactor: config.dpr, hasTouch: !!config.touch, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin'}), page = await context.newPage(), errors = [];
   page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1:8773')) errors.push(`${r.status()} ${r.url()}`); });
   await page.goto('http://127.0.0.1:8773'); await page.waitForFunction(() => document.querySelector('#loading').hidden);
   await page.evaluate(async () => { const {Studio} = await import('./studio.js'); for (const method of ['body', 'sky']) { const original = Studio.prototype[method]; Studio.prototype[method] = function(...args) { window.__scene = this; return original.apply(this, args); }; } });
   for (const id of ['earth', 'mercury', 'moon', 'saturn', 'earth']) {
    await page.evaluate(id => { location.hash = `body/${id}`; }, id);
    await page.waitForFunction(id => window.__scene?.pickables.some(o => o.userData.pick?.label === ({earth: 'Erde', mercury: 'Merkur', moon: 'Mond', saturn: 'Saturn'})[id]) && document.querySelector('#viewport canvas').dataset.textureState === 'ready', id, {timeout: 60000});
    await page.waitForTimeout(300);
    const quality = await page.evaluate(() => { const s = window.__scene, c = s.renderer.domElement; return {canvas: [c.width, c.height], css: [s.host.clientWidth, s.host.clientHeight], dpr: s.renderer.getPixelRatio(), maps: Object.entries(s.cache).filter(([name]) => /^(hq|4k)\//.test(name)).map(([name, t]) => ({name, width: t.image.width})), textures: s.renderer.info.memory.textures, lost: s.renderer.getContext().isContextLost()}; });
    if (config.touch) assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#search')).fontSize) >= 16), 'Mobile inputs must avoid iOS focus zoom');
    assert.equal(quality.lost, false); assert.ok(quality.canvas[0] * quality.canvas[1] <= 8_010_000, 'Render pixel budget');
    assert.ok(Math.abs(quality.canvas[0] - quality.css[0] * quality.dpr) <= 1, 'HiDPI canvas width');
    assert.ok(quality.maps.length > 0 && quality.maps.every(t => t.width >= 4096), JSON.stringify(quality));
    if (config.touch) assert.ok(quality.maps.every(t => t.name.startsWith('4k/')), 'Mobile texture budget');
    assert.ok(quality.textures < 24, 'Browsing bodies must release previous large GPU maps');
    console.log(config.name, id, JSON.stringify(quality));
   }
   await page.screenshot({path: path.join(results, `visual-${config.name}-earth.png`), fullPage: true});
   await page.evaluate(() => { location.hash = 'sky/Ori'; });
   await page.waitForFunction(() => window.__scene?.skyMode);
   await page.fill('#when', '2026-12-15T23:30'); await page.dispatchEvent('#when', 'change');
   for (const fov of [15, 35, 70, 100]) for (const az of [0, 90, 180, 270]) {
    const state = await page.evaluate(({fov, az}) => {
     const s = window.__scene; s.camera.fov = fov; s.camera.updateProjectionMatrix(); s.lookAt(30, az); s.layoutLabels();
     return {width: s.host.clientWidth, height: s.host.clientHeight, labels: s.managedLabels.filter(o => o.visible).map(o => ({text: o.userData.label.text, ...o.userData.screenRect}))};
    }, {fov, az});
    for (let i = 0; i < state.labels.length; i++) {
     const a = state.labels[i]; assert.ok(a.left >= 0 && a.right <= state.width && a.top >= 0 && a.bottom <= state.height, `Clipped label: ${a.text}`);
     for (const b of state.labels.slice(i + 1)) assert.ok(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom, `Overlapping ${a.text}/${b.text}`);
    }
   }
   await page.evaluate(() => { const s = window.__scene; s.camera.fov = 70; s.camera.updateProjectionMatrix(); s.lookAt(25, 180); });
   await page.screenshot({path: path.join(results, `visual-${config.name}-sky.png`), fullPage: true});
   assert.deepEqual(errors, []); await context.close();
  }
  console.log('PASS visual: HiDPI, original map resolution, mobile GPU budget, texture disposal, 32 sky views without overlapping or clipped labels');
 } finally { await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
