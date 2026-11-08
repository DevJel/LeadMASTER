import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('workspace navigation renders its selected section and handles the mobile menu',async()=>{
  const script=await readFile(new URL('../public/dashboard.js',import.meta.url),'utf8');
  function element(){return {attributes:{},handlers:{},classList:{toggle(_name,on){this.open=on}},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},getAttribute(k){return this.attributes[k]},addEventListener(k,f){this.handlers[k]=f},focus(){this.focused=true}}}
  const ids={};for(const id of ['menu','sidebar','section-title','breadcrumb','section-description','panel-title','panel-description'])ids[id]=element();
  ids.menu.attributes['aria-expanded']='false';
  const overview=element(), emails=element();overview.dataset={section:'overview'};overview.hash='#overview';emails.dataset={section:'emails'};emails.hash='#emails';
  const document={getElementById:id=>ids[id],querySelectorAll:()=>[overview,emails],handlers:{},addEventListener(k,f){this.handlers[k]=f}};
  const location={hash:''},window={handlers:{},addEventListener(k,f){this.handlers[k]=f}};
  vm.runInNewContext(script,{document,location,window,Object});
  assert.equal(ids['section-title'].textContent,'Overview');assert.equal(overview.getAttribute('aria-current'),'page');
  location.hash='#emails';window.handlers.hashchange();assert.equal(ids['section-title'].textContent,'Emails');assert.equal(emails.getAttribute('aria-current'),'page');
  ids.menu.handlers.click();assert.equal(ids.menu.getAttribute('aria-expanded'),'true');document.handlers.keydown({key:'Escape'});assert.equal(ids.menu.getAttribute('aria-expanded'),'false');assert.equal(ids.menu.focused,true);
  location.hash='#constructor';window.handlers.hashchange();assert.equal(ids['section-title'].textContent,'Overview');
});
test('dashboard contains no sample messages or fictitious statistics',async()=>{const html=await readFile(new URL('../public/dashboard.html',import.meta.url),'utf8');assert.match(html,/Workspace unavailable/);assert.match(html,/No email or account data is shown/);assert.doesNotMatch(html,/demo account|example\.com|12,408|32,140/i)});
