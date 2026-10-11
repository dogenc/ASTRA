const {resolveAsset,isAppURL}=require('../desktop/paths.cjs');
const assert=require('node:assert/strict'),path=require('node:path');const root=path.resolve('dist');
assert.equal(resolveAsset(root,'astra://app/'),path.join(root,'index.html'));
assert.equal(resolveAsset(root,'astra://app/data/stars.json'),path.join(root,'data','stars.json'));
for(const url of ['astra://evil/index.html','https://app/index.html','astra://app/%2e%2e%2fsecret','astra://app/%5c..%5csecret','astra://app/%00','astra://user@app/index.html','astra://app:42/index.html','not a url'])assert.equal(resolveAsset(root,url),null,url);
assert.ok(isAppURL('astra://app/#sky/Ori'));console.log('PASS desktop protocol paths and origin boundaries');
