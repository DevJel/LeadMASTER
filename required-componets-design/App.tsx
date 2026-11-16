import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LoadingIndicator } from '../src/dashboard-tsx/LoadingIndicator';
import { SendingIndicator, SendingPhase } from '../src/dashboard-tsx/SendingIndicator';
import { ActionConfirmation, ActionConfirmationRequest } from '../src/dashboard-tsx/ActionConfirmation';
import { SafeEmailHtml } from '../src/dashboard-tsx/SafeEmailHtml';
import UtilityApps from './UtilityApps';
import { GravatarAvatar } from '../src/dashboard-tsx/GravatarAvatar';
import { createMailSoundPlayer, createMailSoundTracker } from './mail-sounds.mjs';
import { mapLeadMasterError } from '../src/leadmaster-error-mapper.mjs';

type Folder = 'inbox' | 'sent' | 'drafts';
type View = 'compose' | 'inbox' | 'sent' | 'outbox' | 'deleted' | 'assistant' | 'automation' | 'templates' | 'scheduled' | 'settings';
type Email = { id:string; sender:string; email:string; initials:string; color:string; subject:string; snippet:string; body:string; htmlBody?:string; fromAddress?:string; sourceUrl?:string; detailLoaded?:boolean; label:string|null; date:string; time:string; unread:boolean; attachment:boolean; folder:Folder; isUser?:boolean; company?:string; value?:string; deliveryStatus?:string };
type Template = { id:string; name:string; subject:string; body:string; category:string; recordId?:string };
type Rule = { id:string; name:string; triggerType:'sender'|'subject'; contains:string; action:'label'|'star'|'archive'|'move'; actionValue:string; enabled:boolean; recordId?:string };
type ScheduledItem = { id:string; to:string; subject:string; body:string; when:string; recordId?:string };
type OutboxItem = { id:string; to:string; subject:string; body:string; status:'Queued'|'Sending'|'Failed'|'Unknown'; error?:string; attempt:string };
type Contact = { id:string; name:string; email:string; company:string; phone:string; role:string; location:string; recordId?:string };
type Reminder = { id:string; title:string; date:string; time:string; done:boolean; recordId?:string };
type NoteItem = { id:string; title:string; body:string; pinned:boolean; recordId?:string };

type IconName = 'inbox'|'sent'|'outbox'|'deleted'|'assistant'|'automation'|'templates'|'scheduled'|'settings'|'search'|'menu'|'help'|'apps'|'archive'|'trash'|'clock'|'star'|'refresh'|'more'|'chevron-down'|'chevron-right'|'x'|'back'|'reply'|'forward'|'paperclip'|'smile'|'bold'|'italic'|'underline'|'strike'|'align'|'align-center'|'align-right'|'justify'|'calendar'|'keep'|'tasks'|'contacts'|'plus'|'restore'|'edit'|'copy'|'check'|'alert'|'spark'|'zap'|'flame'|'close'|'send'|'filter'|'link'|'list'|'drag'|'pin'|'note'|'panel'|'user'|'building'|'compose'|'html'|'eye'|'quote'|'divider'|'font'|'code'|'table'|'image'|'indent'|'outdent'|'undo'|'redo'|'clear'|'spell'|'numbered';
function UniformIcon({name, size=20, className=''}:{name:IconName; size?:number; className?:string}){
  const p = {fill:'none', stroke:'currentColor', strokeWidth:1.8, strokeLinecap:'round' as const, strokeLinejoin:'round' as const};
  const paths: Record<IconName, React.ReactNode> = {
    inbox: <><path {...p} d="M3 5h18v14H3z"/><path {...p} d="M3 7.5 12 13l9-5.5"/></>,
    sent: <><path {...p} d="M22 2 11 13"/><path {...p} d="M22 2 15 22l-4-9-9-4 20-7z"/></>,
    outbox: <><path {...p} d="M4 6h16v12H4z"/><path {...p} d="M12 11V3"/><path {...p} d="M8 7l4-4 4 4"/></>,
    deleted: <><path {...p} d="M4 7h16"/><path {...p} d="M9 7V4h6v3"/><path {...p} d="M6 7l1 13h10l1-13"/><path {...p} d="M10 11v6M14 11v6"/></>,
    assistant: <><path {...p} d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path {...p} d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>,
    automation: <><circle {...p} cx="6" cy="6" r="2.4"/><circle {...p} cx="18" cy="12" r="2.4"/><circle {...p} cx="6" cy="18" r="2.4"/><path {...p} d="M8.4 7.3 15.6 10.7"/><path {...p} d="M8.4 16.7 15.6 13.3"/></>,
    templates: <><path {...p} d="M12 3l9 5-9 5-9-5 9-5z"/><path {...p} d="M3 13l9 5 9-5"/><path {...p} d="M3 17l9 5 9-5"/></>,
    scheduled: <><rect {...p} x="3" y="5" width="18" height="16" rx="2"/><path {...p} d="M3 10h18"/><path {...p} d="M12 13v4l2.5 1.5"/><path {...p} d="M8 3v4M16 3v4"/></>,
    settings: <><circle {...p} cx="12" cy="12" r="3"/><path {...p} d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></>,
    search: <><circle {...p} cx="11" cy="11" r="7"/><path {...p} d="m21 21-4.3-4.3"/></>,
    menu: <><path {...p} d="M4 7h16M4 12h16M4 17h16"/></>,
    help: <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2.5-2.5 4"/><circle {...p} cx="12" cy="17" r="0.6"/></>,
    apps: <><circle {...p} cx="6" cy="6" r="1.6"/><circle {...p} cx="12" cy="6" r="1.6"/><circle {...p} cx="18" cy="6" r="1.6"/><circle {...p} cx="6" cy="12" r="1.6"/><circle {...p} cx="12" cy="12" r="1.6"/><circle {...p} cx="18" cy="12" r="1.6"/><circle {...p} cx="6" cy="18" r="1.6"/><circle {...p} cx="12" cy="18" r="1.6"/><circle {...p} cx="18" cy="18" r="1.6"/></>,
    archive: <><rect {...p} x="3" y="4" width="18" height="4"/><path {...p} d="M5 8h14v10H5z"/><path {...p} d="M9 12h6"/></>,
    trash: <><path {...p} d="M4 7h16"/><path {...p} d="M9 7V4h6v3"/><path {...p} d="M6 7l1 13h10l1-13"/></>,
    clock: <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 7v5l3 2"/></>,
    star: <><path {...p} d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z"/></>,
    refresh: <><path {...p} d="M20 12a8 8 0 1 1-2.34-5.66"/><path {...p} d="M20 3v4h-4"/></>,
    more: <><circle {...p} cx="5" cy="12" r="1.2"/><circle {...p} cx="12" cy="12" r="1.2"/><circle {...p} cx="19" cy="12" r="1.2"/></>,
    'chevron-down': <><path {...p} d="m6 9 6 6 6-6"/></>,
    'chevron-right': <><path {...p} d="m9 6 6 6-6 6"/></>,
    x: <><path {...p} d="M6 6l12 12M18 6 6 18"/></>,
    back: <><path {...p} d="M19 12H5"/><path {...p} d="m11 18-6-6 6-6"/></>,
    reply: <><path {...p} d="M4 12h11a5 5 0 0 1 0 10H9"/><path {...p} d="m8 8-4 4 4 4"/></>,
    forward: <><path {...p} d="M20 12H9a5 5 0 0 0 0 10h6"/><path {...p} d="m16 8 4 4-4 4"/></>,
    paperclip: <><path {...p} d="m8 12 6.5-6.5a4 4 0 0 1 5.7 5.7L9 22.5A6 6 0 0 1 .5 14L11 3.5"/></>,
    smile: <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M8 10h.01M16 10h.01"/><path {...p} d="M8 14a4 4 0 0 0 8 0"/></>,
    bold: <><path {...p} d="M7 4h5a3.5 3.5 0 0 1 0 7H7z"/><path {...p} d="M7 11h6a3.5 3.5 0 0 1 0 7H7z"/></>,
    italic: <><path {...p} d="M13 4h6M9 20h6M14 4 10 20"/></>,
    underline: <><path {...p} d="M6 4v6a6 6 0 0 0 12 0V4"/><path {...p} d="M4 20h16"/></>,
    strike: <><path {...p} d="M5 8a4 4 0 0 1 14 0"/><path {...p} d="M5 16a4 4 0 0 0 14 0"/><path {...p} d="M4 12h16"/></>,
    align: <><path {...p} d="M4 6h16M4 11h10M4 16h16M4 21h10"/></>,
    'align-center': <><path {...p} d="M4 6h16M7 11h10M4 16h16M7 21h10"/></>,
    'align-right': <><path {...p} d="M4 6h16M10 11h10M4 16h16M10 21h10"/></>,
    justify: <><path {...p} d="M4 6h16M4 11h16M4 16h16M4 21h16"/></>,
    code: <><path {...p} d="M8 6 4 12l4 6"/><path {...p} d="m16 6 4 6-4 6"/><path {...p} d="m12 4-1 16"/></>,
    table: <><rect {...p} x="3" y="4" width="18" height="16" rx="2"/><path {...p} d="M3 10h18M3 15h18M9 4v16M15 4v16"/></>,
    image: <><rect {...p} x="3" y="4" width="18" height="16" rx="2"/><circle {...p} cx="9" cy="10" r="1.5"/><path {...p} d="m4 18 5-5 4 4 3-3 4 4"/></>,
    indent: <><path {...p} d="M4 6h16M4 11h16M4 16h16M4 21h10"/><path {...p} d="m11 4 4 4-4 4"/></>,
    outdent: <><path {...p} d="M4 6h16M4 11h16M4 16h16M4 21h10"/><path {...p} d="m13 4-4 4 4 4"/></>,
    undo: <><path {...p} d="M9 14 4 9l5-5"/><path {...p} d="M4 9h10a6 6 0 0 1 0 12h-3"/></>,
    redo: <><path {...p} d="m15 14 5-5-5-5"/><path {...p} d="M20 9H10a6 6 0 0 0 0 12h3"/></>,
    clear: <><path {...p} d="M5 5l14 14M19 5 5 19"/><path {...p} d="M4 12h4M16 12h4"/></>,
    spell: <><path {...p} d="M6 20 12 4l6 16"/><path {...p} d="M8.5 13h7"/><circle {...p} cx="18" cy="18" r="2.5"/></>,
    numbered: <><path {...p} d="M7 6h13M7 12h13M7 18h13"/><path {...p} d="M4 6h.01M4 12h.01M4 18h.01"/></>,
    calendar: <><rect {...p} x="3" y="5" width="18" height="16" rx="2"/><path {...p} d="M3 10h18"/><path {...p} d="M8 3v4M16 3v4"/></>,
    keep: <><path {...p} d="M9 18h6M10 21h4"/><path {...p} d="M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0 0 12 3z"/></>,
    tasks: <><path {...p} d="m4 6 2 2 4-4"/><path {...p} d="m4 12 2 2 4-4"/><path {...p} d="m4 18 2 2 4-4"/><path {...p} d="M12 6h8M12 12h8M12 18h8"/></>,
    contacts: <><circle {...p} cx="9" cy="8" r="3.5"/><path {...p} d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5"/><path {...p} d="M16 5.5a3.5 3.5 0 0 1 0 6.5"/><path {...p} d="M17.5 14.7c1.8.7 3 2.2 3 5.3"/></>,
    plus: <><path {...p} d="M12 5v14M5 12h14"/></>,
    restore: <><path {...p} d="M4 9a8 8 0 0 1 14.9-2"/><path {...p} d="M19 4v5h-5"/><path {...p} d="M20 15a8 8 0 0 1-14.9 2"/><path {...p} d="M5 20v-5h5"/></>,
    edit: <><path {...p} d="M4 20h4L20 8l-4-4L4 16z"/><path {...p} d="m13.5 6.5 4 4"/></>,
    copy: <><rect {...p} x="9" y="9" width="11" height="11" rx="2"/><path {...p} d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    check: <><path {...p} d="m4 12.5 5 5L20 6.5"/></>,
    alert: <><path {...p} d="M12 3 2.5 20h19z"/><path {...p} d="M12 10v4"/><circle {...p} cx="12" cy="17" r="0.6"/></>,
    spark: <><path {...p} d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/></>,
    zap: <><path {...p} d="M13 2 4 14h6l-1 8 9-12h-6z"/></>,
    flame: <><path {...p} d="M12 3c1 4-3 5-3 9a5 5 0 0 0 10 0c0-2-1-3.5-2.5-4.5C15.5 9 14 11 12 11c.5-3 0-6 0-8z"/></>,
    close: <><path {...p} d="M6 6l12 12M18 6 6 18"/></>,
    send: <><path {...p} d="M22 2 11 13"/><path {...p} d="M22 2 15 22l-4-9-9-4 20-7z"/></>,
    filter: <><path {...p} d="M4 6h16M7 12h10M10 18h4"/></>,
    link: <><path {...p} d="M10 14a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path {...p} d="M14 10a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></>,
    list: <><path {...p} d="M8 6h13M8 12h13M8 18h13"/><circle {...p} cx="4" cy="6" r="1"/><circle {...p} cx="4" cy="12" r="1"/><circle {...p} cx="4" cy="18" r="1"/></>,
    drag: <><circle {...p} cx="9" cy="5" r="1"/><circle {...p} cx="15" cy="5" r="1"/><circle {...p} cx="9" cy="12" r="1"/><circle {...p} cx="15" cy="12" r="1"/><circle {...p} cx="9" cy="19" r="1"/><circle {...p} cx="15" cy="19" r="1"/></>,
    pin: <><path {...p} d="M12 3v13"/><path {...p} d="m9 3 6 0"/><path {...p} d="M12 16l-2 5h4z"/></>,
    note: <><path {...p} d="M5 3h14v18H5z"/><path {...p} d="M8 8h8M8 12h8M8 16h5"/></>,
    panel: <><rect {...p} x="3" y="4" width="18" height="16" rx="2"/><path {...p} d="M15 4v16"/></>,
    user: <><circle {...p} cx="12" cy="8" r="4"/><path {...p} d="M4 20c0-3.5 3.6-5.5 8-5.5s8 2 8 5.5"/></>,
    building: <><path {...p} d="M4 21h16"/><path {...p} d="M6 21V4h8v17"/><path {...p} d="M14 8h4v13"/><path {...p} d="M9 7h2M9 11h2M9 15h2"/></>,
    compose: <><path {...p} d="M4 20h4L20 8l-4-4L4 16z"/><path {...p} d="m13.5 6.5 4 4"/></>,
    html: <><path {...p} d="M8 6 4 12l4 6"/><path {...p} d="m16 6 4 6-4 6"/><path {...p} d="m13 4-2 16"/></>,
    eye: <><path {...p} d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle {...p} cx="12" cy="12" r="3"/></>,
    quote: <><path {...p} d="M5 15c-1.5 0-2.5-1-2.5-2.5C2.5 9 5 6 8.5 5l.8 1.8C7.5 7.5 6.5 8.5 6 10c.2.5.7.8 1.5.8 1.4 0 2.5 1.1 2.5 2.5S8.9 15 7.5 15H5z"/><path {...p} d="M15 15c-1.5 0-2.5-1-2.5-2.5 0-3.5 2.5-6.5 6-7.5l.8 1.8c-1.8.7-2.8 1.7-3.3 3.2.2.5.7.8 1.5.8 1.4 0 2.5 1.1 2.5 2.5S18.9 15 17.5 15H15z"/></>,
    divider: <><path {...p} d="M4 12h16"/><circle {...p} cx="12" cy="12" r="1.5"/></>,
    font: <><path {...p} d="M6 20 12 4l6 16"/><path {...p} d="M8.5 13h7"/><path {...p} d="M5 20h4M15 20h4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">{paths[name]}</svg>;
}
function Spinner({size=18}:{size?:number}){ return <svg width={size} height={size} viewBox="0 0 24 24" className="lm-spinner" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>; }

const DEFAULT_COMPONENT_ORDER: View[] = ['compose','inbox','sent','outbox','deleted','assistant','automation','templates','scheduled'];
const COMPOSE_FONTS = [
  {name:'Arial', value:'Arial, Helvetica, sans-serif'},
  {name:'Georgia', value:'Georgia, "Times New Roman", serif'},
  {name:'Times New Roman', value:'"Times New Roman", Times, serif'},
  {name:'Verdana', value:'Verdana, Geneva, sans-serif'},
  {name:'Courier New', value:'"Courier New", Courier, monospace'},
  {name:'Roboto', value:'Roboto, Arial, sans-serif'},
  {name:'Inter', value:'Inter, ui-sans-serif, system-ui, sans-serif'},
  {name:'Helvetica', value:'Helvetica, Arial, sans-serif'},
  {name:'Sans — System', value:'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'},
];
const COMPOSE_FONT_SIZES = [
  {name:'Small · 12px', value:'12px'},
  {name:'Normal · 14px', value:'14px'},
  {name:'Medium · 16px', value:'16px'},
  {name:'Large · 18px', value:'18px'},
  {name:'Huge · 22px', value:'22px'},
];
const COMPOSE_COLORS = [
  {name:'Black', value:'#000000'},
  {name:'Dark gray', value:'#374151'},
  {name:'Gray', value:'#6B7280'},
  {name:'Light gray', value:'#9CA3AF'},
  {name:'White', value:'#FFFFFF'},
];
const HTML_SNIPPETS = [
  {name:'Button', html:'<a href="https://example.com" style="display:inline-block;background:#000;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Open link</a>'},
  {name:'Table', html:'<table style="width:100%;border-collapse:collapse"><tr><td style="border:1px solid #000;padding:8px">Left</td><td style="border:1px solid #000;padding:8px">Right</td></tr><tr><td style="border:1px solid #000;padding:8px">Left</td><td style="border:1px solid #000;padding:8px">Right</td></tr></table>'},
  {name:'Divider', html:'<hr style="border:0;border-top:1px solid #000;margin:16px 0" />'},
  {name:'Image', html:'<p><img src="https://example.com/photo.jpg" alt="Describe this image" style="max-width:100%;border:1px solid #000;border-radius:8px" /></p>'},
  {name:'Signature Block', html:'<p><strong>LeadMASTER</strong></p>'},
  {name:'Callout Box', html:'<div style="border:1px solid #000;padding:12px;border-radius:8px"><strong>Callout</strong><p style="margin:6px 0 0">Add your callout text here.</p></div>'},
  {name:'Callout box', html:'<div style="border:1px solid #000;padding:12px;border-radius:8px"><strong>Callout</strong><p style="margin:6px 0 0">Add your callout text here.</p></div>'},
  {name:'Two-column table', html:'<table style="width:100%;border-collapse:collapse"><tr><td style="border:1px solid #000;padding:8px">Left</td><td style="border:1px solid #000;padding:8px">Right</td></tr></table>'},
  {name:'Button link', html:'<a href="https://example.com" style="display:inline-block;background:#000;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Open link</a>'},
  {name:'Signature block', html:'<p><strong>Alex Morgan</strong><br/>LeadMaster · Sales Lead<br/><a href="mailto:alex.morgan@leadmaster.com">alex.morgan@leadmaster.com</a></p>'},
];
const COMPOSE_SIGNATURES = [
  {name:'LeadMASTER', value:'Best,\nLeadMASTER'},
  {name:'Short — Thanks, Alex', value:'Thanks,\nAlex'},
  {name:'Formal', value:'Kind regards,\nLeadMASTER'},
];
const CANNED_RESPONSES = [
  {name:'Quick thanks', body:'Hi,\n\nThanks so much for your message — I’ll follow up shortly.\n\nBest,\nAlex'},
  {name:'Following up', body:'Hi,\n\nJust following up on my last note — happy to help if you have questions.\n\nBest,\nAlex'},
  {name:'Book a call', body:'Hi,\n\nWould a 20-minute call on Tuesday or Wednesday morning work for you?\n\nBest,\nAlex'},
];
function sanitizeHtml(html:string){ const purifier=(window as any).DOMPurify; if(purifier && typeof purifier.sanitize==='function') return purifier.sanitize(html,{USE_PROFILES:{html:true},FORBID_TAGS:['script','style','iframe','object','embed','form','meta','link'],FORBID_ATTR:['srcdoc'],ALLOW_DATA_ATTR:false}); return html.replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[ch]); }
function isValidRecipientChip(v:string){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function containsHtml(s:string){ return /<[a-z][\s\S]*>/i.test(s); }
function initialsFor(name:string){ return name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase() || '—'; }
const PERSONAL_MAIL_DOMAINS = new Set(['gmail.com','yahoo.com','icloud.com','outlook.com','hotmail.com','protonmail.com','aol.com','mail.com','gmx.com','zoho.com']);
function avatarKindForEmail(email:string){ const domain = (email||'').split('@')[1]?.toLowerCase().trim() || ''; return (PERSONAL_MAIL_DOMAINS.has(domain) || [...PERSONAL_MAIL_DOMAINS].some(d=>domain.endsWith('.'+d))) ? 'user' as const : 'building' as const; }
function avatarLabelForEmail(email:string){ return avatarKindForEmail(email)==='building' ? 'Organization' : 'Personal'; }
function AvatarIcon({email, size=18}:{email:string; size?:number}){ return <GravatarAvatar email={email} size={size} fallback={<UniformIcon name={avatarKindForEmail(email)} size={size} />} />; }

async function api(action:string, args:any, signal?:AbortSignal){
  const res = await fetch("/api/workspace/actions", {method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body: JSON.stringify({action, args}), ...(signal ? {signal} : {})});
  const json = await res.json().catch(()=>({}));
  if(!res.ok || json.error) throw new Error(mapLeadMasterError(json.error || 'system').message);
  return json.data;
}
function uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }

