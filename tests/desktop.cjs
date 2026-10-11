const {_electron} = require('playwright'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs'), os = require('node:os');
(async () => {
  const result = path.resolve('test-results'); fs.mkdirSync(result, {recursive: true}); const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-test-'));
  const app = await _electron.launch({executablePath: require('../desktop/node_modules/electron'), args: [path.resolve('desktop/main.cjs'), '--enable-unsafe-swiftshader'], env: {...process.env, ASTRA_TEST_USER_DATA: profile}, timeout: 60000});
  try {
    const page = await app.firstWindow(), errors = []; page.on('pageerror', e => errors.push(e.message));
    const ready = () => page.waitForFunction(() => document.querySelector('canvas') && document.querySelector('#loading').hidden, null, {polling: 500, timeout: 90000});
    await ready(); assert.ok(page.url().startsWith('astra://app/'));
    assert.equal(await page.locator('.atlas-family nav a').count(), 5);
    for (const hash of ['body/system', 'body/saturn', 'sky/all', 'sky/UMa', 'process/eclipse']) { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(400); }
    await page.evaluate(() => { location.hash = 'body/mars'; }); await page.waitForFunction(() => document.querySelector('#scene-title').textContent === 'Mars', null, {polling: 500, timeout: 60000});
    await page.locator('summary').click(); await page.fill('#note', 'Desktop-Notiz'); await page.reload(); await ready(); assert.equal(await page.inputValue('#note'), 'Desktop-Notiz');
    const destination = path.join(result, 'desktop-export.png');
    await app.evaluate(({BrowserWindow}, dest) => { globalThis.saved = new Promise(resolve => BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_e, item) => { item.setSavePath(dest); item.once('done', (_e, state) => resolve(state)); })); }, destination);
    await page.click('#export'); assert.equal(await app.evaluate(() => Promise.race([globalThis.saved, new Promise(r => setTimeout(() => r('timeout'), 20000))])), 'completed');
    assert.equal(fs.readFileSync(destination).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    await page.screenshot({path: path.join(result, 'desktop.png')}); assert.deepEqual(errors, []);
    console.log('PASS Electron: lokales Protokoll, Sonnensystem, Himmel, Phänomene, Notizen, PNG');
  } finally { await app.close(); fs.rmSync(profile, {recursive: true, force: true}); }
})().catch(e => { console.error(e); process.exit(1); });
