import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapMailbox,mapMessage,mapTemplateList,mapTemplateDetail} from '../design-reference/2026-11-16-dashboard/dashboard-model.mjs';
const id='12345678-1234-1234-1234-123456789abc';
test('maps inbox without inventing category, attachments or snippet',()=>{
 const [r]=mapMailbox({items:[{id,from_name:'Ada',from_address:'ada@example.test',to_address:'me@example.test',subject:'Hello',received_at:1000,read_at:null}]},'inbox');
 assert.equal(r.sender,'Ada'); assert.equal(r.read,false); assert.equal(r.at,1000); assert.equal(r.kind,'received');
 assert.ok(!('category' in r)); assert.ok(!('body' in r)); assert.ok(!('attachment' in r));
});
test('keeps queued, accepted and delivered distinct',()=>{
 const [r]=mapMailbox({items:[{id,recipient:'a@example.test',from_email:'me@example.test',status:'accepted',queue_status:'complete',delivery_status:''}]},'sent');
 assert.equal(r.status,'accepted'); assert.equal(r.deliveryStatus,''); assert.equal(r.queueStatus,'complete');
});
test('maps both deleted kinds and fails closed on unknown kinds',()=>{
 const r=mapMailbox({items:[{id,kind:'received',from_address:'a@example.test',received_at:5},{id:'2',kind:'sent',recipient:'b@example.test',received_at:8}]},'deleted');
 assert.equal(r[0].read,null); assert.equal(r[1].to,'b@example.test'); assert.equal(r[1].at,8);
 assert.throws(()=>mapMailbox({items:[{id,kind:'unknown'}]},'deleted'),/kind/);
});
test('message body stays plain text and source downloads stay same-origin',()=>{
 const message=mapMessage({id,subject:'s',text_body:'<script>x</script>',attachments:2,download_url:`/api/admin/mail/${id}/source`});
 assert.equal(message.textBody,'<script>x</script>'); assert.equal(message.attachmentCount,2); assert.ok(message.sourceUrl);
 assert.equal(mapMessage({id,download_url:'https://example.test/evil'}).sourceUrl,null);
});
test('template list has summaries only; detail maps full persisted fields',()=>{
 assert.deepEqual(mapTemplateList({templates:[{id,name:'Welcome',updated_at:2}]}),[{id,name:'Welcome',updatedAt:2}]);
 assert.deepEqual(mapTemplateDetail({template:{id,name:'Welcome',subject:'Hi',text_body:'Text',html_body:'<p>Text</p>',updated_at:3}}),{id,name:'Welcome',subject:'Hi',text:'Text',html:'<p>Text</p>',updatedAt:3});
 assert.throws(()=>mapTemplateList({}),/Invalid/);
});
