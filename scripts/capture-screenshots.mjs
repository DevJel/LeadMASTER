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
    // Keep screenshot automation deterministic: the static fixture has no
    // production API, so provide an isolated in-memory workspace API.
    const screenshotRecords = new Map([["leadmaster_templates", [{
      id: "fixture-template-1",
      value: {id: "fixture-template-1", name: "Screenshot template", subject: "A sample subject", body: "This is a synthetic template preview.", category: "Sales"}
    }]]]);
    let screenshotRecordId = 0;
    await page.route("**/api/workspace/actions", async route => {
      const request = route.request();
      let body = {};
      try { body = request.postDataJSON() || {}; } catch {}
      const action = body.action;
      const args = body.args || {};
      const collection = String(args.collection || "");
      if (!screenshotRecords.has(collection)) screenshotRecords.set(collection, []);
      const records = screenshotRecords.get(collection);
      let data = {};
      if (action === "records.list") {
        if (collection === "leadmaster_templates" && records.length === 0) {
          records.push({id:"screenshot-template-1",value:{id:"screenshot-template-1",name:"Screenshot template",subject:"Preview template",body:"This is a local screenshot fixture.",category:"General"}});
        }
        data = {records};
      }
      else if (action === "records.create") {
        const record = {id: "screenshot-record-" + (++screenshotRecordId), value: args.value || {}};
        records.unshift(record);
        data = {id: record.id};
      } else if (action === "records.replace") {
        const index = records.findIndex(item => item.id === args.id);
        if (index >= 0) records[index] = {id: args.id, value: args.value || {}};
        data = {id: args.id};
      } else if (action === "records.delete") {
        screenshotRecords.set(collection, records.filter(item => item.id !== args.id));
        data = {deleted: true};
      }
      await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({data})});
    });
    const deletedMailFixture = [{id:"deleted-fixture-1",from_address:"former-contact@example.test",from_name:"Former Contact",subject:"Synthetic deleted message",received_at:Date.now(),kind:"received"}];
    await page.route("**/api/admin/mail**", async route => {
      const request=route.request();
      const requestUrl=new URL(request.url());
      if(request.method()==="PATCH"){
        let payload={};try{payload=request.postDataJSON()||{}}catch{}
        if(payload.action==="permanentDelete"){
          const id=decodeURIComponent(requestUrl.pathname.split("/").pop()||"");
          const index=deletedMailFixture.findIndex(item=>item.id===id);
          if(index>=0)deletedMailFixture.splice(index,1);
        }
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});
      }
      const folder=requestUrl.searchParams.get("folder")||"inbox";
      const items=folder==="deleted"?deletedMailFixture:[];
      await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify({items, counts: {inbox: 0, archived: 0, sent: 0, queued: 0, deleted: deletedMailFixture.length, bounced: 0, unsuccessful: 0, unsubscribed: 0}})});
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
      if (device === "mobile") await page.getByRole("button",{name:"Open navigation"}).click();
      if (slug === "settings") {
        // Settings is intentionally opened from the profile menu; it is not a
        // primary sidebar item in the current dashboard information architecture.
        await page.getByRole("button",{name:"Open profile and settings"}).click();
        await page.getByRole("button",{name:"Profile, settings & configurations"}).click();
      } else {
        await page.getByRole("navigation",{name:"LeadMASTER navigation"}).getByRole("button",{name:label,exact:true}).click();
      }
      await page.waitForTimeout(200);
      await snap(`dashboard-${slug}`);
    }
    // Critical empty-navigation regression checks: empty folders must never render
    // a blank split pane, retain stale filters, or silently reopen a different utility.
    const clickPrimaryNav=async(label)=>{if(device==="mobile")await page.getByRole("button",{name:"Open navigation"}).click();await page.getByRole("navigation",{name:"LeadMASTER navigation"}).getByRole("button",{name:label,exact:true}).click();};
    await clickPrimaryNav("Deleted");
    await page.getByText("Synthetic deleted message",{exact:true}).waitFor({state:"visible",timeout:5000});
    await page.getByRole("button",{name:/Empty Trash/}).click();
    await page.getByRole("button",{name:"Empty Deleted folder",exact:true}).click();
    await page.getByRole("heading",{name:"Inbox is empty",exact:true}).waitFor({state:"visible",timeout:10000});
    if(await page.locator(".lm-mail-workspace").count())throw new Error("Empty Inbox rendered the split mail workspace.");
    await clickPrimaryNav("Deleted");
    await page.getByRole("heading",{name:"Deleted is empty",exact:true}).waitFor({state:"visible",timeout:5000});
    if(await page.locator(".lm-mail-workspace").count())throw new Error("Empty Deleted folder rendered a blank split pane.");
    await primaryNav.getByRole("button",{name:"Deleted",exact:true}).click();
    await page.getByRole("heading",{name:"Deleted is empty",exact:true}).waitFor({state:"visible",timeout:5000});
    const searchBox=page.getByRole("textbox",{name:"Search mail"});
    await searchBox.fill("no-such-message");
    await clickPrimaryNav("Sent");
    if(await searchBox.inputValue()!=="")throw new Error("Changing folders retained a stale search filter.");
    await page.getByRole("heading",{name:"Sent is empty",exact:true}).waitFor({state:"visible",timeout:5000});
    if(await page.locator(".lm-mail-workspace").count())throw new Error("Empty Sent folder rendered a blank split pane.");
    // An unknown app route must show an unavailable state, never default to Notes.
    await page.goto(`http://127.0.0.1:${port}/dashboard.html?app=unknown-feature`,{waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:"This section is unavailable",exact:true}).waitFor({state:"visible",timeout:10000});
    if(await page.getByRole("heading",{name:"Create or edit a note"}).count())throw new Error("Unknown utility route silently opened Notes.");
    await page.goto(`http://127.0.0.1:${port}/dashboard.html`,{waitUntil:"domcontentloaded"});
    await page.waitForSelector("#root main",{timeout:15000});
    await page.waitForFunction(()=>!document.querySelector("#root")?.textContent?.includes("Loading workspace"),null,{timeout:10000});
    await page.getByRole("navigation",{name:"LeadMASTER navigation"}).getByRole("button",{name:"Inbox",exact:true}).waitFor({state:"visible",timeout:5000});
    await snap("dashboard-empty-navigation-regression");
    // Retain the existing refresh and template-preview smoke checks.
    if (device === "desktop") {
      await page.getByRole("button",{name:"Refresh workspace"}).click();
      await page.getByText("Refreshing and verifying workspace data…",{exact:true}).waitFor({state:"hidden",timeout:5000});
      await snap("dashboard-refresh-verified");
      await page.getByRole("navigation",{name:"LeadMaster navigation"}).getByRole("button",{name:"Templates",exact:true}).click();
      const templateCard = page.locator("article").filter({hasText:"Screenshot template"});
      await templateCard.waitFor({state:"visible",timeout:10000});
      await templateCard.getByRole("button",{name:"Preview",exact:true}).click();
      await snap("dashboard-template-preview");
    }
    if (device === "mobile") await page.getByRole("button",{name:"Open navigation"}).click();
    await page.getByRole("navigation",{name:"LeadMaster navigation"}).getByRole("button",{name:"Inbox",exact:true}).click();
    // The current Inbox UI has no legacy category tabs; the main Inbox view was
    // already captured above, so do not wait for removed controls here.
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
