'use strict';
(() => {
  const sections = {
    overview:['Overview','A clear view of your email workspace.','Your workspace','Manage your email activity in one place.'],
    emails:['Emails','Your transactional email activity.','Email activity','Review individual messages and their status.'],
    logs:['Logs','Delivery events and request history.','Activity logs','Review email activity and delivery events.'],
    broadcasts:['Broadcasts','Send a message to an audience.','Broadcasts','Create and manage email campaigns.'],
    audiences:['Audiences','Organize the people you communicate with.','Audiences','Manage contacts and their consent.'],
    templates:['Templates','Keep reusable messages together.','Templates','Create and manage reusable email content.'],
    domains:['Domains','Manage sending identities.','Sending domains','Review domain verification and DNS status.'],
    'api-keys':['API Keys','Connect your applications to LeadMASTER.','API keys','Create and manage server-side credentials.'],
    webhooks:['Webhooks','Receive events in your application.','Webhook endpoints','Configure and manage delivery endpoints.'],
    settings:['Settings','Manage your workspace preferences.','Workspace settings','Review your workspace configuration.']
  };
  const el=id=>document.getElementById(id), links=[...document.querySelectorAll('[data-section]')];
  function render(){
    const requested=location.hash.slice(1), key=Object.hasOwn(sections,requested)?requested:'overview';
    const [title,description,panel,panelDescription]=sections[key];
    el('section-title').textContent=title;el('breadcrumb').textContent=title;el('section-description').textContent=description;
    el('panel-title').textContent=panel;el('panel-description').textContent=panelDescription;
    links.forEach(link=>{if(link.dataset.section===key)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});
    document.title=title+' · LeadMASTER';
  }
  function menu(open){el('sidebar').classList.toggle('open',open);el('menu').setAttribute('aria-expanded',String(open));el('menu').setAttribute('aria-label',open?'Close navigation':'Open navigation')}
  el('menu').addEventListener('click',()=>menu(el('menu').getAttribute('aria-expanded')!=='true'));
  links.forEach(link=>link.addEventListener('click',()=>{menu(false);if(location.hash===link.hash)render()}));
  window.addEventListener('hashchange',render);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&el('menu').getAttribute('aria-expanded')==='true'){menu(false);el('menu').focus()}});
  render();

  async function verifySession(){
    if (typeof fetch !== 'function') return;
    try {
      const response=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok) throw new Error('session-check-failed');
      const data=await response.json();
      if(data.authenticated!==true) location.replace('/login.html');
      const name=document.getElementById('workspace-name');
      const email=document.getElementById('workspace-email');
      if(name&&data.account?.name)name.textContent=data.account.name;
      if(email&&data.email)email.textContent=data.email;
    } catch { location.replace('/login.html'); }
  }
  const logout=el('logout-link');
  if(logout) logout.addEventListener('click',async event=>{
    event.preventDefault();
    logout.setAttribute('aria-busy','true');
    try {
      await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    } finally { location.replace('/login.html'); }
  });
  verifySession();
})();
