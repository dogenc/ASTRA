const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-release-'));
try {
 for (const name of ['scripts', 'desktop', 'dist', 'docs', 'bin', 'release-assets']) fs.mkdirSync(path.join(tmp, name));
 fs.copyFileSync(path.resolve(__dirname, '../scripts/release.cjs'), path.join(tmp, 'scripts/release.cjs'));
 fs.writeFileSync(path.join(tmp, 'desktop/package.json'), JSON.stringify({version: '0.0.0'}));
 for (const name of ['LICENSE', 'NOTICE.md', 'docs/release-notes.md', 'dist/index.html']) fs.writeFileSync(path.join(tmp, name), 'fixture');
 const fakeGH = path.join(tmp, 'bin/gh');
 fs.writeFileSync(fakeGH, '#!/usr/bin/env node\nconst fs=require("node:fs");fs.appendFileSync(process.env.CALLS,JSON.stringify(process.argv.slice(2))+"\\n");if(process.argv.includes("view"))console.log(JSON.stringify({isDraft:process.env.DRAFT==="yes",targetCommitish:"abc"}));'); fs.chmodSync(fakeGH, 0o755);
 const env = {...process.env, PATH: path.join(tmp, 'bin') + path.delimiter + process.env.PATH, CALLS: path.join(tmp, 'calls'), GITHUB_RUN_ID: '123', GITHUB_SHA: 'abc'};
 const execute = (stage, extra = {}) => cp.spawnSync(process.execPath, ['scripts/release.cjs', stage], {cwd: tmp, env: {...env, ...extra}, encoding: 'utf8'});
 assert.notEqual(execute('prepare').status, 0, 'A published release must never be overwritten'); assert.equal(execute('prepare', {DRAFT: 'yes'}).status, 0);
 const assetDir = path.join(tmp, 'release-assets'), names = ['ASTRA-0.0.0-Windows-Setup.exe', 'ASTRA-0.0.0-Windows-portable.exe', 'ASTRA-0.0.0-macOS.dmg'];
 const files = names.map(name => { const file = path.join(assetDir, name); fs.writeFileSync(file, 'installer:' + name); return {name, bytes: fs.statSync(file).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}; });
 const proof = (os, run = '123') => fs.writeFileSync(path.join(assetDir, `ASTRA-0.0.0-${os}-build.json`), JSON.stringify({version: '0.0.0', run, commit: 'abc', os, files: os === 'Windows' ? files.slice(0, 2) : files.slice(2)}));
 proof('Windows'); proof('macOS', '122'); assert.notEqual(execute('publish').status, 0, 'Stale platform output must block publication');
 proof('macOS'); fs.appendFileSync(path.join(assetDir, names[2]), 'tamper'); assert.notEqual(execute('publish').status, 0, 'Changed installer must block publication');
 fs.writeFileSync(path.join(assetDir, names[2]), 'installer:' + names[2]); fs.writeFileSync(env.CALLS, ''); assert.equal(execute('publish').status, 0);
 const sums = fs.readFileSync(path.join(assetDir, 'SHA256SUMS.txt'), 'utf8'); assert.equal(sums.trim().split('\n').length, 4); assert.ok(sums.includes('ASTRA-0.0.0-Web.zip'));
 const calls = fs.readFileSync(env.CALLS, 'utf8').trim().split('\n').map(JSON.parse); assert.ok(calls.at(-1).includes('--draft=false'), 'Publish only after verified assets and checksum upload');
 console.log('PASS release: published-release protection, stale-build rejection, installer tamper rejection, verified publication order');
} finally { fs.rmSync(tmp, {recursive: true, force: true}); }
