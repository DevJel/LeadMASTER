'use strict';
(() => {
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

  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
})();
