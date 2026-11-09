'use strict';
(() => {
  const el=id=>document.getElementById(id);
  const section=el('html-preview'), input=el('preview-html'), frame=el('preview-frame');
  const feedback=el('preview-feedback'),empty=el('preview-empty'),canvas=el('preview-canvas');
  const state={'email-preview':'','template-preview':''};let current=null;
  const policy="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  function message(text,error=false){feedback.textContent=text;feedback.classList.toggle('is-error',error)}
  function resetFrame(){frame.hidden=true;frame.removeAttribute('srcdoc');empty.hidden=false}
  function changeSection(){
    const key=location.hash.slice(1);
    const next=Object.hasOwn(state,key)?key:null;
    if(next===current)return;
    current=next;section.hidden=!next;el('workspace-panel').hidden=Boolean(next);resetFrame();message('');
    if(next){input.value=state[next];el('html-preview-title').textContent=next==='email-preview'?'Compose email · HTML preview':'Template · HTML preview';el('html-preview-description').textContent=next==='email-preview'?'Preview message HTML before sending.':'Preview reusable template HTML.';}
  }
  el('preview-close').addEventListener('click',()=>{location.hash=current==='email-preview'?'#emails':'#templates'});
  input.addEventListener('input',()=>{if(current)state[current]=input.value;if(!frame.hidden){resetFrame();message('Content changed. Select Preview HTML to refresh.')}});
  el('preview-clear').addEventListener('click',()=>{input.value='';if(current)state[current]='';resetFrame();message('Preview cleared.');input.focus()});
  el('preview-render').addEventListener('click',()=>{
    resetFrame();
    if(!input.value.trim()){message('Enter HTML to preview.',true);input.focus();return}
    if(!window.DOMPurify?.isSupported){message('HTML preview is unavailable. Please reload the page.',true);return}
    try {
      // Sanitize before placing the document in an isolated sandbox.
      // External loads and active links are blocked by the CSP, sanitizer and iframe sandbox.
      const clean=window.DOMPurify.sanitize(input.value,{WHOLE_DOCUMENT:true,FORBID_TAGS:['script','iframe','frame','frameset','object','embed','base','link','meta','form','svg','math'],FORBID_ATTR:['srcset','action','formaction','href','xlink:href']});
      frame.srcdoc='<!doctype html><meta http-equiv="Content-Security-Policy" content="'+policy+'">'+clean;
      empty.hidden=true;frame.hidden=false;message('Preview updated.');
    } catch {resetFrame();message('Unable to render this HTML. Please try again.',true)}
  });
  for(const mode of ['desktop','mobile'])el('preview-'+mode).addEventListener('click',()=>{canvas.classList.toggle('is-mobile',mode==='mobile');el('preview-desktop').setAttribute('aria-pressed',String(mode==='desktop'));el('preview-mobile').setAttribute('aria-pressed',String(mode==='mobile'));});
  window.addEventListener('hashchange',changeSection);changeSection();
})();
