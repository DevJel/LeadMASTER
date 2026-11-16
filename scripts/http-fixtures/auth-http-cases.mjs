import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import worker from '../../worker.js';
const origin='https://synthetic.invalid', email='admin@example.test';
function setup(){const sql=new DatabaseSync(':memory:');sql.exec(`PRAGMA foreign_keys=ON;CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,email TEXT,created_at INTEGER,expires_at INTEGER,revoked_at INTEGER);CREATE TABLE auth_challenges(id TEXT PRIMARY KEY,email TEXT,code_hash TEXT,created_at INTEGER,expires_at INTEGER,attempts INTEGER);CREATE TABLE accounts(id TEXT PRIMARY KEY,name TEXT,owner_email TEXT UNIQUE,owner_name TEXT,created_at INTEGER,updated_at INTEGER);CREATE TABLE account_members(account_id TEXT,email TEXT,role TEXT,created_at INTEGER,UNIQUE(account_id,email));CREATE TABLE developer_api_keys(id TEXT,account_id TEXT,created_by TEXT);CREATE TABLE developer_email_requests(account_id TEXT,api_key_id TEXT);CREATE TABLE developer_webhooks(account_id TEXT,api_key_id TEXT);CREATE TABLE admin_sent_mail(id TEXT PRIMARY KEY);CREATE TABLE workspace_activity(id TEXT PRIMARY KEY,actor_email TEXT,action TEXT,summary TEXT,target_id TEXT,created_at INTEGER,details_json TEXT);`);sql.exec(readFileSync(new URL('../../migrations/0010_email_templates.sql',import.meta.url),'utf8'));sql.exec(readFileSync(new URL('../../migrations/0011_audience_groups.sql',import.meta.url),'utf8'));sql.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run('acct_synthetic','Test workspace',email,'Test',0,0);
 const db={prepare(q){let args=[];return {bind(...v){args=v;return this},async all(){return {results:sql.prepare(q).all(...args)}},async first(){return sql.prepare(q).get(...args)||null},async run(){return {meta:{changes:Number(sql.prepare(q).run(...args).changes)}}}}},async batch(stmts){sql.exec('BEGIN');try{let out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};const env={AUTH_DB:db,ADMIN_EMAIL:email,ADMIN_PASSWORD:'synthetic',SESSION_SECRET:'synthetic',TURNSTILE_SITE_KEY:'synthetic',TURNSTILE_SECRET:'synthetic',SES_SMTP_HOST:'synthetic',SES_SMTP_USERNAME:'synthetic',SES_SMTP_PASSWORD:'synthetic',SES_FROM_EMAIL:'sender@example.test'};return {sql,env}}
async function session(sql,token,{expires=Date.now()+60000,revoked=null}={}){const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?)').run(hash,email,Date.now(),expires,revoked)}
async function call(env,path,{token,method='GET',body,source=origin,ctx}={}){const headers={};if(token)headers.Cookie='lm_session='+token;if(body){headers['content-type']='application/json';headers.Origin=source}return worker.fetch(new Request(origin+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env,ctx)}
// Prevent any test from making network calls, including the upstream fallback.
globalThis.fetch=async()=>new Response('SYNTHETIC UPSTREAM',{status:404});
test('dashboard aliases and listed supporting assets redirect without a session',async()=>{const {env}=setup();for(const p of ['/dashboard','/dashboard.html','/Dashboard.HTML','/%64ashboard.html','/dashboard.html/','/dashboard/nested','/dashboard.css','/dashboard.js','/developer-api-keys.html','/html-preview.js','/html-preview.css','/assets/vendor/dompurify.min.js']){let r=await call(env,p);assert.equal(r.status,302,p);assert.equal(new URL(r.headers.get('location')).pathname,'/login',p);assert.ok(!(await r.text()).includes('SYNTHETIC DASHBOARD'),p)}});
test('legacy HTML page URLs redirect to clean canonical URLs and preserve query parameters',async()=>{const {env,sql}=setup();await session(sql,'live');let r=await call(env,'/dashboard.html?app=notes',{token:'live'});assert.equal(r.status,308);let target=new URL(r.headers.get('location'));assert.equal(target.pathname,'/dashboard');assert.equal(target.search,'?app=notes');r=await call(env,'/login.html?next=%2Fdashboard');assert.equal(r.status,308);target=new URL(r.headers.get('location'));assert.equal(target.pathname,'/login');assert.equal(target.search,'?next=%2Fdashboard');r=await call(env,'/help-center.html?code=LM-USR-1002');assert.equal(r.status,308);target=new URL(r.headers.get('location'));assert.equal(target.pathname,'/help-center');assert.equal(target.search,'?code=LM-USR-1002');});
test('expired and revoked sessions cannot load the dashboard or audience',async()=>{const {env,sql}=setup();await session(sql,'expired',{expires:Date.now()-1});await session(sql,'revoked',{revoked:Date.now()});for(const token of ['expired','revoked','unknown']){assert.equal((await call(env,'/dashboard',{token})).status,302);assert.equal((await call(env,'/api/admin/audience/groups',{token})).status,401)}});
test('authenticated requests traverse Worker session gate and persist groups and templates',async()=>{const {env,sql}=setup();await session(sql,'live');let r=await call(env,'/dashboard',{token:'live'});assert.equal(r.status,200);assert.equal(await r.text(),'SYNTHETIC DASHBOARD');r=await call(env,'/api/admin/audience/groups',{token:'live',method:'POST',body:{name:'Customers'}});assert.equal(r.status,201);const id=(await r.json()).id;r=await call(env,`/api/admin/audience/groups/${id}/members`,{token:'live',method:'POST',body:{emails:['one@example.test','ONE@example.test','two@example.test']}});assert.equal(r.status,200);assert.equal((await r.json()).added,2);r=await call(env,`/api/admin/audience/groups/${id}`,{token:'live'});assert.deepEqual((await r.json()).emails,['one@example.test','two@example.test']);r=await call(env,'/api/admin/templates',{token:'live',method:'POST',body:{name:'Welcome',subject:'Hello',text:'Hello',html:'<b>Hello</b>'}});assert.equal(r.status,201);r=await call(env,'/api/admin/templates',{token:'live'});assert.equal((await r.json()).templates.length,1)});
test('audience and template writes reject cross-origin and invalid sessions',async()=>{const {env,sql}=setup();await session(sql,'live');for(const [path,body] of [['/api/admin/audience/groups',{name:'X'}],['/api/admin/templates',{name:'X',subject:'x',text:'x'}]]){assert.equal((await call(env,path,{method:'POST',body})).status,401);assert.equal((await call(env,path,{token:'live',method:'POST',body,source:'https://evil.invalid'})).status,403)}});
test('existing admin routes return 401 without a session',async()=>{const {env}=setup();for(const p of ['/api/admin/mail','/api/admin/send','/api/admin/activity','/api/admin/notifications','/api/admin/unsubscribes','/api/account/profile','/api/admin/mail/00000000-0000-0000-0000-000000000000/suggest'])assert.equal((await call(env,p)).status,401,p)});

test('non-admin session is forbidden on protected admin routes',async()=>{const {env,sql}=setup();await session(sql,'live');env.ADMIN_EMAIL='other@example.test';for(const p of ['/api/admin/mail','/api/admin/send','/api/admin/activity','/api/admin/notifications','/api/admin/unsubscribes','/api/account/profile','/api/admin/mail/00000000-0000-0000-0000-000000000000/suggest'])assert.equal((await call(env,p,{token:'live'})).status,403,p)});
test('batch progress traverses real Worker authorization and uses the session owner',async()=>{const {env,sql}=setup();sql.exec("CREATE TABLE mail_send_batches(id TEXT PRIMARY KEY,created_by TEXT,total_count INTEGER,created_at INTEGER,status TEXT);ALTER TABLE admin_sent_mail ADD COLUMN batch_id TEXT;ALTER TABLE admin_sent_mail ADD COLUMN status TEXT;ALTER TABLE admin_sent_mail ADD COLUMN delivery_status TEXT;CREATE INDEX idx_admin_sent_mail_batch_id ON admin_sent_mail(batch_id);INSERT INTO mail_send_batches VALUES('b','admin@example.test',2,0,'queued');INSERT INTO admin_sent_mail(id,batch_id,status) VALUES('m','b','accepted')");assert.equal((await call(env,'/api/admin/send-batches')).status,401);await session(sql,'live');const r=await call(env,'/api/admin/send-batches',{token:'live'});assert.equal(r.status,200);const b=(await r.json()).batches[0];assert.equal(b.accepted,1);assert.equal(b.unaccounted,1);env.ADMIN_EMAIL='someone@example.test';assert.equal((await call(env,'/api/admin/send-batches',{token:'live'})).status,403)});

async function seedOtp(sql,code='123456'){
 const id='challenge-otp',now=Date.now(),secret='synthetic';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const raw=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('otp:'+id+':'+code));
 const hash=Array.from(new Uint8Array(raw),b=>b.toString(16).padStart(2,'0')).join('');
 sql.prepare('INSERT INTO auth_challenges VALUES(?,?,?,?,?,0)').run(id,email,hash,now,now+600000);
}
test('valid OTP atomically creates the session and returns its cookie before background work',async()=>{
 const {env,sql}=setup();await seedOtp(sql);
 const background=[];const ctx={waitUntil(p){background.push(p)}};
 const r=await call(env,'/api/auth/verify',{method:'POST',body:{code:'123456'},ctx});
 assert.equal(r.status,200);assert.equal((await r.json()).authenticated,true);
 const cookie=r.headers.get('set-cookie')||'';assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 const token=cookie.match(/lm_session=([^;]+)/)?.[1];assert.ok(token);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_challenges').get().n,0);
 assert.equal((await call(env,'/dashboard',{token})).status,200);
 await Promise.allSettled(background);
});
test('OTP verification falls back to a one-time D1 claim when batch commits are unavailable',async()=>{
 const {env,sql}=setup();await seedOtp(sql);
 env.AUTH_DB.batch=async()=>{throw new Error('synthetic D1 batch unavailable')};
 const background=[];const ctx={waitUntil(p){background.push(p)}};
 const r=await call(env,'/api/auth/verify',{method:'POST',body:{code:'123456'},ctx});
 assert.equal(r.status,200);assert.equal((await r.json()).authenticated,true);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_challenges').get().n,0);
 await Promise.allSettled(background);
});
test('failed session persistence rolls back OTP consumption so the valid code is not stranded',async()=>{
 const {env,sql}=setup();await seedOtp(sql);
 sql.exec("CREATE TRIGGER fail_auth_session BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(ABORT,'synthetic session write failure'); END");
 const r=await call(env,'/api/auth/verify',{method:'POST',body:{code:'123456'},ctx:{waitUntil(){}}});
 assert.equal(r.status,503);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_challenges').get().n,1);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n,0);
});
test('explicit logout revokes the persistent session and clears its cookie',async()=>{const {env,sql}=setup();await session(sql,'persistent');const r=await call(env,'/api/auth/logout',{token:'persistent',method:'POST',body:{}});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie')||'',/Max-Age=0/);assert.equal((await call(env,'/api/admin/mail',{token:'persistent'})).status,401);const row=sql.prepare('SELECT revoked_at FROM auth_sessions').get();assert.ok(row.revoked_at)});

test('session restore renews the persistent server session and HttpOnly cookie',async()=>{const {env,sql}=setup();await session(sql,'remember-me');const before=sql.prepare('SELECT expires_at FROM auth_sessions').get().expires_at;const r=await call(env,'/api/auth/session',{token:'remember-me'});assert.equal(r.status,200);const body=await r.json();assert.equal(body.authenticated,true);const after=sql.prepare('SELECT expires_at FROM auth_sessions').get().expires_at;assert.ok(after>before+1000*60*60*24*179);assert.match(r.headers.get('set-cookie')||'',/Max-Age=15552000/);assert.match(r.headers.get('set-cookie')||'',/HttpOnly; Secure; SameSite=Strict/)});

test('a generated verification code is identical in delivery and accepted by the real verification route',async()=>{
 const {env,sql}=setup();const delivered=[];const originalFetch=globalThis.fetch;
 const {EmailDispatchCore}=await import('../../src/email-queue-core.mjs');
 class Storage{constructor(){this.data=new Map()}async get(k){return this.data.get(k)}async put(k,v){this.data.set(k,v)}async transaction(fn){return fn(this)}}
 const core=new EmailDispatchCore({storage:new Storage(),send:async job=>{delivered.push(job);return {status:'accepted'}}});
 env.EMAIL_COORDINATOR={idFromName:()=> 'synthetic',get:()=>({fetch:async(_url,init)=>{try{return Response.json(await core.dispatch(JSON.parse(init.body)))}catch{return Response.json({status:'invalid_request'},{status:400})}}})};
 // This synthetic fixture does not contact, open, or solve a real human challenge.
 globalThis.fetch=async url=>String(url)==='https://challenges.cloudflare.com/turnstile/v0/siteverify'?Response.json({success:true,hostname:'leadmaster.jelvan.space',action:'login'}):new Response('SYNTHETIC UPSTREAM',{status:404});
 try{
  const start=await call(env,'/api/auth/login',{method:'POST',body:{identity:email,password:'synthetic',turnstileToken:'synthetic'}});
  assert.equal(start.status,200);assert.equal((await start.json()).next,'verify_email');assert.equal(delivered.length,1);
  const match=delivered[0].text.match(/verification code is (\d{6})\./);assert.ok(match);const code=match[1];
  assert.ok(delivered[0].html.includes('>'+code+'</div>'));assert.ok(delivered[0].html.includes('>'+code+'</strong>'));
  assert.notEqual(sql.prepare('SELECT code_hash FROM auth_challenges').get().code_hash,code);
  // Once delivery occurred, verification must not require sender or password bindings.
  for(const k of ['SES_SMTP_HOST','SES_SMTP_USERNAME','SES_SMTP_PASSWORD','SES_FROM_EMAIL','ADMIN_PASSWORD','TURNSTILE_SITE_KEY','TURNSTILE_SECRET'])delete env[k];
  const background=[];const result=await call(env,'/api/auth/verify',{method:'POST',body:{code},ctx:{waitUntil(p){background.push(p)}}});
  assert.equal(result.status,200);assert.equal((await result.json()).authenticated,true);
  const token=(result.headers.get('set-cookie')||'').match(/lm_session=([^;]+)/)?.[1];assert.ok(token);
  assert.equal((await call(env,'/dashboard',{token})).status,200);
  assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code}})).status,401);
  await Promise.allSettled(background);
 }finally{globalThis.fetch=originalFetch}
});

