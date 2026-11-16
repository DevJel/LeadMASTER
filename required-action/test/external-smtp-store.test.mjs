import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {createSmtpConnection,listSmtpConnections,replaceSmtpConnection,revokeSmtpConnection} from '../src/external-smtp-store.mjs';import {decryptSmtpCredentials} from '../src/external-smtp-config.mjs';
const accountId='acct_'+'A'.repeat(22),other='acct_'+'B'.repeat(22),key=Buffer.alloc(32,3).toString('base64');
const config={name:'Sales',email:'sender@example.com',server:'smtp.example.com',username:'private-user',password:'private-password'};
function setup(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0017_external_smtp_connections.sql',import.meta.url),'utf8'));const db={prepare(q){let a=[];return{bind(...v){a=v;return this},async all(){return {results:sql.prepare(q).all(...a)}},async run(){return {meta:{changes:Number(sql.prepare(q).run(...a).changes)}}}}}};return {sql,db}}
const args=(extra={})=>({accountId,config,at:10,encryptionKey:key,keyVersion:'key-v1',...extra});
test('stores encrypted credentials while returning only account-scoped public fields',async()=>{
 const {sql,db}=setup(),created=await createSmtpConnection(db,args());assert.equal(created.verification_status,'unverified');
 const raw=sql.prepare('SELECT * FROM external_smtp_connections').get();assert.ok(!JSON.stringify(raw).includes(config.password));assert.ok(!JSON.stringify(raw).includes(config.username));
 assert.deepEqual(await decryptSmtpCredentials(JSON.parse(raw.credential_envelope),key,accountId,created.id),{username:config.username,password:config.password});
 const list=await listSmtpConnections(db,{accountId});assert.equal(list.length,1);assert.ok(!JSON.stringify(list).includes('credential'));assert.ok(!JSON.stringify(list).includes(config.username));assert.deepEqual(await listSmtpConnections(db,{accountId:other}),[]);
});
test('rejects cross-account and stale writes and invalidates verification on edits',async()=>{
 const {sql,db}=setup(),{id}=await createSmtpConnection(db,args());sql.prepare("UPDATE external_smtp_connections SET verification_status='verified' WHERE id=?").run(id);
 assert.equal(await replaceSmtpConnection(db,args({accountId:other,id,revision:1,at:20})),false);
 assert.equal(await replaceSmtpConnection(db,args({id,revision:2,at:20})),false);
 assert.equal(await replaceSmtpConnection(db,args({id,revision:1,at:20,config:{...config,name:'Updated'}})),true);
 const row=(await listSmtpConnections(db,{accountId}))[0];assert.equal(row.name,'Updated');assert.equal(row.revision,2);assert.equal(row.verification_status,'unverified');
 assert.equal(await revokeSmtpConnection(db,{accountId:other,id,revision:2,at:21}),false);
 assert.equal(await revokeSmtpConnection(db,{accountId,id,revision:1,at:21}),false);
 assert.equal(await revokeSmtpConnection(db,{accountId,id,revision:2,at:21}),true);assert.deepEqual(await listSmtpConnections(db,{accountId}),[]);
});
test('rejects invalid settings and missing encryption keys without writing a row',async()=>{
 const {db,sql}=setup();await assert.rejects(createSmtpConnection(db,args({encryptionKey:''})));await assert.rejects(createSmtpConnection(db,args({config:{...config,server:'localhost'}})));await assert.rejects(createSmtpConnection(db,args({keyVersion:''})));assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM external_smtp_connections').get().n,0);
});
test('enforces per-account connection limits without blocking another account',async()=>{
 const {db}=setup();for(let i=0;i<100;i++)assert.ok(await createSmtpConnection(db,args({at:i})));
 assert.equal(await createSmtpConnection(db,args({at:101})),null);
 assert.ok(await createSmtpConnection(db,args({accountId:other,at:101})));
});
