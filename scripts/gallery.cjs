// Echte App-Aufnahmen, keine Mockups. Aufruf: node scripts/gallery.cjs
const {chromium} = require('playwright'), path = require('node:path'), fs = require('node:fs');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/gallery'); fs.mkdirSync(out, {recursive: true});
const server = require('node:child_process').spawn(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'http.server', '8771', '--bind', '127.0.0.1', '--directory', path.join(root, 'dist')], {stdio: 'ignore'}); process.on('exit', () => server.kill());
(async () => {
  for (let i = 0; i < 50; i++) { try { await fetch('http://127.0.0.1:8771'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  const browser = await chromium.launch({headless: true, executablePath: process.env.ASTRA_CHROMIUM || undefined, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist']});
  try {
    const page = await browser.newPage({viewport: {width: 1800, height: 1160}, deviceScaleFactor: 1}), errors = []; page.on('pageerror', e => errors.push(e.message));
    const open = async (hash, wait = 2500) => { await page.goto('http://127.0.0.1:8771/' + hash); await page.waitForSelector('canvas'); await page.waitForTimeout(wait); };
    const when = async v => { await page.fill('#when', v); await page.dispatchEvent('#when', 'change'); await page.waitForTimeout(1200); };
    const shot = name => page.screenshot({path: path.join(out, name + '.png')});
    await open('#body/system', 3000); await when('2026-12-15T21:00'); await shot('01-sonnensystem');
    await open('#body/earth'); await page.click('#cutaway'); await page.waitForTimeout(2000); await shot('02-erde-aufbau'); await page.click('#cutaway');
    await open('#body/saturn', 3000); await shot('03-saturn');
    await open('#sky/all'); await when('2026-12-15T21:00'); await page.evaluate(() => {}); await shot('04-himmel');
    await open('#sky/Ori'); await when('2026-12-15T23:30'); await page.locator('#items .item.active').click(); await page.waitForTimeout(1200); await shot('05-orion');
    await open('#process/phases'); await page.locator('#steps button').nth(1).click(); await page.waitForTimeout(800); await shot('06-mondphasen');
    await open('#process/eclipse'); await page.locator('#steps button').nth(3).click(); await page.waitForTimeout(1500); await shot('07-mondfinsternis');
    await open('#process/starlife'); await page.locator('#steps button').nth(2).click(); await page.waitForTimeout(800); await shot('08-roter-riese');
    await page.setViewportSize({width: 430, height: 932}); await open('#body/jupiter', 3000); await page.screenshot({path: path.join(out, '09-mobil.png'), fullPage: true});
    if (errors.length) throw Error(errors.join('\n'));
    console.log('Galerie erstellt:', fs.readdirSync(out).join(', '));
  } finally { await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
