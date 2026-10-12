// Draft staging avoids Actions artifact quotas. Publication requires both native jobs.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const version = require('../desktop/package.json').version, tag = `v${version}`, stage = process.argv[2];
const run = process.env.GITHUB_RUN_ID, commit = process.env.GITHUB_SHA;
const gh = (...args) => cp.execFileSync('gh', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']});
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const windows = [`ASTRA-${version}-Windows-Setup.exe`, `ASTRA-${version}-Windows-portable.exe`], mac = [`ASTRA-${version}-macOS.dmg`];
function assert(condition, message) { if (!condition) throw Error(message); }
if (stage === 'prepare') {
 let release;
 try { release = JSON.parse(gh('release', 'view', tag, '--json', 'isDraft,targetCommitish')); } catch {}
 if (release) { assert(release.isDraft, 'Published releases cannot be overwritten; increment the version.'); gh('release', 'edit', tag, '--target', commit); }
 else gh('release', 'create', tag, '--draft', '--target', commit, '--title', `ASTRA ${version} · DGKN@Labs`, '--notes-file', 'docs/release-notes.md');
 console.log(`Draft ${tag} prepared at ${commit}`);
} else if (stage === 'upload') {
 const os = process.env.RUNNER_OS, names = os === 'Windows' ? windows : mac;
 assert(['Windows', 'macOS'].includes(os), 'Unsupported build platform');
 const directory = path.resolve('desktop/release'), records = names.map(name => {
  const file = path.join(directory, name); assert(fs.existsSync(file) && fs.statSync(file).size > 10_000_000, `Missing or incomplete installer: ${name}`);
  return {name, bytes: fs.statSync(file).size, sha256: digest(file)};
 });
 const proof = path.join(directory, `ASTRA-${version}-${os}-build.json`);
 fs.writeFileSync(proof, JSON.stringify({version, run, commit, os, files: records}, null, 2) + '\n');
 gh('release', 'upload', tag, ...names.map(name => path.join(directory, name)), proof, '--clobber');
 console.log(`${os}: native checks passed; verified installers staged in draft`);
} else if (stage === 'publish') {
 const directory = path.resolve('release-assets'); fs.mkdirSync(directory, {recursive: true});
 gh('release', 'download', tag, '--pattern', '*', '--dir', directory, '--clobber');
 for (const os of ['Windows', 'macOS']) {
  const proof = JSON.parse(fs.readFileSync(path.join(directory, `ASTRA-${version}-${os}-build.json`)));
  assert(proof.run === run && proof.commit === commit && proof.version === version, `Stale ${os} build`);
  const expected = os === 'Windows' ? windows : mac;
  assert(proof.files.length === expected.length && expected.every(name => proof.files.some(f => f.name === name)), `Unexpected ${os} installer set`);
  for (const record of proof.files) {
   const file = path.join(directory, record.name); assert(fs.statSync(file).size === record.bytes && digest(file) === record.sha256, `Installer checksum mismatch: ${record.name}`);
  }
 }
 const zip = `ASTRA-${version}-Web.zip`;
 cp.execFileSync('python3', ['-c', `import pathlib,zipfile\nwith zipfile.ZipFile('release-assets/${zip}','w',zipfile.ZIP_DEFLATED) as out:\n for p in pathlib.Path('dist').rglob('*'):\n  if p.is_file(): out.write(p,p.relative_to('dist'))\n for name in ['LICENSE','NOTICE.md']: out.write(name,name)`], {stdio: 'inherit'});
 const names = [...windows, ...mac, zip], sums = path.join(directory, 'SHA256SUMS.txt');
 fs.writeFileSync(sums, names.map(name => `${digest(path.join(directory, name))}  ${name}`).join('\n') + '\n');
 gh('release', 'upload', tag, path.join(directory, zip), sums, '--clobber');
 gh('release', 'edit', tag, '--draft=false', '--latest', '--notes-file', 'docs/release-notes.md');
 console.log(`Published ${tag}: both native builds and all installer checksums verified`);
} else throw Error('Expected prepare, upload or publish');
