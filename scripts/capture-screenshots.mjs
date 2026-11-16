import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve("public");
const output = resolve("assets/screenshots");
const port = 4179;
const accountId = "acct_preview_account_00000001";
const apiBase = "https://leadmaster.jelvan.pro/api/v1/accounts/" + accountId;
const types = { ".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8",".webp":"image/webp" };
const watermarkCss = "body::after{content:'LOCAL UI PREVIEW · SYNTHETIC ACCOUNT';position:fixed;z-index:999999;right:18px;bottom:16px;padding:7px 10px;border-radius:6px;background:rgba(20,20,20,.86);color:#fff;font:600 10px/1.2 Arial,sans-serif;letter-spacing:.08em;pointer-events:none}";

const server = createServer(async (req,res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:"+port);
  if (url.pathname === "/api/workspace/actions" && req.method === "POST") {
    let raw="";for await (const chunk of req) raw+=chunk;
    let payload={};try{payload=JSON.parse(raw)}catch{}
    const data=payload.action==="records.create"?{id:"preview-record-"+Date.now()}:{records:[]};
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({data}));
  }
  if (url.pathname === "/api/auth/session") {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({authenticated:true,email:"preview-user@example.test",account:{id:accountId,name:"Preview workspace",api_base_url:apiBase,endpoints:{account:"/api/v1/accounts/"+accountId,emails:apiBase+"/emails",webhooks:apiBase+"/webhooks"}}}));
  }
  if (url.pathname === "/api/developer/keys" && req.method === "GET") {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({account:{id:accountId,api_base_url:apiBase},keys:[]}));
  }
  if (url.pathname.startsWith(apiBase+"/webhooks")) {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({webhooks:[],deliveries:[]}));
  }
  if (url.pathname === "/api/auth/config") {
    res.writeHead(503,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({error:"Human security verification is not connected in this local preview"}));
  }
  if (url.pathname === "/api/account/profile") {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({fullName:"Preview User"}));
  }
  if (url.pathname.startsWith("/api/admin/mail/")) {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    if (url.pathname.endsWith("/suggest")) return res.end(JSON.stringify({suggestion:"Thanks for your message. I will review the details and get back to you shortly."}));
    if (req.method==="PATCH") return res.end(JSON.stringify({ok:true}));
    return res.end(JSON.stringify({id:"preview-message",text_body:"Synthetic preview message body.",from_address:"preview@example.test",from_name:"Preview Contact",recipient:"preview-user@example.test",subject:"Preview message",status:"accepted",delivery_status:"delivered"}));
  }
  if (url.pathname === "/api/admin/mail" && req.method === "GET") {
    const folder = url.searchParams.get("folder") || "inbox";
    const counts = {inbox:0,sent:0,queued:0,unsuccessful:0,bounced:0,unsubscribed:0};
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify(folder === "counts" ? {counts,storage:true} : {items:[],counts,storage:true}));
  }
  if (url.pathname === "/api/admin/templates" && req.method === "GET") {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({templates:[]}));
  }
  if (url.pathname === "/api/admin/templates" && req.method === "POST") {
    let raw="";for await (const chunk of req) raw+=chunk;
    let payload={};try{payload=JSON.parse(raw)}catch{}
    res.writeHead(201,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({id:"preview-template",name:payload.name||"Preview template",updated_at:Date.now()}));
  }
  if (url.pathname === "/api/admin/templates/preview-template") {
    if (req.method === "GET") {
      res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
      return res.end(JSON.stringify({template:{id:"preview-template",name:"Preview template",subject:"A sample subject",text_body:"This is a synthetic template preview.",html_body:null,updated_at:Date.now()}}));
    }
    if (req.method === "PUT" || req.method === "DELETE") {
      res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
      return res.end(JSON.stringify({ok:true}));
    }
  }
  if (url.pathname === "/api/admin/activity" || url.pathname === "/api/admin/unsubscribes" || url.pathname === "/api/admin/webhooks") {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify(url.pathname.endsWith("/webhooks") ? {webhooks:[]} : {items:[],counts:{unsubscribed:0}}));
  }
  if (url.pathname === "/api/auth/logout" || url.pathname === "/api/admin/send" || url.pathname === "/api/admin/unsubscribes" || url.pathname === "/api/admin/webhooks") {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({ok:true,queued:1,status:"queued"}));
  }
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(404,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({error:"Preview route not implemented"}));
  }
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = resolve(root,rel);
  if (!(file === root || file.startsWith(root+sep))) {
    res.writeHead(403); return res.end("Forbidden");
  }
  try {
    // Match the production asset builder's canonical illustration sources.
    const referenceAssets = {
      'assets/illustrations/empty-mail.webp': resolve('design-references/illustrations/empty-mail.webp'),
      'assets/illustrations/empty-contacts.webp': resolve('design-references/illustrations/empty-contacts.webp')
    };
    const body = await readFile(referenceAssets[rel] || file);
    res.writeHead(200,{"content-type":types[extname(file)]||"application/octet-stream","cache-control":"no-store"});
    res.end(body);
  } catch {
    res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});
    res.end("Not found");
  }
});

