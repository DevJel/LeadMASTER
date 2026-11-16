import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDashboardApi, DashboardApiError} from '../design-reference/2026-11-16-dashboard/dashboard-api.mjs';
const id = '12345678-1234-1234-1234-123456789abc';
function harness(body = {ok:true}, status = 200) {
 const calls=[];
 const api=createDashboardApi(async (path,options)=>{calls.push({path,options}); return new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json'}})});
 return {api,calls};
}
test('mailbox uses existing relative same-origin routes and encodes filters', async () => {
 const {api,calls}=harness({items:[],counts:{}});
 await api.mailbox({folder:'inbox',q:'a & b',domain:'example.test'});
 assert.equal(calls[0].path,'/api/admin/mail?folder=inbox&q=a+%26+b&domain=example.test');
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.throws(()=>api.mailbox({folder:'drafts'}),/Unsupported/);
});
test('message mutations and template operations use current routes', async () => {
 const {api,calls}=harness();
 await api.messageAction(id,'read',false); await api.messageAction(id,'permanentDelete');
 await api.createTemplate({name:'test',subject:'s',text:'x'}); await api.updateTemplate(id,{name:'test',subject:'s',text:'x'}); await api.deleteTemplate(id);
 assert.deepEqual(calls.map(c=>c.options.method),['PATCH','PATCH','POST','PUT','DELETE']);
 assert.deepEqual(JSON.parse(calls[0].options.body),{action:'read',read:false});
 assert.equal(calls[4].path,`/api/admin/templates/${id}`);
 assert.throws(()=>api.messageAction(id,'star'),/Unsupported/);
 assert.throws(()=>api.message('../other'),/Invalid/);
});
test('send returns actual queue response without labeling it delivered or retrying', async () => {
 const value={batch_id:id,queued:1,status:'queued'}; const {api,calls}=harness(value,202);
 assert.deepEqual(await api.send({to:'a@example.test',subject:'s',text:'x'}),value);
 assert.equal(calls.length,1); assert.equal(calls[0].path,'/api/admin/send');
});
test('uncertain send result preserves batch information and does not retry', async () => {
 const value={batch_id:id,status:'submission_unconfirmed',error:'Check the batch.'}; const {api,calls}=harness(value,503);
 await assert.rejects(api.send({to:'a@example.test'}),e=>e instanceof DashboardApiError && e.uncertain && e.data.batch_id===id);
 assert.equal(calls.length,1);
});
test('network failure on writes is uncertain, reads do not become fake data', async () => {
 let calls=0; const api=createDashboardApi(async()=>{calls++; throw Error('network')});
 await assert.rejects(api.send({}),e=>e.uncertain===true);
 await assert.rejects(api.templates(),e=>e.uncertain===false);
 assert.equal(calls,2);
});
test('groups, keys and webhooks use account session API routes without bearer keys', async()=>{
 const {api,calls}=harness(); await api.addGroupMembers(id,['a@example.test']); await api.revokeApiKey(id); await api.webhookDeliveries(id);
 assert.deepEqual(calls.map(c=>c.path),[`/api/admin/audience/groups/${id}/members`,`/api/developer/keys/${id}`,`/api/admin/webhooks/${id}/deliveries`]);
 assert.ok(calls.every(c=>!c.options.headers?.authorization));
});
test('draft adapter uses scoped session routes and preserves the revision',async()=>{
 const {api,calls}=harness();await api.createDraft({subject:'s'});await api.updateDraft(id,{subject:'updated',revision:2});await api.deleteDraft(id);
 assert.deepEqual(calls.map(c=>c.path),['/api/admin/drafts',`/api/admin/drafts/${id}`,`/api/admin/drafts/${id}`]);
 assert.deepEqual(calls.map(c=>c.options.method),['POST','PUT','DELETE']);assert.equal(JSON.parse(calls[1].options.body).revision,2);
});
