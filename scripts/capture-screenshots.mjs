import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve("public");
const output = resolve("docs/screenshots/generated");
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
    const body = await readFile(file);
    res.writeHead(200,{"content-type":types[extname(file)]||"application/octet-stream","cache-control":"no-store"});
    res.end(body);
  } catch {
    res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});
    res.end("Not found");
  }
});

await mkdir(output,{recursive:true});
await new Promise(resolveListen=>server.listen(port,"127.0.0.1",resolveListen));
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  page.on("pageerror", error => console.log("Dashboard page error:", error.message));
  const mark = async () => page.addStyleTag({content:watermarkCss});

  await page.goto("http://127.0.0.1:"+port+"/",{waitUntil:"domcontentloaded"});
  await mark();
  await page.waitForTimeout(500);
  await page.screenshot({path:output+"/landing.png",fullPage:true});
  await page.locator("[data-open-tab='documentation']").first().click();
  await page.waitForSelector("#docs-search");
  await mark();
  await page.screenshot({path:output+"/landing-documentation.png",fullPage:true});

  await page.goto("http://127.0.0.1:"+port+"/login.html",{waitUntil:"domcontentloaded"});
  await mark();
  await page.waitForTimeout(500);
  await page.screenshot({path:output+"/login.png",fullPage:true});

  await page.goto("http://127.0.0.1:"+port+"/dashboard.html",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#root main",{timeout:15000});
  await page.waitForFunction(()=>!document.querySelector("#root")?.textContent?.includes("Loading workspace"),null,{timeout:10000}).catch(()=>{});
  await mark();
  const views = [
    ["Inbox","inbox"],["Assistant","assistant"],["Automation","automation"],
    ["Templates","templates"],["Scheduled","scheduled"],["Sent","sent"],
    ["Outbox","outbox"],["Deleted","deleted"],["Settings","settings"]
  ];
  for (const [label,slug] of views) {
    const button=page.getByRole("button",{name:label,exact:true}).first();
    await button.click();
    await page.waitForTimeout(180);
    await page.screenshot({path:output+"/dashboard-"+slug+".png",fullPage:true});
  }

  await page.getByRole("button",{name:"Refresh workspace"}).click();
  await page.getByText("Workspace refreshed from the server.",{exact:true}).waitFor({timeout:5000});
  await page.screenshot({path:output+"/dashboard-refresh-verified.png",fullPage:true});

  await page.getByRole("button",{name:"Templates",exact:true}).first().click();
  await page.getByRole("button",{name:/New Template/}).first().click();
  await page.getByLabel("Name").fill("Preview template");
  await page.getByLabel("Subject").fill("A sample subject");
  await page.getByLabel("Body").fill("This is a synthetic template preview.");
  await page.getByRole("button",{name:"Save template"}).click();
  await page.getByRole("button",{name:"Preview",exact:true}).first().click();
  await page.screenshot({path:output+"/dashboard-template-preview.png",fullPage:true});

  await page.getByRole("button",{name:"Compose",exact:true}).first().click();
  await page.waitForSelector('textarea[aria-label="Message body"]');
  await page.screenshot({path:output+"/dashboard-compose.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+"/dashboard-compose-mobile.png",fullPage:true});
  // On narrow screens the sidebar is intentionally hidden behind the navigation drawer.
  // Open that drawer before selecting Inbox so the smoke test exercises the real mobile path.
  await page.getByRole("button",{name:"Show or hide navigation"}).click();
  await page.getByRole("navigation",{name:"LeadMaster navigation"}).getByRole("button",{name:"Inbox",exact:true}).click();
  await page.screenshot({path:output+"/dashboard-mobile-inbox.png",fullPage:true});
  console.log("Captured landing, login, production React workspace views, template preview and mobile layouts into "+output);
} finally {
  await browser.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}
