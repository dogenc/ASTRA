// Stage verified lossless screenshots as unreferenced Git blobs; never move a branch.
const fs = require('node:fs'), cp = require('node:child_process'), path = require('node:path');
const root = path.resolve(__dirname, '..');
cp.execFileSync('python3', ['-c', `from PIL import Image,ImageChops\nfrom pathlib import Path\nfor p in Path('docs/gallery').glob('*.png'):\n im=Image.open(p).convert('RGB');out=p.with_suffix('.webp');im.save(out,format='WEBP',lossless=True,method=6)\n assert ImageChops.difference(im,Image.open(out).convert('RGB')).getbbox() is None\n print(out,im.size)`], {cwd: root, stdio: 'inherit'});
for (const name of fs.readdirSync(path.join(root, 'docs/gallery')).filter(n => n.endsWith('.webp')).sort()) {
 const file = path.join(root, 'docs/gallery', name), input = JSON.stringify({content: fs.readFileSync(file).toString('base64'), encoding: 'base64'});
 const result = JSON.parse(cp.execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/git/blobs`, '--method', 'POST', '--input', '-'], {input, encoding: 'utf8', maxBuffer: 10_000_000, stdio: ['pipe', 'pipe', 'inherit']}));
 console.log('GALLERY_BLOB', JSON.stringify({path: `docs/gallery/${name}`, mode: '100644', type: 'blob', sha: result.sha}));
}
