const {chromium} = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const results = path.resolve(__dirname, '../test-results'); fs.mkdirSync(results, {recursive: true});
const exe = process.env.ASTRA_CHROMIUM || undefined, BASE = 'http://127.0.0.1:8769';
const server = require('node:child_process').spawn(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'http.server', '8769', '--bind', '127.0.0.1', '--directory', path.resolve(__dirname, '../dist')], {stdio: 'ignore'});
process.on('exit', () => server.kill());
(async () => {
  for (let i = 0; i < 50; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  const browser = await chromium.launch({headless: true, executablePath: exe, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: 1512, height: 1000}, deviceScaleFactor: 1}); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE); await page.waitForSelector('canvas'); await page.waitForTimeout(800);
  assert.equal(await page.locator('#items .item').count(), 12); assert.equal(await page.locator('.atlas-family nav a').count(), 5);
  assert.ok((await page.locator('.atlas-family a[aria-current]').textContent()).includes('ASTRA'));
  assert.ok((await page.textContent('#facts')).includes('Erde – Sonne')); await page.screenshot({path: path.join(results, '01-sonnensystem.png')});
  await page.click('#time-play'); await page.waitForTimeout(700); await page.click('#time-play');
  await page.selectOption('#scale', 'real'); await page.waitForTimeout(300); await page.selectOption('#scale', 'compact');
  for (const id of ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) { await page.goto(`${BASE}/#body/${id}`); await page.waitForFunction(id => document.querySelector('#source-link').href.includes(id + 'fact'), id); }
  await page.goto(`${BASE}/#body/earth`); await page.click('#cutaway'); await page.waitForTimeout(500); assert.ok((await page.textContent('#legend')).includes('Innerer Kern')); await page.screenshot({path: path.join(results, '02-erde-aufbau.png')}); await page.click('#cutaway');
  await page.locator('[data-mode=sky]').click(); await page.waitForFunction(() => document.querySelector('#scene-title').textContent === 'Der Himmel über dir');
  assert.equal(await page.locator('#items .item').count(), 89); await page.screenshot({path: path.join(results, '03-himmel.png')});
  await page.fill('#search', 'Orion'); assert.equal(await page.locator('#items .item').count(), 1); await page.locator('#items .item').click();
  await page.waitForFunction(() => document.querySelector('#scene-title').textContent === 'Orion'); await page.fill('#search', '');
  await page.selectOption('#place', '2'); await page.waitForFunction(() => document.querySelector('#scene-subtitle').textContent.startsWith('München'));
  await page.click('#lines'); await page.click('#names'); await page.click('#time-play'); await page.waitForTimeout(900); await page.click('#time-play');
  await page.fill('#when', '2030-07-15T23:00'); await page.dispatchEvent('#when', 'change'); await page.waitForFunction(() => document.querySelector('#scene-subtitle').textContent.includes('2030'));
  for (const id of ['phases', 'eclipse', 'seasons', 'starlife']) { await page.goto(`${BASE}/#process/${id}`); for (let i = 0; i < 4; i++) await page.locator('#steps button').nth(i).click(); await page.click('#play'); await page.waitForTimeout(150); await page.click('#play'); }
  await page.goto(`${BASE}/#process/eclipse`); await page.locator('#steps button').nth(3).click(); await page.waitForTimeout(300); await page.screenshot({path: path.join(results, '04-finsternis.png')});
  await page.goto(`${BASE}/#body/mars`); await page.locator('summary').click(); await page.fill('#note', 'Olympus Mons: 22 km hoch.'); await page.reload(); await page.waitForSelector('canvas'); assert.equal(await page.inputValue('#note'), 'Olympus Mons: 22 km hoch.');
  const download = page.waitForEvent('download'); await page.click('#export'); assert.ok((await download).suggestedFilename().endsWith('.png'));
  await page.setViewportSize({width: 390, height: 844}); await page.goto(`${BASE}/#sky/all`); await page.waitForTimeout(600); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({path: path.join(results, '05-mobil.png'), fullPage: true});
  await page.click('#sources-open'); assert.ok(await page.locator('#sources').isVisible()); await page.keyboard.press('Escape');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS browser: 12 Himmelskörper, Zeitsteuerung, Maßstab, Schalenaufbau, 88 Sternbilder, Suche, Ort, 4 Phänomene, Notizen, PNG, mobil; keine JS-Fehler');
  await browser.close(); server.kill();
})().catch(e => { console.error(e); process.exit(1); });
