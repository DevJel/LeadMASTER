import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve("public");
const output = resolve("docs/screenshots/generated");
const port = 4179;
const accountId = "acct_preview_account_00000001";
const apiBase = "https://leadmaster.jelvan.pro/api/v1/accounts/" + accountId;
const types = { ".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".txt":"text/plain; charset=utf-8" };
const watermarkCss = "body::after{content:'LOCAL UI PREVIEW · SYNTHETIC ACCOUNT';position:fixed;z-index:999999;right:18px;bottom:16px;padding:7px 10px;border-radius:6px;background:rgba(20,20,20,.86);color:#fff;font:600 10px/1.2 Arial,sans-serif;letter-spacing:.08em;pointer-events:none}";

const server = createServer(async (req,res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:"+port);
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
  await page.waitForSelector("#root .app-shell",{timeout:15000});
  await mark();
  const sections = [
    ["Homepage","home"],["Emails","emails"],["Templates","templates"],["Audience","audience"],
    ["Inboxes","inboxes"],["Broadcasts","broadcasts"],["Automations","automations"],["Metrics","metrics"],
    ["Domains","domains"],["Logs","logs"],["API keys","api"],["Webhooks","webhooks"],
    ["Settings","settings"],["Help","help"],["Appearance","appearance"],["Onboarding","onboarding"],["Profile","profile"]
  ];
  for (const [label,slug] of sections) {
    const tab = page.locator(".tab-link").filter({hasText:label}).first();
    await tab.click();
    await page.waitForFunction(value => document.querySelector(".tab-link.active")?.textContent?.trim().startsWith(value),label,{timeout:10000});
    await page.screenshot({path:output+"/dashboard-"+slug+".png",fullPage:true});
  }
  await page.locator(".tab-link").filter({hasText:"Emails"}).first().click();
  await page.getByRole("button",{name:"HTML preview"}).first().click();
  await page.waitForFunction(()=>document.getElementById("html-preview") && !document.getElementById("html-preview").hidden,null,{timeout:5000});
  await page.screenshot({path:output+"/dashboard-email-html-preview.png",fullPage:true});
  await page.locator("#preview-close").click();
  await page.locator(".tab-link").filter({hasText:"Templates"}).first().click();
  await page.getByRole("button",{name:"HTML preview"}).first().click();
  await page.waitForFunction(()=>document.getElementById("html-preview") && !document.getElementById("html-preview").hidden,null,{timeout:5000});
  await page.screenshot({path:output+"/dashboard-template-html-preview.png",fullPage:true});
  await page.locator("#preview-close").click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+"/dashboard-mobile-home.png",fullPage:true});
  for (const [label,slug] of [["Audience","audience"],["Profile","profile"]]) {
    await page.locator(".bottom-tab").filter({hasText:label}).first().click();
    await page.waitForTimeout(300);
    await page.screenshot({path:output+"/dashboard-mobile-"+slug+".png",fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("http://127.0.0.1:"+port+"/developer-api-keys.html",{waitUntil:"domcontentloaded"});
  await mark();
  await page.waitForFunction(()=>document.querySelector("#account-api-base")?.textContent?.startsWith("https://"),null,{timeout:5000});
  await page.screenshot({path:output+"/dashboard-api-keys.png",fullPage:true});
  console.log("Captured landing, login, all dashboard sections, email/template HTML previews, mobile views and API Keys UI into "+output);
} finally {
  await browser.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}
