import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { permanentlyDeleteInbound, restoreInbound } from '../src/inbound-deletion.mjs';

function fixture(deletedAt = 42) {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE inbound_mail (id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, deleted_at INTEGER, deletion_pending INTEGER NOT NULL DEFAULT 0)');
  sql.prepare('INSERT INTO inbound_mail(id,r2_key,deleted_at) VALUES (?,?,?)').run('one','file-key',deletedAt);
  let failDbDelete = false, failObject = false; const objectCalls=[];
  const db = { prepare(query) { return { bind(...args) { return {
    async first() { return sql.prepare(query).get(...args) ?? null; },
    async run() { if(failDbDelete && query.startsWith('DELETE')) throw Error('db failed'); const r=sql.prepare(query).run(...args); return {meta:{changes:Number(r.changes)}}; }
  }; } }; } };
  const bucket={async delete(key){objectCalls.push(key);if(failObject)throw Error('storage failed')}};
  return {db,bucket,sql,objectCalls,setFailObject:v=>failObject=v,setFailDbDelete:v=>failDbDelete=v};
}
test('active inbound mail cannot have its original removed',async()=>{
 const f=fixture(null); assert.deepEqual(await permanentlyDeleteInbound(f.db,f.bucket,'one'),{deleted:false,reason:'not_deleted'});
 assert.deepEqual(f.objectCalls,[]); assert.ok(f.sql.prepare('SELECT * FROM inbound_mail').get());
});
test('only soft-deleted inbound mail is removed from both stores',async()=>{
 const f=fixture(); assert.deepEqual(await permanentlyDeleteInbound(f.db,f.bucket,'one'),{deleted:true});
 assert.deepEqual(f.objectCalls,['file-key']); assert.equal(f.sql.prepare('SELECT * FROM inbound_mail').get(),undefined);
});
test('failed object delete blocks restore and can be retried',async()=>{
 const f=fixture(); f.setFailObject(true); assert.equal((await permanentlyDeleteInbound(f.db,f.bucket,'one')).reason,'retry');
 assert.equal(await restoreInbound(f.db,'one'),false); assert.equal(f.sql.prepare('SELECT deletion_pending FROM inbound_mail').get().deletion_pending,1);
 f.setFailObject(false); assert.equal((await permanentlyDeleteInbound(f.db,f.bucket,'one')).deleted,true);
});
test('failed D1 cleanup remains claimed even when object may be gone',async()=>{
 const f=fixture(); f.setFailDbDelete(true); assert.equal((await permanentlyDeleteInbound(f.db,f.bucket,'one')).reason,'retry');
 assert.equal(await restoreInbound(f.db,'one'),false); f.setFailDbDelete(false);
 assert.equal((await permanentlyDeleteInbound(f.db,f.bucket,'one')).deleted,true); assert.equal(f.objectCalls.length,2);
});
test('restored mail cannot subsequently be claimed for permanent delete',async()=>{
 const f=fixture(); assert.equal(await restoreInbound(f.db,'one'),true);
 assert.equal((await permanentlyDeleteInbound(f.db,f.bucket,'one')).reason,'not_deleted'); assert.deepEqual(f.objectCalls,[]);
});
test('a missing row is rejected without touching storage',async()=>{
 const f=fixture(); assert.equal((await permanentlyDeleteInbound(f.db,f.bucket,'missing')).reason,'not_deleted'); assert.deepEqual(f.objectCalls,[]);
});
test('restore racing a claimed deletion is refused until cleanup',async()=>{
 const f=fixture(); let release, entered;
 const started=new Promise(resolve=>{entered=resolve}); const wait=new Promise(resolve=>{release=resolve});
 f.bucket.delete=async key=>{f.objectCalls.push(key);entered();await wait;};
 const deleting=permanentlyDeleteInbound(f.db,f.bucket,'one');
 await started; assert.equal(await restoreInbound(f.db,'one'),false); release();
 assert.equal((await deleting).deleted,true); assert.equal(f.sql.prepare('SELECT * FROM inbound_mail').get(),undefined);
});