test('an unconfirmed fallback write keeps the code claimed and cannot reset attempts',async()=>{
 const {env,sql}=setup();await seedOtp(sql);sql.exec('UPDATE auth_challenges SET attempts=4');
 env.AUTH_DB.batch=async()=>{throw Error('synthetic batch failure')};
 sql.exec("CREATE TRIGGER fail_auth_session BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(ABORT,'synthetic session write failure'); END");
 assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code:'123456'}})).status,503);
 assert.equal(sql.prepare('SELECT attempts FROM auth_challenges').get().attempts,9);
 assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code:'000000'}})).status,429);
 assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code:'123456'}})).status,429);
});

test('leading-zero code is accepted once, while expired and incorrect codes are rejected',async()=>{
 const {env,sql}=setup();await seedOtp(sql,'012345');
 const invalid=await call(env,'/api/auth/verify',{method:'POST',body:{code:'012346'}});assert.equal(invalid.status,401);
 assert.equal(sql.prepare('SELECT attempts FROM auth_challenges').get().attempts,1);
 assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code:'012345'}})).status,200);
 assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code:'012345'}})).status,401);
 await seedOtp(sql,'000001');sql.exec('UPDATE auth_challenges SET expires_at=0');
 assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code:'000001'}})).status,401);
});

