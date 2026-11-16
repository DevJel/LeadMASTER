import test from 'node:test';
import assert from 'node:assert/strict';
import {createMailSoundTracker,createMailSoundPlayer} from '../required-componets-design/mail-sounds.mjs';

test('baseline is silent; new inbound and confirmed sends sound once, never queued or failed',()=>{
 const track=createMailSoundTracker(()=>1000);
 assert.deepEqual(track([{id:'old',received_at:500}],[{id:'q',status:'sending',created_at:500},{id:'accepted',status:'accepted',created_at:500}]),[]);
 assert.deepEqual(track([{id:'old',received_at:500},{id:'new',received_at:1100}],[{id:'q',status:'sending',created_at:500},{id:'failed',status:'failed',created_at:1100}]),['receive']);
 assert.deepEqual(track([{id:'new',received_at:1100}],[{id:'q',status:'accepted',created_at:500},{id:'failed',status:'failed',created_at:1100}]),['sent']);
 assert.deepEqual(track([{id:'old',received_at:500},{id:'new',received_at:1100}],[{id:'q',status:'accepted',created_at:500}]),[]);
 assert.deepEqual(track([{id:'restored-old',received_at:900}],[{id:'old-restored',status:'accepted',created_at:800,updated_at:1200}]),[]);
 assert.deepEqual(track([],[{id:'new-send',status:'accepted',created_at:1100}]),['sent']);
 assert.deepEqual(track([],[{id:'new-send',status:'accepted',created_at:1100}]),[]);
});

test('audio is gesture-unlocked, distinct, quiet, visibility-gated and disposable',()=>{
 const notes=[];let created=0,closed=0;
 const priorWindow=globalThis.window,priorDocument=globalThis.document;
 class AudioMock{constructor(){created++;this.state='running';this.currentTime=0;this.destination={}}createOscillator(){return {type:'',frequency:{set value(v){notes.push(v)}},connect(){},start(){},stop(){}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}close(){closed++;return Promise.resolve()}}
 globalThis.window={AudioContext:AudioMock};globalThis.document={visibilityState:'visible'};
 try{const player=createMailSoundPlayer();player.play('sent');assert.equal(created,0);player.unlock();player.play('sent');assert.deepEqual(notes,[660,990]);player.play('deleted');assert.deepEqual(notes.slice(-2),[520,390]);player.play('receive');assert.deepEqual(notes.slice(-3),[660,880,1040]);globalThis.document.visibilityState='hidden';player.play('receive');assert.equal(notes.length,7);player.close();assert.equal(closed,1)}finally{globalThis.window=priorWindow;globalThis.document=priorDocument}
});
