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

  await page.goto("http://127.0.0.1:"+port+"/dashboard.html#overview",{waitUntil:"domcontentloaded"});
  await mark();
  await page.waitForFunction(()=>document.querySelector("#workspace-name")?.textContent==="Preview workspace",null,{timeout:5000});
  for (const section of ["overview","emails","logs","broadcasts","audiences","templates","domains","webhooks","settings"]) {
    await page.goto("http://127.0.0.1:"+port+"/dashboard.html#"+section,{waitUntil:"domcontentloaded"});
    await mark();
    await page.waitForFunction(value=>document.querySelector("#section-title")?.textContent?.toLowerCase()===value,section,{timeout:5000});
    await page.screenshot({path:output+"/dashboard-"+section+".png",fullPage:true});
  }

  await page.goto("http://127.0.0.1:"+port+"/developer-api-keys.html",{waitUntil:"domcontentloaded"});
  await mark();
  await page.waitForFunction(()=>document.querySelector("#account-api-base")?.textContent?.startsWith("https://"),null,{timeout:5000});
  await page.screenshot({path:output+"/dashboard-api-keys.png",fullPage:true});
  console.log("Captured landing, login, nine dashboard sections and API Keys UI into "+output);
} finally {
  await browser.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}
