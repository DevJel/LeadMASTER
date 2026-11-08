import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../public/html-preview.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/dashboard.html',import.meta.url),'utf8');
function setup(){
 function element(){return {attributes:{},handlers:{},classList:{classes:new Set(),toggle(k,v){v?this.classes.add(k):this.classes.delete(k)}},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this[k]},addEventListener(k,f){this.handlers[k]=f},focus(){this.focused=true},value:'',hidden:false}}
 const ids={};for(const id of ['html-preview','preview-html','preview-frame','preview-feedback','preview-empty','preview-canvas','workspace-panel','html-preview-title','html-preview-description','preview-clear','preview-render','preview-desktop','preview-mobile'])ids[id]=element();
 let options;const window={handlers:{},addEventListener(k,f){this.handlers[k]=f},DOMPurify:{isSupported:true,sanitize(value,opts){options=opts;return value}}};const document={getElementById:id=>ids[id]};const location={hash:'#emails'};
 vm.runInNewContext(script,{document,window,location,Object,Boolean});return {ids,window,location,getOptions:()=>options};
}
test('preview is sandboxed and available separately for Emails and Templates',()=>{
 assert.match(html,/id="preview-frame"[^>]*sandbox/);
 const {ids,window,location}=setup();assert.equal(ids['html-preview'].hidden,false);assert.match(ids['html-preview-title'].textContent,/Compose email/);
 ids['preview-html'].value='<p>Draft</p>';ids['preview-html'].handlers.input();location.hash='#templates';window.handlers.hashchange();assert.equal(ids['preview-html'].value,'');assert.match(ids['html-preview-title'].textContent,/Template/);
 location.hash='#emails';window.handlers.hashchange();assert.equal(ids['preview-html'].value,'<p>Draft</p>');location.hash='#overview';window.handlers.hashchange();assert.equal(ids['html-preview'].hidden,true);
});
test('blank input, sanitized preview and clear states',()=>{
 const {ids,getOptions}=setup();ids['preview-render'].handlers.click();assert.match(ids['preview-feedback'].textContent,/Enter HTML/);
 ids['preview-html'].value='<p>Hi</p>';ids['preview-render'].handlers.click();assert.equal(ids['preview-frame'].hidden,false);assert.match(ids['preview-frame'].srcdoc,/Content-Security-Policy/);assert.ok(getOptions().FORBID_TAGS.includes('meta'));assert.ok(getOptions().FORBID_ATTR.includes('href'));
 ids['preview-html'].handlers.input();assert.equal(ids['preview-frame'].hidden,true);ids['preview-mobile'].handlers.click();assert.equal(ids['preview-mobile'].attributes['aria-pressed'],'true');ids['preview-clear'].handlers.click();assert.equal(ids['preview-html'].value,'');
});
test('sanitizer failure never displays unsafe markup',()=>{const {ids,window}=setup();ids['preview-html'].value='<p>Hi</p>';window.DOMPurify.sanitize=()=>{throw new Error('failure')};ids['preview-render'].handlers.click();assert.equal(ids['preview-frame'].hidden,true);assert.match(ids['preview-feedback'].textContent,/Unable to render/)});
