import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {LoadingIndicator} from '../src/dashboard-tsx/LoadingIndicator';
import {ActionConfirmation,ActionConfirmationRequest} from '../src/dashboard-tsx/ActionConfirmation';
import {mapLeadMasterError} from '../src/leadmaster-error-mapper.mjs';

type UtilityRoute='notes'|'contacts'|'calendar'|'calculator'|'currency'|'email-html-playground';
type RecordRow<T>={id:string;value:T};
type Note={title:string;body:string;pinned?:boolean};
type Contact={name:string;email:string;company?:string;phone?:string;role?:string;location?:string};
type Reminder={title:string;date:string;time:string;done:boolean};
const labels:Record<UtilityRoute,string>={notes:'Notes',contacts:'Contacts',calendar:'Calendar',calculator:'Calculator',currency:'Currency Conversion','email-html-playground':'Email HTML Playground'};
const routeList:UtilityRoute[]=['notes','contacts','calendar','calculator','currency','email-html-playground'];
const today=()=>new Date().toISOString().slice(0,10);

async function recordsApi(action:string,args:any){
  const response=await fetch('/api/workspace/actions',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({action,args})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.error)throw new Error(body.error||'The change could not be saved.');
  return body.data;
}
function cleanHtml(value:string){
  const purifier=(window as any).DOMPurify;
  if(purifier&&typeof purifier.sanitize==='function')return purifier.sanitize(value,{USE_PROFILES:{html:true},FORBID_TAGS:['script','style','iframe','object','embed','form','meta','link'],FORBID_ATTR:['srcdoc'],ALLOW_DATA_ATTR:false});
  return value.replace(/<\/?(script|iframe|object|embed|form|style)[^>]*>/gi,'').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/javascript:/gi,'');
}
function calculate(input:string):number{
  const tokens=input.replace(/\s+/g,'');
  if(!tokens||!/^[0-9.+*/()^-]+$/.test(tokens))throw new Error('LM-USR-4004');
  let at=0;
  const number=():number=>{
    const start=at;
    while(at<tokens.length&&/[0-9.]/.test(tokens[at]))at++;
    const value=Number(tokens.slice(start,at));
    if(start===at||!Number.isFinite(value))throw new Error('LM-USR-4004');
    return value;
  };
  const factor=():number=>{
    if(tokens[at]==='+'){at++;return factor();}
    if(tokens[at]==='-'){at++;return -factor();}
    if(tokens[at]==='('){at++;const value=expression();if(tokens[at]!==')')throw new Error('LM-USR-4004');at++;return value;}
    return number();
  };
  const power=():number=>{let value=factor();if(tokens[at]==='^'){at++;value=Math.pow(value,power());}return value;};
  const term=():number=>{let value=power();while(tokens[at]==='*'||tokens[at]==='/'){const op=tokens[at++];const right=power();value=op==='*'?value*right:value/right;if(!Number.isFinite(value))throw new Error('LM-USR-4004');}return value;};
  const expression=():number=>{let value=term();while(tokens[at]==='+'||tokens[at]==='-'){const op=tokens[at++];const right=term();value=op==='+'?value+right:value-right;}return value;};
  const result=expression();if(at!==tokens.length||!Number.isFinite(result))throw new Error('LM-USR-4004');return result;
}

