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
    tab.addEventListener('click',() => showTab(tab.dataset.tab));
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
  for (const canvas of document.querySelectorAll('[data-halftone]')) {
    const ctx=canvas.getContext('2d'); if(!ctx) continue;
    const dark=canvas.dataset.halftone==='dark', background=dark?'#0a0a0a':'#fff', ink=dark?[237,232,224]:[10,10,10], warm=[233,118,43];
    const parent=canvas.parentElement, gap=6, radius=80; let points=[],width=1,height=1,dpr=1,frame=0,visible=true,pointer={x:-1e5,y:-1e5},ring=null;
    function resize(){
      const rect=parent.getBoundingClientRect(); width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      const mask=document.createElement('canvas');mask.width=width;mask.height=height;const m=mask.getContext('2d',{willReadFrequently:true});if(!m)return;
      const font='"Inter Tight", "Inter Variable", Inter, "Helvetica Neue", Arial, system-ui, sans-serif';m.font=`800 100px ${font}`;
      const size=(100/m.measureText('LeadMASTER').width)*width*(dark?1.02:.96);m.font=`800 ${size}px ${font}`;
      const measured=m.measureText('LeadMASTER'),ascent=measured.actualBoundingBoxAscent||size*.72;
      m.textBaseline='alphabetic';m.fillStyle='#000';m.fillText('LeadMASTER',(width-measured.width)/2,height+ascent*(dark?.2:-.25));
      const data=m.getImageData(0,0,width,height).data;points=[];
      for(let y=0;y<height;y+=gap)for(let x=0;x<width;x+=gap){let alpha=0;for(let yy=0;yy<3;yy++)for(let xx=0;xx<3;xx++){const sx=Math.min(width-1,Math.floor(x+(xx+.5)*gap/3)),sy=Math.min(height-1,Math.floor(y+(yy+.5)*gap/3));alpha+=data[(sy*width+sx)*4+3];}const density=alpha/2295;if(density>=.06)points.push({x:x+gap/2,y:y+gap/2,ox:x+gap/2,oy:y+gap/2,vx:0,vy:0,r:Math.sqrt(Math.min(1,density))*gap*.56});}
      draw(performance.now(),true);
    }
    function draw(now,force=false){frame=0;if(!visible&&!force)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=background;ctx.fillRect(0,0,width,height);let moving=false;const elapsed=ring?now-ring.t:1e9;
      for(const p of points){
        if(!reduced.matches){
          if(elapsed<900){const dx=p.ox-ring.x,dy=p.oy-ring.y,dist=Math.hypot(dx,dy)+.001,k=1-Math.min(1,Math.abs(dist-elapsed*.9)/26);if(k>0){const f=k*3.2*(1-elapsed/900);p.vx+=dx/dist*f;p.vy+=dy/dist*f;}}
          const dx=p.x-pointer.x,dy=p.y-pointer.y,dist=Math.hypot(dx,dy)+.001;if(dist<radius){const force=(1-dist/radius)*2.6;p.vx+=dx/dist*force;p.vy+=dy/dist*force;}
          p.vx=(p.vx+(p.ox-p.x)*.05)*.84;p.vy=(p.vy+(p.oy-p.y)*.05)*.84;p.x+=p.vx;p.y+=p.vy;
          if(Math.abs(p.vx)+Math.abs(p.vy)>.02||Math.abs(p.x-p.ox)+Math.abs(p.y-p.oy)>.05)moving=true;else{p.x=p.ox;p.y=p.oy;p.vx=p.vy=0;}
        } else {p.x=p.ox;p.y=p.oy;}
        const blend=Math.min(1,Math.hypot(p.x-p.ox,p.y-p.oy)/28),color=ink.map((c,i)=>Math.round(c+(warm[i]-c)*blend));ctx.fillStyle=`rgb(${color.join(',')})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
      }
      if(!reduced.matches&&(moving||elapsed<900||pointer.x>-1e4))schedule();
    }
    function schedule(){if(!frame&&visible)frame=requestAnimationFrame(draw)}
    function pos(event){const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
    canvas.addEventListener('pointermove',event=>{if(!reduced.matches){pointer=pos(event);schedule();}});
    canvas.addEventListener('pointerleave',()=>{pointer={x:-1e5,y:-1e5};schedule();});
    canvas.addEventListener('click',event=>{if(!reduced.matches){ring={...pos(event),t:performance.now()};schedule();}});
    if('ResizeObserver' in window)new ResizeObserver(resize).observe(parent);else window.addEventListener('resize',resize);
    if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();}).observe(parent);
    reduced.addEventListener?.('change',()=>schedule());resize();
  }
})();