export default function App(){
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [onlyAttachment, setOnlyAttachment] = useState(false);
  const [view, setView] = useState<View>('inbox');
  const [previousView, setPreviousView] = useState<View>('inbox');
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [deletedForever, setDeletedForever] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [prefsId, setPrefsId] = useState<string|null>(null);
  const [userEmails, setUserEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openEmailId, setOpenEmailId] = useState<string|null>(null);
  const [detailState, setDetailState] = useState<{id:string; status:'loading'|'error'|'ready'}|null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({to:'', cc:'', bcc:'', subject:'', body:'', showCc:false});
  const [composeMode, setComposeMode] = useState<'new'|'reply'|'forward'|'draft'|'template'>('new');
  const [replyTo, setReplyTo] = useState<Email|null>(null);
  const [fmt, setFmt] = useState({bold:false, italic:false, underline:false});
  const [showEmoji, setShowEmoji] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [density, setDensity] = useState<'comfortable'|'compact'>('comfortable');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showApps, setShowApps] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [tasksDone, setTasksDone] = useState<Set<string>>(new Set(['t2']));

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');
  const [viewLoading, setViewLoading] = useState(true);
  const [viewError, setViewError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [loadingOverlayDismissed, setLoadingOverlayDismissed] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number|null>(null);
  const refreshLock = useRef(false);
  const pollLock = useRef(false);
  const mainScrollRef = useRef<HTMLElement|null>(null);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [confirmation, setConfirmation] = useState<ActionConfirmationRequest|null>(null);
  const [confirmationAction, setConfirmationAction] = useState<(()=>Promise<void>|void)|null>(null);
  const [sendingPhase, setSendingPhase] = useState<SendingPhase|null>(null);
  const loadingOverlayActive = isLoading || viewLoading || isRefreshing || busy || Boolean(sendingPhase) || detailState?.status === 'loading';
  useEffect(() => { if (loadingOverlayActive) setLoadingOverlayDismissed(false); }, [loadingOverlayActive]);
  const touchStartY = useRef<number|null>(null);
  const pointerStartY = useRef<number|null>(null);
  const wheelDistance = useRef(0);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [theme] = useState<'system'|'light'|'dark'>('light');
  const [profileName, setProfileName] = useState('LeadMASTER User');
  const [profileEmail, setProfileEmail] = useState('hello@work.jelvan.pro');
  const [signature, setSignature] = useState('Best,\nLeadMASTER');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(true);
  const [notifSound, setNotifSound] = useState(false);
  const soundEnabled = useRef(false);
  soundEnabled.current = notifSound;
  const soundPlayer = useRef(createMailSoundPlayer());
  const trackMailSounds = useRef(createMailSoundTracker());
  useEffect(()=>{
    const unlock=()=>{if(soundEnabled.current) soundPlayer.current.unlock();};
    document.addEventListener('pointerdown',unlock); document.addEventListener('keydown',unlock);
    return ()=>{document.removeEventListener('pointerdown',unlock); document.removeEventListener('keydown',unlock); soundPlayer.current.close();};
  },[]);
  function playMailSound(kind:'receive'|'sent'|'deleted'){if(soundEnabled.current) soundPlayer.current.play(kind);}
  const [replyBehavior, setReplyBehavior] = useState<'reply'|'reply-all'>('reply');
  const [vacationOn, setVacationOn] = useState(false);
  const [vacationSubject, setVacationSubject] = useState('Out of office — back Monday');
  const [vacationBody, setVacationBody] = useState('Thanks for your message! I’m out of office and will reply when I’m back on Monday. For urgent leads, contact team@leadmaster.com.');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({name:'', triggerType:'sender' as 'sender'|'subject', contains:'', action:'label' as Rule['action'], actionValue:'Work'});
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templatePreviewId, setTemplatePreviewId] = useState('');
  const [templateForm, setTemplateForm] = useState({id:'', name:'', subject:'', body:'', category:'Sales'});
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({id:'', to:'', subject:'', body:'', when:'Tomorrow · 9:00 AM'});
  const [scheduleWhen, setScheduleWhen] = useState('');
  const [schedulePicker, setSchedulePicker] = useState<{id:string; when:string; dateTime:string}|null>(null);
  const [assistantTab, setAssistantTab] = useState<'summary'|'drafts'|'cleanup'|'priority'>('summary');
  const [assistantResult, setAssistantResult] = useState<string>('');
  const [cleanupApplied, setCleanupApplied] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  // NEW — Compose tab, Components bar, Sender profile, Right panel
  const [componentOrder, setComponentOrder] = useState<View[]>(DEFAULT_COMPONENT_ORDER);
  const [expandedComponents, setExpandedComponents] = useState<Set<View>>(new Set());
  const [hiddenComponents, setHiddenComponents] = useState<Set<View>>(new Set());
  const [organizerSaved, setOrganizerSaved] = useState(false);
  const [dragKey, setDragKey] = useState<View|null>(null);
  const [dropKey, setDropKey] = useState<View|null>(null);
  const [selectedSender, setSelectedSender] = useState<{name:string; email:string; company?:string}|null>(null);
  const [senderNotes, setSenderNotes] = useState<Record<string,string>>({});
  const [senderNoteDraft, setSenderNoteDraft] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [calendarDate, setCalendarDate] = useState(()=>{ const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState(()=> new Date().toISOString().slice(0,10));
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderForm, setReminderForm] = useState({title:'', date:new Date().toISOString().slice(0,10), time:'09:00'});
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({id:'', title:'', body:'', pinned:false});
  const [newChip, setNewChip] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [templatePick, setTemplatePick] = useState('');
  const [schedulePick, setSchedulePick] = useState('Tomorrow · 9:00 AM');
  // HTML insert + fonts + Inbox/Sent preview
  const [composeFont, setComposeFont] = useState(COMPOSE_FONTS[0].value);
  const [composeFontSize, setComposeFontSize] = useState('14px');
  const [composeAlign, setComposeAlign] = useState<'left'|'center'|'right'|'justify'>('left');
  const [composeColor, setComposeColor] = useState('#000000');
  const [composeHighlight, setComposeHighlight] = useState('transparent');
  const [showHtmlInsert, setShowHtmlInsert] = useState(false);
  const [htmlSnippet, setHtmlSnippet] = useState('');
  const [htmlTemplate, setHtmlTemplate] = useState('');
  const [showComposePreview, setShowComposePreview] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewEmailId, setPreviewEmailId] = useState<string|null>(null);
  const [detailPreviewMode, setDetailPreviewMode] = useState<'text'|'html'>('text');
  const [composePriority, setComposePriority] = useState<'normal'|'high'|'low'>('normal');
  const [composeReadReceipt, setComposeReadReceipt] = useState(false);
  const [composeHistory, setComposeHistory] = useState<string[]>([]);
  const [composeRedoHistory, setComposeRedoHistory] = useState<string[]>([]);
  const [composeLabel, setComposeLabel] = useState('Work');
  const [composeSpellCheck, setComposeSpellCheck] = useState(true);
  const [composeViewSource, setComposeViewSource] = useState(false);
  const [composeCustomSize, setComposeCustomSize] = useState('');
  const [composeDiscardConfirm, setComposeDiscardConfirm] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<'vertical'|'horizontal'>('vertical');
  const [htmlDialogOpen, setHtmlDialogOpen] = useState(false);
  const [htmlDialogValue, setHtmlDialogValue] = useState('');
  const [htmlDialogPreview, setHtmlDialogPreview] = useState(true);
  const [linkEditOpen, setLinkEditOpen] = useState(false);
  const [linkEditValue, setLinkEditValue] = useState('');
  const [imageUrlOpen, setImageUrlOpen] = useState(false);
  const [imageUrlValue, setImageUrlValue] = useState('');
  const [imageAltValue, setImageAltValue] = useState('');
  const [composeSignaturePick, setComposeSignaturePick] = useState('');
  const [cannedPick, setCannedPick] = useState('');
  const [fmtStrike, setFmtStrike] = useState(false);

  useEffect(()=>{setViewError(false);setViewLoading(false);},[view]);
  async function retryCurrentView(){setViewError(false);return await reloadRecords();}

  const allEmails = useMemo(()=> userEmails.filter(e=>!deletedForever.has(e.id)), [userEmails, deletedForever]);
  useEffect(()=>{ document.documentElement.setAttribute('data-theme','light'); },[theme]);

  async function reloadRecords(options:{silent?:boolean; timeoutMs?:number; background?:boolean}={}){
    const silent = options.silent === true;
    const requestController = silent ? new AbortController() : null;
    const requestTimeout = requestController ? window.setTimeout(()=>requestController.abort(),Math.max(1,options.timeoutMs??10000)) : null;
    const requestSignal = requestController?.signal;
    if(!silent){ setIsLoading(true); setLoadError(''); }
    else if(!options.background) setRefreshError('');
    try{
      const [prefsData, msgsData, tplData, ruleData, schedData, contactsData, remindersData, notesData, inboxData, sentData, deletedData] = await Promise.all([
        api("records.list", {collection:'leadmaster_prefs'}, requestSignal),
        api("records.list", {collection:'leadmaster_messages'}, requestSignal),
        api("records.list", {collection:'leadmaster_templates'}, requestSignal),
        api("records.list", {collection:'leadmaster_rules'}, requestSignal),
        api("records.list", {collection:'leadmaster_scheduled'}, requestSignal),
        api("records.list", {collection:'leadmaster_contacts'}, requestSignal),
        api("records.list", {collection:'leadmaster_reminders'}, requestSignal),
        api("records.list", {collection:'leadmaster_notes'}, requestSignal),
        fetch('/api/admin/mail?folder=inbox', {credentials:'same-origin',signal:requestSignal}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`Inbox request failed (${r.status})`);return j;}),
        fetch('/api/admin/mail?folder=sent', {credentials:'same-origin',signal:requestSignal}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`Sent request failed (${r.status})`);return j;}),
        fetch('/api/admin/mail?folder=deleted', {credentials:'same-origin',signal:requestSignal}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`Deleted request failed (${r.status})`);return j;}),
      ]);
      if(!Array.isArray(prefsData?.records) || !Array.isArray(msgsData?.records) || !Array.isArray(tplData?.records) || !Array.isArray(ruleData?.records) || !Array.isArray(schedData?.records) || !Array.isArray(contactsData?.records) || !Array.isArray(remindersData?.records) || !Array.isArray(notesData?.records) || !Array.isArray(inboxData?.items) || !Array.isArray(sentData?.items) || !Array.isArray(deletedData?.items)) throw new Error('The server returned an incomplete workspace snapshot.');
      const prefsRec = prefsData?.records?.[0];
      const soundsActive = typeof prefsRec?.value?.notifSound === 'boolean' ? prefsRec.value.notifSound : soundEnabled.current;
      const soundEvents = trackMailSounds.current(inboxData.items, sentData.items);
      if(soundsActive) for(const kind of soundEvents) soundPlayer.current.play(kind);
      if(prefsRec){
        setPrefsId(prefsRec.id); const v = prefsRec.value||{};
        if(v.starred) setStarred(new Set(v.starred)); if(v.read) setReadIds(new Set(v.read)); if(v.archived) setArchived(new Set(v.archived));
        if(v.deleted) setDeleted(new Set(v.deleted)); if(v.deletedForever) setDeletedForever(new Set(v.deletedForever)); if(v.snoozed) setSnoozed(new Set(v.snoozed));
        if(v.density) setDensity(v.density); if(v.profileName) setProfileName(v.profileName); if(v.profileEmail) setProfileEmail(v.profileEmail); if(v.signature) setSignature(v.signature);
        if(typeof v.notifEmail==='boolean') setNotifEmail(v.notifEmail); if(typeof v.notifDesktop==='boolean') setNotifDesktop(v.notifDesktop); if(typeof v.notifSound==='boolean') setNotifSound(v.notifSound);
        if(v.replyBehavior) setReplyBehavior(v.replyBehavior); if(typeof v.vacationOn==='boolean') setVacationOn(v.vacationOn); if(v.vacationSubject) setVacationSubject(v.vacationSubject); if(v.vacationBody) setVacationBody(v.vacationBody);
        if(Array.isArray(v.componentOrder) && v.componentOrder.length){ const merged = [...(v.componentOrder as View[]), ...DEFAULT_COMPONENT_ORDER].filter((x,i,a)=>a.indexOf(x)===i); setComponentOrder(merged); }
        if(Array.isArray(v.componentHidden)) setHiddenComponents(new Set(v.componentHidden as View[]));
        if(v.senderNotes) setSenderNotes(v.senderNotes);
      }else setPrefsId(null);
      const formatMailDate=(value:any)=>{const d=new Date(typeof value==='number'?value:(value||Date.now()));return Number.isNaN(d.getTime())?'':d.toLocaleDateString([], {month:'short',day:'numeric'});};
      const formatMailTime=(value:any)=>{const d=new Date(typeof value==='number'?value:(value||Date.now()));return Number.isNaN(d.getTime())?'':d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});};
      const inboxRows=(inboxData?.items||[]).map((m:any)=>({id:m.id,sender:m.from_name||m.from_address||'Unknown sender',email:m.from_address||'',initials:initialsFor(m.from_name||m.from_address||'?'),color:'#333333',subject:m.subject||'(no subject)',snippet:'Open message to load its contents.',body:'',label:null,date:formatMailDate(m.received_at),time:formatMailTime(m.received_at),unread:!m.read_at,attachment:false,folder:'inbox' as Folder,isUser:false} as Email));
      const sentRows=(sentData?.items||[]).map((m:any)=>({id:m.id,sender:'Me',email:m.recipient||'',initials:'Me',color:'#111111',subject:m.subject||'(no subject)',snippet:`${m.delivery_status||m.queue_status||m.status||'Status unavailable'}`,body:m.text_body||'',label:null,date:formatMailDate(m.created_at),time:formatMailTime(m.created_at),unread:false,attachment:false,folder:'sent' as Folder,isUser:true,deliveryStatus:String(m.delivery_status||m.status||m.queue_status||'unknown').toLowerCase()} as Email));
      const deletedRows=(deletedData?.items||[]).map((m:any)=>({id:m.id,sender:m.from_address||m.from_email||'Deleted message',email:m.from_address||m.recipient||'',initials:'DL',color:'#555555',subject:m.subject||'(no subject)',snippet:'Deleted message',body:'',label:null,date:formatMailDate(m.received_at),time:formatMailTime(m.received_at),unread:false,attachment:false,folder:(m.kind==='sent'?'sent':'inbox') as Folder,isUser:m.kind==='sent'} as Email));
      const draftRows=(msgsData?.records||[]).filter((r:any)=>r.value?.kind==='draft').map((r:any)=>{const v=r.value||{};return {id:r.id,sender:'Draft',email:v.to||'',initials:'DR',color:'#555555',subject:v.subject||'(no subject)',snippet:(v.body||'').slice(0,110),body:v.body||'',label:null,date:'Saved',time:'',unread:false,attachment:false,folder:'drafts' as Folder,isUser:true} as Email;});
      setUserEmails([...inboxRows,...sentRows,...deletedRows,...draftRows]);
      setReadIds(new Set([...inboxRows.filter((m:any)=>!m.unread).map((m:any)=>m.id), ...((prefsRec?.value?.read||[]) as string[])]));
      setDeleted(new Set(deletedRows.map((m:any)=>m.id)));
      setOutbox((sentData?.items||[]).filter((m:any)=>['queued','processing','retrying'].includes(String(m.queue_status||'').toLowerCase()) || ['sending','failed','unknown'].includes(String(m.status||'').toLowerCase()) || ['bounced','rejected','failed'].includes(String(m.delivery_status||'').toLowerCase())).map((m:any)=>({id:m.id,to:m.recipient||'',subject:m.subject||'(no subject)',body:m.text_body||'',status:(String(m.status||'').toLowerCase()==='unknown'?'Unknown':['failed','bounced','rejected'].includes(String(m.delivery_status||m.status||'').toLowerCase())?'Failed':String(m.queue_status||'').toLowerCase()==='processing'?'Sending':'Queued') as OutboxItem['status'],error:m.error_code||undefined,attempt:`${['queued','processing','retrying'].includes(String(m.queue_status||'').toLowerCase()) ? m.queue_status : (m.delivery_status||m.status||'Status pending')} · ${formatMailTime(m.updated_at||m.created_at)}`})));
      setTemplates(tplData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id})));
      setRules(ruleData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id})));
      setScheduled(schedData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id})));
      setContacts(contactsData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id})));
      setReminders(remindersData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id})));
      setNotes(notesData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id})));
      setLastRefreshedAt(Date.now());
      return true;
    }catch(e){
      const safeError = mapLeadMasterError(e, 'workspace');
      if(silent) { if(!options.background) setRefreshError(safeError.message); }
      else setLoadError(safeError.message);
      return false;
    }finally{ if(requestTimeout!==null) window.clearTimeout(requestTimeout); if(!silent) setIsLoading(false); }
  }
  useEffect(()=>{ reloadRecords(); },[]);
  // Dashboard data is kept in React memory between views. Avoid timer/visibility polling;
  // the user refresh gesture below is the explicit source of a fresh workspace snapshot.
  async function refreshWorkspace(){
    if(refreshLock.current) return;
    if(pollLock.current || busyRef.current) return;
    refreshLock.current = true;
    setIsRefreshing(true);
    setRefreshError('');
    const startedAt = Date.now();
    let verified = false;
    try{
      while(Date.now() - startedAt < 12000){
        const remainingAtStart = Math.max(1, 12000 - (Date.now() - startedAt));
        verified = await reloadRecords({silent:true,background:true,timeoutMs:remainingAtStart});
        if(verified) break;
        const remaining = 12000 - (Date.now() - startedAt);
        if(remaining <= 0) break;
        await new Promise(resolve => window.setTimeout(resolve, Math.min(1500,remaining)));
      }
      if(!verified) setRefreshError('Could not refresh the workspace. Your previously loaded content is still available. Try again.');
    }finally{
      setIsRefreshing(false);
      refreshLock.current = false;
    }
  }
  function currentScrollTop(){ return mainScrollRef.current?.scrollTop || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0; }
  function handleRefreshTouchStart(event:React.TouchEvent<HTMLDivElement>){
    touchStartY.current = currentScrollTop() <= 0 && event.touches.length === 1 ? event.touches[0].clientY : null;
  }
  function handleRefreshTouchEnd(event:React.TouchEvent<HTMLDivElement>){
    const startY = touchStartY.current;
    touchStartY.current = null;
    if(startY !== null && currentScrollTop() <= 0 && event.changedTouches[0] && event.changedTouches[0].clientY - startY >= 72) void refreshWorkspace();
  }
  function handleRefreshPointerDown(event:React.PointerEvent<HTMLDivElement>){
    pointerStartY.current = event.pointerType === 'mouse' && event.button === 0 && currentScrollTop() <= 0 ? event.clientY : null;
  }
  function handleRefreshPointerUp(event:React.PointerEvent<HTMLDivElement>){
    const startY = pointerStartY.current;
    pointerStartY.current = null;
    if(startY !== null && currentScrollTop() <= 0 && event.clientY - startY >= 84) void refreshWorkspace();
  }
  function handleRefreshWheel(event:React.WheelEvent<HTMLDivElement>){
    if(currentScrollTop() > 0){ wheelDistance.current = 0; return; }
    if(event.deltaY < 0){
      wheelDistance.current += Math.abs(event.deltaY);
      if(wheelDistance.current >= 120){ wheelDistance.current = 0; void refreshWorkspace(); }
    }else wheelDistance.current = 0;
  }

  async function savePrefs(next?:any){
    const value = {starred:[...(next?.starred||starred)], read:[...(next?.read||readIds)], archived:[...(next?.archived||archived)], deleted:[...(next?.deleted||deleted)], deletedForever:[...(next?.deletedForever||deletedForever)], snoozed:[...(next?.snoozed||snoozed)], theme:'light', density: next?.density||density, profileName: next?.profileName||profileName, profileEmail: next?.profileEmail||profileEmail, signature: next?.signature||signature, notifEmail: next?.notifEmail ?? notifEmail, notifDesktop: next?.notifDesktop ?? notifDesktop, notifSound: next?.notifSound ?? notifSound, replyBehavior: next?.replyBehavior||replyBehavior, vacationOn: next?.vacationOn ?? vacationOn, vacationSubject: next?.vacationSubject||vacationSubject, vacationBody: next?.vacationBody||vacationBody, componentOrder: next?.componentOrder||componentOrder, componentHidden: next?.componentHidden || [...hiddenComponents], senderNotes: next?.senderNotes||senderNotes};
    try{ if(prefsId) await api("records.replace", {collection:'leadmaster_prefs', id:prefsId, value}); else { const created = await api("records.create", {collection:'leadmaster_prefs', value, idempotency_key:'leadmaster-prefs-v1'}); if(created?.id) setPrefsId(created.id); } setActionError(''); }
    catch(e){ setActionError('Could not save that change — it is shown here but not stored yet.'); }
  }

  function requestConfirmation(request:ActionConfirmationRequest, action:()=>Promise<void>|void){
    setConfirmation(request);
    setConfirmationAction(()=>action);
  }

    async function patchMail(id:string, action:string, extra:any={}){const res=await fetch(`/api/admin/mail/${encodeURIComponent(id)}`,{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action,...extra})});const j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(mapLeadMasterError(j.error||'system').message);return j;}
  async function openMessage(id:string){setOpenEmailId(id);markRead(id);const item=userEmails.find(e=>e.id===id);if(!item||item.folder==='drafts'||item.detailLoaded)return;setDetailState({id,status:'loading'});try{const res=await fetch(`/api/admin/mail/${encodeURIComponent(id)}`,{credentials:'same-origin'});const j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(j.error||'Message unavailable');const source=`/api/admin/mail/${id}/source`;setUserEmails(prev=>prev.map(e=>e.id===id?{...e,body:typeof j.text_body==='string'?j.text_body:(j.detail||''),htmlBody:typeof j.html_body==='string'?j.html_body:undefined,fromAddress:e.folder==='sent'&&typeof j.sender==='string'?j.sender:undefined,sourceUrl:j.download_url===source?source:undefined,detailLoaded:true,snippet:(j.text_body||j.detail||e.snippet).slice(0,110),email:e.folder==='inbox'?(j.from_address||e.email):e.email,sender:e.folder==='inbox'?(j.from_name||j.from_address||e.sender):e.sender,attachment:Number(j.attachments||0)>0}:e));setDetailState(prev=>prev?.id===id?{id,status:'ready'}:prev);}catch(e){setDetailState(prev=>prev?.id===id?{id,status:'error'}:prev);}}
  function toggleStar(id:string, e?:React.MouseEvent){ e?.stopPropagation(); const next = new Set(starred); next.has(id)? next.delete(id): next.add(id); setStarred(next); savePrefs({starred:next}); setStatus(next.has(id)?'Starred — priority lead saved':'Removed from starred'); }
  function markRead(id:string){ if(readIds.has(id)) return; const next=new Set(readIds); next.add(id); setReadIds(next); const mail=userEmails.find(e=>e.id===id); if(mail?.folder==='inbox') patchMail(id,'read',{read:true}).catch(e=>setActionError(mapLeadMasterError(e).message)); else savePrefs({read:next}); }
  async function doArchive(id:string){const mail=userEmails.find(e=>e.id===id);if(mail?.folder==='sent'){setStatus('Sent mail cannot be archived through this mailbox endpoint. Move it to Deleted instead.');return;}try{await patchMail(id,'archive');setArchived(prev=>new Set([...prev,id]));setStatus('Message archived.');setOpenEmailId(null);await reloadRecords();}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('Could not archive this message.');}}
  function doDelete(id:string){const item=userEmails.find(e=>e.id===id);requestConfirmation({title:'Move this message to Deleted?',message:'You can restore this message later from the Deleted folder.',itemLabel:item?.subject||'Selected message',confirmLabel:'Move to Deleted'},()=>doDeleteConfirmed(id));}
  async function doDeleteConfirmed(id:string){try{await patchMail(id,'delete');playMailSound('deleted');setDeleted(prev=>new Set([...prev,id]));setStatus('Message moved to Deleted.');setOpenEmailId(null);await reloadRecords();}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('The message could not be moved.');}}
  function doSnooze(id:string){ setStatus('Timed snooze is not enabled in this release. No mailbox change was made.'); }
  async function restoreEmail(id:string){try{await patchMail(id,'restore');setStatus('Message restored.');await reloadRecords();}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('Could not restore this message.');}}
  function deleteForever(id:string){const item=userEmails.find(e=>e.id===id);requestConfirmation({title:'Delete this message permanently?',message:'This message will be removed and cannot be restored.',itemLabel:item?.subject||'Selected message',confirmLabel:'Delete permanently'},()=>deleteForeverConfirmed(id));}
  async function deleteForeverConfirmed(id:string){try{await patchMail(id,'permanentDelete');playMailSound('deleted');setStatus('Message permanently deleted.');setOpenEmailId(null);await reloadRecords();}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('The message could not be deleted.');}}
  function emptyTrash(){requestConfirmation({title:'Empty the Deleted folder?',message:'All messages currently in Deleted will be permanently removed. This cannot be undone.',itemLabel:deleted.size+' message(s)',confirmLabel:'Empty Deleted folder'},()=>emptyTrashConfirmed());}
  async function emptyTrashConfirmed(){setBusy(true);let removed=0,failed=0;for(const id of deleted){try{await patchMail(id,'permanentDelete');removed++;}catch{failed++;}}if(removed>0)playMailSound('deleted');setConfirmEmpty(false);await reloadRecords();setBusy(false);setStatus(failed?`Removed ${removed} message(s); ${failed} need another review.`:`Removed ${removed} message(s).`);}

  const filtered = useMemo(()=>{
    let list = [...allEmails];
    if(view==='inbox') list = list.filter(e=> e.folder==='inbox' && !deleted.has(e.id) && !archived.has(e.id) && !snoozed.has(e.id));
    else if(view==='sent') list = list.filter(e=> e.folder==='sent' && !deleted.has(e.id));
    else if(view==='deleted') list = list.filter(e=> deleted.has(e.id));
    else list = list.filter(()=>false);
    if(search.trim()){ const q=search.toLowerCase(); list = list.filter(e=> (e.sender+' '+e.subject+' '+e.snippet+' '+e.body+' '+e.email).toLowerCase().includes(q)); }
    if(onlyAttachment) list = list.filter(e=> e.attachment);
    return list;
  },[allEmails, view, search, onlyAttachment, archived, deleted, snoozed]);

  const q = search.trim().toLowerCase();
  const filteredOutbox = useMemo(()=> outbox.filter(o=> !q || (o.subject+' '+o.to+' '+o.body).toLowerCase().includes(q)), [outbox, q]);
  const filteredTemplates = useMemo(()=> templates.filter(t=> !q || (t.name+' '+t.subject+' '+t.body+' '+t.category).toLowerCase().includes(q)), [templates, q]);
  const filteredRules = useMemo(()=> rules.filter(r=> !q || (r.name+' '+r.contains+' '+r.action).toLowerCase().includes(q)), [rules, q]);
  const filteredScheduled = useMemo(()=> scheduled.filter(s=> !q || (s.subject+' '+s.to+' '+s.body+' '+s.when).toLowerCase().includes(q)), [scheduled, q]);

  const counts = useMemo(()=>{
    const inbox = allEmails.filter(e=> e.folder==='inbox' && !archived.has(e.id) && !snoozed.has(e.id) && !deleted.has(e.id));
    return { inboxUnread: inbox.filter(e=> !readIds.has(e.id)).length, inboxTotal: inbox.length, sent: allEmails.filter(e=> e.folder==='sent' && !deleted.has(e.id)).length, deleted: deleted.size, outbox: outbox.length, scheduled: scheduled.length };
  },[allEmails, readIds, archived, deleted, snoozed, outbox, scheduled]);
  const openEmail = allEmails.find(e=> e.id===openEmailId) || null;

  function openCompose(mode:'new'|'reply'|'forward'|'draft'|'template', email?:Email, tpl?:Template){
    setComposeMode(mode); setReplyTo(email||null); setShowEmoji(false);
    if(mode==='reply' && email) setCompose({to:email.email, cc:'', bcc:'', subject: email.subject.startsWith('Re:')?email.subject:`Re: ${email.subject}`, body:`\n\n— — —\nOn ${email.date}, ${email.sender} wrote:\n${email.body}`, showCc:false});
    else if(mode==='forward' && email) setCompose({to:'', cc:'', bcc:'', subject:`Fwd: ${email.subject}`, body:`\n\n— — —\nForwarded message\nFrom: ${email.sender} <${email.email}>\n${email.body}`, showCc:false});
    else if(mode==='draft' && email) setCompose({to:email.email, cc:'', bcc:'', subject:email.subject, body:email.body, showCc:false});
    else if(mode==='template' && tpl) setCompose({to:'', cc:'', bcc:'', subject:tpl.subject, body:tpl.body + (signature? `\n\n${signature}`:''), showCc:false});
    else setCompose({to:'', cc:'', bcc:'', subject:'', body:'', showCc:false});
    if(view!=='compose') setPreviousView(view);
    setOpenEmailId(null); setMobileSidebar(false); setView('compose');
  }
  function openComposeTab(to?:string, subject?:string){
    if(view!=='compose') setPreviousView(view);
    setComposeMode('new'); setReplyTo(null); setShowEmoji(false);
    setCompose(prev=>({to: to ?? prev.to, cc:'', bcc:'', subject: subject ?? prev.subject, body: prev.body, showCc:false}));
    if(to!==undefined) setCompose({to, cc:'', bcc:'', subject:subject||'', body:'', showCc:false});
    setView('compose'); setOpenEmailId(null); setMobileSidebar(false);
  }
  function closeComposeTab(){ setView(previousView || 'inbox'); setStatus('Compose closed — returned to previous view.'); }
  function openSender(name:string, email:string, company?:string){
    setSelectedSender({name, email, company});
    setSenderNoteDraft(senderNotes[email] || '');
  }
  function senderInfoFor(email:string, name:string, company?:string){
    const c = contacts.find(x=>x.email.toLowerCase()===email.toLowerCase());
    const d = {role:c?.role||'Contact', phone:c?.phone||'—', location:c?.location||'—', labels:company||c?.company||'Contact', lastContacted:'—', notes:''};
    return {role:c?.role||d.role, phone:c?.phone||d.phone, location:c?.location||d.location, labels:d.labels, lastContacted:d.lastContacted, notes: senderNotes[email] || d.notes, company: c?.company || company || ''};
  }
  function addSenderToContacts(){
    if(!selectedSender) return;
    if(contacts.some(c=>c.email.toLowerCase()===selectedSender.email.toLowerCase())){ setStatus(`${selectedSender.name} is already in Contacts.`); return; }
    const info = senderInfoFor(selectedSender.email, selectedSender.name, selectedSender.company);
    const item: Contact = {id:uid(), name:selectedSender.name, email:selectedSender.email, company:info.company, phone:info.phone==='—'?'':info.phone, role:info.role, location:info.location==='—'?'':info.location};
    setContacts(prev=>[item, ...prev]); setStatus(`Added ${item.name} to Contacts.`);
    (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_contacts', value:item, idempotency_key:`leadmaster-contact-${item.id}`}); if(created?.id) setContacts(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError(mapLeadMasterError('system').message); } })();
  }
  function viewAllFromSender(){
    if(!selectedSender) return;
    setSearch(selectedSender.email); setView('inbox'); setSelectedSender(null); setOpenEmailId(null); setStatus(`Showing all emails from ${selectedSender.name}.`);
  }
  function sendEmailToSender(){
    if(!selectedSender) return;
    const to = selectedSender.email; const name = selectedSender.name; setSelectedSender(null); openComposeTab(to); setStatus(`Compose opened to ${name}.`);
  }
  function saveSenderNote(){
    if(!selectedSender) return;
    const next = {...senderNotes, [selectedSender.email]: senderNoteDraft}; setSenderNotes(next); savePrefs({senderNotes:next}); setStatus('Sender note saved.');
  }

  async function createRow(row:any){ return api("records.create", {collection:'leadmaster_messages', value:row, idempotency_key: row._key}); }
  async function handleSendOrDraft(kind:'sent'|'draft'){
    if(!compose.to.trim() && kind==='sent'){ setStatus('Add a recipient before sending.'); return; }
    if(!compose.subject.trim() && !compose.body.trim() && kind==='draft'){ setStatus('Draft is empty — add a subject or body first.'); return; }
    setBusy(true); setActionError('');
    if(kind==='sent')setSendingPhase('submitting');
    try{
      if(kind==='draft'){
        const key=`leadmaster-draft-${uid()}`;
        await createRow({kind:'draft',to:compose.to.trim(),subject:compose.subject.trim()||'(no subject)',body:compose.body,_key:key});
        setStatus('Draft saved to your account.');
      }else{
        const body=compose.body||'';
        const payload={to:compose.to.trim(),cc:compose.cc,bcc:compose.bcc,subject:compose.subject.trim(),text:containsHtml(body)?body.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim():body,html:containsHtml(body)?sanitizeHtml(body):undefined,fromEmail:profileEmail||'hello@work.jelvan.pro',fromName:profileName||'LeadMASTER'};
        const res=await fetch('/api/admin/send',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
        const result=await res.json().catch(()=>({}));
        if(!res.ok) throw new Error(result.error||`Send request failed (${res.status})`);
        setSendingPhase('queued');
        setStatus(`Queued ${result.queued||1} message${(result.queued||1)===1?'':'s'}. Queue acceptance is not delivery confirmation.`);
      }
      setComposeOpen(false); setCompose({to:'',cc:'',bcc:'',subject:'',body:'',showCc:false});
      if(kind==='sent') setView('outbox');
      setOpenEmailId(null); await reloadRecords();
    }catch(e){if(kind==='sent')setSendingPhase('unknown');setActionError(mapLeadMasterError(e).message);setStatus(kind==='sent'?'The send request was not confirmed. Check Outbox before trying again.':'The draft could not be saved.');}
    finally{setBusy(false);if(kind==='sent')window.setTimeout(()=>setSendingPhase(null),1800);}
  }
  async function scheduleCompose(){ if(!compose.to.trim()){ setStatus('Add a recipient before scheduling.'); return; } const item: ScheduledItem = {id:uid(), to:compose.to, subject:compose.subject||'(no subject)', body:compose.body, when:scheduleWhen||schedulePick||'Tomorrow · 9:00 AM'};setBusy(true);try{const created=await api('records.create',{collection:'leadmaster_scheduled',value:item,idempotency_key:`leadmaster-sched-${item.id}`});setScheduled(prev=>[{...item,recordId:created?.id},...prev]);setComposeOpen(false);setCompose({to:'',cc:'',bcc:'',subject:'',body:'',showCc:false});setView('scheduled');setStatus('Saved in Scheduled. Automatic timed dispatch is not enabled yet; use Send now to queue it.');}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('Schedule was not saved; your compose content is still available.');}finally{setBusy(false);}}
  function toggleSelectAll(){ if(selected.size===filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(e=>e.id))); }
  async function bulkArchive(){const ids=[...selected];for(const id of ids){try{await patchMail(id,'archive');}catch(e){setActionError(mapLeadMasterError(e).message);}}setSelected(new Set());await reloadRecords();setStatus('Archive actions processed.');}
  function bulkDelete(){const ids=[...selected];if(!ids.length)return;requestConfirmation({title:'Move the selected messages to Deleted?',message:'The selected messages will be moved to your Deleted folder.',itemLabel:ids.length+' message(s)',confirmLabel:'Move to Deleted'},()=>bulkDeleteConfirmed(ids));}
  async function bulkDeleteConfirmed(ids:string[]){let removed=0;for(const id of ids){try{await patchMail(id,'delete');removed++;}catch(e){setActionError(mapLeadMasterError(e).message);}}if(removed>0)playMailSound('deleted');setSelected(new Set());await reloadRecords();setStatus('Selected delete actions processed.');}

  async function sendNowScheduled(item:ScheduledItem){setBusy(true);setSendingPhase('submitting');try{const res=await fetch('/api/admin/send',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({to:item.to,subject:item.subject,text:item.body,fromEmail:profileEmail||'hello@work.jelvan.pro',fromName:profileName||'LeadMASTER'})});const j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(j.error||`Send failed (${res.status})`);if(item.recordId)await api('records.delete',{collection:'leadmaster_scheduled',id:item.recordId});setScheduled(prev=>prev.filter(s=>s.id!==item.id));setSendingPhase('queued');setStatus('Message queued now. Delivery is not yet confirmed.');await reloadRecords();}catch(e){setSendingPhase('unknown');setActionError(mapLeadMasterError(e).message);setStatus('Scheduled message was not removed because sending could not be confirmed.');}finally{setBusy(false);window.setTimeout(()=>setSendingPhase(null),1800);}}
  function cancelScheduled(item:ScheduledItem){requestConfirmation({title:'Cancel this saved schedule?',message:'The saved scheduled item will be removed. It will not be sent automatically.',itemLabel:item.subject,confirmLabel:'Cancel schedule'},()=>cancelScheduledConfirmed(item));}
  async function cancelScheduledConfirmed(item:ScheduledItem){try{if(item.recordId)await api('records.delete',{collection:'leadmaster_scheduled',id:item.recordId});setScheduled(prev=>prev.filter(s=>s.id!==item.id));setStatus('Saved schedule cancelled.');}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('The schedule could not be cancelled.');}}
  function openEditSchedule(item:ScheduledItem){ setScheduleForm({id:item.id, to:item.to, subject:item.subject, body:item.body, when:item.when}); setShowScheduleForm(true); setSchedulePicker({id:item.id, when:item.when, dateTime:''}); }
  async function saveSchedulePicker(){ if(!schedulePicker) return; const label = schedulePicker.dateTime ? new Date(schedulePicker.dateTime).toLocaleString([], {weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : schedulePicker.when;const existing=scheduled.find(s=>s.id===schedulePicker.id);if(!existing)return;const next={...existing,when:label};try{if(existing.recordId)await api('records.replace',{collection:'leadmaster_scheduled',id:existing.recordId,value:next});setScheduled(prev=>prev.map(s=>s.id===existing.id?next:s));setScheduleForm(prev=>({...prev,when:label}));setSchedulePicker(null);setShowScheduleForm(false);setStatus(`Saved schedule updated for ${label}. Automatic timed dispatch is not enabled yet.`);}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('Schedule change was not saved.');}}
  async function saveScheduleForm(){ if(!scheduleForm.to.trim()){ setStatus('Add a recipient for the scheduled message.'); return; }setBusy(true);try{if(scheduleForm.id){const existing=scheduled.find(s=>s.id===scheduleForm.id);const next={...existing,...scheduleForm};if(existing?.recordId)await api('records.replace',{collection:'leadmaster_scheduled',id:existing.recordId,value:next});setScheduled(prev=>prev.map(s=>s.id===scheduleForm.id?next:s));setStatus('Saved schedule updated.');}else{const item:ScheduledItem={id:uid(),to:scheduleForm.to,subject:scheduleForm.subject,body:scheduleForm.body,when:scheduleForm.when};const created=await api('records.create',{collection:'leadmaster_scheduled',value:item,idempotency_key:`leadmaster-sched-${item.id}`});setScheduled(prev=>[{...item,recordId:created?.id},...prev]);setStatus('Saved schedule created.');}setShowScheduleForm(false);setSchedulePicker(null);}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('Schedule change was not saved.');}finally{setBusy(false);}}

  function useTemplate(t:Template){ openCompose('template', undefined, t); }
  function openEditTemplate(t?:Template){ if(t) setTemplateForm({id:t.id, name:t.name, subject:t.subject, body:t.body, category:t.category}); else setTemplateForm({id:'', name:'', subject:'', body:'', category:'Sales'}); setShowTemplateForm(true); }
  async function saveTemplateForm(){ if(!templateForm.name.trim()||!templateForm.subject.trim()){setStatus('Give the template a name and subject.');return;}setBusy(true);try{if(templateForm.id){const existing=templates.find(t=>t.id===templateForm.id);if(!existing?.recordId)throw new Error('Template record is not available for update.');const next={...existing,name:templateForm.name,subject:templateForm.subject,body:templateForm.body,category:templateForm.category};await api('records.replace',{collection:'leadmaster_templates',id:existing.recordId,value:next});setTemplates(prev=>prev.map(t=>t.id===templateForm.id?next:t));setStatus('Template updated and saved.');}else{const item:Template={id:uid(),name:templateForm.name,subject:templateForm.subject,body:templateForm.body,category:templateForm.category};const created=await api('records.create',{collection:'leadmaster_templates',value:item,idempotency_key:`leadmaster-tpl-${item.id}`});setTemplates(prev=>[{...item,recordId:created?.id},...prev]);setStatus('Template created and saved.');}setShowTemplateForm(false);}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('Template was not saved.');}finally{setBusy(false);}}
  async function duplicateTemplate(t:Template){ const copy: Template = {id:uid(), name:`${t.name} (copy)`, subject:t.subject, body:t.body, category:t.category}; try{const created=await api('records.create',{collection:'leadmaster_templates',value:copy,idempotency_key:`leadmaster-tpl-${copy.id}`});setTemplates(prev=>[{...copy,recordId:created?.id},...prev]);setStatus(`Duplicated “${t.name}” and saved it.`);}catch(e){setActionError(mapLeadMasterError(e).message);setStatus('Template duplicate was not saved.');} }
  function deleteTemplate(t:Template){requestConfirmation({title:'Delete this template?',message:'The template will be removed from your saved templates.',itemLabel:t.name,confirmLabel:'Delete template'},async()=>{try{if(t.recordId)await api('records.delete',{collection:'leadmaster_templates',id:t.recordId});setTemplates(prev=>prev.filter(x=>x.id!==t.id));setStatus('Template deleted.');if(templatePreviewId===t.id)setTemplatePreviewId('');}catch(e){setActionError(mapLeadMasterError(e).message);}});}

  function toggleRule(id:string){ const next = rules.map(r=>r.id===id?{...r, enabled:!r.enabled}:r); setRules(next); const changed = next.find(r=>r.id===id); setStatus(changed?.enabled?`Rule “${changed.name}” turned on.`:`Rule “${changed.name}” turned off.`); if(changed?.recordId) api("records.replace", {collection:'leadmaster_rules', id:changed.recordId, value:changed}).catch(()=>setActionError('Could not save the rule change yet.')); }
  function saveRuleForm(){ if(!ruleForm.name.trim() || !ruleForm.contains.trim()){ setStatus('Give the rule a name and a “contains” value.'); return; } const item: Rule = {id:uid(), name:ruleForm.name, triggerType:ruleForm.triggerType, contains:ruleForm.contains, action:ruleForm.action, actionValue:ruleForm.actionValue, enabled:true}; setRules(prev=>[item, ...prev]); setShowRuleForm(false); setRuleForm({name:'', triggerType:'sender', contains:'', action:'label', actionValue:'Work'}); setStatus('Automation rule added.'); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_rules', value:item, idempotency_key:`leadmaster-rule-${item.id}`}); if(created?.id) setRules(prev=>prev.map(r=>r.id===item.id?{...r, recordId:created.id}:r)); }catch{ setActionError(mapLeadMasterError('system').message); } })(); }
  function deleteRule(id:string){const t=rules.find(r=>r.id===id);if(!t)return;requestConfirmation({title:'Delete this automation rule?',message:'The rule will be removed and will no longer be available.',itemLabel:t.name,confirmLabel:'Delete rule'},async()=>{try{if(t.recordId)await api("records.delete",{collection:'leadmaster_rules',id:t.recordId});setRules(prev=>prev.filter(r=>r.id!==id));setStatus('Automation rule deleted.');}catch(e){setActionError(mapLeadMasterError(e).message);}});}

  function runAssistant(kind:'summary'|'drafts'|'cleanup'|'priority'){
    setAssistantTab(kind);
    const inbox=allEmails.filter(e=>e.folder==='inbox'&&!deleted.has(e.id)&&!archived.has(e.id));
    const unread=inbox.filter(e=>!readIds.has(e.id));
    const important=[...inbox].sort((a,b)=>Number(starred.has(b.id))-Number(starred.has(a.id))||Number(!readIds.has(b.id))-Number(!readIds.has(a.id)));
    if(kind==='summary') setAssistantResult(inbox.length?(`Live inbox summary · ${unread.length} unread of ${inbox.length} messages.\n\n${unread.slice(0,8).map((e,i)=>`${i+1}. ${e.sender} — ${e.subject}`).join('\n')||'No unread messages.'}\n\nThis summary uses the messages currently loaded from your connected LeadMASTER mailbox.`):'No inbox messages are currently available. Refresh the mailbox or check your mailbox connection.');
    if(kind==='drafts') setAssistantResult('Choose a real inbox message below and request an AI reply suggestion. Suggestions are generated from that message and available correspondence; review before sending.');
    if(kind==='cleanup') setAssistantResult(`${inbox.filter(e=>readIds.has(e.id)&&!starred.has(e.id)).length} read, unstarred inbox message(s) are eligible for archive review. Nothing will be changed until you confirm the action.`);
    if(kind==='priority') setAssistantResult(important.length?(`Priority view · starred messages first, then unread messages.\n\n${important.slice(0,12).map((e,i)=>`${i+1}. ${starred.has(e.id)?'★ ':''}${e.sender} — ${e.subject}${readIds.has(e.id)?'':' · Unread'}`).join('\n')}`):'No inbox messages are available to rank yet.');
  }
  async function suggestReplyFor(email:Email){
    if(email.folder!=='inbox'){setStatus('AI reply suggestions are available for received inbox messages.');return;}
    setBusy(true);setActionError('');
    try{const res=await fetch(`/api/admin/mail/${encodeURIComponent(email.id)}/suggest`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'}});const j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(j.error||`Suggestion failed (${res.status})`);openCompose('reply',email);setCompose(prev=>({...prev,body:j.suggestion||prev.body}));setStatus('AI reply suggestion ready. Review it before sending.');}
    catch(e){setActionError(mapLeadMasterError(e).message);setStatus('Could not generate an AI reply suggestion.');}
    finally{setBusy(false);}
  }
  async function applyCleanup(){
    const ids=allEmails.filter(e=>e.folder==='inbox'&&readIds.has(e.id)&&!starred.has(e.id)&&!deleted.has(e.id)&&!archived.has(e.id)).map(e=>e.id);
    for(const id of ids){try{await patchMail(id,'archive');}catch(e){setActionError(mapLeadMasterError(e).message);}}
    setCleanupApplied(true);await reloadRecords();setAssistantResult(`Processed archive requests for ${ids.length} read, unstarred message(s). Review Inbox and Archived after refresh.`);setStatus(`Archive requests processed: ${ids.length}.`);
  }
  async function archiveNewsletters(){await applyCleanup();}
  function saveSettings(){ savePrefs({}); setSettingsSaved(true); setStatus('Settings saved — profile, theme, and signature are stored.'); }

  // ——— Components Organizer (Settings only): reorder + persist ———
  function toggleComponent(k:View){ const n=new Set(expandedComponents); n.has(k)?n.delete(k):n.add(k); setExpandedComponents(n); }
  function reorderComponents(from:View, to:View){ if(from===to) return; const arr=[...componentOrder]; const fi=arr.indexOf(from); const ti=arr.indexOf(to); if(fi<0||ti<0) return; arr.splice(fi,1); arr.splice(ti,0,from); setComponentOrder(arr); setOrganizerSaved(false); setStatus(`Components reordered — ${componentLabel(from)} moved. Press Save organizer to save.`); }
  function resetComponentOrder(){ setComponentOrder(DEFAULT_COMPONENT_ORDER); setHiddenComponents(new Set()); setOrganizerSaved(false); setStatus('Component order reset — press Save organizer to save.'); }
  function toggleComponentVisibility(k:View){ const n=new Set(hiddenComponents); n.has(k)?n.delete(k):n.add(k); setHiddenComponents(n); setOrganizerSaved(false); setStatus(n.has(k)?`${componentLabel(k)} hidden from the sidebar — press Save organizer to save.`:`${componentLabel(k)} shown in the sidebar — press Save organizer to save.`); }
  function saveComponentOrder(){ savePrefs({componentOrder, componentHidden:[...hiddenComponents]}); setOrganizerSaved(true); setStatus('Components organizer saved — sidebar order updated.'); }
  function componentSummary(k:View):string{
    if(k==='inbox') return `${counts.inboxUnread} unread · ${counts.inboxTotal} messages in your Inbox`;
    if(k==='compose') return 'Full compose tab — chips, templates, schedule send.';
    if(k==='assistant') return 'Summaries, draft replies, cleanup, priority leads.';
    if(k==='automation') return `${rules.filter(r=>r.enabled).length} of ${rules.length} rules on.`;
    if(k==='templates') return `${templates.length} templates ready to insert.`;
    if(k==='scheduled') return `${scheduled.length} send-later messages.`;
    if(k==='sent') return `${counts.sent} sent messages.`;
    if(k==='outbox') return `${counts.outbox} messages waiting in Outbox.`;
    if(k==='deleted') return `${counts.deleted} messages in Deleted.`;
    return '';
  }
  function componentIcon(k:View):IconName{ return k==='inbox'?'inbox':k==='compose'?'compose':k==='assistant'?'assistant':k==='automation'?'automation':k==='templates'?'templates':k==='sent'?'sent':k==='outbox'?'outbox':k==='deleted'?'deleted':'scheduled'; }
  function componentLabel(k:View):string{ return k==='inbox'?'Inbox':k==='compose'?'Compose':k==='assistant'?'Assistant':k==='automation'?'Automation':k==='templates'?'Templates':k==='sent'?'Sent':k==='outbox'?'Outbox':k==='deleted'?'Deleted':'Scheduled'; }

  // ——— Right panel: contacts / reminders / notes ———
  const sortedNotes = useMemo(()=> [...notes].sort((a,b)=> Number(b.pinned)-Number(a.pinned)), [notes]);
  const remindersForDay = useMemo(()=> reminders.filter(r=>r.date===selectedDay), [reminders, selectedDay]);
  const calendarCells = useMemo(()=>{ const y=calendarDate.getFullYear(); const m=calendarDate.getMonth(); const first=new Date(y,m,1); const startDay=first.getDay(); const days=new Date(y,m+1,0).getDate(); const cells:(number|null)[]=[]; for(let i=0;i<startDay;i++) cells.push(null); for(let d=1;d<=days;d++) cells.push(d); return cells; },[calendarDate]);
  function dateStrForDay(d:number){ const y=calendarDate.getFullYear(); const m=String(calendarDate.getMonth()+1).padStart(2,'0'); return `${y}-${m}-${String(d).padStart(2,'0')}`; }
  function saveContactForm(){ if(!contactForm.name.trim()||!contactForm.email.trim()){ setStatus('Add a name and email for the contact.'); return; } const item: Contact = {id:uid(), name:contactForm.name, email:contactForm.email, company:contactForm.company, phone:contactForm.phone, role:contactForm.role||'Contact', location:contactForm.location}; setContacts(prev=>[item, ...prev]); setShowContactForm(false); setContactForm({name:'', email:'', company:'', phone:'', role:'', location:''}); setStatus(`Added ${item.name} to Contacts.`); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_contacts', value:item, idempotency_key:`leadmaster-contact-${item.id}`}); if(created?.id) setContacts(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError(mapLeadMasterError('system').message); } })(); }
  function deleteContact(c:Contact){requestConfirmation({title:'Remove this contact?',message:'The contact will be removed from your saved Contacts.',itemLabel:c.email,confirmLabel:'Remove contact'},async()=>{try{if(c.recordId)await api("records.delete",{collection:'leadmaster_contacts',id:c.recordId});setContacts(prev=>prev.filter(x=>x.id!==c.id));setStatus('Contact removed.');}catch(e){setActionError(mapLeadMasterError(e).message);}});}
  function saveReminderForm(){ if(!reminderForm.title.trim()){ setStatus('Add a title for the reminder.'); return; } const item: Reminder = {id:uid(), title:reminderForm.title, date:reminderForm.date, time:reminderForm.time, done:false}; setReminders(prev=>[item, ...prev]); setShowReminderForm(false); setReminderForm({title:'', date:selectedDay, time:'09:00'}); setStatus(`Reminder added for ${item.date} · ${item.time}.`); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_reminders', value:item, idempotency_key:`leadmaster-reminder-${item.id}`}); if(created?.id) setReminders(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError('Reminder saved here, but could not store it yet.'); } })(); }
  function toggleReminder(r:Reminder){ const next={...r, done:!r.done}; setReminders(prev=>prev.map(x=>x.id===r.id?next:x)); if(r.recordId) api("records.replace", {collection:'leadmaster_reminders', id:r.recordId, value:next}).catch(()=>setActionError('Could not save the reminder change yet.')); }
  function deleteReminder(r:Reminder){requestConfirmation({title:'Delete this reminder?',message:'This reminder will be removed from your calendar.',itemLabel:r.title,confirmLabel:'Delete reminder'},async()=>{try{if(r.recordId)await api("records.delete",{collection:'leadmaster_reminders',id:r.recordId});setReminders(prev=>prev.filter(x=>x.id!==r.id));setStatus('Reminder deleted.');}catch(e){setActionError(mapLeadMasterError(e).message);}});}
  function saveNoteForm(){ if(!noteForm.title.trim()){ setStatus('Give the note a title.'); return; } if(noteForm.id){ const next={title:noteForm.title, body:noteForm.body, pinned:noteForm.pinned}; setNotes(prev=>prev.map(x=>x.id===noteForm.id?{...x, ...next}:x)); const ex=notes.find(x=>x.id===noteForm.id); if(ex?.recordId) api("records.replace", {collection:'leadmaster_notes', id:ex.recordId, value:{...ex, ...next}}).catch(()=>setActionError(mapLeadMasterError('system').message)); setStatus('Note updated.'); } else { const item: NoteItem = {id:uid(), title:noteForm.title, body:noteForm.body, pinned:noteForm.pinned}; setNotes(prev=>[item, ...prev]); setStatus('Note added.'); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_notes', value:item, idempotency_key:`leadmaster-note-${item.id}`}); if(created?.id) setNotes(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError('Note saved here, but could not store it yet.'); } })(); } setShowNoteForm(false); setNoteForm({id:'', title:'', body:'', pinned:false}); }
  function togglePinNote(n:NoteItem){ const next={...n, pinned:!n.pinned}; setNotes(prev=>prev.map(x=>x.id===n.id?next:x)); if(n.recordId) api("records.replace", {collection:'leadmaster_notes', id:n.recordId, value:next}).catch(()=>setActionError(mapLeadMasterError('system').message)); }
  function deleteNote(n:NoteItem){requestConfirmation({title:'Delete this note?',message:'This note will be removed from your workspace.',itemLabel:n.title,confirmLabel:'Delete note'},async()=>{try{if(n.recordId)await api("records.delete",{collection:'leadmaster_notes',id:n.recordId});setNotes(prev=>prev.filter(x=>x.id!==n.id));setStatus('Note deleted.');}catch(e){setActionError(mapLeadMasterError(e).message);}});}
  function addChip(){ const v=newChip.trim().replace(/,$/,''); if(!v) return; if(!isValidRecipientChip(v)){ setStatus(`“${v}” does not look like a valid email — use name@example.com.`); return; } setCompose(prev=>({...prev, to: prev.to.trim()? `${prev.to.replace(/,$/,'')}, ${v}` : v})); setNewChip(''); }
  function removeChip(idx:number){ const chips=compose.to.split(',').map(s=>s.trim()).filter(Boolean); chips.splice(idx,1); setCompose(prev=>({...prev, to: chips.join(', ')})); }
  function insertTemplateIntoCompose(){ const t=templates.find(x=>x.id===templatePick); if(!t) return; setCompose(prev=>({...prev, subject:t.subject, body: t.body + (prev.body? `\n\n${prev.body}`:'')})); setStatus(`Template “${t.name}” inserted.`); }
  function insertLink(){ if(!linkUrl.trim()) return; setCompose(prev=>({...prev, body: prev.body + (prev.body?'\n':'') + linkUrl.trim()})); setLinkUrl(''); setShowLinkInput(false); setStatus('Link added to body.'); }
  function insertList(){ setCompose(prev=>({...prev, body: prev.body + (prev.body?'\n':'') + '• '})); }
  function applyFmt(kind:'bold'|'italic'|'underline'){ setFmt(prev=>({...prev, [kind]:!prev[kind]})); setStatus(kind==='bold'?'Bold toggled.':kind==='italic'?'Italic toggled.':'Underline toggled.'); }
  function pushHistory(){ setComposeHistory(prev=>[...prev.slice(-19), compose.body]); setComposeRedoHistory([]); }
  function undoCompose(){ if(composeHistory.length===0){ setStatus('Nothing to undo.'); return; } const prevBody = composeHistory[composeHistory.length-1]; setComposeHistory(prev=>prev.slice(0,-1)); setComposeRedoHistory(prev=>[...prev, compose.body]); setCompose({...compose, body:prevBody}); setStatus('Undid last insert.'); }
  function redoCompose(){ if(composeRedoHistory.length===0){ setStatus('Nothing to redo.'); return; } const nextBody = composeRedoHistory[composeRedoHistory.length-1]; setComposeRedoHistory(prev=>prev.slice(0,-1)); setComposeHistory(prev=>[...prev, compose.body]); setCompose({...compose, body:nextBody}); setStatus('Redid last change.'); }
  function clearComposeFormatting(){ pushHistory(); setCompose(prev=>({...prev, body: prev.body.replace(/<[^>]*>/g,'')})); setFmt({bold:false, italic:false, underline:false}); setFmtStrike(false); setStatus('Formatting cleared — HTML tags removed, text kept.'); }
  function insertAtCursor(snippet:string){ pushHistory(); setCompose(prev=>({...prev, body: prev.body + (prev.body && !prev.body.endsWith('\n')?'\n':'') + snippet})); }
  function insertTableBlock(){ insertAtCursor('<table style="width:100%;border-collapse:collapse"><tr><td style="border:1px solid #000;padding:8px">Cell 1</td><td style="border:1px solid #000;padding:8px">Cell 2</td></tr><tr><td style="border:1px solid #000;padding:8px">Cell 3</td><td style="border:1px solid #000;padding:8px">Cell 4</td></tr></table>'); setStatus('Table inserted.'); }
  function insertCodeBlock(){ insertAtCursor('<pre style="background:#F5F5F5;border:1px solid #000;padding:12px;border-radius:8px"><code>// Add your code here</code></pre>'); setStatus('Code block inserted.'); }
  function insertIndent(){ insertAtCursor('    '); setStatus('Indented.'); }
  function insertOutdent(){ setCompose(prev=>({...prev, body: prev.body.replace(/^ {1,4}/gm,'')})); setStatus('Outdented.'); }
  function applySignaturePick(){ const s = COMPOSE_SIGNATURES.find(x=>x.name===composeSignaturePick); if(!s) return; pushHistory(); setCompose(prev=>({...prev, body: prev.body + (prev.body?'\n\n':'') + s.value})); setStatus(`Signature “${s.name}” inserted.`); }
  function applyCannedPick(){ const c = CANNED_RESPONSES.find(x=>x.name===cannedPick); if(!c) return; pushHistory(); setCompose(prev=>({...prev, body: c.body + (prev.body? `\n\n${prev.body}`:'')})); setStatus(`Canned response “${c.name}” inserted.`); }
  function insertImageFromUrl(){ if(!imageUrlValue.trim()){ setStatus('Add an image URL first.'); return; } insertAtCursor(`<p><img src="${imageUrlValue.trim()}" alt="${(imageAltValue.trim()||'Image').replace(/"/g,'')}" style="max-width:100%;border:1px solid #000;border-radius:8px" /></p>`); setImageUrlValue(''); setImageAltValue(''); setImageUrlOpen(false); setStatus('Image inserted from URL.'); }
  function insertLinkEdit(){ if(!linkEditValue.trim()) return; insertAtCursor(`<a href="${linkEditValue.trim()}">${linkEditValue.trim()}</a>`); setLinkEditValue(''); setLinkEditOpen(false); setStatus('Link inserted.'); }
  function openHtmlDialog(){ setHtmlDialogValue(htmlSnippet || ''); setHtmlDialogOpen(true); }
  function insertHtmlFromDialog(){ if(!htmlDialogValue.trim()){ setStatus('Paste or choose HTML first.'); return; } pushHistory(); setCompose(prev=>({...prev, body: prev.body + (prev.body?'\n\n':'') + sanitizeHtml(htmlDialogValue)})); setHtmlDialogOpen(false); setStatus('HTML inserted — use Preview to see it rendered. Scripts were stripped.'); }
  function discardComposeConfirmed(){ setCompose({to:'',cc:'',bcc:'',subject:'',body:'',showCc:false}); setNewChip(''); setComposeDiscardConfirm(false); setStatus('Draft discarded.'); }
  function insertHtml(){ if(!htmlSnippet.trim()){ setStatus('Paste or choose HTML first.'); return; } pushHistory(); setCompose(prev=>({...prev, body: prev.body + (prev.body?'\n\n':'') + sanitizeHtml(htmlSnippet)})); setStatus('HTML inserted — use Preview to see it rendered.'); }
  function insertHtmlTemplate(){ const t = HTML_SNIPPETS.find(x=>x.name===htmlTemplate); if(!t) return; setHtmlSnippet(t.html); setStatus(`HTML template “${t.name}” loaded — press Insert HTML.`); }
  function insertDivider(){ pushHistory(); setCompose(prev=>({...prev, body: prev.body + '\n\n— — —\n\n'})); setStatus('Divider inserted.'); }
  function insertQuote(){ pushHistory(); setCompose(prev=>({...prev, body: prev.body + (prev.body?'\n\n':'') + '> '})); setStatus('Quote inserted.'); }
  function insertNumberedList(){ pushHistory(); setCompose(prev=>({...prev, body: prev.body + (prev.body?'\n':'') + '1. '})); setStatus('Numbered list inserted.'); }
  function insertSignatureIntoCompose(){ pushHistory(); setCompose(prev=>({...prev, body: prev.body + (prev.body?'\n\n':'') + signature})); setStatus('Signature inserted.'); }
  function composeBodyStyle(): React.CSSProperties { return {fontFamily: composeFont, fontSize: composeFontSize, textAlign: composeAlign, color: composeColor, backgroundColor: composeHighlight, textDecoration: fmtStrike ? 'line-through' : undefined}; }

  const viewTitle = view==='compose'?'Compose': view==='inbox'?'Inbox': view==='sent'?'Sent': view==='outbox'?'Outbox': view==='deleted'?'Deleted': view==='assistant'?'Assistant': view==='automation'?'Automation': view==='templates'?'Templates': view==='scheduled'?'Scheduled':'Settings';
  const goView = (v:View)=>{ if(v==='compose'){ openComposeTab(); return; } if(view==='compose') setPreviousView(view); setView(v); setOpenEmailId(null); setSelected(new Set()); setMobileSidebar(false); setConfirmEmpty(false); setViewError(false); };
  const badgeFor = (k:View)=> k==='inbox'?counts.inboxUnread : k==='outbox'?counts.outbox : k==='deleted'?counts.deleted : k==='scheduled'?counts.scheduled : 0;
  const NAV: {k:View; label:string; icon:IconName; badge:number}[] = componentOrder.filter(k=>k!=='settings' && !hiddenComponents.has(k)).map(k=>({k, label:componentLabel(k), icon:componentIcon(k), badge:badgeFor(k)}));

  const stateBar = (
    <div className="mx-1 sm:mx-2 mt-2 space-y-2">
      {actionError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-[var(--text)] bg-[var(--surface)] px-3 py-2.5"><UniformIcon name="alert" size={18}/><span className="flex-1 min-w-[180px] text-[13px] font-medium">{actionError}</span><button onClick={()=>setActionError('')} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[13px]">Dismiss</button></div>}
      {status && !showLoading && <div className="flex flex-wrap items-center gap-2"><span className="bg-[var(--text)] text-[var(--surface)] text-[13px] px-3 py-2 rounded-lg">{status}</span><button onClick={()=>setStatus('')} className="text-[13px] underline underline-offset-2">Dismiss</button></div>}
      {settingsSaved && view==='settings' && <div className="flex items-center gap-2 bg-[var(--text)] text-[var(--surface)] text-[13px] px-3 py-2 rounded-lg"><UniformIcon name="check" size={16}/> Settings saved.<button onClick={()=>setSettingsSaved(false)} className="underline underline-offset-2 ml-1">Dismiss</button></div>}
    </div>
  );

  // Loading is rendered once in the viewport-level overlay below, never inside a panel.
  const LoadingState = null;
  const ErrorState = (
    <div className="mx-1 sm:mx-2 mt-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 sm:p-10 text-center" role="alert">
      <div className="mx-auto w-14 h-14 rounded-full border-2 border-[var(--text)] grid place-items-center"><UniformIcon name="alert" size={28}/></div>
      <h2 className="text-[20px] font-medium mt-4">Something went wrong</h2>
      <p className="text-[14px] text-[var(--text-3)] mt-1 max-w-[420px] mx-auto">We couldn&apos;t load this view. Please try again.</p>
      <div className="flex flex-wrap justify-center gap-2 mt-5"><button onClick={retryCurrentView} className="px-6 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] font-medium">Retry</button><button onClick={()=>goView('inbox')} className="px-6 py-2.5 rounded-full border border-[var(--text)] bg-[var(--surface)] text-[14px]">Go to Inbox</button></div>
    </div>
  );

  const sidebar = (
    <div className="flex flex-col h-full min-h-0">
      <nav className="px-0 py-2 text-[14px] overflow-y-auto flex-1 min-h-0" aria-label="LeadMASTER navigation">
        {NAV.map(item=>(
          <button key={item.k} disabled={viewLoading && view!==item.k} onClick={()=>goView(item.k)} className={`w-full flex items-center gap-3 pl-5 pr-3 py-[10px] rounded-r-full text-left ${view===item.k?'bg-[var(--text)] text-[var(--surface)] font-medium':'hover:bg-[var(--surface-2)] text-[var(--text-2)]'}`}>
            <UniformIcon name={item.icon} size={20}/><span className="flex-1 truncate">{item.label}</span>{item.badge>0 && <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${view===item.k?'bg-[var(--surface)] text-[var(--text)]':'bg-[var(--text)] text-[var(--surface)]'}`}>{item.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="shrink-0 border-t border-[var(--border)] p-3 grid gap-1">
        <button onClick={()=>setShowProfile(!showProfile)} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--surface-2)]" aria-label="Open profile and settings" aria-expanded={showProfile}>
          <GravatarAvatar email={profileEmail} name={profileName} size={36} className="shrink-0 rounded-full" fallback={<UniformIcon name="user" size={18}/>} />
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-[var(--text-2)]">{profileName}</span><span className="block truncate text-[11px] text-[var(--text-3)]">Profile &amp; settings</span></span>
          <UniformIcon name="chevron-right" size={16}/>
        </button>
        <button onClick={()=>{if(window.innerWidth<768){setMobileSidebar(false);setSidebarOpen(false);}else{setSidebarOpen(false);}}} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-[var(--text-3)] hover:bg-[var(--surface-2)]" aria-label={window.innerWidth<768?'Close navigation':'Collapse sidebar'} title={window.innerWidth<768?'Close navigation':'Collapse sidebar'}>
          <UniformIcon name="panel" size={19}/><span>{window.innerWidth<768?'Close navigation':'Collapse sidebar'}</span>
        </button>
      </div>
    </div>
  );

  const settingsComponentsOrganizer = (
    <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]" aria-label="Components Organizer">
      <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">Components Organizer</h3><span className="text-[12px] text-[var(--text-3)]">Drag to reorder the sidebar · Expand a row to show or hide it</span></div>
      <p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed">This order controls the sidebar order. Press Save organizer to store it in your LeadMaster records.</p>
      <div className="mt-4">
        {componentOrder.map(k=>(
          <div key={k} draggable onDragStart={()=>setDragKey(k)} onDragEnd={()=>{setDragKey(null); setDropKey(null);}} onDragOver={(e)=>{e.preventDefault(); setDropKey(k);}} onDrop={(e)=>{e.preventDefault(); if(dragKey) reorderComponents(dragKey,k); setDragKey(null); setDropKey(null);}} className={`border-b border-[var(--text)] last:border-b-0 ${dropKey===k?'border-t-4 border-t-[var(--text)]':''} ${dragKey===k?'opacity-50':''}`}>
            <div className="flex items-center gap-2 py-3">
              <span className="cursor-grab p-1 shrink-0" title="Drag to reorder" aria-label={`Drag ${componentLabel(k)} to reorder`}><UniformIcon name="drag" size={17}/></span>
              <button onClick={()=>goView(k)} className="flex items-center gap-2 font-medium text-[14px] text-left min-w-0"><UniformIcon name={componentIcon(k)} size={19}/><span className="truncate">{componentLabel(k)}</span></button>
              <span className={`ml-auto shrink-0 text-[12px] px-2 py-0.5 rounded-full border border-[var(--border)] ${hiddenComponents.has(k)?'text-[var(--text-3)]':'font-medium'}`}>{hiddenComponents.has(k)?'Hidden':'Shown'}</span>
              <button onClick={()=>toggleComponent(k)} className="p-1.5 rounded-full hover:bg-[var(--surface-3)] shrink-0" aria-label={`${expandedComponents.has(k)?'Collapse':'Expand'} ${componentLabel(k)}`} aria-expanded={expandedComponents.has(k)}><UniformIcon name={expandedComponents.has(k)?'chevron-down':'chevron-right'} size={17}/></button>
            </div>
            {expandedComponents.has(k) && <div className="pb-4 pl-8 pr-1">
              <p className="text-[13px] text-[var(--text-3)] leading-relaxed">{componentSummary(k)}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button onClick={()=>toggleComponentVisibility(k)} role="switch" aria-checked={!hiddenComponents.has(k)} aria-label={`Show or hide ${componentLabel(k)} in the sidebar`} className={`w-11 h-6 rounded-full relative shrink-0 border border-[var(--border)] ${!hiddenComponents.has(k)?'bg-[var(--text)]':'bg-[var(--surface-3)]'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-all ${!hiddenComponents.has(k)?'left-[22px] bg-[var(--surface)]':'left-0.5 bg-white'}`}/></button>
                <span className="text-[13px] font-medium">{hiddenComponents.has(k)?'Hidden — not shown in the sidebar':'Shown in the sidebar'}</span>
                <button onClick={()=>goView(k)} className="ml-auto px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Open {componentLabel(k)}</button>
                <button onClick={()=>toggleComponent(k)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px]">Collapse</button>
              </div>
            </div>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={resetComponentOrder} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-[var(--border)] text-[13px]"><UniformIcon name="restore" size={15}/> Reset order</button>
        <button onClick={saveComponentOrder} className="px-5 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] font-medium">Save organizer</button>
        {organizerSaved && <span className="flex items-center gap-1.5 text-[13px] font-medium"><UniformIcon name="check" size={16}/> Components organizer saved.</span>}
      </div>
    </section>
  );

  const senderButton = (email:Email) => {
    const sent = email.folder==='sent';
    const identityName = sent ? (email.email.split('@')[0]||'Recipient').replace(/[._-]+/g,' ') : email.sender;
    const identityEmail = email.email;
    return (
      <>
        <button onClick={(e)=>{e.stopPropagation(); openSender(identityName, identityEmail, email.company);}} className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center text-[13px] font-medium shrink-0 hidden sm:grid" aria-label={`Open profile for ${sent?'recipient':'sender'} ${identityEmail}`} title={sent?`Recipient: ${identityEmail}`:email.sender}><AvatarIcon email={identityEmail} size={18} /></button>
        <button onClick={(e)=>{e.stopPropagation(); openSender(identityName, identityEmail, email.company);}} className={`text-left shrink-0 break-words text-[14px] underline-offset-2 hover:underline ${!readIds.has(email.id)?'font-bold':'font-normal'}`} aria-label={`Open profile for ${sent?'recipient':'sender'} ${identityEmail}`}>{sent?`To: ${identityEmail}`:email.sender}{!sent&&email.company?` · ${email.company}`:''}</button>
      </>
    );
  };

  const mailList = (
    <div className="bg-[var(--surface)] rounded-2xl overflow-hidden gmail-shadow mx-1 sm:mx-2">
      {filtered.length===0 ? <div className="p-10 sm:p-16 text-center"><img src="/assets/illustrations/empty-mail.webp" alt="" width="168" height="120" className="mx-auto mb-2 h-auto w-[168px] object-contain" loading="lazy"/><h2 className="text-[18px] mt-3">Nothing in {viewTitle}</h2><p className="text-[14px] text-[var(--text-3)] mt-1 max-w-[420px] mx-auto">{view==='deleted'?'Deleted is empty. Restored mail returns to Inbox.': search? `No results for “${search}”. Try a different sender, subject, or lead.` : 'You are all caught up.'}</p><button onClick={()=>{setSearch(''); setOnlyAttachment(false); goView('inbox');}} className="mt-4 px-5 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px]">Back to Inbox</button></div> : filtered.map(email=>{
        const isUnread = !readIds.has(email.id); const isSel = selected.has(email.id); const rowPad = density==='compact'?'py-1.5':'py-2.5';
        return <div key={email.id} className={`group relative flex items-center gap-1 sm:gap-2 px-2 sm:px-3 border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-[var(--surface-2)] ${isSel?'bg-[var(--surface-2)]':''} ${previewEmailId===email.id?'bg-[var(--surface-2)]':''} ${rowPad}`} onClick={()=>{ if(previewMode){ setPreviewEmailId(email.id); openMessage(email.id); } else { openMessage(email.id); } }} onDoubleClick={()=>{ openMessage(email.id); }} title="Click to preview or open · Double-click to open full detail">
          <input type="checkbox" checked={isSel} onChange={e=>{e.stopPropagation(); const n=new Set(selected); n.has(email.id)?n.delete(email.id):n.add(email.id); setSelected(n);}} onClick={e=>e.stopPropagation()} className="accent-black w-4 h-4 shrink-0" aria-label={`Select ${email.subject}`}/>
          <button onClick={e=>toggleStar(email.id,e)} className="p-1 shrink-0" aria-label="Star">{starred.has(email.id)?<span className="text-[18px] leading-none">★</span>:<UniformIcon name="star" size={18}/>}</button>
          <span className="hidden sm:flex items-center gap-2 shrink-0">{senderButton(email)}</span>
          <span className="sm:hidden min-w-0 flex items-center gap-1.5"><GravatarAvatar email={email.email} name={email.folder==='sent'?email.email:email.sender} size={22} className="shrink-0 rounded-full"/><button onClick={(e)=>{e.stopPropagation(); openSender(email.folder==='sent'?(email.email.split('@')[0]||'Recipient').replace(/[._-]+/g,' '):email.sender, email.email, email.company);}} className="text-[14px] font-medium underline-offset-2 hover:underline text-left truncate">{email.folder==='sent'?`To: ${email.email}`:email.sender}</button></span>
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3"><span className="min-w-0 flex-1 flex items-center gap-2"><span className="break-words text-[14px] leading-snug"><span className={isUnread?'font-bold':''}>{email.subject}</span><span className="text-[var(--text-3)] font-normal"> — {email.snippet}</span>{view==='sent'&&email.deliveryStatus&&<span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${email.deliveryStatus==='delivered'?'bg-emerald-100 text-emerald-700':(['failed','bounced','rejected','unknown'].includes(email.deliveryStatus)?'bg-red-100 text-red-600':'bg-[var(--surface-2)] text-[var(--text-3)]')}`}>{email.deliveryStatus==='delivered'?'Delivered':(['failed','bounced','rejected','unknown'].includes(email.deliveryStatus)?'Failed':email.deliveryStatus==='accepted'?'Accepted by mail service':email.deliveryStatus)}</span>}</span>{email.value && <span className="hidden md:inline-flex shrink-0 text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] font-medium">{email.value}</span>}{email.label && <span className="hidden md:inline-flex shrink-0 text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)]">{email.label}</span>}{email.attachment && <UniformIcon name="paperclip" size={15}/>}</span></div>
          <span className="text-[12px] sm:text-[13px] text-[var(--text-3)] shrink-0 whitespace-nowrap">{view==='sent'?`Sent · ${email.date}`:email.date}</span>
          <span className="hidden lg:flex absolute right-16 top-1/2 -translate-y-1/2 gap-0.5 bg-[var(--surface)] rounded-full px-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            {view==='deleted' ? <><button onClick={e=>{e.stopPropagation(); restoreEmail(email.id);}} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Restore"><UniformIcon name="restore" size={17}/></button><button onClick={e=>{e.stopPropagation(); deleteForever(email.id);}} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Delete forever"><UniformIcon name="trash" size={17}/></button></> : <><button onClick={e=>{e.stopPropagation(); setPreviewEmailId(email.id); setPreviewMode(true); markRead(email.id); setStatus(`Previewing “${email.subject}” — click the row to open the full message.`);}} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Preview"><UniformIcon name="eye" size={17}/></button><button onClick={e=>{e.stopPropagation(); doArchive(email.id);}} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Archive"><UniformIcon name="archive" size={17}/></button><button onClick={e=>{e.stopPropagation(); doDelete(email.id);}} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Delete"><UniformIcon name="trash" size={17}/></button><button onClick={e=>{e.stopPropagation(); doSnooze(email.id);}} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Snooze"><UniformIcon name="clock" size={17}/></button></>}
          </span>
        </div>;
      })}
      <div className="flex items-center justify-between px-4 py-3 text-[12px] text-[var(--text-3)]"><span>Showing {filtered.length} conversation{filtered.length===1?'':'s'} in {viewTitle}</span><span className="hidden sm:inline">1–{filtered.length} of {filtered.length}</span></div>
    </div>
  );

  const previewEmail = allEmails.find(e=>e.id===previewEmailId) || null;
  const previewPanel = previewMode && previewEmail && (view==='inbox'||view==='sent'||view==='deleted') && !openEmail ? (
    <div className={`bg-[var(--surface)] rounded-2xl gmail-shadow border border-[var(--border)] overflow-hidden ${previewLayout==='vertical'?'m-0 flex-1 min-w-0':'mx-1 sm:mx-2 mt-3'}`} aria-label={`Preview of ${previewEmail.subject}`}>
      <div className="flex flex-wrap items-center gap-2 bg-[var(--surface-2)] px-4 py-3"><span className="flex items-center gap-2 font-medium text-[14px]"><UniformIcon name="eye" size={18}/> Preview — {view==='sent'?'Sent':view==='deleted'?'Deleted':'Inbox'} · {previewLayout==='vertical'?'Vertical':'Horizontal'}</span><span className="text-[12px] text-[var(--text-3)]">Click a row to preview it here. Double-click or Open for full detail.</span><div className="ml-auto flex gap-1"><button onClick={()=>setDetailPreviewMode(detailPreviewMode==='html'?'text':'html')} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[12px]">{detailPreviewMode==='html'?'Show as text':'Show as HTML'}</button><button onClick={()=>{ setOpenEmailId(previewEmail.id); }} className="px-3 py-1.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[12px]">Open</button><button onClick={()=>setPreviewEmailId(null)} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[12px]" aria-label="Close preview"><UniformIcon name="x" size={14}/></button></div></div>
      <div className="p-4 sm:p-5"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center font-medium shrink-0"><AvatarIcon email={previewEmail.email} size={20} /></span><div className="min-w-0"><button onClick={()=>openSender(previewEmail.sender, previewEmail.email, previewEmail.company)} className="font-medium hover:underline text-left">{previewEmail.sender}</button><p className="text-[12px] text-[var(--text-3)] truncate">&lt;{previewEmail.email}&gt; · {previewEmail.date} · {previewEmail.time} · {previewEmail.category}{previewEmail.label?` · ${previewEmail.label}`:''}</p></div></div><h3 className="text-[18px] font-medium leading-snug mt-3">{previewEmail.subject}</h3>{previewEmail.company && <p className="mt-1 text-[12px]"><span className="px-2 py-0.5 rounded-full border border-[var(--border)]">{previewEmail.company}</span>{previewEmail.value && <span className="ml-1 px-2 py-0.5 rounded-full border border-[var(--border)]">{previewEmail.value}</span>}</p>}{detailPreviewMode==='html' && previewEmail.htmlBody ? <SafeEmailHtml html={previewEmail.htmlBody}/> : <p className="whitespace-pre-line text-[14px] leading-relaxed mt-3">{previewEmail.body.slice(0,1200)}{previewEmail.body.length>1200?'…':''}</p>}{previewEmail.sourceUrl && <p className="mt-3 text-[13px]"><a className="underline" href={previewEmail.sourceUrl}>Download original message (.eml)</a></p>}<div className="flex flex-wrap gap-2 mt-4"><button onClick={()=>openCompose('reply', previewEmail)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="reply" size={14}/> Reply</button><button onClick={()=>openCompose('forward', previewEmail)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="forward" size={14}/> Forward</button><button onClick={()=>doArchive(previewEmail.id)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="archive" size={14}/> Archive</button><button onClick={()=>doDelete(previewEmail.id)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="trash" size={14}/> Delete</button><button onClick={()=>doSnooze(previewEmail.id)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="clock" size={14}/> Snooze</button><button onClick={()=>openComposeTab(previewEmail.email)} className="px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Compose to sender</button></div></div>
    </div>
  ) : null;

  const composeTab = (
    <div className="mx-1 sm:mx-2">
      <div className="flex flex-wrap items-center gap-2 mb-3"><span className="text-[13px] text-[var(--text-3)]">LeadMaster / <span className="text-[var(--text)] font-medium">Compose</span></span><button onClick={closeComposeTab} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border)] text-[13px]"><UniformIcon name="x" size={15}/> Close Compose</button></div>
      <section className="bg-[var(--surface)] rounded-2xl gmail-shadow border border-[var(--border)] overflow-hidden">
        <div className="flex items-center gap-3 bg-[var(--surface-2)] px-4 py-3"><span className="w-9 h-9 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center"><UniformIcon name="compose" size={19}/></span><div><h2 className="text-[18px] font-medium leading-none">New Message</h2><p className="text-[12px] text-[var(--text-3)] mt-1">Dedicated Compose tab — full editor, templates, and schedule send.</p></div><span className="ml-auto text-[12px] px-2 py-1 rounded-full border border-[var(--border)]">{composeMode==='template'?'From template':'New'}</span></div>
        <div className="p-4 sm:p-5">
          <div className="border border-[var(--border)] rounded-xl p-3">
            <p className="text-[13px] font-medium mb-2">To <span className="text-[var(--text-3)] font-normal">— press Enter to add a recipient chip</span></p>
            <div className="flex flex-wrap gap-1.5">
              {compose.to.split(',').map(s=>s.trim()).filter(Boolean).map((chip, idx)=>(<span key={idx} className="inline-flex items-center gap-1 bg-[var(--text)] text-[var(--surface)] text-[13px] px-2.5 py-1 rounded-full max-w-full"><span className="truncate">{chip}</span><button onClick={()=>removeChip(idx)} aria-label={`Remove ${chip}`} className="font-bold">×</button></span>))}
              <input value={newChip} onChange={e=>setNewChip(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===','){ e.preventDefault(); addChip(); } }} placeholder="Add recipient email…" className="flex-1 min-w-[160px] outline-none bg-transparent text-[14px] py-1" aria-label="Add recipient chip"/>
              <button onClick={addChip} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[13px]">Add</button>
            </div>
            <button onClick={()=>setCompose({...compose, showCc:!compose.showCc})} className="mt-2 text-[13px] underline underline-offset-2">{compose.showCc?'Hide Cc / Bcc':'Show Cc / Bcc'}</button>
            {compose.showCc && <div className="grid sm:grid-cols-2 gap-3 mt-3"><label className="text-[13px]">Cc<input value={compose.cc} onChange={e=>setCompose({...compose, cc:e.target.value})} placeholder="Cc" className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">Bcc<input value={compose.bcc} onChange={e=>setCompose({...compose, bcc:e.target.value})} placeholder="Bcc" className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label></div>}
          </div>
          <label className="block text-[13px] font-medium mt-4">Subject<input value={compose.subject} onChange={e=>setCompose({...compose, subject:e.target.value})} placeholder="Subject" className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2.5 bg-[var(--surface)] outline-none text-[15px]"/></label>
          <div className="mt-4 border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 bg-[var(--surface-2)] px-2 py-2">
              <button onClick={()=>applyFmt('bold')} className={`p-2 rounded-full ${fmt.bold?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Bold"><UniformIcon name="bold" size={17}/></button>
              <button onClick={()=>applyFmt('italic')} className={`p-2 rounded-full ${fmt.italic?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Italic"><UniformIcon name="italic" size={17}/></button>
              <button onClick={()=>applyFmt('underline')} className={`p-2 rounded-full ${fmt.underline?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Underline"><UniformIcon name="underline" size={17}/></button>
              <button onClick={()=>{setFmtStrike(!fmtStrike); setStatus(fmtStrike?'Strikethrough off.':'Strikethrough on.');}} className={`p-2 rounded-full ${fmtStrike?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Strikethrough"><UniformIcon name="strike" size={17}/></button>
              <span className="w-px h-6 bg-[var(--text)] mx-1" aria-hidden="true"/>
              <button onClick={()=>setComposeAlign('left')} className={`p-2 rounded-full ${composeAlign==='left'?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Align left"><UniformIcon name="align" size={17}/></button>
              <button onClick={()=>setComposeAlign('center')} className={`p-2 rounded-full ${composeAlign==='center'?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Align center"><UniformIcon name="align-center" size={17}/></button>
              <button onClick={()=>setComposeAlign('right')} className={`p-2 rounded-full ${composeAlign==='right'?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Align right"><UniformIcon name="align-right" size={17}/></button>
              <button onClick={()=>setComposeAlign('justify')} className={`p-2 rounded-full ${composeAlign==='justify'?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Justify"><UniformIcon name="justify" size={17}/></button>
              <button onClick={insertIndent} className="p-2 rounded-full" aria-label="Indent"><UniformIcon name="indent" size={17}/></button>
              <button onClick={insertOutdent} className="p-2 rounded-full" aria-label="Outdent"><UniformIcon name="outdent" size={17}/></button>
              <span className="w-px h-6 bg-[var(--text)] mx-1" aria-hidden="true"/>
              <button onClick={()=>setLinkEditOpen(!linkEditOpen)} className={`p-2 rounded-full ${linkEditOpen?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Insert or edit link"><UniformIcon name="link" size={17}/></button>
              <button onClick={()=>setImageUrlOpen(!imageUrlOpen)} className={`p-2 rounded-full ${imageUrlOpen?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Insert image by URL"><UniformIcon name="image" size={17}/></button>
              <button onClick={insertTableBlock} className="p-2 rounded-full" aria-label="Insert table"><UniformIcon name="table" size={17}/></button>
              <button onClick={insertList} className="p-2 rounded-full" aria-label="Insert bullet list"><UniformIcon name="list" size={17}/></button>
              <button onClick={insertNumberedList} className="p-2 rounded-full" aria-label="Insert numbered list"><UniformIcon name="numbered" size={17}/></button>
              <button onClick={insertQuote} className="p-2 rounded-full" aria-label="Insert quote"><UniformIcon name="quote" size={17}/></button>
              <button onClick={insertCodeBlock} className="p-2 rounded-full" aria-label="Insert code block"><UniformIcon name="code" size={17}/></button>
              <button onClick={insertDivider} className="p-2 rounded-full" aria-label="Insert horizontal line"><UniformIcon name="divider" size={17}/></button>
              <button onClick={()=>setStatus('Photo and file uploads are not available yet. Attachments are not available yet.')} className="p-2 rounded-full" aria-label="Attach file"><UniformIcon name="paperclip" size={17}/></button>
              <button onClick={()=>setShowEmoji(!showEmoji)} className={`p-2 rounded-full ${showEmoji?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Emoji"><UniformIcon name="smile" size={17}/></button>
              <button onClick={openHtmlDialog} className="flex items-center gap-1 px-2 py-2 rounded-full text-[13px] border border-[var(--border)]" aria-label="Insert HTML"><UniformIcon name="html" size={17}/> Insert HTML</button>
              <button onClick={()=>setComposeViewSource(!composeViewSource)} className={`px-2 py-2 rounded-full text-[13px] ${composeViewSource?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="View source / Edit HTML toggle">{composeViewSource?'Rich Editor':'View Source'}</button>
              <button onClick={undoCompose} className="p-2 rounded-full" aria-label="Undo"><UniformIcon name="undo" size={17}/></button>
              <button onClick={redoCompose} className="p-2 rounded-full" aria-label="Redo"><UniformIcon name="redo" size={17}/></button>
              <button onClick={clearComposeFormatting} className="p-2 rounded-full" aria-label="Clear formatting"><UniformIcon name="clear" size={17}/></button>
              <button onClick={()=>{const v=!composeSpellCheck; setComposeSpellCheck(v); setStatus(v?'Spell check on.':'Spell check off.');}} className={`p-2 rounded-full ${composeSpellCheck?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Spell check toggle" aria-pressed={composeSpellCheck}><UniformIcon name="spell" size={17}/></button>
              <span className="ml-auto text-[12px] text-[var(--text-3)]">{composeViewSource?'Raw HTML':'Rich editor'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 bg-[var(--surface-2)] border-t border-[var(--border)] px-2 py-2">
              <span className="flex items-center gap-1 text-[12px] font-medium"><UniformIcon name="font" size={15}/> Font</span>
              <label className="text-[12px] min-w-0 flex-1 sm:flex-none">Family<select value={composeFont} onChange={e=>setComposeFont(e.target.value)} className="ml-1 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px] w-full sm:w-auto max-w-full">{COMPOSE_FONTS.map(f=><option key={f.name} value={f.value}>{f.name}</option>)}</select></label>
              <label className="text-[12px]">Size<select value={composeFontSize} onChange={e=>setComposeFontSize(e.target.value)} className="ml-1 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]">{COMPOSE_FONT_SIZES.map(f=><option key={f.name} value={f.value}>{f.name}</option>)}</select></label>
              <span className="flex gap-1"><button onClick={()=>setComposeAlign('left')} className={`px-2.5 py-1.5 rounded-full text-[12px] ${composeAlign==='left'?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`}>Left</button><button onClick={()=>setComposeAlign('center')} className={`px-2.5 py-1.5 rounded-full text-[12px] ${composeAlign==='center'?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`}>Center</button><button onClick={()=>setComposeAlign('right')} className={`px-2.5 py-1.5 rounded-full text-[12px] ${composeAlign==='right'?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`}>Right</button><button onClick={()=>setComposeAlign('justify')} className={`px-2.5 py-1.5 rounded-full text-[12px] ${composeAlign==='justify'?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`}>Justify</button></span>
              <label className="text-[12px]">Custom px<input value={composeCustomSize} onChange={e=>{setComposeCustomSize(e.target.value); const n=parseInt(e.target.value,10); if(!isNaN(n)&&n>=8&&n<=48) setComposeFontSize(`${n}px`);}} placeholder="e.g. 15" inputMode="numeric" className="ml-1 w-[64px] border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label>
              <label className="text-[12px]">Text color<select value={composeColor} onChange={e=>setComposeColor(e.target.value)} className="ml-1 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]">{COMPOSE_COLORS.map(c=><option key={c.name} value={c.value}>{c.name}</option>)}</select></label>
              <label className="text-[12px]">Highlight<select value={composeHighlight} onChange={e=>setComposeHighlight(e.target.value)} className="ml-1 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"><option value="transparent">None</option><option value="#E5E5E5">Gray</option><option value="#D4D4D4">Dark gray</option><option value="#F5F5F5">Light gray</option></select></label>
            </div>
            {showLinkInput && <div className="flex gap-2 p-2 border-t border-[var(--border)]"><input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://example.com" className="flex-1 min-w-0 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none text-[13px]"/><button onClick={insertLink} className="px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Insert link</button></div>}
            {linkEditOpen && <div className="flex flex-wrap gap-2 p-2 border-t border-[var(--border)]"><input value={linkEditValue} onChange={e=>setLinkEditValue(e.target.value)} placeholder="https://example.com — insert or edit link" className="flex-1 min-w-[160px] border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none text-[13px]"/><button onClick={insertLinkEdit} className="px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Insert link</button><button onClick={()=>setLinkEditOpen(false)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px]">Cancel</button></div>}
            {imageUrlOpen && <div className="flex flex-wrap gap-2 p-2 border-t border-[var(--border)]"><input value={imageUrlValue} onChange={e=>setImageUrlValue(e.target.value)} placeholder="Image URL — https://example.com/photo.jpg" className="flex-1 min-w-[160px] border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none text-[13px]"/><input value={imageAltValue} onChange={e=>setImageAltValue(e.target.value)} placeholder="Alt text" className="w-[140px] border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none text-[13px]"/><button onClick={insertImageFromUrl} className="px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Insert image</button><button onClick={()=>setImageUrlOpen(false)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px]">Cancel</button></div>}
            {showEmoji && <div className="flex flex-wrap gap-1 p-2 border-t border-[var(--border)]">{[':)','<3','Thanks!','Hello','Yes','No','OK','Done','Idea','Coffee','👍','🎉','❤️','🙂','📎','✅'].map(em=><button key={em} onClick={()=>setCompose({...compose, body:compose.body+em})} className="text-[13px] px-2 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-2)]">{em}</button>)}</div>}
            <textarea value={compose.body} onChange={e=>setCompose({...compose, body:e.target.value})} spellCheck={composeSpellCheck} placeholder={composeViewSource?'Edit raw HTML here — synced with the Rich Editor. Scripts are stripped on insert.':'Write your message… Use Insert HTML for formatted HTML.'} rows={10} style={composeViewSource?{fontFamily:'ui-monospace, monospace', fontSize:'13px'}:composeBodyStyle()} className={`w-full outline-none bg-transparent resize-y leading-relaxed p-3 ${composeViewSource?'font-mono':''} ${fmt.bold?'font-bold':''} ${fmt.italic?'italic':''} ${fmt.underline?'underline':''} ${fmtStrike?'line-through':''}`} aria-label="Message body"/>
            {showHtmlInsert && <div className="border-t border-[var(--border)] p-3 bg-[var(--surface-2)]"><p className="font-medium text-[13px] flex items-center gap-2"><UniformIcon name="html" size={16}/> Insert HTML</p><p className="text-[12px] text-[var(--text-3)] mt-1">Paste HTML or pick a template. Scripts are stripped before inserting. Use Preview to see it rendered. For the full dialog, use Insert HTML in the toolbar.</p><label className="block text-[12px] mt-2">HTML template<select value={htmlTemplate} onChange={e=>setHtmlTemplate(e.target.value)} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"><option value="">Choose an HTML block…</option>{HTML_SNIPPETS.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select></label><button onClick={insertHtmlTemplate} disabled={!htmlTemplate} className="mt-2 px-3 py-1.5 rounded-full border border-[var(--border)] text-[12px] disabled:opacity-40">Load template</button><textarea value={htmlSnippet} onChange={e=>setHtmlSnippet(e.target.value)} placeholder={'<p><strong>Hello</strong> — paste HTML here</p>'} rows={4} className="w-full mt-2 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none text-[13px] font-mono resize-y" aria-label="HTML to insert"/><div className="flex flex-wrap gap-2 mt-2"><button onClick={insertHtml} className="px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Insert HTML</button><button onClick={()=>{setHtmlSnippet(''); setShowHtmlInsert(false);}} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px]">Close</button></div>{htmlSnippet && <div className="mt-3"><p className="text-[12px] font-medium mb-1">HTML preview</p><div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--background)] text-[14px]" dangerouslySetInnerHTML={{__html: sanitizeHtml(htmlSnippet)}} /></div>}</div>}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] p-3"><button onClick={()=>setShowComposePreview(!showComposePreview)} className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-[13px]"><UniformIcon name="eye" size={15}/> {showComposePreview?'Hide email preview':'Preview email'}</button><label className="text-[13px]">Label<select value={composeLabel} onChange={e=>setComposeLabel(e.target.value)} className="ml-1 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none"><option>Work</option><option>Personal</option><option>Finance</option><option>Travel</option></select></label><label className="text-[13px]">Priority<select value={composePriority} onChange={e=>setComposePriority(e.target.value as any)} className="ml-1 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={composeReadReceipt} onChange={e=>setComposeReadReceipt(e.target.checked)} className="accent-black w-4 h-4"/> Request read receipt</label>{composePriority==='high' && <span className="text-[12px] font-bold px-2 py-1 rounded-full border border-[var(--border)]">! High priority</span>}{composePriority==='low' && <span className="text-[12px] px-2 py-1 rounded-full border border-[var(--border)]">Low priority</span>}{composeReadReceipt && <span className="text-[12px] px-2 py-1 rounded-full border border-[var(--border)]">Read receipt requested</span>}</div>
            {showComposePreview && <div className="border-t border-[var(--border)] p-4 bg-[var(--background)]"><p className="text-[12px] font-bold uppercase tracking-wide">Email preview — as the recipient will see it</p><p className="font-medium mt-2" style={{fontFamily: composeFont}}>To: {compose.to || '(no recipient)'} {compose.cc?`· Cc: ${compose.cc}`:''} {compose.bcc?`· Bcc: ${compose.bcc}`:''}</p><p className="text-[13px] text-[var(--text-3)]">Subject: {compose.subject || '(no subject)'}</p>{containsHtml(compose.body) ? <div className="mt-3 border border-[var(--border)] rounded-xl p-3" style={composeBodyStyle()} dangerouslySetInnerHTML={{__html: sanitizeHtml(compose.body)}} /> : <p className="whitespace-pre-line mt-3" style={composeBodyStyle()}>{compose.body || 'Nothing to preview yet.'}</p>}{composePriority==='high' && <p className="text-[12px] mt-2 font-bold">Marked high priority.</p>}</div>}
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <label className="text-[13px] font-medium">Templates<select value={templatePick} onChange={e=>setTemplatePick(e.target.value)} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2.5 bg-[var(--surface)] outline-none"><option value="">Choose a template…</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} — {t.subject}</option>)}</select></label>
            <label className="text-[13px] font-medium">Schedule Send<select value={schedulePick} onChange={e=>{setSchedulePick(e.target.value); setScheduleWhen(e.target.value);}} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2.5 bg-[var(--surface)] outline-none"><option>Tomorrow morning · 9:00 AM</option><option>Tomorrow afternoon · 2:00 PM</option><option>Monday morning · 9:00 AM</option><option>Friday · 8:30 AM</option><option>Today · 5:00 PM</option><option>Pick date / time…</option></select></label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3"><label className="text-[13px] font-medium">Signature<select value={composeSignaturePick} onChange={e=>setComposeSignaturePick(e.target.value)} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2.5 bg-[var(--surface)] outline-none"><option value="">Choose a signature…</option>{COMPOSE_SIGNATURES.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select></label><label className="text-[13px] font-medium">Canned responses<select value={cannedPick} onChange={e=>setCannedPick(e.target.value)} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2.5 bg-[var(--surface)] outline-none"><option value="">Choose a canned response…</option>{CANNED_RESPONSES.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></label></div>
          <div className="flex flex-wrap gap-2 mt-3"><button onClick={insertTemplateIntoCompose} disabled={!templatePick} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] disabled:opacity-40">Insert template</button><button onClick={applySignaturePick} disabled={!composeSignaturePick} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] disabled:opacity-40">Insert signature</button><button onClick={applyCannedPick} disabled={!cannedPick} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] disabled:opacity-40">Insert canned response</button><input value={scheduleWhen} onChange={e=>setScheduleWhen(e.target.value)} placeholder="Or custom time / pick date…" className="border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] bg-[var(--surface)] outline-none flex-1 min-w-[140px]"/></div>
          <div className="flex flex-wrap gap-2 mt-5 border-t border-[var(--border)] pt-4">
            <button disabled={busy} onClick={()=>handleSendOrDraft('sent')} className="flex items-center gap-2 bg-[var(--text)] text-[var(--surface)] disabled:opacity-50 px-6 py-3 rounded-full text-[14px] font-medium">{busy?'Sending…':'Send'} <UniformIcon name="send" size={16}/></button>
            <button disabled={busy} onClick={()=>handleSendOrDraft('draft')} className="px-5 py-3 rounded-full border border-[var(--border)] text-[14px]">Save Draft</button>
            <button onClick={scheduleCompose} className="px-5 py-3 rounded-full border border-[var(--border)] text-[14px] flex items-center gap-1.5"><UniformIcon name="clock" size={16}/> Schedule Send — {scheduleWhen || schedulePick}</button>
            <button onClick={()=>requestConfirmation({title:'Discard this draft?',message:'The current compose content will be cleared.',itemLabel:compose.subject||compose.to||'Unsaved compose content',confirmLabel:'Discard draft'},discardComposeConfirmed)} className="ml-auto px-5 py-3 rounded-full hover:bg-[var(--surface-2)] text-[14px]">Discard</button>
          </div>
          <p className="text-[12px] text-[var(--text-3)] mt-3">Sending saves a copy in Sent. Attachments: attach files / insert photo — file uploads are not available yet.</p>
        </div>
      </section>
    </div>
  );

  const mainContent = (
    <>
      {view==='compose' && composeTab}
      {(view==='inbox'||view==='sent'||view==='deleted') && !openEmail && (
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-[48px] text-[var(--text-3)]">
          <label className="flex items-center gap-1 p-1"><input type="checkbox" disabled={viewLoading} checked={filtered.length>0 && selected.size===filtered.length} onChange={toggleSelectAll} className="accent-black w-4 h-4" aria-label="Select all"/><UniformIcon name="chevron-down" size={16}/></label>
          <button disabled={viewLoading} onClick={()=>{ void retryCurrentView(); }} className="p-2 rounded-full hover:bg-[var(--surface-3)] disabled:opacity-50" aria-label="Refresh"><UniformIcon name="refresh" size={18}/></button>
          {selected.size>0 ? <><button onClick={bulkArchive} className="p-2 rounded-full hover:bg-[var(--surface-3)]" aria-label="Archive selected"><UniformIcon name="archive" size={18}/></button><button onClick={bulkDelete} className="p-2 rounded-full hover:bg-[var(--surface-3)]" aria-label="Delete selected"><UniformIcon name="trash" size={18}/></button><span className="text-[13px] text-[var(--text-2)]">{selected.size} selected</span></> : <button onClick={()=>setStatus('More actions: Mark as read, Filter messages, Mute — use row actions for quick triage.')} className="p-2 rounded-full hover:bg-[var(--surface-3)]" aria-label="More actions"><UniformIcon name="more" size={18}/></button>}
          <span className="flex items-center gap-1 border border-[var(--border)] rounded-full p-0.5" aria-label="Preview pane layout"><button onClick={()=>{ setPreviewMode(false); setPreviewEmailId(null); setStatus('Preview pane off — rows open the full message again.'); }} className={`px-2.5 py-1 rounded-full text-[12px] ${!previewMode?'bg-[var(--text)] text-[var(--surface)]':''}`}>No split</button><button onClick={()=>{ setPreviewMode(true); setPreviewLayout('vertical'); setStatus('Preview pane on — Vertical. Click any Inbox or Sent row to preview it.'); }} className={`px-2.5 py-1 rounded-full text-[12px] ${previewMode&&previewLayout==='vertical'?'bg-[var(--text)] text-[var(--surface)]':''}`}>Vertical</button><button onClick={()=>{ setPreviewMode(true); setPreviewLayout('horizontal'); setStatus('Preview pane on — Horizontal. Click any Inbox or Sent row to preview it below.'); }} className={`px-2.5 py-1 rounded-full text-[12px] ${previewMode&&previewLayout==='horizontal'?'bg-[var(--text)] text-[var(--surface)]':''}`}>Horizontal</button></span>
          <div className="ml-auto flex items-center gap-2 text-[12px] sm:text-[13px]"><span className="hidden sm:inline">1–{filtered.length} of {filtered.length}</span><span className="sm:hidden">{filtered.length}</span><button className="p-1" aria-label="Previous page">‹</button><button className="p-1" aria-label="Next page">›</button><button onClick={()=>setShowSettings(!showSettings)} className="p-1.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="List settings"><UniformIcon name="settings" size={16}/></button></div>
        </div>
      )}
      {view==='deleted' && !openEmail && <div className="mx-1 sm:mx-2 mb-3 flex flex-wrap items-center gap-2"><p className="text-[13px] text-[var(--text-3)]">Deleted mail stays here until you delete it forever or empty the trash.</p>{confirmEmpty && <span className="text-[13px] font-medium">Are you sure? This cannot be undone.</span>}<button disabled={viewLoading || deleted.size===0} onClick={emptyTrash} className="ml-auto px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-40">Empty Trash{deleted.size>0?` (${deleted.size})`:''}</button></div>}

      {openEmail && (view==='inbox'||view==='sent'||view==='deleted') ? (
        <article className="bg-[var(--surface)] rounded-2xl gmail-shadow mx-1 sm:mx-2 overflow-hidden border border-[var(--border)]">
          <div className="flex flex-wrap items-center gap-1 p-3 border-b border-[var(--border)]">
            <button onClick={()=>setOpenEmailId(null)} className="flex items-center gap-1 px-3 py-2 rounded-full hover:bg-[var(--surface-2)] text-[14px]"><UniformIcon name="back" size={18}/> Back</button>
            <button onClick={()=>doArchive(openEmail.id)} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Archive"><UniformIcon name="archive" size={19}/></button>
            <button onClick={()=>doDelete(openEmail.id)} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Delete"><UniformIcon name="trash" size={19}/></button>
            <button onClick={()=>doSnooze(openEmail.id)} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Snooze"><UniformIcon name="clock" size={19}/></button>
            <button onClick={()=>toggleStar(openEmail.id)} className="p-2 rounded-full hover:bg-[var(--surface-2)]" aria-label="Star">{starred.has(openEmail.id)?<span className="text-[19px] leading-none">★</span>:<UniformIcon name="star" size={19}/>}</button>
            {view==='deleted' && <><button onClick={()=>restoreEmail(openEmail.id)} className="flex items-center gap-1 px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]"><UniformIcon name="restore" size={16}/> Restore</button><button onClick={()=>deleteForever(openEmail.id)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px]">Delete forever</button></>}
            <span className="ml-auto text-[12px] text-[var(--text-3)]">{openEmail.folder==='sent' ? `Sent at ${openEmail.date} · ${openEmail.time}` : `${openEmail.date} · ${openEmail.time}`}</span>
          </div>
          <div className="p-4 sm:p-8 max-w-[780px]">
            <h1 className="text-[22px] sm:text-[28px] leading-tight font-normal">{openEmail.subject}</h1>
            {openEmail.folder==='sent' && <p className="mt-2 text-[13px] font-medium">Sent at {openEmail.date} · {openEmail.time}</p>}
            {openEmail.company && <p className="mt-2 text-[13px]"><span className="px-2 py-1 rounded-full border border-[var(--border)] font-medium">{openEmail.company}</span>{openEmail.value && <span className="ml-2 px-2 py-1 rounded-full border border-[var(--border)] font-medium">{openEmail.value}</span>}</p>}
            <div className="flex items-start gap-3 mt-5">{openEmail.folder==='sent'?<GravatarAvatar email={profileEmail} name={profileName||'Me'} size={40} className="shrink-0 rounded-full" fallback={<UniformIcon name="user" size={20}/>} />:<button onClick={()=>openSender(openEmail.sender, openEmail.email, openEmail.company)} className="w-10 h-10 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center font-medium shrink-0" aria-label={`Open profile for ${openEmail.sender}`}><AvatarIcon email={openEmail.email} size={20} /></button>}<div className="min-w-0"><div className="font-medium">{openEmail.folder==='sent'?(profileName||'Me'): <button onClick={()=>openSender(openEmail.sender, openEmail.email, openEmail.company)} className="hover:underline underline-offset-2 text-left">{openEmail.sender}</button>} <span className="text-[13px] text-[var(--text-3)] font-normal">{openEmail.folder==='sent'? `<${openEmail.fromAddress||profileEmail||'sender'}>`:`<${openEmail.email}>`}</span></div><p className="text-[13px] text-[var(--text-3)]">{openEmail.folder==='sent'?'Sent by you':'to me'} · {openEmail.category}{openEmail.label?` · ${openEmail.label}`:''}</p></div></div>
            {openEmail.folder==='sent'&&<div className="flex items-center gap-2 mt-3 ml-[52px]"><GravatarAvatar email={openEmail.email} name={openEmail.email.split('@')[0]||'Recipient'} size={24} className="shrink-0 rounded-full"/><span className="text-[13px] text-[var(--text-3)]">To</span><button onClick={()=>openSender((openEmail.email.split('@')[0]||'Recipient').replace(/[._-]+/g,' '),openEmail.email)} className="text-[13px] font-medium hover:underline break-all">{openEmail.email}</button></div>}
            <div className="flex flex-wrap items-center gap-2 mt-5"><span className="text-[12px] font-medium">Message preview:</span><button onClick={()=>setDetailPreviewMode('text')} className={`px-3 py-1.5 rounded-full text-[12px] ${detailPreviewMode==='text'?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`}>Text</button><button onClick={()=>setDetailPreviewMode('html')} className={`px-3 py-1.5 rounded-full text-[12px] ${detailPreviewMode==='html'?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`}>HTML</button><span className="text-[12px] text-[var(--text-3)]">{detailPreviewMode==='html' ? 'HTML preview blocks scripts, links and remote content.' : 'Plain-text view'}</span></div>
            {detailState?.id===openEmail.id && detailState.status==='loading' ? null : detailState?.id===openEmail.id && detailState.status==='error' ? <div className="mt-4" role="alert"><p>Could not load this message.</p><button className="underline mt-2" onClick={()=>void openMessage(openEmail.id)}>Try again</button></div> : detailPreviewMode==='html' && openEmail.htmlBody ? <SafeEmailHtml html={openEmail.htmlBody}/> : <p className="whitespace-pre-line leading-[1.7] text-[15px] mt-6">{detailPreviewMode==='html' ? 'An HTML version is not available for this message. Select Text to read the available content.' : (openEmail.body || (openEmail.detailLoaded ? 'No plain-text content available.' : 'Loading message…'))}</p>}
            {openEmail.sourceUrl && <div className="mt-6 border border-[var(--border)] rounded-xl p-3 max-w-[440px] text-[14px]"><p>The original message may contain attachments. Individual attachment previews are not available yet.</p><a className="underline underline-offset-2" href={openEmail.sourceUrl}>Download original message (.eml)</a></div>}
            <div className="flex flex-wrap gap-2 mt-8"><button onClick={()=>openCompose('reply', openEmail)} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] hover:bg-[var(--surface-2)]"><UniformIcon name="reply" size={17}/> Reply</button><button onClick={()=>openCompose('forward', openEmail)} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] hover:bg-[var(--surface-2)]"><UniformIcon name="forward" size={17}/> Forward</button>{openEmail.folder==='drafts' && <button onClick={()=>openCompose('draft', openEmail)} className="px-5 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)]">Continue draft</button>}</div>
          </div>
        </article>
      ) : (view==='inbox'||view==='sent'||view==='deleted') ? (previewMode && previewLayout==='vertical' && previewEmail ? <div className="flex flex-col lg:flex-row gap-3 mx-1 sm:mx-2 items-start"><div className="flex-1 min-w-0 w-full">{mailList}</div><div className="flex-1 min-w-0 w-full lg:max-w-[440px] lg:sticky lg:top-[132px]">{previewPanel}</div></div> : <>{mailList}{previewPanel}</>) : null}

      {view==='outbox' && (
        <div className="mx-1 sm:mx-2">
          <div className="flex flex-wrap items-center gap-2 mb-3"><h2 className="text-[20px] font-medium">Outbox</h2><span className="text-[13px] text-[var(--text-3)]">{filteredOutbox.length} messages · Queued, Sending, Failed, and Unknown in one place.</span><button disabled={viewLoading} onClick={()=>retryCurrentView()} className="px-4 py-2.5 rounded-full border border-[var(--border)] text-[14px] flex items-center gap-1.5 disabled:opacity-50"><UniformIcon name="refresh" size={16}/> Refresh</button></div>
          <div className="bg-[var(--surface)] rounded-2xl gmail-shadow overflow-hidden border border-[var(--border)]">
            {filteredOutbox.length===0 ? <div className="p-10 text-center"><UniformIcon name="sent" size={36} className="mx-auto text-[var(--text-3)]"/><p className="mt-3 font-medium">Outbox is clear</p><p className="text-[13px] text-[var(--text-3)] mt-1">Everything you sent has left the Outbox.</p></div> : filteredOutbox.map(o=>(
              <div key={o.id} className="p-4 sm:p-5 border-b border-[var(--border)] last:border-0 flex flex-col sm:flex-row gap-3"><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium truncate">{o.subject}</p><span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] font-bold">{o.status}</span></div><p className="text-[13px] text-[var(--text-3)] mt-1"><span className="inline-grid w-6 h-6 rounded-full bg-[var(--text)] text-[var(--surface)] place-items-center align-middle mr-1.5"><AvatarIcon email={o.to} size={14} /></span>To <button onClick={()=>openSender(o.to.split('@')[0].replace(/[._]/g,' '), o.to)} className="underline underline-offset-2 font-medium text-[var(--text)]">{o.to}</button> · {o.attempt}</p><p className="text-[14px] mt-2 line-clamp-2">{o.body}</p>{o.error && <p className="flex gap-1.5 items-start text-[13px] mt-2"><UniformIcon name="alert" size={16}/>{o.error}</p>}</div></div>
            ))}
          </div>
          <div className="mt-3 bg-[var(--surface)] rounded-2xl p-4 gmail-shadow flex gap-3 border border-[var(--border)]"><UniformIcon name="alert" size={18}/><p className="text-[13px] text-[var(--text-3)] leading-relaxed"><span className="font-medium text-[var(--text)]">Check the message status before sending again.</span> Automatic retry controls are temporarily unavailable. Unknown outcomes must be reconciled to avoid duplicate sends; queued messages are processed automatically.</p></div>
        </div>
      )}

      {view==='assistant' && (
        <div className="mx-1 sm:mx-2">
          <div className="bg-[var(--text)] text-[var(--surface)] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center"><div className="flex-1"><div className="flex items-center gap-3"><span className="w-9 h-9 rounded-full border border-current grid place-items-center"><UniformIcon name="assistant" size={20}/></span><h2 className="text-[22px] font-medium">LeadMASTER Assistant</h2></div><p className="text-[14px] opacity-80 mt-2 max-w-[620px]">Works with messages in your connected mailbox. AI suggestions are drafts only; review and approve every send.</p></div><span className="text-[12px] border border-current px-3 py-1.5 rounded-full">{counts.inboxUnread} unread · {counts.inboxTotal} in Inbox</span></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {[{k:'summary' as const,t:'Summarize inbox',d:'Briefing from currently loaded messages.',i:'spark' as IconName},{k:'drafts' as const,t:'Suggest replies',d:'Generate a reply for a real received message.',i:'reply' as IconName},{k:'cleanup' as const,t:'Review cleanup',d:'Find read, unstarred messages for archiving.',i:'zap' as IconName},{k:'priority' as const,t:'Priority messages',d:'Starred messages and unread items first.',i:'flame' as IconName}].map(c=><button key={c.k} disabled={busy||viewLoading} onClick={()=>runAssistant(c.k)} className={`text-left bg-[var(--surface)] rounded-2xl p-4 gmail-shadow border-2 disabled:opacity-50 ${assistantTab===c.k?'border-[var(--text)]':'border-[var(--border)]'}`}><UniformIcon name={c.i} size={20}/><p className="font-medium mt-2">{c.t}</p><p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed">{c.d}</p><span className="inline-block mt-3 text-[13px] font-medium underline underline-offset-2">Run →</span></button>)}
          </div>
          <div className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mt-4 border border-[var(--border)]">
            <p className="font-medium">{assistantTab==='summary'?'Inbox summary':assistantTab==='drafts'?'AI reply suggestions':assistantTab==='cleanup'?'Cleanup review':'Priority messages'}</p>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-[var(--text-2)] mt-2 min-h-[90px]">{assistantResult||'Choose an action above to analyze your connected mailbox.'}</p>
            {assistantTab==='drafts' && <div className="space-y-2 mt-3">{allEmails.filter(e=>e.folder==='inbox'&&!deleted.has(e.id)).slice(0,20).map(e=><div key={e.id} className="border border-[var(--border)] rounded-xl p-3 flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="font-medium truncate">{e.sender}</p><p className="text-[13px] text-[var(--text-3)] truncate">{e.subject}</p></div><button disabled={busy} onClick={()=>suggestReplyFor(e)} className="px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-50">{busy?'Preparing…':'Suggest reply'}</button></div>)}</div>}
            {assistantTab==='cleanup' && <div className="mt-3"><button disabled={busy} onClick={applyCleanup} className="px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-50">Archive eligible read messages</button>{cleanupApplied&&<span className="ml-3 text-[13px]">Archive requests processed</span>}</div>}
            {assistantTab==='priority' && <div className="space-y-2 mt-3">{allEmails.filter(e=>e.folder==='inbox'&&!deleted.has(e.id)).sort((a,b)=>Number(starred.has(b.id))-Number(starred.has(a.id))||Number(!readIds.has(b.id))-Number(!readIds.has(a.id))).slice(0,12).map(e=><button key={e.id} onClick={()=>openMessage(e.id)} className="w-full text-left border border-[var(--border)] rounded-xl p-3"><span className="font-medium">{starred.has(e.id)?'★ ':''}{e.sender}</span><span className="text-[13px] text-[var(--text-3)]"> · {e.subject}{readIds.has(e.id)?'':' · Unread'}</span></button>)}</div>}
          </div>
        </div>
      )}

      {view==='automation' && (
        <div className="mx-1 sm:mx-2">
          <div className="flex flex-wrap items-center gap-3 mb-3"><h2 className="text-[20px] font-medium">Automation</h2><span className="text-[13px] text-[var(--text-3)]">{rules.filter(r=>r.enabled).length} of {rules.length} rules saved as enabled</span><button disabled={viewLoading} onClick={()=>setShowRuleForm(!showRuleForm)} className="ml-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] disabled:opacity-50"><UniformIcon name="plus" size={17}/> Add Rule</button></div>
          {showRuleForm && <div className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-4 border border-[var(--border)]"><p className="font-medium">Create rule</p><p className="text-[13px] text-[var(--text-3)] mt-1">When sender / subject contains … → Do label / star / archive / move.</p><div className="grid sm:grid-cols-2 gap-3 mt-4"><label className="text-[13px]">Rule name<input value={ruleForm.name} onChange={e=>setRuleForm({...ruleForm, name:e.target.value})} placeholder="e.g. Star pricing leads" className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">When<select value={ruleForm.triggerType} onChange={e=>setRuleForm({...ruleForm, triggerType:e.target.value as any})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)]"><option value="sender">Sender contains</option><option value="subject">Subject contains</option></select></label><label className="text-[13px]">Contains<input value={ruleForm.contains} onChange={e=>setRuleForm({...ruleForm, contains:e.target.value})} placeholder="pricing" className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">Do<select value={ruleForm.action} onChange={e=>setRuleForm({...ruleForm, action:e.target.value as any})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)]"><option value="label">Label</option><option value="star">Star</option><option value="archive">Archive</option><option value="move">Move to category</option></select></label>{(ruleForm.action==='label'||ruleForm.action==='move') && <label className="text-[13px] sm:col-span-2">{ruleForm.action==='label'?'Label':'Move to'}<input value={ruleForm.actionValue} onChange={e=>setRuleForm({...ruleForm, actionValue:e.target.value})} placeholder="Work" className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label>}</div><div className="flex justify-end gap-2 mt-4"><button onClick={()=>setShowRuleForm(false)} className="px-4 py-2 rounded-full hover:bg-[var(--surface-2)]">Cancel</button><button onClick={saveRuleForm} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)]">Save rule</button></div></div>}
          <div className="space-y-3">{filteredRules.map(r=>(
            <div key={r.id} className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-center border border-[var(--border)]"><div className="flex-1 min-w-0"><p className="font-medium">{r.name}</p><p className="text-[13px] text-[var(--text-3)] mt-1">When <span className="font-medium text-[var(--text)]">{r.triggerType}</span> contains “<span className="font-medium text-[var(--text)]">{r.contains}</span>” → <span className="font-medium text-[var(--text)]">{r.action}{r.actionValue?` · ${r.actionValue}`:''}</span></p></div><div className="flex items-center gap-2"><button disabled={viewLoading} onClick={()=>deleteRule(r.id)} className="p-2 rounded-full hover:bg-[var(--surface-2)] disabled:opacity-50" aria-label="Delete rule"><UniformIcon name="trash" size={17}/></button><button disabled={viewLoading} onClick={()=>toggleRule(r.id)} role="switch" aria-checked={r.enabled} aria-label={`Toggle ${r.name}`} className={`w-11 h-6 rounded-full relative shrink-0 border border-[var(--border)] disabled:opacity-50 ${r.enabled?'bg-[var(--text)]':'bg-[var(--surface-3)]'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-all ${r.enabled?'left-[22px] bg-[var(--surface)]':'left-0.5 bg-white'}`}/></button><span className="text-[13px] w-10">{r.enabled?'On':'Off'}</span></div></div>
          ))}</div>
          {filteredRules.length===0 && <div className="bg-[var(--surface)] rounded-2xl p-8 text-center text-[var(--text-3)] text-[14px] border border-[var(--border)]">No rules match “{search}”. Add one to automate triage.</div>}
        </div>
      )}

      {view==='templates' && (
        <div className="mx-1 sm:mx-2">
          <div className="flex flex-wrap items-center gap-3 mb-3"><h2 className="text-[20px] font-medium">Templates</h2><span className="text-[13px] text-[var(--text-3)]">{filteredTemplates.length} templates</span><button disabled={viewLoading} onClick={()=>openEditTemplate()} className="ml-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] disabled:opacity-50"><UniformIcon name="plus" size={17}/> New Template</button></div>
          {showTemplateForm && <div className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-4 border border-[var(--border)]"><p className="font-medium">{templateForm.id?'Edit template':'New template'}</p><div className="grid sm:grid-cols-2 gap-3 mt-4"><label className="text-[13px]">Name<input value={templateForm.name} onChange={e=>setTemplateForm({...templateForm, name:e.target.value})} placeholder="Template name" className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">Category<input value={templateForm.category} onChange={e=>setTemplateForm({...templateForm, category:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px] sm:col-span-2">Subject<input value={templateForm.subject} onChange={e=>setTemplateForm({...templateForm, subject:e.target.value})} placeholder="Subject" className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px] sm:col-span-2">Body<textarea value={templateForm.body} onChange={e=>setTemplateForm({...templateForm, body:e.target.value})} placeholder="Body" rows={5} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none resize-y"/></label></div><div className="flex justify-end gap-2 mt-4"><button onClick={()=>setShowTemplateForm(false)} className="px-4 py-2 rounded-full hover:bg-[var(--surface-2)]">Cancel</button><button onClick={saveTemplateForm} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)]">Save template</button></div></div>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{filteredTemplates.map(t=>(
            <article key={t.id} className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 flex flex-col border border-[var(--border)]"><span className="text-[11px] font-bold uppercase tracking-wide">{t.category}</span><h3 className="font-medium text-[17px] mt-1">{t.name}</h3><p className="text-[13px] font-medium mt-2 line-clamp-1">{t.subject}</p><p className="text-[13px] text-[var(--text-3)] leading-relaxed mt-1 line-clamp-2 flex-1 whitespace-pre-line">{t.body}</p><div className="flex flex-wrap gap-1.5 mt-4"><button disabled={viewLoading} onClick={()=>useTemplate(t)} className="px-3.5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-50">Use Template</button><button disabled={viewLoading} onClick={()=>setTemplatePreviewId(templatePreviewId===t.id?'':t.id)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px]">Preview</button><button disabled={viewLoading} onClick={()=>openEditTemplate(t)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="edit" size={13}/> Edit</button><button disabled={viewLoading} onClick={()=>duplicateTemplate(t)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="copy" size={13}/> Duplicate</button><button disabled={viewLoading} onClick={()=>deleteTemplate(t)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="trash" size={13}/> Delete</button></div>{templatePreviewId===t.id&&<div className="mt-3 border border-[var(--border)] rounded-xl p-3 bg-[var(--background)]"><p className="text-[12px] font-semibold mb-2">Preview · {t.subject}</p>{containsHtml(t.body)?<div dangerouslySetInnerHTML={{__html:sanitizeHtml(t.body)}}/>:<p className="text-[13px] whitespace-pre-line">{t.body||"No template body."}</p>}</div>}</article>
          ))}</div>
          {filteredTemplates.length===0 && <div className="bg-[var(--surface)] rounded-2xl p-8 text-center text-[var(--text-3)] text-[14px] border border-[var(--border)] mt-3">No templates match “{search}”.</div>}
        </div>
      )}

      {view==='scheduled' && (
        <div className="mx-1 sm:mx-2">
          <div className="flex flex-wrap items-center gap-3 mb-3"><h2 className="text-[20px] font-medium">Scheduled</h2><span className="text-[13px] text-[var(--text-3)]">{filteredScheduled.length} saved schedules · automatic timed dispatch is not enabled</span><button disabled={viewLoading} onClick={()=>{setScheduleForm({id:'', to:'', subject:'', body:'', when:'Tomorrow · 9:00 AM'}); setShowScheduleForm(true); setSchedulePicker(null);}} className="ml-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] disabled:opacity-50"><UniformIcon name="plus" size={17}/> New scheduled</button></div>
          {showScheduleForm && <div className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-4 border border-[var(--border)]"><p className="font-medium">{scheduleForm.id?'Edit schedule':'New scheduled message'}</p><div className="grid sm:grid-cols-2 gap-3 mt-4"><label className="text-[13px]">To<input value={scheduleForm.to} onChange={e=>setScheduleForm({...scheduleForm, to:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">Send at<input value={scheduleForm.when} onChange={e=>setScheduleForm({...scheduleForm, when:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px] sm:col-span-2">Subject<input value={scheduleForm.subject} onChange={e=>setScheduleForm({...scheduleForm, subject:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px] sm:col-span-2">Body<textarea value={scheduleForm.body} onChange={e=>setScheduleForm({...scheduleForm, body:e.target.value})} rows={4} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none resize-y"/></label></div><div className="flex justify-end gap-2 mt-4"><button onClick={()=>{setShowScheduleForm(false); setSchedulePicker(null);}} className="px-4 py-2 rounded-full hover:bg-[var(--surface-2)]">Cancel</button><button onClick={saveScheduleForm} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)]">Save schedule</button></div></div>}
          {schedulePicker && <div className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-4 border-2 border-[var(--text)]"><p className="font-medium flex items-center gap-2"><UniformIcon name="calendar" size={18}/> Edit Schedule — choose date &amp; time</p><p className="text-[13px] text-[var(--text-3)] mt-1">Current: {schedulePicker.when}</p><label className="block text-[13px] mt-4">Date &amp; time<input type="datetime-local" value={schedulePicker.dateTime} onChange={e=>setSchedulePicker({...schedulePicker, dateTime:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><div className="flex flex-wrap gap-2 mt-3">{['Tomorrow · 9:00 AM','Friday · 8:30 AM','Monday · 10:00 AM'].map(p=><button key={p} onClick={()=>setSchedulePicker({...schedulePicker, when:p})} className={`px-3 py-1.5 rounded-full border text-[13px] ${schedulePicker.when===p?'bg-[var(--text)] text-[var(--surface)]':'border-[var(--border)]'}`}>{p}</button>)}</div><div className="flex justify-end gap-2 mt-4"><button onClick={()=>setSchedulePicker(null)} className="px-4 py-2 rounded-full hover:bg-[var(--surface-2)]">Cancel</button><button onClick={saveSchedulePicker} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)]">Save schedule</button></div></div>}
          <div className="space-y-3">{filteredScheduled.map(s=>(
            <div key={s.id} className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 flex flex-col sm:flex-row gap-3 border border-[var(--border)]"><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium truncate">{s.subject}</p><span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] font-medium flex items-center gap-1"><UniformIcon name="clock" size={12}/> {s.when}</span></div><p className="text-[13px] text-[var(--text-3)] mt-1"><span className="inline-grid w-6 h-6 rounded-full bg-[var(--text)] text-[var(--surface)] place-items-center align-middle mr-1.5"><AvatarIcon email={s.to} size={14} /></span>To <button onClick={()=>openSender(s.to.split('@')[0].replace(/[._]/g,' '), s.to)} className="underline underline-offset-2 font-medium text-[var(--text)]">{s.to}</button> · Saved for {s.when}</p><p className="text-[14px] text-[var(--text-2)] mt-2 line-clamp-2 whitespace-pre-line">{s.body}</p></div><div className="flex sm:flex-col gap-2 shrink-0"><button disabled={viewLoading} onClick={()=>openEditSchedule(s)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="edit" size={14}/> Edit schedule</button><button disabled={viewLoading} onClick={()=>sendNowScheduled(s)} className="px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="send" size={14}/> Send now</button><button disabled={viewLoading} onClick={()=>cancelScheduled(s)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] disabled:opacity-50">Cancel</button></div></div>
          ))}</div>
          {filteredScheduled.length===0 && <div className="bg-[var(--surface)] rounded-2xl p-8 text-center border border-[var(--border)]"><UniformIcon name="scheduled" size={32} className="mx-auto text-[var(--text-3)]"/><p className="font-medium mt-2">Nothing scheduled</p><p className="text-[13px] text-[var(--text-3)] mt-1">Schedule a message from Compose or add one here.</p></div>}
        </div>
      )}

      {view==='settings' && (
        <div className="mx-1 sm:mx-2 max-w-[760px]">
          <h2 className="text-[20px] font-medium mb-3">Settings</h2>
          {settingsComponentsOrganizer}
          <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]"><h3 className="font-medium">Profile &amp; signature</h3><div className="grid sm:grid-cols-2 gap-3 mt-4"><label className="text-[13px]">Full name<input value={profileName} onChange={e=>{setProfileName(e.target.value); setSettingsSaved(false);}} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">Email<input value={profileEmail} onChange={e=>{setProfileEmail(e.target.value); setSettingsSaved(false);}} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px] sm:col-span-2">Signature<textarea value={signature} onChange={e=>{setSignature(e.target.value); setSettingsSaved(false);}} rows={4} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none resize-y"/><span className="text-[12px] text-[var(--text-3)]">Used when you use a template or send from LeadMaster.</span></label></div></section>
          <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]"><h3 className="font-medium">Theme — Black &amp; White</h3><p className="text-[13px] text-[var(--text-3)] mt-1">LeadMaster uses one fixed Black &amp; White theme. White background, black text, gray panels and borders.</p><div className="flex flex-wrap gap-2 mt-3"><span className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] font-medium">Black &amp; White — Selected</span><span className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] text-[var(--text-3)]">White #FFFFFF · Panels #FAFAFA / #F5F5F5 · Borders #E5E5E5</span></div><h3 className="font-medium mt-5">Density</h3><div className="flex flex-wrap gap-2 mt-3">{(['comfortable','compact'] as const).map(d=><button key={d} disabled={viewLoading} onClick={()=>{setDensity(d); savePrefs({density:d});}} className={`px-4 py-2 rounded-full border capitalize disabled:opacity-50 ${density===d?'bg-[var(--text)] text-[var(--surface)]':'border-[var(--border)]'}`}>{d}</button>)}</div></section>
          <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]"><h3 className="font-medium">Notifications</h3><div className="space-y-3 mt-3 text-[14px]">{[[notifEmail, setNotifEmail, 'Email notifications', 'Preference saved; email alerts are not active yet'], [notifDesktop, setNotifDesktop, 'Desktop notifications', 'Preference saved; desktop alerts are not active yet'], [notifSound, setNotifSound, 'Sounds', 'Play sounds for new mail, confirmed sends, and deletions while the workspace is open']].map(([val, setter, label, desc]:any, i)=><label key={i} className="flex items-start gap-3 cursor-pointer"><input type="checkbox" disabled={viewLoading} checked={val} onChange={e=>{setter(e.target.checked); if(i===2){soundEnabled.current=e.target.checked;if(e.target.checked)soundPlayer.current.unlock();} savePrefs({[i===0?'notifEmail':i===1?'notifDesktop':'notifSound']:e.target.checked});}} className="accent-black w-4 h-4 mt-0.5"/><span><span className="block">{label}</span><span className="block text-[13px] text-[var(--text-3)]">{desc}</span></span></label>)}</div></section>
          <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]"><h3 className="font-medium">Default reply behavior</h3><div className="flex flex-wrap gap-2 mt-3">{([['reply','Reply'],['reply-all','Reply all']] as const).map(([v,l])=><button key={v} disabled={viewLoading} onClick={()=>{setReplyBehavior(v); savePrefs({replyBehavior:v});}} className={`px-4 py-2 rounded-full border disabled:opacity-50 ${replyBehavior===v?'bg-[var(--text)] text-[var(--surface)]':'border-[var(--border)]'}`}>{l}</button>)}</div><p className="text-[13px] text-[var(--text-3)] mt-2">Reply buttons in email detail follow this default.</p></section>
          <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]"><div className="flex items-center justify-between gap-3"><div><h3 className="font-medium">Vacation responder</h3><p className="text-[13px] text-[var(--text-3)] mt-1">Save your out-of-office message preferences. Automatic replies are not enabled yet.</p></div><button disabled={viewLoading} onClick={()=>{const next=!vacationOn; setVacationOn(next); savePrefs({vacationOn:next});}} role="switch" aria-checked={vacationOn} className={`w-11 h-6 rounded-full relative shrink-0 border border-[var(--border)] disabled:opacity-50 ${vacationOn?'bg-[var(--text)]':'bg-[var(--surface-3)]'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-all ${vacationOn?'left-[22px] bg-[var(--surface)]':'left-0.5 bg-white'}`}/></button></div>{vacationOn && <div className="grid gap-3 mt-4"><label className="text-[13px]">Subject<input value={vacationSubject} onChange={e=>setVacationSubject(e.target.value)} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">Message<textarea value={vacationBody} onChange={e=>setVacationBody(e.target.value)} rows={4} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none resize-y"/></label></div>}</section>
          <div className="flex flex-wrap gap-2"><button disabled={viewLoading} onClick={saveSettings} className="px-6 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] disabled:opacity-50">Save Settings</button><button onClick={()=>{setDensity('comfortable'); setSignature('Best,\nLeadMASTER'); setStatus('Settings reset to LeadMaster defaults.');}} className="px-5 py-2.5 rounded-full border border-[var(--border)] text-[14px]">Reset to defaults</button></div>
          {settingsSaved && <p className="flex items-center gap-2 text-[13px] font-medium mt-3"><UniformIcon name="check" size={16}/> Settings saved — profile, theme, and signature are stored.</p>}
          <p className="text-[12px] text-[var(--text-3)] mt-3">Settings are saved to your LeadMaster workspace. Vacation responder only applies when turned on.</p>
        </div>
      )}

      {view==='inbox' && !openEmail && <div className="grid sm:grid-cols-3 gap-3 mx-1 sm:mx-2 mt-4">
        {[{t:'One inbox', d:'All incoming messages appear together. Search and use message actions to focus on what matters.', i:'spark' as IconName}, {t:'Triage in seconds', d:'Hover any row to archive, delete, or snooze. Star what you need to find again.', i:'zap' as IconName}, {t:'Assistant does the busywork', d:'Summaries, draft replies, cleanup, and priority leads — in one panel.', i:'assistant' as IconName}].map(x=><div key={x.t} className="bg-[var(--surface)] rounded-2xl p-4 gmail-shadow border border-[var(--border)]"><UniformIcon name={x.i} size={18}/><p className="font-medium mt-2">{x.t}</p><p className="text-[13px] text-[var(--text-3)] leading-relaxed mt-1">{x.d}</p></div>)}
      </div>}
    </>
  );

  const senderProfile = selectedSender ? (()=>{ const info = senderInfoFor(selectedSender.email, selectedSender.name, selectedSender.company); const emailCount = allEmails.filter(e=>e.email.toLowerCase()===selectedSender.email.toLowerCase()).length; return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-label={`Profile for ${selectedSender.name}`}>
      <div className="absolute inset-0 bg-black/40" onClick={()=>setSelectedSender(null)} />
      <div className="relative w-[360px] max-w-[calc(100vw-16px)] bg-[var(--surface)] h-full overflow-y-auto p-5 border-l border-[var(--border)]">
        <div className="flex items-start justify-between"><p className="text-[12px] font-bold uppercase tracking-wide">Sender Profile</p><button onClick={()=>setSelectedSender(null)} className="p-1.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Close sender profile"><UniformIcon name="x" size={18}/></button></div>
        <div className="text-center mt-4"><span className="w-16 h-16 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center text-[22px] font-medium mx-auto"><AvatarIcon email={selectedSender.email} size={32} /></span><p className="text-[12px] text-[var(--text-3)] mt-2">{avatarLabelForEmail(selectedSender.email)}</p><h2 className="text-[20px] font-medium mt-3">{selectedSender.name}</h2><p className="text-[13px] text-[var(--text-3)] break-all">{selectedSender.email}</p></div>
        <dl className="mt-5 space-y-3 text-[14px]">
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-3)]">Company</dt><dd className="font-medium text-right">{info.company || '—'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-3)]">Role</dt><dd className="font-medium text-right">{info.role}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-3)]">Phone</dt><dd className="font-medium text-right">{info.phone}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-3)]">Location</dt><dd className="font-medium text-right">{info.location}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-3)]">Labels</dt><dd className="font-medium text-right">{info.labels}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-3)]">Last contacted</dt><dd className="font-medium text-right">{info.lastContacted}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--text-3)]">Emails</dt><dd className="font-medium text-right">{emailCount} in LeadMaster</dd></div>
        </dl>
        <label className="block text-[13px] font-medium mt-5">Notes about sender<textarea value={senderNoteDraft} onChange={e=>setSenderNoteDraft(e.target.value)} rows={4} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none resize-y text-[13px]" placeholder="Add notes about this sender…"/></label>
        <button onClick={saveSenderNote} className="mt-2 px-4 py-2 rounded-full border border-[var(--border)] text-[13px]">Save note</button>
        <div className="grid gap-2 mt-5">
          <button onClick={sendEmailToSender} className="flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px]"><UniformIcon name="send" size={16}/> Send Email</button>
          <button onClick={addSenderToContacts} className="flex items-center justify-center gap-2 px-4 py-3 rounded-full border border-[var(--border)] text-[14px]"><UniformIcon name="contacts" size={16}/> Add to Contacts</button>
          <button onClick={viewAllFromSender} className="flex items-center justify-center gap-2 px-4 py-3 rounded-full border border-[var(--border)] text-[14px]"><UniformIcon name="inbox" size={16}/> View All Emails From Sender</button>
        </div>
        <p className="text-[12px] text-[var(--text-3)] mt-4">Clicking a sender never opens the email itself. Click the email row to open the message.</p>
      </div>
    </div>
  ); })() : null;

  const utilityRoute = new URLSearchParams(window.location.search).get('app');
  if(utilityRoute) return <UtilityApps route={utilityRoute}/>;

  return (
    <div data-safe-area-inset-root className="min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden w-full flex flex-col bg-[var(--background)] overflow-x-clip" style={{boxSizing:'border-box', paddingTop:'var(--safe-area-inset-top)'}} onTouchStart={handleRefreshTouchStart} onTouchEnd={handleRefreshTouchEnd} onPointerDown={handleRefreshPointerDown} onPointerUp={handleRefreshPointerUp} onWheel={handleRefreshWheel}>
      <header data-safe-area-sticky-top className="sticky z-40 shrink-0 bg-[var(--background)] border-b border-[var(--border)]" style={{top:'var(--safe-area-inset-top)'}}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[52px_48px] gap-x-3 px-3 md:grid-cols-[minmax(0,1fr)_minmax(280px,680px)_minmax(0,1fr)] md:grid-rows-[72px] md:gap-x-5 md:px-6">
          <button type="button" className="col-start-1 row-start-1 justify-self-start self-center shrink-0 rounded-lg p-0" onClick={()=>goView('inbox')} aria-label="Go to Inbox">
            <img src="/assets/brand/leadmaster-full.svg" width="164" height="38" alt="LeadMASTER" className="block w-[118px] sm:w-[148px] md:w-[164px] h-auto object-contain"/>
          </button>
          <div className="col-span-3 row-start-2 w-full min-w-0 self-start md:col-span-1 md:col-start-2 md:row-start-1 md:self-center">
            <div className={`mx-auto flex w-full items-center gap-2 rounded-full px-3 sm:px-4 h-[42px] md:h-[48px] border border-[var(--border)] ${showFilters?'bg-[var(--surface)] shadow':'bg-[var(--surface-2)]'}`}><UniformIcon name="search" size={20}/><input value={search} onChange={e=>{setSearch(e.target.value); setOpenEmailId(null);}} placeholder="Search leads & mail" className="flex-1 min-w-0 bg-transparent outline-none text-[14px] md:text-[15px] placeholder:text-[var(--text-3)]" aria-label="Search mail"/>{search && <button onClick={()=>setSearch('')} aria-label="Clear search" className="p-1 rounded-full hover:bg-[var(--surface-3)]"><UniformIcon name="x" size={16}/></button>}<button onClick={()=>setShowFilters(!showFilters)} className={`p-1.5 rounded-full ${showFilters?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Show search options"><UniformIcon name="filter" size={19}/></button></div>
            {showFilters && <div className="absolute left-1/2 -translate-x-1/2 top-[104px] md:top-[62px] w-[calc(100%-24px)] md:w-full max-w-[560px] bg-[var(--surface)] rounded-2xl gmail-shadow p-4 z-50 text-[14px] border border-[var(--border)]"><p className="font-medium mb-3">Search options</p><label className="flex items-center gap-3 py-2"><input type="checkbox" checked={onlyAttachment} onChange={e=>setOnlyAttachment(e.target.checked)} className="accent-black w-4 h-4"/> Has attachment</label><div className="flex justify-end gap-2 mt-3"><button onClick={()=>{setOnlyAttachment(false); setSearch(''); setShowFilters(false);}} className="px-4 py-2 rounded-full hover:bg-[var(--surface-2)]">Clear</button><button onClick={()=>setShowFilters(false)} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)]">Search</button></div></div>}
          </div>
          <div className="col-start-3 row-start-1 flex items-center justify-self-end gap-0.5 md:gap-1 shrink-0">
            <button onClick={()=>setShowHelp(!showHelp)} className="hidden sm:block p-2 md:p-2.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Help"><UniformIcon name="help" size={20}/></button>
            <button onClick={()=>void refreshWorkspace()} disabled={isRefreshing} className="p-2 md:p-2.5 rounded-full hover:bg-[var(--surface-3)] disabled:opacity-50" aria-label="Refresh workspace" title={lastRefreshedAt ? `Last verified ${new Date(lastRefreshedAt).toLocaleTimeString()}` : "Refresh workspace"}><UniformIcon name="refresh" size={19}/></button>
            <button onClick={()=>setShowApps(!showApps)} className="p-2 md:p-2.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Apps"><UniformIcon name="apps" size={19}/></button>
          </div>
        </div>
        {(showHelp||showApps) && <div className="absolute right-2 sm:right-4 top-[72px] w-[320px] max-w-[calc(100vw-16px)] bg-[var(--surface)] rounded-2xl gmail-shadow p-4 z-50 border border-[var(--border)]">
          {showHelp && <div><p className="font-medium">Help — LeadMASTER</p><p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed">Search filters this view live. Star, archive, snooze and delete are on every row. Use Assistant for summaries, Automation for rules, Templates for fast replies, and Scheduled for send-later.</p><button onClick={()=>setShowHelp(false)} className="mt-3 text-[14px] underline underline-offset-2">Close</button></div>}
          {showApps && <div><p className="font-medium mb-3">Apps</p><div className="grid grid-cols-3 gap-3 text-center text-[12px]">
            {[['Notes','note','notes'],['Contacts','contacts','contacts'],['Calendar','calendar','calendar'],['Calculator','tasks','calculator'],['Currency Conversion','building','currency'],['Email HTML Playground','html','email-html-playground']].map(([name,ic,route])=><a key={route} href={`/dashboard?app=${route}`} target="_blank" rel="noopener noreferrer" onClick={()=>setShowApps(false)} className="p-3 rounded-xl hover:bg-[var(--surface-2)] flex flex-col items-center gap-1 text-[var(--text-2)]"><UniformIcon name={ic as IconName} size={22}/><span>{name}</span></a>)}
          </div></div>}
        </div>}
      </header>
      {showProfile && <div className="fixed left-3 md:left-4 bottom-20 z-[90] w-[min(310px,calc(100vw-24px))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 gmail-shadow" role="dialog" aria-label="Profile and settings">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
          <GravatarAvatar email={profileEmail} name={profileName} size={44} className="rounded-full" />
          <div className="min-w-0"><p className="font-semibold text-[14px] truncate">{profileName}</p><p className="text-[12px] text-[var(--text-3)] truncate">{profileEmail}</p></div>
        </div>
        <button onClick={()=>{setShowProfile(false);goView('settings');}} className="mt-3 w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium hover:bg-[var(--surface-2)]"><UniformIcon name="settings" size={18}/> Profile, settings &amp; configurations</button>
        <button onClick={()=>setShowProfile(false)} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-[12px] text-[var(--text-3)] hover:bg-[var(--surface-2)]">Close</button>
      </div>}

      {!mobileSidebar && <button onClick={()=>setMobileSidebar(true)} className="md:hidden fixed bottom-4 left-4 z-[60] w-11 h-11 grid place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-lg" aria-label="Open navigation" title="Open navigation"><UniformIcon name="panel" size={19}/></button>}
      <div className="flex flex-1 min-h-0 items-start lg:overflow-hidden">
        <aside className={`hidden md:block shrink-0 sticky top-[72px] h-[calc(100vh-72px)] lg:top-0 lg:h-full ${sidebarOpen?'w-[256px]':'w-[72px]'} transition-all overflow-hidden`}>
          {sidebarOpen ? sidebar : <div className="h-full flex flex-col items-center py-3 gap-1">
            <nav className="flex-1 flex flex-col items-center gap-1" aria-label="Collapsed LeadMASTER navigation">{NAV.map(k=><button key={k.k} onClick={()=>goView(k.k)} className={`w-11 h-11 grid place-items-center rounded-xl ${view===k.k?'bg-[var(--text)] text-[var(--surface)]':'hover:bg-[var(--surface-2)]'}`} aria-label={k.label} title={k.label}><UniformIcon name={k.icon} size={20}/></button>)}</nav>
            <button onClick={()=>setShowProfile(!showProfile)} className="w-11 h-11 grid place-items-center rounded-full bg-[var(--text)] text-[var(--surface)] hover:opacity-80" aria-label="Open profile and settings" title="Profile & settings"><UniformIcon name="user" size={19}/></button>
            <button onClick={()=>setSidebarOpen(true)} className="w-11 h-11 grid place-items-center rounded-xl hover:bg-[var(--surface-2)]" aria-label="Expand sidebar" title="Expand sidebar"><UniformIcon name="panel" size={20}/></button>
          </div>}
        </aside>
        {mobileSidebar && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setMobileSidebar(false)}/><div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--background)] p-2 pt-4 overflow-y-auto">{sidebar}</div></div>}

        <main ref={mainScrollRef} className="lm-main-scroll flex-1 min-w-0 min-h-0 px-1 sm:px-3 pb-6 lg:h-full lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain">
          {refreshError && <div role="alert" className="mx-2 mt-2 mb-1 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-[13px]"><span className="flex-1 min-w-[180px]">{refreshError}</span><button onClick={()=>void refreshWorkspace()} disabled={isRefreshing} className="rounded-full border border-[var(--text)] px-4 py-2 font-medium disabled:opacity-50">Retry refresh</button></div>}
          {stateBar}
          {isLoading || viewLoading ? LoadingState : loadError || viewError ? ErrorState : mainContent}
        </main>

      </div>

      {senderProfile}

      {loadingOverlayActive && !loadingOverlayDismissed && <div className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/35 backdrop-blur-md" role="status" aria-live="polite"><section className="relative w-full max-w-[420px] min-h-[220px] flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl px-4 py-8" aria-label={sendingPhase ? 'Sending status' : 'Loading status'}><button type="button" onClick={()=>setLoadingOverlayDismissed(true)} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Dismiss loading overlay" title="Dismiss"><UniformIcon name="x" size={18}/></button>{sendingPhase ? <SendingIndicator phase={sendingPhase}/> : <LoadingIndicator label={detailState?.status === 'loading' ? 'Loading message…' : isRefreshing ? 'Refreshing and verifying workspace data…' : isLoading || viewLoading ? `Loading ${viewTitle.toLowerCase()}…` : 'Processing your request…'}/>}</section></div>}
      <ActionConfirmation request={confirmation} onCancel={()=>{setConfirmation(null);setConfirmationAction(null);}} onConfirm={async()=>{const action=confirmationAction;setConfirmation(null);setConfirmationAction(null);await action?.();}} />
      {htmlDialogOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-label="Insert HTML"><div className="absolute inset-0 bg-black/40" onClick={()=>setHtmlDialogOpen(false)} /><div className="relative w-full max-w-[640px] bg-[var(--surface)] rounded-2xl gmail-shadow border border-[var(--border)] overflow-hidden max-h-[92vh] overflow-y-auto"><div className="flex items-center justify-between bg-[var(--surface-2)] px-4 py-3"><p className="font-medium flex items-center gap-2"><UniformIcon name="html" size={18}/> Insert HTML</p><button onClick={()=>setHtmlDialogOpen(false)} className="p-1.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Close HTML dialog"><UniformIcon name="x" size={18}/></button></div><div className="p-4"><p className="text-[13px] text-[var(--text-3)]">Paste HTML or choose a preset. Scripts are stripped on insert. Preview shows how it will render.</p><label className="block text-[13px] font-medium mt-3">Preset<select value={htmlTemplate} onChange={e=>{setHtmlTemplate(e.target.value); const t=HTML_SNIPPETS.find(x=>x.name===e.target.value); if(t) setHtmlDialogValue(t.html);}} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"><option value="">Choose a preset — Button, Table, Divider, Image, Signature Block, Callout Box…</option>{HTML_SNIPPETS.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select></label><label className="block text-[13px] font-medium mt-3">HTML code<textarea value={htmlDialogValue} onChange={e=>setHtmlDialogValue(e.target.value)} rows={10} placeholder={'<p><strong>Hello</strong> — paste HTML here</p>'} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none text-[13px] font-mono resize-y" aria-label="HTML code"/></label><label className="flex items-center gap-2 text-[13px] mt-3"><input type="checkbox" checked={htmlDialogPreview} onChange={e=>setHtmlDialogPreview(e.target.checked)} className="accent-black w-4 h-4"/> Preview HTML</label>{htmlDialogPreview && htmlDialogValue && <div className="mt-3"><p className="text-[12px] font-medium mb-1">Preview</p><div className="border border-[var(--border)] rounded-xl p-3 bg-[var(--background)] text-[14px]" dangerouslySetInnerHTML={{__html: sanitizeHtml(htmlDialogValue)}} /></div>}<div className="flex justify-end gap-2 mt-4"><button onClick={()=>setHtmlDialogOpen(false)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[14px]">Cancel</button><button onClick={insertHtmlFromDialog} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px]">Insert HTML</button></div></div></div></div>}


    </div>
  );
}