export default function UtilityApps({route}:{route:string|null}){
  const selected=(routeList.includes(route as UtilityRoute)?route:'notes') as UtilityRoute;
  const [notes,setNotes]=useState<RecordRow<Note>[]>([]);
  const [contacts,setContacts]=useState<RecordRow<Contact>[]>([]);
  const [reminders,setReminders]=useState<RecordRow<Reminder>[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [search,setSearch]=useState('');
  const [confirmation,setConfirmation]=useState<ActionConfirmationRequest|null>(null);
  const [confirmationAction,setConfirmationAction]=useState<(()=>Promise<void>)|null>(null);
  const [noteForm,setNoteForm]=useState({id:'',title:'',body:'',pinned:false});
  const [contactForm,setContactForm]=useState({id:'',name:'',email:'',company:'',phone:'',role:'',location:''});
  const [reminderForm,setReminderForm]=useState({id:'',title:'',date:today(),time:'09:00'});
  const [calcInput,setCalcInput]=useState('12 * (4 + 3)');
  const [calcResult,setCalcResult]=useState('');
  const [fromCurrency,setFromCurrency]=useState('USD');
  const [toCurrency,setToCurrency]=useState('PHP');
  const [amount,setAmount]=useState('1');
  const [currencyResult,setCurrencyResult]=useState('');
  const [currencyDate,setCurrencyDate]=useState('');
  const [currencyBusy,setCurrencyBusy]=useState(false);
  const [prompt,setPrompt]=useState('Create a clean product update email with a clear headline, a short introduction, three benefit points and a primary call-to-action button.');
  const [html,setHtml]=useState('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;color:#222"><tr><td style="padding:28px"><h1 style="margin:0 0 12px">Your next update</h1><p>Write a helpful introduction for your readers.</p><a href="https://example.com" style="display:inline-block;padding:12px 18px;background:#222;color:#fff;text-decoration:none;border-radius:24px">Read more</a></td></tr></table>');
  const [subject,setSubject]=useState('A helpful update from our team');
  const [aiBusy,setAiBusy]=useState(false);
  const [showPreview,setShowPreview]=useState(true);
  const [htmlCopied,setHtmlCopied]=useState(false);
  const [lastLoaded,setLastLoaded]=useState<number|null>(null);

  const load=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true);
    if(!silent)setError('');
    try{
      const collection=selected==='notes'?'leadmaster_notes':selected==='contacts'?'leadmaster_contacts':selected==='calendar'?'leadmaster_reminders':null;
      if(collection){
        const result=await recordsApi('records.list',{collection});
        if(!Array.isArray(result?.records))throw new Error('The saved list could not be checked.');
        const rows=result.records.map((row:any)=>({id:String(row.id),value:row.value||{}}));
        if(selected==='notes')setNotes(rows as RecordRow<Note>[]);
        if(selected==='contacts')setContacts(rows as RecordRow<Contact>[]);
        if(selected==='calendar')setReminders(rows as RecordRow<Reminder>[]);
      }
      setLastLoaded(Date.now());
    }catch(e){if(!silent)setError(mapLeadMasterError(e).message);}
    finally{if(!silent)setLoading(false);}
  },[selected]);

  useEffect(()=>{void load(false);},[load]);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{if(!active||document.visibilityState==='hidden')return;await load(true);};
    const interval=window.setInterval(()=>{void refresh();},3000);
    const onVisibility=()=>{if(document.visibilityState==='visible')void refresh();};
    document.addEventListener('visibilitychange',onVisibility);
    return ()=>{active=false;window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisibility);};
  },[load]);

  const filteredNotes=useMemo(()=>notes.filter(row=>(row.value.title+' '+row.value.body).toLowerCase().includes(search.toLowerCase())),[notes,search]);
  const filteredContacts=useMemo(()=>contacts.filter(row=>(row.value.name+' '+row.value.email+' '+(row.value.company||'')).toLowerCase().includes(search.toLowerCase())),[contacts,search]);
  const filteredReminders=useMemo(()=>reminders.filter(row=>(row.value.title+' '+row.value.date).toLowerCase().includes(search.toLowerCase())),[reminders,search]);

  async function saveNote(){
    if(!noteForm.title.trim()){setNotice('Add a title before saving your note.');return;}
    setSaving(true);
    try{
      const value={title:noteForm.title.trim(),body:noteForm.body,pinned:noteForm.pinned};
      if(noteForm.id)await recordsApi('records.replace',{collection:'leadmaster_notes',id:noteForm.id,value});
      else await recordsApi('records.create',{collection:'leadmaster_notes',value,idempotency_key:'utility-note-'+crypto.randomUUID()});
      setNoteForm({id:'',title:'',body:'',pinned:false});setNotice('Your note has been saved.');await load(true);
    }catch(e){setError(mapLeadMasterError(e).message);}finally{setSaving(false);}
  }
  async function saveContact(){
    if(!contactForm.name.trim()||!contactForm.email.trim()){setNotice('Add a name and email address for this contact.');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email.trim())){setError(mapLeadMasterError(new Error('invalid email')).message);return;}
    setSaving(true);
    try{
      const value={name:contactForm.name.trim(),email:contactForm.email.trim(),company:contactForm.company,phone:contactForm.phone,role:contactForm.role,location:contactForm.location};
      if(contactForm.id)await recordsApi('records.replace',{collection:'leadmaster_contacts',id:contactForm.id,value});
      else await recordsApi('records.create',{collection:'leadmaster_contacts',value,idempotency_key:'utility-contact-'+crypto.randomUUID()});
      setContactForm({id:'',name:'',email:'',company:'',phone:'',role:'',location:''});setNotice('Your contact has been saved.');await load(true);
    }catch(e){setError(mapLeadMasterError(e).message);}finally{setSaving(false);}
  }
  async function saveReminder(){
    if(!reminderForm.title.trim()||!reminderForm.date||!reminderForm.time){setNotice('Complete the title, date and time.');return;}
    setSaving(true);
    try{
      const value={title:reminderForm.title.trim(),date:reminderForm.date,time:reminderForm.time,done:false};
      if(reminderForm.id){const old=reminders.find(x=>x.id===reminderForm.id)?.value;await recordsApi('records.replace',{collection:'leadmaster_reminders',id:reminderForm.id,value:{...old,...value}});}
      else await recordsApi('records.create',{collection:'leadmaster_reminders',value,idempotency_key:'utility-reminder-'+crypto.randomUUID()});
      setReminderForm({id:'',title:'',date:today(),time:'09:00'});setNotice('Your calendar reminder has been saved.');await load(true);
    }catch(e){setError(mapLeadMasterError(e).message);}finally{setSaving(false);}
  }
  function askDelete(request:ActionConfirmationRequest,action:()=>Promise<void>){setConfirmation(request);setConfirmationAction(()=>action);}
  async function deleteRecord(collection:string,id:string){
    setSaving(true);
    try{await recordsApi('records.delete',{collection,id});setNotice('The item has been removed.');await load(true);}
    catch(e){setError(mapLeadMasterError(e).message);}finally{setSaving(false);}
  }
  async function toggleReminder(row:RecordRow<Reminder>){
    setSaving(true);try{await recordsApi('records.replace',{collection:'leadmaster_reminders',id:row.id,value:{...row.value,done:!row.value.done}});await load(true);}
    catch(e){setError(mapLeadMasterError(e).message);}finally{setSaving(false);}
  }
  async function convertCurrency(){
    const numeric=Number(amount);
    if(!Number.isFinite(numeric)||numeric<0){setError(mapLeadMasterError(new Error('invalid calculation input')).message);return;}
    if(fromCurrency===toCurrency){setCurrencyResult(numeric.toLocaleString(undefined,{maximumFractionDigits:4})+' '+toCurrency);setCurrencyDate(new Date().toISOString().slice(0,10));return;}
    setCurrencyBusy(true);setError('');
    try{
      const response=await fetch('https://api.frankfurter.dev/v1/latest?base='+encodeURIComponent(fromCurrency)+'&symbols='+encodeURIComponent(toCurrency),{cache:'no-store'});
      if(!response.ok)throw new Error('currency provider unavailable');
      const data=await response.json();
      const rate=Number(data?.rates?.[toCurrency]);
      if(!Number.isFinite(rate))throw new Error('invalid currency pair');
      setCurrencyResult((numeric*rate).toLocaleString(undefined,{maximumFractionDigits:4})+' '+toCurrency);
      setCurrencyDate(String(data.date||''));
    }catch(e){setError(mapLeadMasterError(e,'currency').message);}finally{setCurrencyBusy(false);}
  }
  async function generateEmail(){
    if(!prompt.trim()){setNotice('Describe the email you want to create first.');return;}
    setAiBusy(true);setError('');
    try{
      const response=await fetch('/api/admin/email-html/assistant',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({prompt,html,subject})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.errorCode||'system');
      if(typeof result.html!=='string'||!result.html.trim())throw new Error('system');
      setHtml(cleanHtml(result.html));
      if(typeof result.subject==='string'&&result.subject.trim())setSubject(result.subject);
      setNotice('Your email draft has been prepared. Review the preview before using it.');
    }catch(e){setError(mapLeadMasterError(e).message);}finally{setAiBusy(false);}
  }
  async function copyHtml(){
    try{await navigator.clipboard.writeText(cleanHtml(html));setHtmlCopied(true);window.setTimeout(()=>setHtmlCopied(false),1600);}
    catch{setError('Your browser could not copy the HTML. Select the code and copy it instead.');}
  }
  function downloadHtml(){
    const blob=new Blob([cleanHtml(html)],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='leadmaster-email-template.html';anchor.click();URL.revokeObjectURL(url);
  }

  const nav=<div className="flex flex-wrap gap-2">{routeList.map(item=><a key={item} href={'/dashboard?app='+item} className={'rounded-full px-3 py-2 text-xs border '+(selected===item?'bg-[#222] text-white border-[#222]':'border-[#ddd] hover:bg-[#f5f5f5')}>{labels[item]}</a>)}</div>;
  const panel='rounded-2xl border border-[#e5e5e5] bg-white p-4 sm:p-5';
  const field='w-full rounded-xl border border-[#d9d9d9] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#555]';
  const action='rounded-full bg-[#222] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50';
  const secondary='rounded-full border border-[#d9d9d9] px-4 py-2.5 text-sm font-medium text-[#333] disabled:opacity-50';

  return <div className="min-h-screen bg-[#f7f7f7] text-[#252525]">
    <header className="sticky top-0 z-30 border-b border-[#e5e5e5] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a href="/dashboard" className="text-lg font-bold tracking-tight">LeadMASTER <span className="font-normal text-[#777]">/ {labels[selected]}</span></a>
        <a href="/dashboard" className={secondary}>Back to workspace</a>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-3">{nav}</div>
    </header>
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#777]">Workspace utility</p><h1 className="mt-1 text-2xl font-semibold">{labels[selected]}</h1></div>{lastLoaded&&<p className="text-xs text-[#888]">Updated {new Date(lastLoaded).toLocaleTimeString()}</p>}</div>
      {error&&<div role="alert" className="rounded-xl border border-[#e6caca] bg-[#fff8f8] p-3 text-sm">{error}</div>}
      {notice&&<div role="status" className="rounded-xl border border-[#ddd] bg-white p-3 text-sm">{notice}</div>}
      {loading&&['notes','contacts','calendar'].includes(selected)?<div className={panel}><LoadingIndicator label={'Loading '+labels[selected].toLowerCase()} compact/></div>:null}

      {selected==='notes'&&<div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <section className={panel}><h2 className="font-semibold">Create or edit a note</h2><div className="mt-3 space-y-3"><input className={field} placeholder="Note title" value={noteForm.title} onChange={e=>setNoteForm({...noteForm,title:e.target.value})}/><textarea className={field} rows={7} placeholder="Write your note…" value={noteForm.body} onChange={e=>setNoteForm({...noteForm,body:e.target.value})}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noteForm.pinned} onChange={e=>setNoteForm({...noteForm,pinned:e.target.checked})}/> Pin this note</label><div className="flex gap-2"><button className={action} disabled={saving} onClick={()=>void saveNote()}>{saving?'Saving…':'Save note'}</button><button className={secondary} onClick={()=>setNoteForm({id:'',title:'',body:'',pinned:false})}>Clear</button></div></div></section>
        <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Saved notes ({notes.length})</h2><input className={field+' max-w-xs flex-1'} placeholder="Search notes" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{filteredNotes.map(row=><article key={row.id} className="rounded-xl border border-[#e5e5e5] p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-medium">{row.value.pinned?'Pinned · ':''}{row.value.title}</h3><button className="text-xs underline" onClick={()=>askDelete({title:'Delete this note?',message:'This note will be removed from your workspace.',itemLabel:row.value.title,confirmLabel:'Delete note'},()=>deleteRecord('leadmaster_notes',row.id))}>Delete</button></div><p className="mt-2 whitespace-pre-wrap text-sm text-[#666]">{row.value.body}</p><button className="mt-3 text-xs underline" onClick={()=>setNoteForm({id:row.id,title:row.value.title,body:row.value.body,pinned:!!row.value.pinned})}>Edit</button></article>)}</div>{filteredNotes.length===0&&<div className="py-8 text-center"><img src="/assets/illustrations/empty-mail.webp" alt="" width="168" height="120" className="mx-auto h-auto w-[168px] object-contain"/><p className="mt-2 text-sm text-[#777]">{search?'No notes match that search.':'No notes have been saved yet.'}</p></div>}</section>
      </div>}

      {selected==='contacts'&&<div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <section className={panel}><h2 className="font-semibold">Add or edit a contact</h2><div className="mt-3 space-y-2">{(['name','email','company','phone','role','location'] as const).map(key=><input key={key} className={field} placeholder={key[0].toUpperCase()+key.slice(1)} value={contactForm[key]} onChange={e=>setContactForm({...contactForm,[key]:e.target.value})}/>)}<div className="flex gap-2"><button className={action} disabled={saving} onClick={()=>void saveContact()}>{saving?'Saving…':'Save contact'}</button><button className={secondary} onClick={()=>setContactForm({id:'',name:'',email:'',company:'',phone:'',role:'',location:''})}>Clear</button></div></div></section>
        <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Contacts ({contacts.length})</h2><input className={field+' max-w-xs'} placeholder="Search contacts" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="mt-4 space-y-2">{filteredContacts.map(row=><article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] p-3"><div><p className="font-medium">{row.value.name}</p><p className="text-sm text-[#666]">{row.value.email} {row.value.company?'· '+row.value.company:''}</p></div><div className="flex gap-2"><button className="text-xs underline" onClick={()=>setContactForm({id:row.id,name:row.value.name,email:row.value.email,company:row.value.company||'',phone:row.value.phone||'',role:row.value.role||'',location:row.value.location||''})}>Edit</button><button className="text-xs underline" onClick={()=>askDelete({title:'Remove this contact?',message:'The contact will be removed from your saved Contacts.',itemLabel:row.value.email,confirmLabel:'Remove contact'},()=>deleteRecord('leadmaster_contacts',row.id))}>Delete</button></div></article>)}</div>{filteredContacts.length===0&&<div className="py-8 text-center"><img src="/assets/illustrations/empty-contacts.webp" alt="" width="168" height="120" className="mx-auto h-auto w-[168px] object-contain"/><p className="mt-2 text-sm text-[#777]">{search?'No contacts match that search.':'No contacts have been saved yet.'}</p></div>}</section>
      </div>}

      {selected==='calendar'&&<div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <section className={panel}><h2 className="font-semibold">Add or edit a reminder</h2><div className="mt-3 space-y-3"><input className={field} placeholder="Reminder title" value={reminderForm.title} onChange={e=>setReminderForm({...reminderForm,title:e.target.value})}/><label className="block text-sm">Date<input type="date" className={field+' mt-1'} value={reminderForm.date} onChange={e=>setReminderForm({...reminderForm,date:e.target.value})}/></label><label className="block text-sm">Time<input type="time" className={field+' mt-1'} value={reminderForm.time} onChange={e=>setReminderForm({...reminderForm,time:e.target.value})}/></label><button className={action} disabled={saving} onClick={()=>void saveReminder()}>{saving?'Saving…':'Save reminder'}</button></div></section>
        <section className={panel}><h2 className="font-semibold">Calendar reminders ({reminders.length})</h2><div className="mt-4 space-y-2">{filteredReminders.map(row=><article key={row.id} className="flex items-center gap-3 rounded-xl border border-[#e5e5e5] p-3"><input type="checkbox" checked={!!row.value.done} onChange={()=>void toggleReminder(row)}/><div className="min-w-0 flex-1"><p className={'font-medium '+(row.value.done?'line-through text-[#888]':'')}>{row.value.title}</p><p className="text-sm text-[#777]">{row.value.date} · {row.value.time}</p></div><button className="text-xs underline" onClick={()=>setReminderForm({id:row.id,title:row.value.title,date:row.value.date,time:row.value.time})}>Edit</button><button className="text-xs underline" onClick={()=>askDelete({title:'Delete this reminder?',message:'This reminder will be removed from your calendar.',itemLabel:row.value.title,confirmLabel:'Delete reminder'},()=>deleteRecord('leadmaster_reminders',row.id))}>Delete</button></article>)}</div></section>
      </div>}

      {selected==='calculator'&&<section className={panel+' max-w-2xl'}><h2 className="font-semibold">Calculator</h2><p className="mt-1 text-sm text-[#777]">Use +, −, ×, ÷, parentheses and powers.</p><input className={field+' mt-4 font-mono text-lg'} value={calcInput} onChange={e=>setCalcInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')try{setCalcResult(String(calculate(calcInput)));setError('')}catch(err){setError(mapLeadMasterError(err).message)}}}/><div className="mt-3 flex flex-wrap gap-2"><button className={action} onClick={()=>{try{setCalcResult(String(calculate(calcInput)));setError('')}catch(err){setError(mapLeadMasterError(err).message)}}}>Calculate</button><button className={secondary} onClick={()=>{setCalcInput('');setCalcResult('')}}>Clear</button></div>{calcResult&&<p className="mt-4 rounded-xl bg-[#f6f6f6] p-4 text-2xl font-semibold">{calcResult}</p>}</section>}

      {selected==='currency'&&<section className={panel+' max-w-2xl'}><h2 className="font-semibold">Currency Conversion</h2><p className="mt-1 text-sm text-[#777]">Get a recent reference rate before calculating your conversion.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Amount<input className={field+' mt-1'} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="text-sm">From<select className={field+' mt-1'} value={fromCurrency} onChange={e=>setFromCurrency(e.target.value)}>{['USD','PHP','MYR','EUR','GBP','SGD','AUD','JPY','CAD','CHF','THB','IDR'].map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm">To<select className={field+' mt-1'} value={toCurrency} onChange={e=>setToCurrency(e.target.value)}>{['PHP','USD','MYR','EUR','GBP','SGD','AUD','JPY','CAD','CHF','THB','IDR'].map(x=><option key={x}>{x}</option>)}</select></label></div><button className={action+' mt-4'} disabled={currencyBusy} onClick={()=>void convertCurrency()}>{currencyBusy?'Checking rate…':'Convert'}</button>{currencyResult&&<div className="mt-4 rounded-xl bg-[#f6f6f6] p-4"><p className="text-xs uppercase tracking-wider text-[#777]">Estimated conversion</p><p className="mt-1 text-2xl font-semibold">{currencyResult}</p><p className="mt-1 text-xs text-[#777]">{currencyDate?'Reference rate date: '+currencyDate:'No quote date returned'}. Final bank or provider rates may differ.</p></div>}</section>}

      {selected==='email-html-playground'&&<div className="grid gap-4 xl:grid-cols-2">
        <section className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">AI email designer</h2><p className="text-xs text-[#777]">Generate a draft, then review before exporting.</p></div><span className="rounded-full border border-[#ddd] px-2.5 py-1 text-[10px] uppercase tracking-wider">AI assisted</span></div><label className="mt-4 block text-sm">What should this email say?<textarea className={field+' mt-1'} rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)}/></label><label className="mt-3 block text-sm">Subject<input className={field+' mt-1'} value={subject} onChange={e=>setSubject(e.target.value)}/></label><label className="mt-3 block text-sm">HTML source<textarea className={field+' mt-1 font-mono text-xs'} rows={14} value={html} onChange={e=>setHtml(e.target.value)}/></label><div className="mt-3 flex flex-wrap gap-2"><button className={action} disabled={aiBusy} onClick={()=>void generateEmail()}>{aiBusy?'Preparing…':'Generate with AI'}</button><button className={secondary} onClick={()=>void copyHtml()}>{htmlCopied?'Copied':'Copy HTML'}</button><button className={secondary} onClick={downloadHtml}>Export HTML</button><button className={secondary} onClick={()=>setShowPreview(!showPreview)}>{showPreview?'Hide preview':'Show preview'}</button></div></section>
        <section className={panel}><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Email preview</h2><span className="text-xs text-[#777]">Sanitized preview</span></div><div className="mt-3 rounded-xl border border-[#e5e5e5] bg-white p-4"><p className="text-xs text-[#777]">Subject</p><p className="mt-1 font-semibold">{subject}</p></div>{showPreview&&<div className="mt-3 min-h-[480px] overflow-auto rounded-xl border border-[#e5e5e5] bg-white p-3"><div dangerouslySetInnerHTML={{__html:cleanHtml(html)}}/></div>}</section>
      </div>}
    </main>
    <ActionConfirmation request={confirmation} onCancel={()=>{setConfirmation(null);setConfirmationAction(null);}} onConfirm={async()=>{
      const action=confirmationAction;setConfirmation(null);setConfirmationAction(null);if(action)await action();
    }}/>
  </div>;
}
