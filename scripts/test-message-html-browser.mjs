// Synthetic local preview. No real account, remote message, or outbound send.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'), id='12345678-1234-1234-1234-123456789abc';
const inboundId='12345678-1234-1234-1234-123456789abb';
let trackerHits=0;
const payload=base=>`<h2 style="color:rgb(42, 42, 42)">Example email</h2><p>Styled content</p><script>parent.document.body.dataset.compromised="yes"</script><img src="${base}/tracker" onerror="parent.document.body.dataset.compromised=1"><a href="${base}/tracker">Link</a>`;
let failed=true;
const server=createServer(async(req,res)=>{
 const u=new URL(req.url||'/', 'http://localhost');
 if(u.pathname==='/tracker'){trackerHits++;res.writeHead(204);return res.end()}
 if(u.pathname.startsWith('/api/')){
  let value={}; let status=200;
  if(u.pathname==='/api/workspace/actions')value={data:{records:[]}};
  else if(u.pathname==='/api/admin/mail')value={items:u.searchParams.get('folder')==='sent'?[{id,recipient:'person@example.test',subject:'Example message',status:'accepted',queue_status:'complete',created_at:1700000000000},{id:'12345678-1234-1234-1234-123456789abd',recipient:'a@example.test',subject:'Unknown outcome',status:'unknown',queue_status:'complete',created_at:1700000000000},{id:'12345678-1234-1234-1234-123456789abe',recipient:'b@example.test',subject:'Failed message',status:'failed',queue_status:'complete',created_at:1700000000000},{id:'12345678-1234-1234-1234-123456789abf',recipient:'c@example.test',subject:'Queued message',status:'sending',queue_status:'queued',created_at:1700000000000}]:u.searchParams.get('folder')==='inbox'?[{id:inboundId,from_address:'sender@example.test',subject:'Incoming example',received_at:1700000000000,read_at:1,size_bytes:100}]:[]};
  else if(u.pathname===`/api/admin/mail/${inboundId}` && req.method==='GET')value={id:inboundId,from_address:'sender@example.test',text_body:'Incoming plain version',attachments:1,download_url:`/api/admin/mail/${inboundId}/source`};
  else if(u.pathname===`/api/admin/mail/${id}` && req.method==='GET'){
   if(failed){failed=false;status=503;value={error:'unavailable'}}else value={id,sender:'sender@example.test',text_body:'Plain version',html_body:payload(`http://127.0.0.1:${server.address().port}`)};
  }
  res.writeHead(status,{'content-type':'application/json'});return res.end(JSON.stringify(value));
 }
 let rel=u.pathname==='/'?'dashboard.html':u.pathname.slice(1);let file=resolve(root,rel);
 if(!file.startsWith(root+sep)){res.writeHead(403);return res.end()}
 try{let data=await readFile(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream'});res.end(data)}catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.LOCAL_CHROMIUM?{executablePath:process.env.LOCAL_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.addInitScript(()=>Object.defineProperty(document,'visibilityState',{get:()=> 'hidden'}));
 await page.goto(`http://127.0.0.1:${server.address().port}/dashboard.html`);
 await page.getByRole('button',{name:'Sent',exact:true}).first().click();
 await page.getByText('Example message',{exact:true}).first().click();
 await page.getByText('Could not load this message.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Try again',exact:true}).click();
 await page.getByText('Plain version',{exact:true}).waitFor();
 assert.equal(await page.getByText('Could not load this message.',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Open full message',exact:true}).click();
 await page.locator('article').waitFor();
 assert.ok((await page.locator('article').innerText()).toLowerCase().includes('to person@example.test'));
 assert.ok((await page.locator('article').innerText()).includes('sender@example.test'));
 await page.getByRole('button',{name:'HTML',exact:true}).click();
 const iframe=page.locator('iframe[title="HTML email preview"]');await iframe.waitFor();
 assert.equal(await iframe.getAttribute('sandbox'),'');
 const frame=page.frameLocator('iframe[title="HTML email preview"]');
 await frame.getByText('Styled content').waitFor();
 assert.equal(await frame.locator('script').count(),0);
 assert.equal(await frame.locator('a').getAttribute('href'),null);
 await page.waitForTimeout(250);
 assert.equal(await page.locator('body').getAttribute('data-compromised'),null);
 assert.equal(trackerHits,0,'tracking content must not reach the server');
 await mkdir('docs/screenshots/generated',{recursive:true});
 await page.addStyleTag({content:'body::after{content:"LOCAL UI PREVIEW · SYNTHETIC MESSAGE";position:fixed;z-index:999999;bottom:12px;right:12px;background:#222;color:#fff;font:600 10px Arial;padding:8px;border-radius:5px}'});
 await page.screenshot({path:'docs/screenshots/generated/html-message-desktop.png'});
 await page.setViewportSize({width:390,height:1000});
 await page.screenshot({path:'docs/screenshots/generated/html-message-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>{window.DOMPurify=undefined});
 await page.getByRole('button',{name:'Text',exact:true}).click();
 await page.getByRole('button',{name:'HTML',exact:true}).click();
 await page.getByText('HTML preview is unavailable. Use the text view instead.').waitFor();
 assert.equal(await page.locator('iframe[title="HTML email preview"]').count(),0);
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:/^Outbox/ }).first().click();
 for(const label of ['Unknown outcome','Failed message','Queued message','Unknown','Failed','Queued'])assert.ok(await page.getByText(label,{exact:true}).first().isVisible(),label);
 assert.equal(await page.getByRole('button',{name:'Resend',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Send All Now',exact:true}).count(),0);
 assert.ok(await page.getByText('Unknown outcomes must be reconciled to avoid duplicate sends; queued messages are processed automatically.',{exact:false}).isVisible());
 await page.screenshot({path:'docs/screenshots/generated/outbox-safety-desktop.png'});
 await page.setViewportSize({width:390,height:1000});
 await page.screenshot({path:'docs/screenshots/generated/outbox-safety-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Inbox',exact:true}).first().click();
 await page.getByText('Incoming example',{exact:true}).first().click();
 await page.getByRole('button',{name:'Text',exact:true}).click();
 await page.getByText('Incoming plain version',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Download original message (.eml)'}).getAttribute('href'),`/api/admin/mail/${inboundId}/source`);
 assert.equal(await page.getByText('attachment.pdf',{exact:true}).count(),0);
 await page.screenshot({path:'docs/screenshots/generated/inbox-original-desktop.png'});
 await page.setViewportSize({width:390,height:1000});
 await page.screenshot({path:'docs/screenshots/generated/inbox-original-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('Synthetic browser: error/retry, HTML sandbox, script and remote blocking, desktop and mobile passed.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
