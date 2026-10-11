const {app,BrowserWindow,protocol,net,shell,Menu,session}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {isAppURL,resolveAsset}=require('./paths.cjs');
const ROOT=app.isPackaged?path.join(process.resourcesPath,'app'):path.join(__dirname,'..','dist');
protocol.registerSchemesAsPrivileged([{scheme:'astra',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
if(process.env.ASTRA_TEST_USER_DATA)app.setPath('userData',process.env.ASTRA_TEST_USER_DATA);
function openExternal(value){try{if(new URL(value).protocol==='https:')shell.openExternal(value).catch(()=>{});}catch{}}
function createWindow(){
 const win=new BrowserWindow({width:1560,height:1040,minWidth:800,minHeight:650,title:'ASTRA · Das Universum in 3D',backgroundColor:'#0b0f24',show:false,autoHideMenuBar:true,icon:path.join(__dirname,'build','icon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,spellcheck:false}});
 win.once('ready-to-show',()=>win.show());
 win.webContents.setWindowOpenHandler(({url})=>{if(!isAppURL(url))openExternal(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(!isAppURL(url)){event.preventDefault();openExternal(url);}});
 win.webContents.on('will-attach-webview',event=>event.preventDefault());
 win.loadURL('astra://app/');return win;
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{const [win]=BrowserWindow.getAllWindows();if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  protocol.handle('astra',async request=>{if(request.method!=='GET')return new Response('Method not allowed',{status:405});const file=resolveAsset(ROOT,request.url);if(!file)return new Response('Not found',{status:404});try{return await net.fetch(pathToFileURL(file).href);}catch{return new Response('Not found',{status:404});}});
  Menu.setApplicationMenu(process.platform==='darwin'?Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{role:'viewMenu'},{role:'windowMenu'}]):null);
  createWindow();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
 });
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}