await mkdir(output,{recursive:true});
await new Promise(resolveListen=>server.listen(port,"127.0.0.1",resolveListen));
const browser = await chromium.launch({headless:true,...(process.env.LOCAL_CHROMIUM ? {executablePath:process.env.LOCAL_CHROMIUM} : {}),args:["--no-sandbox"]});
try {
  for (const [device,viewport] of [["desktop",{width:1440,height:1000}],["mobile",{width:390,height:844}]]) {
    const page = await browser.newPage({viewport,deviceScaleFactor:1, reducedMotion:"reduce"});
    // Never contact a real service or load/execute the human sign-in challenge.
    await page.route("**/*", route => {
      const u = new URL(route.request().url());
      if (u.hostname !== "127.0.0.1" || u.port !== String(port)) return route.abort();
      if (u.pathname === "/login.js") return route.fulfill({status:200,contentType:"text/javascript",body:""});
      return route.continue();
    });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const mark = async () => page.addStyleTag({content:watermarkCss});
    const snap = async name => page.screenshot({path:`${output}/${name}-${device}.png`,fullPage:true,animations:"disabled"});
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:"domcontentloaded"});
    await mark();
    await page.waitForTimeout(300);
    await snap("landing");
    for (const tab of ["features","documentation","api","campaigns","integrations","status"]) {
      await page.locator(`#tab-${tab}`).click();
      await page.locator(`#panel-${tab}`).scrollIntoViewIfNeeded();
      await snap(`landing-${tab}`);
    }
    await page.goto(`http://127.0.0.1:${port}/login.html`,{waitUntil:"domcontentloaded"});
    await mark();
    await snap("login");
    // Present the existing OTP markup only. No credentials, OTP, authentication,
    // challenge response or verify endpoint is invoked by this local fixture.
    await page.evaluate(() => { document.querySelector("#login-step").hidden = true; document.querySelector("#otp-step").hidden = false; });
    await snap("verification-code");
    await page.goto(`http://127.0.0.1:${port}/dashboard.html`,{waitUntil:"domcontentloaded"});
    await page.waitForSelector("#root main",{timeout:15000});
    await page.waitForFunction(()=>!document.querySelector("#root")?.textContent?.includes("Loading workspace"),null,{timeout:10000});
    await mark();
    const views = [["Inbox","inbox"],["Compose","compose"],["Sent","sent"],["Outbox","outbox"],["Deleted","deleted"],["Assistant","assistant"],["Automation","automation"],["Templates","templates"],["Scheduled","scheduled"],["Settings","settings"]];
    for (const [label,slug] of views) {
      if (device === "mobile") await page.getByRole("button",{name:"Show or hide navigation"}).click();
      await page.getByRole("navigation",{name:"LeadMaster navigation"}).getByRole("button",{name:label,exact:true}).click();
      await page.waitForTimeout(200);
      await snap(`dashboard-${slug}`);
    }
    // Retain the existing refresh and template-preview smoke checks.
    if (device === "desktop") {
      await page.getByRole("button",{name:"Refresh workspace"}).click();
      await page.getByText("Refreshing and verifying workspace data…",{exact:true}).waitFor({state:"hidden",timeout:5000});
      await snap("dashboard-refresh-verified");
      await page.getByRole("navigation",{name:"LeadMaster navigation"}).getByRole("button",{name:"Templates",exact:true}).click();
      await page.getByRole("button",{name:/New Template/}).first().click();
      await page.getByLabel("Name").fill("Preview template");
      await page.getByLabel("Subject").fill("A sample subject");
      await page.getByLabel("Body").fill("This is a synthetic template preview.");
      await page.getByRole("button",{name:"Save template"}).click();
      await page.getByRole("button",{name:"Preview",exact:true}).first().click();
      await snap("dashboard-template-preview");
    }
    if (device === "mobile") await page.getByRole("button",{name:"Show or hide navigation"}).click();
    await page.getByRole("navigation",{name:"LeadMaster navigation"}).getByRole("button",{name:"Inbox",exact:true}).click();
    for (const tab of ["Primary","Promotions","Social","Updates","Forums"]) {
      await page.getByRole("button",{name:new RegExp(`^${tab}`)}).first().click();
      await snap(`inbox-${tab.toLowerCase()}`);
    }
    for (const app of ["notes","contacts","calendar","calculator","currency","email-html-playground"]) {
      await page.goto(`http://127.0.0.1:${port}/dashboard.html?app=${app}`,{waitUntil:"domcontentloaded"});
      await page.waitForSelector("#root",{timeout:15000});
      await page.waitForTimeout(300);
      await mark();
      await snap(`app-${app}`);
    }
    await page.goto(`http://127.0.0.1:${port}/help-center.html`,{waitUntil:"domcontentloaded"});
    await mark();
    await snap("help-center");
    await page.close();
    if (pageErrors.length) throw new Error(`Preview JavaScript errors (${device}): ${pageErrors.join("; ")}`);
  }
  console.log("Captured local presentation-only previews to "+output);
} finally {
  await browser.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}
