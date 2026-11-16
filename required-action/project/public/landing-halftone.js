'use strict';
(() => {
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const menu = document.querySelector('#mobile-menu');
  const menuButton = document.querySelector('.hamburger');
  function closeMenu() { menu.hidden = true; menuButton.setAttribute('aria-expanded','false'); menuButton.setAttribute('aria-label','Open menu'); }
  function showTab(id, focus = false) {
    const selected = tabs.find(t => t.dataset.tab === id); if (!selected) return;
    for (const tab of tabs) {
      const active = tab === selected;
      tab.classList.toggle('active',active); tab.setAttribute('aria-selected',String(active)); tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
    if (focus) selected.focus();
  }
  for (const tab of tabs) {
    tab.addEventListener('click',() => {showTab(tab.dataset.tab);document.getElementById('panels').scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'});});
    tab.addEventListener('keydown',event => {
      const i=tabs.indexOf(tab); let next;
      if(event.key==='ArrowRight') next=(i+1)%tabs.length;
      else if(event.key==='ArrowLeft') next=(i-1+tabs.length)%tabs.length;
      else if(event.key==='Home') next=0;
      else if(event.key==='End') next=tabs.length-1;
      else return;
      event.preventDefault();showTab(tabs[next].dataset.tab,true);
    });
  }
  document.querySelectorAll('[data-open-tab]').forEach(link=>link.addEventListener('click',()=>{showTab(link.dataset.openTab);closeMenu();}));
  menuButton.addEventListener('click',()=>{const opening=menu.hidden;menu.hidden=!opening;menuButton.setAttribute('aria-expanded',String(opening));menuButton.setAttribute('aria-label',opening?'Close menu':'Open menu');});
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){closeMenu();menuButton.focus();}});

  const docs=document.querySelector('#panel-documentation');
  const search=docs.querySelector('#docs-search');
  const filters=[...docs.querySelectorAll('[data-doc-filter]')];
  const cards=[...docs.querySelectorAll('[data-doc-card]')];
  const references=[...docs.querySelectorAll('.doc-reference-section')];
  let category='all';
  function filterDocs() {
    const term=search.value.trim().toLocaleLowerCase(); let count=0;
    for(const card of cards){
      const href=card.querySelector('a')?.getAttribute('href')||'';
      const target=href.startsWith('#')?docs.querySelector(href):null;
      const text=(card.textContent+' '+(target?.textContent||'')).toLocaleLowerCase();
      const visible=(category==='all'||card.dataset.docCategory===category)&&text.includes(term);
      card.hidden=!visible;if(visible)count++;
    }
    for(const section of references){
      const visible=(category==='all'||section.dataset.docCategory===category)&&section.textContent.toLocaleLowerCase().includes(term);
      section.hidden=!visible;
    }
    docs.querySelector('#docs-count').textContent=`${count} ${count===1?'topic':'topics'} shown`;
    docs.querySelector('#docs-empty').hidden=count!==0;
    for(const filter of filters){const active=filter.dataset.docFilter===category;filter.classList.toggle('active',active);filter.setAttribute('aria-pressed',String(active));}
  }
  search.addEventListener('input',filterDocs);
  filters.forEach(filter=>filter.addEventListener('click',()=>{category=filter.dataset.docFilter;filterDocs();}));

  function syncDocumentationHash(){
    const id=decodeURIComponent(location.hash.slice(1));
    if(id==='documentation'||id.startsWith('doc-')){
      showTab('documentation');
      requestAnimationFrame(()=>{
        const target=id.startsWith('doc-')?document.getElementById(id):document.getElementById('documentation');
        (target||document.getElementById('panels')).scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'});
      });
    }
  }
  window.addEventListener('hashchange',syncDocumentationHash);
  syncDocumentationHash();
})();
