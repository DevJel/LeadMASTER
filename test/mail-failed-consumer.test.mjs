import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import consumer from '../workers/mail-failed-consumer.js';

const batchId='22345678-1234-4123-8123-123456789abc';
const first='12345678-1234-4123-8123-123456789abc';
const second='32345678-1234-4123-8123-123456789abc';
const third='42345678-1234-4123-8123-123456789abc';
function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE admin_sent_mail (id TEXT PRIMARY KEY,batch_id TEXT,status TEXT,queue_status TEXT,updated_at INTEGER,error_code TEXT);
 CREATE TABLE developer_email_requests (id TEXT PRIMARY KEY,status TEXT,updated_at INTEGER,error_code TEXT);
 CREATE TABLE mail_send_claims (source TEXT,request_id TEXT,state TEXT);
 CREATE TABLE mail_notifications (id TEXT,type TEXT,title TEXT,message TEXT,target_id TEXT,created_at INTEGER);
 CREATE TABLE workspace_activity (id TEXT,actor_email TEXT,action TEXT,summary TEXT,target_id TEXT,created_at INTEGER);`);
 const db={prepare(query){let args=[];return {bind(...v){args=v;return this},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}};
 return {sql,env:{AUTH_DB:db}};
}
const message=body=>({body,acks:0,retries:[],ack(){this.acks++},retry(x){this.retries.push(x)}});
test('dead-lettered batch preserves accepted rows and distinguishes claimed uncertain from unsent',async()=>{
 const {sql,env}=setup();
 for(const [id,status] of [[first,'accepted'],[second,'sending'],[third,'sending']])sql.prepare('INSERT INTO admin_sent_mail(id,batch_id,status,queue_status) VALUES (?,?,?,?)').run(id,batchId,status,'queued');
 sql.prepare("INSERT INTO mail_send_claims VALUES ('admin',?,'started')").run(second);
 const msg=message({id:batchId,source:'admin',batch:true});await consumer.queue({messages:[msg]},env);
 assert.equal(msg.acks,1);assert.equal(sql.prepare('SELECT status FROM admin_sent_mail WHERE id=?').get(first).status,'accepted');
 assert.deepEqual({...sql.prepare('SELECT status,error_code FROM admin_sent_mail WHERE id=?').get(second)},{status:'unknown',error_code:'delivery_outcome_unknown'});
 assert.deepEqual({...sql.prepare('SELECT status,error_code FROM admin_sent_mail WHERE id=?').get(third)},{status:'failed',error_code:'queue_exhausted'});
});
test('dead-lettered previously claimed legacy batch marks all pending outcomes unknown',async()=>{
 const {sql,env}=setup();for(const id of [first,second])sql.prepare("INSERT INTO admin_sent_mail(id,batch_id,status) VALUES (?,?,'sending')").run(id,batchId);
 sql.prepare("INSERT INTO mail_send_claims VALUES ('admin',?,'started')").run(batchId);
 const msg=message({id:batchId,source:'admin',batch:true});await consumer.queue({messages:[msg]},env);
 assert.deepEqual(sql.prepare('SELECT DISTINCT status FROM admin_sent_mail').all().map(x=>x.status),['unknown']);
});
test('dead-lettered developer request with claim is unknown',async()=>{
 const {sql,env}=setup();sql.prepare("INSERT INTO developer_email_requests(id,status) VALUES (?,'sending')").run(first);
 sql.prepare("INSERT INTO mail_send_claims VALUES ('developer',?,'started')").run(first);
 const msg=message({id:first,source:'developer'});await consumer.queue({messages:[msg]},env);
 assert.equal(sql.prepare('SELECT status FROM developer_email_requests').get().status,'unknown');assert.equal(msg.acks,1);
});
