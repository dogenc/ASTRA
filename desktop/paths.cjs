const path=require('node:path');
function isAppURL(value){try{const u=new URL(value);return u.protocol==='astra:'&&u.hostname==='app'&&!u.port&&!u.username&&!u.password;}catch{return false;}}
function resolveAsset(root,value){
 if(!isAppURL(value))return null;
 try{const u=new URL(value),decoded=decodeURIComponent(u.pathname);if(decoded.includes('\0')||decoded.includes('\\'))return null;const rel=decoded==='/'?'index.html':decoded.replace(/^\/+/,''),file=path.resolve(root,rel),relative=path.relative(root,file);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)?file:null;}catch{return null;}
}
module.exports={isAppURL,resolveAsset};