test('verification fails closed when required authentication dependencies are absent',async()=>{
 for(const key of ['AUTH_DB','ADMIN_EMAIL','SESSION_SECRET']){const {env}=setup();delete env[key];const r=await call(env,'/api/auth/verify',{method:'POST',body:{code:'123456'}});assert.equal(r.status,503,key)}
});

test('a fallback write with a lost response cannot replay an already committed session',async()=>{
 const {env,sql}=setup();await seedOtp(sql);env.AUTH_DB.batch=async()=>{throw Error('synthetic batch failure')};
 const prepare=env.AUTH_DB.prepare.bind(env.AUTH_DB);
 env.AUTH_DB.prepare=query=>{const stmt=prepare(query);if(!query.startsWith('INSERT INTO auth_sessions'))return stmt;const bind=stmt.bind.bind(stmt);stmt.bind=(...params)=>{bind(...params);const run=stmt.run.bind(stmt);stmt.run=async()=>{await run();throw Error('synthetic lost response')};return stmt};return stmt};
 assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code:'123456'}})).status,503);
 assert.equal(sql.prepare('SELECT count(*) n FROM auth_sessions').get().n,1);
 assert.equal((await call(env,'/api/auth/verify',{method:'POST',body:{code:'123456'}})).status,429);
 assert.equal(sql.prepare('SELECT count(*) n FROM auth_sessions').get().n,1);
});
