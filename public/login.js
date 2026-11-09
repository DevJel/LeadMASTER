'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const loginButton=$('login-button'), otpButton=$('otp-button');
  let widgetId, turnstileReady=false, busy=false;
  function error(id,message){const el=$(id); el.textContent=message;el.hidden=!message;}
  function setBusy(button, value, label){busy=value;button.disabled=value;button.textContent=value?'Please wait…':label;}
  async function request(path,options={}) {
    const c=new AbortController(), t=setTimeout(()=>c.abort(),12000);
    try{return await fetch(path,{...options,signal:c.signal,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(options.headers||{})}});} finally{clearTimeout(t);}
  }
  async function initialize(){
    try {
      const res=await request('/api/auth/config'); if(!res.ok) throw Error();
      const config=await res.json(); if(typeof config.turnstileSiteKey!=='string'||!config.turnstileSiteKey)throw Error();
      await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
      if(!window.turnstile)throw Error();
      widgetId=window.turnstile.render('#turnstile',{sitekey:config.turnstileSiteKey,action:'login',theme:'light',retry:'auto','retry-interval':8000,'refresh-expired':'auto','refresh-timeout':'auto',callback:()=>{turnstileReady=true;loginButton.disabled=false;error('login-error','');},'expired-callback':()=>{turnstileReady=false;loginButton.disabled=true;},'timeout-callback':()=>{turnstileReady=false;loginButton.disabled=true;error('login-error','Security verification timed out. Please retry.');},'error-callback':()=>{turnstileReady=false;loginButton.disabled=true;error('login-error','Security verification is unavailable. Please check your connection and retry.');}});
    } catch {error('login-error','Secure sign-in is unavailable. Please try again later.');loginButton.disabled=true;}
  }
  $('show-password').addEventListener('click',()=>{const input=$('password'),show=input.type==='password';input.type=show?'text':'password';const b=$('show-password');b.textContent=show?'Hide':'Show';b.setAttribute('aria-label',show?'Hide password':'Show password');b.setAttribute('aria-pressed',String(show));});
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!turnstileReady)return;error('login-error','');setBusy(loginButton,true,'Log in');
    try {
      const token=window.turnstile.getResponse(widgetId);if(!token)throw Error();
      const res=await request('/api/auth/login',{method:'POST',body:JSON.stringify({identity:$('identity').value.trim(),password:$('password').value,turnstileToken:token})});
      if(!res.ok){const body=await res.json().catch(()=>({}));const message=res.status===429?'Too many attempts. Please wait and try again.':res.status===403?'Security verification failed. Please complete the check again.':res.status===503?'Email verification is temporarily unavailable. Please try again later.':res.status===401?'Unable to sign in. Check your email and password.':'Sign-in service is temporarily unavailable. Please try again.';error('login-error',message);return;}
      const body=await res.json(); if(body.next!=='verify_email')throw Error();
      $('password').value='';$('login-step').hidden=true;$('otp-step').hidden=false;$('code').focus();
    }catch{error('login-error','Sign-in is temporarily unavailable. Please try again.');}
    finally{busy=false;loginButton.textContent='Log in';turnstileReady=false;loginButton.disabled=true;if(window.turnstile&&widgetId!==undefined)window.turnstile.reset(widgetId);}
  });
  $('code').addEventListener('input',()=>{$('code').value=$('code').value.replace(/[^0-9]/g,'').slice(0,6);});
  $('otp-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;error('otp-error','');const code=$('code').value.replace(/[^0-9]/g,'').slice(0,6);$('code').value=code;
    if(code.length!==6){error('otp-error','Enter all 6 numbers from the latest email.');return;}
    setBusy(otpButton,true,'Verify and continue');
    try{
      const res=await request('/api/auth/verify',{method:'POST',body:JSON.stringify({code})});
      if(!res.ok){const body=await res.json().catch(()=>({}));const message=typeof body.error==='string'?body.error:res.status===429?'Too many verification attempts. Please wait before trying again.':res.status===401?'This code is incorrect, expired, or no longer active. Use the latest email code.':res.status===400?'Enter the six-digit code from the latest email.':res.status===503?'The email verification service is unavailable. Please try again shortly.':'We could not verify this code. Please try again.';error('otp-error',message);return;}
      const body=await res.json();if(body.authenticated!==true)throw Error();location.assign('/dashboard.html');
    }catch(err){error('otp-error',err?.name==='AbortError'?'The verification request timed out. Check your connection and retry with the latest code.':'Could not reach the verification service. Check your connection, then retry with the latest code.');}
    finally{setBusy(otpButton,false,'Verify and continue');}
  });
  $('back-button').addEventListener('click',()=>{if(busy)return;$('code').value='';error('otp-error','');$('otp-step').hidden=true;$('login-step').hidden=false;$('identity').focus();});
  initialize();
})();