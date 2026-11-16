// Local synthetic dashboard only: no accounts, real messages, or network services.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public');let inbox=[],sent=[],failDelete=false,enabled=true;
const server=createServer(async(req,res)=>{
 const url=new URL(req.url||'/', 'http://localhost');
 if(url.pathname==='/api/workspace/actions'){
  let data='';for await(const chunk of req)data+=chunk;const b=JSON.parse(data);
  if(b.action==='records.replace'||b.action==='records.create'){if(typeof b.args?.value?.notifSound==='boolean')enabled=b.args.value.notifSound;}
  const records=b.args?.collection==='leadmaster_prefs'?[{id:'prefs',value:{notifSound:enabled}}]:[];
  res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({data:{records,id:'prefs'}}));
 }
 if(url.pathname==='/api/admin/mail'){
  const items=url.searchParams.get('folder')==='inbox'?inbox:url.searchParams.get('folder')==='sent'?sent:[];
  res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({items}));
 }
 if(url.pathname.startsWith('/api/admin/mail/')&&req.method==='PATCH'){
  res.writeHead(failDelete?503:200,{'content-type':'application/json'});
  if(!failDelete)inbox=[];
  return res.end(JSON.stringify(failDelete?{error:'unavailable'}:{ok:true}));
 }
 const file=resolve(root,url.pathname==='/'?'dashboard.html':url.pathname.slice(1));
 if(!file.startsWith(root+sep)){res.writeHead(403);return res.end()}
 try{const body=await readFile(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream'});res.end(body)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.LOCAL_CHROMIUM?{executablePath:process.env.LOCAL_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage();
 const waitForLoadingOverlayToFinish=()=>page.locator('section[aria-label="Loading status"],section[aria-label="Sending status"]').waitFor({state:'detached',timeout:5000});
 await page.addInitScript(()=>{
  window.__notes=[];
  window.AudioContext=class{constructor(){this.state='running';this.currentTime=0;this.destination={}} createOscillator(){return {frequency:{set value(v){window.__notes.push(v)}},connect(){},start(){},stop(){}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}close(){return Promise.resolve()}};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/dashboard.html`);
 await page.getByText('Nothing in Inbox').waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__notes),[],'initial snapshot silent');
 // User interaction unlocks browser audio; test server changes are synthetic.
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 inbox=[{id:'00000000-0000-4000-8000-000000000001',from_address:'sender@example.test',subject:'Synthetic incoming',received_at:Date.now()+10}];
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.getByText('Synthetic incoming').first().waitFor();
  await waitForLoadingOverlayToFinish();
 assert.deepEqual(await page.evaluate(()=>window.__notes),[660,880,1040],'new mail cue');
 sent=[{id:'00000000-0000-4000-8000-000000000002',recipient:'to@example.test',subject:'Test',status:'sending',queue_status:'queued',created_at:Date.now()+10}];
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 assert.equal((await page.evaluate(()=>window.__notes)).length,3,'queued does not play');
 sent[0]={...sent[0],status:'accepted',queue_status:'complete'};
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.waitForFunction(()=>window.__notes.length===5);
  await waitForLoadingOverlayToFinish();
 assert.deepEqual(await page.evaluate(()=>window.__notes.slice(-2)),[660,990],'accepted cue');
 await page.getByRole('checkbox',{name:'Select Synthetic incoming'}).check();
 await page.getByRole('button',{name:'Delete selected'}).click();
 failDelete=true;await page.getByRole('alertdialog').getByRole('button',{name:'Move to Deleted'}).click();
 await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>window.__notes)).length,5,'failed delete silent');
  await waitForLoadingOverlayToFinish();
  await page.reload();
  await page.getByText('Synthetic incoming').first().waitFor();
  await waitForLoadingOverlayToFinish();
  await page.getByRole('checkbox',{name:'Select Synthetic incoming'}).check();
 await page.getByRole('button',{name:'Delete selected'}).click();
 failDelete=false;await page.getByRole('alertdialog').getByRole('button',{name:'Move to Deleted'}).click();
 await page.waitForFunction(()=>window.__notes.length===2);
  await waitForLoadingOverlayToFinish();
 assert.deepEqual(await page.evaluate(()=>window.__notes.slice(-2)),[520,390],'confirmed delete cue');
 await page.getByRole('button',{name:'Open profile and settings'}).click();
 await page.getByRole('button',{name:'Profile, settings & configurations'}).click();
 await page.getByRole('checkbox',{name:/Sounds/}).uncheck();
 await page.waitForTimeout(100);
 await page.getByRole('navigation',{name:'LeadMASTER navigation'}).getByRole('button',{name:'Inbox',exact:true}).click();
 inbox=[{id:'00000000-0000-4000-8000-000000000003',from_address:'sender@example.test',subject:'Muted incoming',received_at:Date.now()+10}];
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.getByText('Muted incoming').first().waitFor();
 assert.equal((await page.evaluate(()=>window.__notes)).length,2,'muted setting suppresses sound');
 console.log('Synthetic dashboard audio: baseline, received, queued, accepted, failed and confirmed delete passed.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
