const {_electron} = require('playwright'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs'), os = require('node:os');
(async () => {
  const result = path.resolve('test-results'); fs.mkdirSync(result, {recursive: true}); const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-test-'));
  const app = await _electron.launch({executablePath: require('../desktop/node_modules/electron'), args: [path.resolve('desktop/main.cjs'), '--enable-unsafe-swiftshader', ...(process.platform === 'win32' ? ['--use-gl=angle', '--use-angle=swiftshader-webgl'] : [])], env: {...process.env, ASTRA_TEST_USER_DATA: profile}, timeout: 60000});
  try {
    const page = await app.firstWindow(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const ready = () => page.waitForFunction(() => document.querySelector('canvas') && document.querySelector('#loading').hidden && document.querySelector('#viewport canvas').dataset.textureState === 'ready', null, {polling: 500, timeout: 90000});
    await ready(); assert.ok(page.url().startsWith('astra://app/'));
    assert.equal(await page.locator('.atlas-family nav a').count(), 5);
    for (const hash of ['body/system', 'body/saturn', 'sky/all', 'sky/UMa', 'process/eclipse']) { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(400); }
    await page.evaluate(() => { location.hash = 'body/mars'; }); await page.waitForFunction(() => document.querySelector('#scene-title').textContent === 'Mars', null, {polling: 500, timeout: 60000});
    // Native checks focus on Electron storage/download integration; browser tests cover pointer and keyboard actionability.
    await page.evaluate(() => { document.querySelector('summary').click(); const note = document.querySelector('#note'); note.value = 'Desktop-Notiz'; note.dispatchEvent(new Event('input', {bubbles: true})); }); await page.reload(); await ready(); assert.equal(await page.inputValue('#note'), 'Desktop-Notiz');
    const graphics = await page.evaluate(() => { const canvas = document.querySelector('#viewport canvas'), gl = canvas.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info'); return {width: canvas.width, height: canvas.height, lost: gl?.isContextLost(), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER)}; });
    assert.equal(graphics.lost, false, 'Native WebGL context must be alive');
    console.log('Native graphics:', JSON.stringify(graphics));
    fs.writeFileSync(path.join(result, 'desktop-graphics.json'), JSON.stringify(graphics, null, 2));
    const destination = path.join(result, 'desktop-export.png');
    await app.evaluate(({BrowserWindow}, dest) => { globalThis.downloadEvents = []; globalThis.saved = new Promise(resolve => BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_e, item) => { globalThis.downloadEvents.push({event: 'started', name: item.getFilename()}); item.setSavePath(dest); item.on('updated', (_e, state) => globalThis.downloadEvents.push({event: 'updated', state, bytes: item.getReceivedBytes()})); item.once('done', (_e, state) => { globalThis.downloadEvents.push({event: 'done', state}); resolve(state); }); })); }, destination);
    await page.evaluate(() => document.querySelector('#export').click()); const downloadState = await app.evaluate(() => Promise.race([globalThis.saved, new Promise(r => setTimeout(() => r('timeout'), 90000))])); const downloadEvents = await app.evaluate(() => globalThis.downloadEvents); fs.writeFileSync(path.join(result, 'desktop-download.json'), JSON.stringify({downloadState, downloadEvents, errors}, null, 2)); assert.equal(downloadState, 'completed', JSON.stringify(downloadEvents));
    const png = fs.readFileSync(destination); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'); assert.ok(png.length > 10000, 'PNG must contain rendered content'); assert.equal(png.readUInt32BE(16), graphics.width); assert.equal(png.readUInt32BE(20), graphics.height);
    // Screenshot capture is diagnostic; the mandatory native checks already verified a real rendered PNG download.
    const capture = await app.evaluate(async ({BrowserWindow}) => {
      const win = BrowserWindow.getAllWindows()[0];
      const image = await Promise.race([win.webContents.capturePage().catch(() => null), new Promise(resolve => setTimeout(() => resolve(null), 15000))]);
      if (!image || image.isEmpty()) return null;
      return image.toPNG().toString('base64');
    });
    if (capture) fs.writeFileSync(path.join(result, 'desktop.png'), Buffer.from(capture, 'base64'));
    else console.warn('Native window screenshot unavailable on this CI compositor; rendered PNG export verified.');
    assert.deepEqual(errors, []);
    console.log('PASS Electron: lokales Protokoll, Sonnensystem, Himmel, Phänomene, Notizen, PNG');
  } finally { await app.close(); fs.rmSync(profile, {recursive: true, force: true}); }
})().catch(e => { console.error(e); process.exit(1); });
