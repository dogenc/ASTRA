const {chromium} = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const results = path.resolve(__dirname, '../test-results'); fs.mkdirSync(results, {recursive: true});
const exe = process.env.ASTRA_CHROMIUM || undefined, BASE = 'http://127.0.0.1:8769';
const server = require('node:child_process').spawn(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'http.server', '8769', '--bind', '127.0.0.1', '--directory', path.resolve(__dirname, '../dist')], {stdio: 'ignore'});
process.on('exit', () => server.kill());
(async () => {
  for (let i = 0; i < 50; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  const browser = await chromium.launch({headless: true, executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: 1512, height: 1000}, deviceScaleFactor: 1, locale: 'de-DE', timezoneId: 'Europe/Berlin'}); const errors = [];
  page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE); await page.waitForFunction(() => document.querySelector('canvas') && document.querySelector('#loading').hidden); await page.waitForTimeout(800);
  assert.equal(await page.locator('#items .item').count(), 12); assert.equal(await page.locator('.atlas-family nav a').count(), 5);
  assert.ok((await page.locator('.atlas-family a[aria-current]').textContent()).includes('ASTRA'));
  assert.ok((await page.textContent('#facts')).includes('Erde – Sonne')); await page.screenshot({path: path.join(results, '01-sonnensystem.png')});
  await page.click('#time-play'); await page.waitForTimeout(700); await page.click('#time-play');
  await page.selectOption('#scale', 'real'); await page.waitForTimeout(300); await page.selectOption('#scale', 'compact');
  for (const id of ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) { await page.goto(`${BASE}/#body/${id}`); await page.waitForFunction(id => document.querySelector('#source-link').href.includes(id + 'fact'), id); await page.click('#cutaway'); assert.ok(await page.locator('#legend span').count() >= 2); await page.click('#cutaway'); }
  await page.goto(`${BASE}/#body/earth`); await page.click('#cutaway'); await page.waitForTimeout(500); assert.ok((await page.textContent('#legend')).includes('Innerer Kern')); await page.screenshot({path: path.join(results, '02-erde-aufbau.png')}); await page.click('#cutaway');
  await page.evaluate(async () => {
    const {Studio} = await import('./studio.js'), sky = Studio.prototype.sky;
    Studio.prototype.sky = function(...args) { window.__scene = this; return sky.apply(this, args); };
  });
  await page.locator('[data-mode=sky]').click(); await page.waitForFunction(() => document.querySelector('#scene-title').textContent === 'Der Himmel über dir');
  assert.equal(await page.locator('#items .item').count(), 89); await page.screenshot({path: path.join(results, '03-himmel.png')});
  await page.fill('#search', 'Orion'); assert.equal(await page.locator('#items .item').count(), 1); await page.locator('#items .item').click();
  await page.waitForFunction(() => document.querySelector('#scene-title').textContent === 'Orion'); await page.fill('#search', '');
  await page.selectOption('#place', '2'); await page.waitForFunction(() => document.querySelector('#scene-subtitle').textContent.startsWith('München'));
  // Keep user drag and field of view when time/location/layer changes redraw the sky.
  const canvas = page.locator('#viewport canvas'), box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .55, {steps: 8}); await page.mouse.up(); await page.waitForTimeout(400);
  await page.mouse.wheel(0, -150); await page.waitForTimeout(200);
  const beforeSky = await page.evaluate(() => ({look: window.__scene.skyLook.slice(), fov: window.__scene.camera.fov}));
  await page.click('#lines'); await page.click('#names');
  const afterSky = await page.evaluate(() => ({look: window.__scene.skyLook.slice(), fov: window.__scene.camera.fov}));
  assert.ok(Math.abs(afterSky.fov - beforeSky.fov) < .001 && afterSky.look.every((v, i) => Math.abs(v - beforeSky.look[i]) < .05), JSON.stringify({beforeSky, afterSky})); await page.click('#time-play'); await page.waitForTimeout(900); await page.click('#time-play');
  await page.fill('#when', '2030-07-15T23:00'); await page.dispatchEvent('#when', 'change'); await page.waitForFunction(() => document.querySelector('#scene-subtitle').textContent.includes('2030'));
  await page.fill('#when', '2200-01-01T12:00'); await page.dispatchEvent('#when', 'change'); assert.ok((await page.inputValue('#when')).startsWith('2050-'));
  await page.fill('#when', '1790-01-01T12:00'); await page.dispatchEvent('#when', 'change'); assert.ok((await page.textContent('#scene-subtitle')).includes('1800'));
  await page.selectOption('#place', '10'); assert.ok((await page.textContent('#scene-subtitle')).startsWith('Dortmund'));
  page.once('dialog', d => d.dismiss()); await page.selectOption('#place', 'custom'); assert.equal(await page.inputValue('#place'), '10');
  const customDialogs = ['51,514', '7,466']; const answer = d => d.accept(customDialogs.shift()); page.on('dialog', answer); await page.selectOption('#place', 'custom'); page.off('dialog', answer); assert.ok((await page.textContent('#scene-subtitle')).startsWith('Eigener Ort'));
  const invalidAnswer = d => d.accept('91'); page.on('dialog', invalidAnswer); await page.selectOption('#place', '0'); await page.selectOption('#place', 'custom'); page.off('dialog', invalidAnswer); assert.equal(await page.inputValue('#place'), '0');
  for (const id of ['phases', 'eclipse', 'seasons', 'starlife']) { await page.goto(`${BASE}/#process/${id}`); for (let i = 0; i < 4; i++) await page.locator('#steps button').nth(i).click(); await page.click('#play'); await page.waitForTimeout(150); await page.click('#play'); }
  await page.goto(`${BASE}/#process/seasons`); for (let i = 0; i < 4; i++) { await page.locator('#steps button').nth(i).click(); assert.equal(await page.inputValue('#timeline'), String(i * 250)); }
  await page.focus('#play'); await page.keyboard.press('Space'); assert.equal(await page.getAttribute('#play', 'aria-pressed'), 'true'); await page.keyboard.press('Space'); assert.equal(await page.getAttribute('#play', 'aria-pressed'), 'false');
  await page.goto(`${BASE}/#process/eclipse`); await page.locator('#steps button').nth(3).click(); await page.waitForTimeout(300); await page.screenshot({path: path.join(results, '04-finsternis.png')});
  await page.goto(`${BASE}/#body/mars`); await page.locator('summary').click(); await page.fill('#note', 'Olympus Mons: 22 km hoch.'); await page.reload(); await page.waitForFunction(() => document.querySelector('canvas') && document.querySelector('#loading').hidden); assert.equal(await page.inputValue('#note'), 'Olympus Mons: 22 km hoch.');
  const download = page.waitForEvent('download'); await page.click('#export'); assert.ok((await download).suggestedFilename().endsWith('.png'));
  await page.setViewportSize({width: 390, height: 844}); await page.goto(`${BASE}/#sky/all`); await page.waitForTimeout(600); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({path: path.join(results, '05-mobil.png'), fullPage: true});
  await page.click('#sources-open'); assert.ok(await page.locator('#sources').isVisible()); await page.keyboard.press('Escape');
  const blocked = await browser.newPage(); blocked.on('pageerror', e => errors.push(e.message));
  await blocked.addInitScript(() => { Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); }; });
  await blocked.goto(`${BASE}/#sky/all`); await blocked.waitForFunction(() => document.querySelector('#loading').hidden); await blocked.selectOption('#place', '10'); assert.ok((await blocked.textContent('#scene-subtitle')).startsWith('Dortmund')); await blocked.close();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS browser: 12 Himmelskörper, Zeitsteuerung, Maßstab, Schalenaufbau, 88 Sternbilder, Suche, Ort, 4 Phänomene, Notizen, PNG, mobil; keine JS-Fehler');
  await browser.close(); server.kill();
})().catch(e => { console.error(e); process.exit(1); });

