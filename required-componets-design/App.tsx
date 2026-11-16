import React, { useEffect, useMemo, useState } from 'react';

type Category = 'Primary' | 'Promotions' | 'Social' | 'Updates' | 'Forums';
type Folder = 'inbox' | 'sent' | 'drafts';
type View = 'compose' | 'inbox' | 'sent' | 'outbox' | 'deleted' | 'assistant' | 'automation' | 'templates' | 'scheduled' | 'settings';
type Email = { id:string; sender:string; email:string; initials:string; color:string; subject:string; snippet:string; body:string; category:Category; label:string|null; date:string; time:string; unread:boolean; attachment:boolean; folder:Folder; isUser?:boolean; company?:string; value?:string };
type Template = { id:string; name:string; subject:string; body:string; category:string; recordId?:string };
type Rule = { id:string; name:string; triggerType:'sender'|'subject'; contains:string; action:'label'|'star'|'archive'|'move'; actionValue:string; enabled:boolean; recordId?:string };
type ScheduledItem = { id:string; to:string; subject:string; body:string; when:string; recordId?:string };
type OutboxItem = { id:string; to:string; subject:string; body:string; status:'Queued'|'Sending'|'Failed'; error?:string; attempt:string };
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

const SAMPLE: Email[] = [
  {id:'e1', sender:'Figma', email:'team@figma.com', initials:'Fi', color:'#111111', subject:'Your weekly design digest is ready', snippet:'See what changed in Aurora — 12 new comments, 3 prototypes, and one handoff ready for review.', body:'Hi there,\n\nYour weekly digest for Aurora is ready. There are 12 new comments on the checkout flow, 3 prototypes waiting for review, and one handoff marked ready for engineering.\n\nOpen Figma to catch up, leave a reaction, and resolve the threads you own.', category:'Primary', label:'Work', date:'Nov 14', time:'9:41 AM', unread:true, attachment:false, folder:'inbox', company:'Figma'},
  {id:'e2', sender:'Priya Sharma', email:'priya@acmehealth.com', initials:'PS', color:'#222222', subject:'Re: Demo follow-up — Acme Health wants pricing', snippet:'Thanks for the demo. Our team is ready to move forward — can you send the proposal by Thursday?', body:'Hi Alex,\n\nThanks for the demo yesterday. Our team is ready to move forward. The clinical workflow you showed fits exactly what we need.\n\nCan you send the proposal by Thursday? We have budget approved for Q1 and want to start onboarding in January. Happy to jump on a 20-minute call if anything is unclear.', category:'Primary', label:'Work', date:'Nov 14', time:'8:12 AM', unread:true, attachment:false, folder:'inbox', company:'Acme Health', value:'$48,000 / yr'},
  {id:'e3', sender:'Maya Chen', email:'maya.chen@studio.co', initials:'MC', color:'#333333', subject:'Re: Aurora homepage — final copy attached', snippet:'I tightened the hero and pricing copy. The deck is attached — let me know if the headline still feels too long.', body:'Hi,\n\nI tightened the hero and pricing copy for Aurora. The headline is shorter, the subhead explains the outcome, and pricing now leads with the monthly plan.\n\nThe deck is attached. Let me know if anything still feels too long before we lock it.', category:'Primary', label:'Work', date:'Nov 13', time:'6:02 PM', unread:true, attachment:true, folder:'inbox', company:'Studio Co'},
  {id:'e4', sender:'LinkedIn', email:'notifications@linkedin.com', initials:'In', color:'#444444', subject:'Maya and 12 others viewed your profile', snippet:'People are checking out your work on Aurora. See who visited and what roles they are hiring for.', body:'Your profile had more views this week. Maya Chen and 12 others viewed it. Several visitors work in product design and are hiring for senior roles.', category:'Social', label:null, date:'Nov 13', time:'4:30 PM', unread:true, attachment:false, folder:'inbox'},
  {id:'e5', sender:'Chase', email:'alerts@chase.com', initials:'Ch', color:'#555555', subject:'Your statement is ready — $1,284.20 due Dec 2', snippet:'Your November statement is available. You spent $1,284.20, with travel and dining as your top categories.', body:'Your November statement is ready. The balance is $1,284.20 and payment is due December 2. Travel and dining were your top categories this month.', category:'Updates', label:'Finance', date:'Nov 13', time:'11:15 AM', unread:false, attachment:false, folder:'inbox'},
  {id:'e6', sender:'Notion', email:'notify@notion.so', initials:'No', color:'#111111', subject:'Weekly recap: 8 pages updated in Product', snippet:'Aurora roadmap, Launch checklist, and 6 other pages changed. Catch up in one place.', body:'Here is what changed in Product this week: Aurora roadmap, Launch checklist, and 6 other pages were updated. The launch checklist has 3 items left.', category:'Updates', label:'Work', date:'Nov 12', time:'5:48 PM', unread:true, attachment:false, folder:'inbox'},
  {id:'e7', sender:'Daniel Okafor', email:'daniel@northwind.co', initials:'DO', color:'#222222', subject:'Interested in Enterprise — 120 seats', snippet:'We saw LeadMaster at the expo. We need 120 seats, SSO, and a pilot for our sales team.', body:'Hi Alex,\n\nWe saw LeadMaster at the expo and our sales leaders were impressed. We need 120 seats, SSO, and a 30-day pilot for our team.\n\nCan you share enterprise pricing and onboarding? We want to decide before the end of the month.', category:'Primary', label:'Work', date:'Nov 12', time:'2:20 PM', unread:false, attachment:false, folder:'inbox', company:'Northwind', value:'$96,000 / yr'},
  {id:'e8', sender:'Nike', email:'news@nike.com', initials:'Ni', color:'#333333', subject:'Members get early access: Winter Run Collection', snippet:'The new Winter Run Collection drops Thursday. Members shop it 24 hours early.', body:'Members get early access to the Winter Run Collection. The drop opens Thursday at 9 AM and includes insulated jackets, reflective tights, and waterproof runners.', category:'Promotions', label:null, date:'Nov 12', time:'9:05 AM', unread:true, attachment:false, folder:'inbox'},
  {id:'e9', sender:'GitHub', email:'notifications@github.com', initials:'Gh', color:'#444444', subject:'[aurora/web] 2 pull requests need your review', snippet:'PR #482 fixes the checkout total. PR #485 updates the empty states. Reviews requested by Maya.', body:'Two pull requests need your review:\n\n• PR #482 — Fix checkout total rounding\n• PR #485 — Update empty states for search\n\nReviews were requested by Maya. The checks are passing on both.', category:'Primary', label:'Work', date:'Nov 11', time:'7:33 PM', unread:true, attachment:false, folder:'inbox'},
  {id:'e10', sender:'Sara Lindqvist', email:'sara@fjordtravel.se', initials:'SL', color:'#555555', subject:'Weekend in the mountains?', snippet:'Found a cabin with a sauna and a trailhead 10 minutes away. Want me to hold the weekend of Dec 6?', body:'Found a cabin with a sauna and a trailhead 10 minutes away. It sleeps four, has a wood stove, and the host allows a late checkout.\n\nWant me to hold the weekend of Dec 6? I can book it tomorrow if you are in.', category:'Primary', label:'Personal', date:'Nov 11', time:'6:40 AM', unread:false, attachment:false, folder:'inbox'},
  {id:'e11', sender:'Delta Air Lines', email:'receipt@delta.com', initials:'De', color:'#222222', subject:'Your receipt — SFO → JFK, Dec 18', snippet:'Thanks for booking. Your confirmation is H7K2Q9. Seats 14A and 14B, one checked bag included.', body:'Thanks for booking SFO → JFK on Dec 18. Confirmation: H7K2Q9. Seats 14A and 14B. One checked bag is included. Check in 24 hours before departure.', category:'Updates', label:'Travel', date:'Nov 10', time:'3:12 PM', unread:false, attachment:true, folder:'inbox'},
  {id:'e12', sender:'Design Community', email:'digest@designcommunity.org', initials:'DC', color:'#333333', subject:'This week: portfolio teardowns + type systems', snippet:'Five portfolio teardowns, a deep dive on variable fonts, and a thread on pricing freelance work.', body:'This week in the forum: five portfolio teardowns, a deep dive on variable fonts, and a lively thread on pricing freelance work. Jump in and share your take.', category:'Forums', label:null, date:'Nov 10', time:'10:02 AM', unread:true, attachment:false, folder:'inbox'},
  {id:'e13', sender:'Whole Foods Market', email:'offers@wholefoods.com', initials:'WF', color:'#444444', subject:'$10 off $50 + seasonal produce guide', snippet:'This week: persimmons, chanterelles, and citrus are at their peak. Clip the $10 coupon before Sunday.', body:'This week at Whole Foods: persimmons, chanterelles, and citrus are at their peak. Clip the $10 off $50 coupon before Sunday.', category:'Promotions', label:'Personal', date:'Nov 9', time:'8:55 AM', unread:false, attachment:false, folder:'inbox'},
  {id:'e14', sender:'Alex Rivera', email:'alex@rivera.dev', initials:'AR', color:'#111111', subject:'Photos from the team offsite', snippet:'Finally sorted the photos — the sunset hike ones are unreal. Link inside, plus a few outtakes.', body:'Finally sorted the photos from the offsite. The sunset hike ones are unreal. I put the full album in the shared folder, plus a few outtakes that should stay between us.', category:'Social', label:'Personal', date:'Nov 9', time:'7:18 PM', unread:true, attachment:true, folder:'inbox'},
  {id:'e15', sender:'Google Calendar', email:'calendar@google.com', initials:'GC', color:'#222222', subject:'Invitation: Aurora Launch Review @ Tue 10 AM', snippet:'Maya Chen invited you to Aurora Launch Review. 6 guests, one agenda doc, and a decision to make.', body:'You are invited to Aurora Launch Review on Tuesday at 10 AM. Maya Chen is organizing. There are 6 guests and one agenda doc. Please confirm if you can attend.', category:'Primary', label:'Work', date:'Nov 8', time:'1:45 PM', unread:false, attachment:false, folder:'inbox'},
  {id:'e16', sender:'Spotify', email:'news@spotify.com', initials:'Sp', color:'#333333', subject:'Your 2025 Wrapped preview is almost here', snippet:'Your top artists are taking shape. Listen a little more this week to lock in your list.', body:'Your Wrapped preview is almost here. Your top artists are taking shape. Listen a little more this week to lock in your year in music.', category:'Promotions', label:null, date:'Nov 8', time:'9:30 AM', unread:false, attachment:false, folder:'inbox'},
  {id:'e17', sender:'Me', email:'me@leadmaster.com', initials:'Me', color:'#111111', subject:'Sent: Aurora launch checklist — final', snippet:'Sending the final launch checklist to the team. Owners, dates, and the go / no-go call are inside.', body:'Team — sending the final launch checklist. Owners and dates are listed, and the go / no-go call is Thursday at 10 AM. Please confirm your items by Wednesday.', category:'Primary', label:'Work', date:'Nov 7', time:'4:10 PM', unread:false, attachment:true, folder:'sent'},
  {id:'e18', sender:'Me', email:'me@leadmaster.com', initials:'Me', color:'#111111', subject:'Draft: Thank-you note for the offsite', snippet:'Draft — thank everyone for the offsite, share the photo album, and propose the next one in spring.', body:'Draft — Thank you all for a wonderful offsite. The hike, the food, and the long conversations made it special. Photos are in the shared album. Let us plan the next one in spring.', category:'Primary', label:'Personal', date:'Nov 7', time:'10:05 AM', unread:false, attachment:false, folder:'drafts'},
  {id:'e19', sender:'Product Hunt', email:'digest@producthunt.com', initials:'PH', color:'#444444', subject:'Today: AI notes, a habit app, and a better inbox', snippet:'The top 5 launches today include a notes app that writes itself and a calmer way to triage email.', body:'Today on Product Hunt: AI notes, a habit app, and a better inbox lead the launches. The notes app that writes itself is getting the most discussion.', category:'Forums', label:null, date:'Nov 6', time:'8:00 AM', unread:true, attachment:false, folder:'inbox'},
  {id:'e20', sender:'Bank of America', email:'alerts@bankofamerica.com', initials:'BA', color:'#222222', subject:'Suspicious sign-in? Review this activity', snippet:'We noticed a new sign-in from a new device. If this was you, no action is needed.', body:'We noticed a new sign-in from a new device in Portland. If this was you, no action is needed. If not, review your recent activity and update your password.', category:'Updates', label:'Finance', date:'Nov 6', time:'6:22 AM', unread:true, attachment:false, folder:'inbox'},
  {id:'e21', sender:'Lena Fischer', email:'lena@brightlabs.io', initials:'LF', color:'#333333', subject:'Pricing for 40 seats + onboarding timeline', snippet:'We loved the trial. Can you confirm pricing for 40 seats and when onboarding can start?', body:'Hi Alex,\n\nWe loved the trial. Our team used the priority inbox every day and wants to roll it out wider.\n\nCan you confirm pricing for 40 seats and when onboarding can start? We are hoping to kick off next Monday.', category:'Primary', label:'Work', date:'Nov 14', time:'10:05 AM', unread:true, attachment:false, folder:'inbox', company:'Bright Labs', value:'$32,000 / yr'},
  {id:'e22', sender:'Marcus Webb', email:'marcus@harborretail.com', initials:'MW', color:'#111111', subject:'Follow-up: Q1 pilot for Harbor Retail', snippet:'Checking in on the pilot proposal. Our buying team meets Friday and wants numbers.', body:'Hi Alex,\n\nChecking in on the pilot proposal. Our buying team meets Friday and wants numbers for a 3-store pilot.\n\nCan you send the one-pager and pricing before then? Happy to take a call Thursday if that helps.', category:'Primary', label:'Work', date:'Nov 13', time:'3:40 PM', unread:true, attachment:false, folder:'inbox', company:'Harbor Retail', value:'$24,500 pilot'},
  {id:'e23', sender:'Weekly Newsletter', email:'newsletter@weekly.co', initials:'WN', color:'#222222', subject:'Weekly newsletter: product updates', snippet:'Your weekly newsletter — product updates, tips, and stories from the community.', body:'Your weekly newsletter with product updates and tips. This is a newsletter you can archive with Smart Cleanup.', category:'Promotions', label:null, date:'Nov 9', time:'8:00 AM', unread:true, attachment:false, folder:'inbox'},
  {id:'e24', sender:'Instagram', email:'notifications@instagram.com', initials:'Ig', color:'#222222', subject:'Maya Chen mentioned you in a comment', snippet:'Maya tagged you on the Aurora launch post. See the comment and reply from LeadMaster.', body:'Maya Chen mentioned you in a comment on the Aurora launch post. The thread has 8 replies and a question about pricing.', category:'Social', label:null, date:'Nov 13', time:'2:10 PM', unread:true, attachment:false, folder:'inbox'},
  {id:'e25', sender:'Hacker News', email:'digest@hackernews.com', initials:'HN', color:'#333333', subject:'Discussion: what makes an inbox feel calm?', snippet:'A long thread on triage, snooze, and why fewer badges help focus. 214 comments so far.', body:'A long thread on what makes an inbox feel calm. Triage, snooze, and fewer badges came up again and again. Jump in with your take on LeadMaster.', category:'Forums', label:null, date:'Nov 12', time:'8:40 AM', unread:true, attachment:false, folder:'inbox'},
  {id:'e26', sender:'Airbnb', email:'offers@airbnb.com', initials:'Ab', color:'#444444', subject:'Weekend stays near you — save 15%', snippet:'Cabins and city stays for the Dec 6 weekend. Free cancellation on most listings.', body:'Weekend stays near you for Dec 6. Cabins with saunas and city stays are 15% off this week, with free cancellation on most listings.', category:'Promotions', label:'Personal', date:'Nov 11', time:'9:20 AM', unread:true, attachment:false, folder:'inbox'},
  {id:'e27', sender:'Slack', email:'notify@slack.com', initials:'Sl', color:'#111111', subject:'3 mentions in #aurora-launch', snippet:'Maya, Daniel, and Lena mentioned you in #aurora-launch. Catch up on the thread.', body:'You have 3 mentions in #aurora-launch. Maya asked about copy, Daniel asked about pricing, and Lena asked about onboarding.', category:'Updates', label:'Work', date:'Nov 12', time:'4:05 PM', unread:true, attachment:false, folder:'inbox'},
  {id:'e28', sender:'X', email:'notify@x.com', initials:'X', color:'#222222', subject:'Your post got 24 replies', snippet:'People are replying to your post about inbox triage. See the top replies.', body:'Your post about inbox triage got 24 replies. The top replies ask about snooze, stars, and priority leads.', category:'Social', label:null, date:'Nov 10', time:'11:30 AM', unread:false, attachment:false, folder:'inbox'},
  {id:'e29', sender:'Designer Hangout', email:'digest@designerhangout.co', initials:'DH', color:'#555555', subject:'Forum: pricing freelance work — new replies', snippet:'The pricing thread has 18 new replies, including rate ranges for homepage copy.', body:'The pricing freelance work thread has 18 new replies, including rate ranges for homepage copy and a template for proposals.', category:'Forums', label:null, date:'Nov 9', time:'3:15 PM', unread:false, attachment:false, folder:'inbox'},
];
const TABS: {name:Category; icon:IconName; desc:string}[] = [
  {name:'Primary', icon:'inbox', desc:'Important mail first'},
  {name:'Promotions', icon:'templates', desc:'Deals and offers'},
  {name:'Social', icon:'contacts', desc:'People and updates'},
  {name:'Updates', icon:'alert', desc:'Receipts and alerts'},
  {name:'Forums', icon:'tasks', desc:'Groups and threads'},
];
const DEFAULT_TEMPLATES: Template[] = [
  {id:'t1', name:'Welcome', subject:'Welcome to LeadMaster — let’s get you started', body:'Hi {{first_name}},\n\nWelcome to LeadMaster! I’m excited to help you turn more conversations into customers.\n\nHere’s a quick way to start:\n1. Connect your inbox\n2. Star your top 5 leads\n3. Try the Assistant summary tomorrow morning\n\nWant a 15-minute walkthrough this week?\n\nBest,\nAlex', category:'Onboarding'},
  {id:'t2', name:'Follow-up', subject:'Following up — {{company}} + LeadMaster', body:'Hi {{first_name}},\n\nFollowing up on my last note — did you get a chance to review the proposal for {{company}}?\n\nI can hold your pilot slot through Friday if it helps. Just reply with a good time and I’ll send a calendar invite.\n\nBest,\nAlex', category:'Sales'},
  {id:'t3', name:'Meeting Invite', subject:'Invite: {{company}} × LeadMaster — 30 min', body:'Hi {{first_name}},\n\nI’d love to show you how LeadMaster can help {{company}} prioritize leads and follow up faster.\n\nAre you open to 30 minutes on Tuesday or Wednesday morning? I’ll bring a short demo tailored to your team.\n\nBest,\nAlex', category:'Sales'},
  {id:'t4', name:'Invoice Reminder', subject:'Friendly reminder: Invoice #{{invoice}} is due', body:'Hi {{first_name}},\n\nJust a friendly reminder that Invoice #{{invoice}} is due soon.\n\nIf you’ve already sent payment, thank you — please ignore this note. If not, you can reply here and I’ll resend the details.\n\nThanks so much,\nAlex', category:'Billing'},
  {id:'t5', name:'Thank You', subject:'Thank you, {{first_name}}', body:'Hi {{first_name}},\n\nThank you for your time today — I really enjoyed learning about {{company}} and what your team is building.\n\nI’ve attached the recap and next steps. I’ll check in Thursday unless you’d like to meet sooner.\n\nGrateful,\nAlex', category:'Thanks'},
  {id:'t6', name:'Lead Nurture', subject:'Checking in — {{company}} + LeadMaster', body:'Hi {{first_name}},\n\nChecking in on {{company}} — I wanted to share one quick idea from teams like yours that cut follow-up time in half.\n\nThey start with the priority inbox, star their top 5 leads, and let Assistant draft the first reply.\n\nWant me to send a 2-minute example for your team?\n\nBest,\nAlex', category:'Nurture'},
];
const DEFAULT_RULES: Rule[] = [
  {id:'r1', name:'Auto-label invoices', triggerType:'subject', contains:'invoice', action:'label', actionValue:'Finance', enabled:true},
  {id:'r2', name:'Auto-star from boss', triggerType:'sender', contains:'boss', action:'star', actionValue:'', enabled:true},
  {id:'r3', name:'Auto-archive newsletters', triggerType:'sender', contains:'newsletter', action:'archive', actionValue:'', enabled:false},
  {id:'r4', name:'Auto-move leads to folder', triggerType:'subject', contains:'lead', action:'move', actionValue:'Primary', enabled:true},
];
const DEFAULT_SCHEDULED: ScheduledItem[] = [
  {id:'s1', to:'priya@acmehealth.com', subject:'Proposal for Acme Health', body:'Hi Priya,\n\nAttached is the proposal we discussed. I included onboarding, pricing, and the January start date.\n\nHappy to walk through it live — just reply with a time.\n\nBest,\nAlex', when:'Tomorrow · 9:00 AM'},
  {id:'s2', to:'daniel@northwind.co', subject:'Enterprise pricing — 120 seats', body:'Hi Daniel,\n\nHere is enterprise pricing for 120 seats, including SSO and a 30-day pilot.\n\nI’ll hold the pilot slot through Friday.\n\nBest,\nAlex', when:'Friday · 8:30 AM'},
  {id:'s3', to:'lena@brightlabs.io', subject:'Onboarding timeline for 40 seats', body:'Hi Lena,\n\nGreat news — we can start onboarding next Monday. Here is the timeline and what we need from your team.\n\nBest,\nAlex', when:'Monday · 10:00 AM'},
];
const DEFAULT_OUTBOX: OutboxItem[] = [
  {id:'o1', to:'marcus@harborretail.com', subject:'Pilot one-pager for Harbor Retail', body:'Hi Marcus, attached is the one-pager and pricing for the 3-store pilot.', status:'Queued', attempt:'Attempt 1 · Waiting to send'},
  {id:'o2', to:'sara@fjordtravel.se', subject:'Re: Weekend in the mountains?', body:'That cabin sounds perfect — let’s hold Dec 6. I can book tomorrow.', status:'Sending', attempt:'Sending now…'},
  {id:'o3', to:'billing@brightlabs.io', subject:'Invoice #1042 — LeadMaster', body:'Hi team, attaching Invoice #1042. Please let me know if you need anything else.', status:'Failed', error:'Connection timed out — the message was not delivered.', attempt:'Attempt 3 · Failed at 9:12 AM'},
];
const SENDER_INFO: Record<string, {role:string; phone:string; location:string; labels:string; lastContacted:string; notes:string}> = {
  'priya@acmehealth.com': {role:'Operations Lead', phone:'(415) 555-0142', location:'San Francisco, CA', labels:'Work · Priority lead', lastContacted:'Nov 14 · Proposal requested', notes:'Wants proposal by Thursday. Budget approved for Q1. Prefers email over calls.'},
  'daniel@northwind.co': {role:'Sales Director', phone:'(206) 555-0187', location:'Seattle, WA', labels:'Work · Enterprise', lastContacted:'Nov 12 · 120 seats', notes:'Needs SSO + 30-day pilot. Decision before month end.'},
  'lena@brightlabs.io': {role:'Head of Operations', phone:'(512) 555-0119', location:'Austin, TX', labels:'Work · Trial', lastContacted:'Nov 14 · Onboarding', notes:'Loved the trial. Wants onboarding next Monday.'},
  'marcus@harborretail.com': {role:'Buying Manager', phone:'(312) 555-0163', location:'Chicago, IL', labels:'Work · Pilot', lastContacted:'Nov 13 · Pilot follow-up', notes:'Buying team meets Friday. Needs one-pager + pricing.'},
  'maya.chen@studio.co': {role:'Design Lead', phone:'(415) 555-0128', location:'San Francisco, CA', labels:'Work', lastContacted:'Nov 13 · Homepage copy', notes:'Owns Aurora homepage copy. Send deck links early.'},
  'sara@fjordtravel.se': {role:'Friend', phone:'(415) 555-0191', location:'Stockholm, SE', labels:'Personal', lastContacted:'Nov 11 · Cabin weekend', notes:'Found cabin for Dec 6. Prefers weekend trips.'},
};
const DEFAULT_CONTACTS: Contact[] = [
  {id:'c1', name:'Priya Sharma', email:'priya@acmehealth.com', company:'Acme Health', phone:'(415) 555-0142', role:'Operations Lead', location:'San Francisco, CA'},
  {id:'c2', name:'Daniel Okafor', email:'daniel@northwind.co', company:'Northwind', phone:'(206) 555-0187', role:'Sales Director', location:'Seattle, WA'},
  {id:'c3', name:'Lena Fischer', email:'lena@brightlabs.io', company:'Bright Labs', phone:'(512) 555-0119', role:'Head of Operations', location:'Austin, TX'},
  {id:'c4', name:'Marcus Webb', email:'marcus@harborretail.com', company:'Harbor Retail', phone:'(312) 555-0163', role:'Buying Manager', location:'Chicago, IL'},
  {id:'c5', name:'Maya Chen', email:'maya.chen@studio.co', company:'Studio Co', phone:'(415) 555-0128', role:'Design Lead', location:'San Francisco, CA'},
  {id:'c6', name:'Sara Lindqvist', email:'sara@fjordtravel.se', company:'Fjord Travel', phone:'(415) 555-0191', role:'Friend', location:'Stockholm, SE'},
];
const DEFAULT_REMINDERS: Reminder[] = [
  {id:'rem1', title:'Send Acme Health proposal', date:new Date().toISOString().slice(0,10), time:'09:00', done:false},
  {id:'rem2', title:'Follow up — Harbor Retail pilot', date:new Date(Date.now()+86400000).toISOString().slice(0,10), time:'10:30', done:false},
  {id:'rem3', title:'Review Aurora homepage copy', date:new Date(Date.now()+2*86400000).toISOString().slice(0,10), time:'14:00', done:false},
];
const DEFAULT_NOTES: NoteItem[] = [
  {id:'n1', title:'Priority leads this week', body:'1. Priya — proposal by Thursday\n2. Daniel — pricing + SSO pilot\n3. Lena — onboarding Monday\n4. Marcus — one-pager before Friday', pinned:true},
  {id:'n2', title:'Aurora launch notes', body:'Go / no-go Thursday 10 AM. Owners: Maya (copy), Alex (checklist), Eng (QA).', pinned:false},
  {id:'n3', title:'Follow-up ideas', body:'Ask Priya about January start. Offer Daniel a pilot walkthrough call.', pinned:false},
];
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
  {name:'Signature Block', html:'<p><strong>Alex Morgan</strong><br/>LeadMaster · Sales Lead<br/><a href="mailto:alex.morgan@leadmaster.com">alex.morgan@leadmaster.com</a></p>'},
  {name:'Callout Box', html:'<div style="border:1px solid #000;padding:12px;border-radius:8px"><strong>Callout</strong><p style="margin:6px 0 0">Add your callout text here.</p></div>'},
  {name:'Callout box', html:'<div style="border:1px solid #000;padding:12px;border-radius:8px"><strong>Callout</strong><p style="margin:6px 0 0">Add your callout text here.</p></div>'},
  {name:'Two-column table', html:'<table style="width:100%;border-collapse:collapse"><tr><td style="border:1px solid #000;padding:8px">Left</td><td style="border:1px solid #000;padding:8px">Right</td></tr></table>'},
  {name:'Button link', html:'<a href="https://example.com" style="display:inline-block;background:#000;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Open link</a>'},
  {name:'Signature block', html:'<p><strong>Alex Morgan</strong><br/>LeadMaster · Sales Lead<br/><a href="mailto:alex.morgan@leadmaster.com">alex.morgan@leadmaster.com</a></p>'},
];
const COMPOSE_SIGNATURES = [
  {name:'Alex Morgan — LeadMaster', value:'Best,\nAlex Morgan\nLeadMaster · Sales Lead\nalex.morgan@leadmaster.com'},
  {name:'Short — Thanks, Alex', value:'Thanks,\nAlex'},
  {name:'Formal', value:'Kind regards,\nAlex Morgan\nLeadMaster · Sales Lead\nalex.morgan@leadmaster.com'},
];
const CANNED_RESPONSES = [
  {name:'Quick thanks', body:'Hi,\n\nThanks so much for your message — I’ll follow up shortly.\n\nBest,\nAlex'},
  {name:'Following up', body:'Hi,\n\nJust following up on my last note — happy to help if you have questions.\n\nBest,\nAlex'},
  {name:'Book a call', body:'Hi,\n\nWould a 20-minute call on Tuesday or Wednesday morning work for you?\n\nBest,\nAlex'},
];
function sanitizeHtml(html:string){ return html.replace(/<script[\s\S]*?<\/script>/gi,''); }
function isValidRecipientChip(v:string){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function containsHtml(s:string){ return /<[a-z][\s\S]*>/i.test(s); }
function initialsFor(name:string){ return name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase() || '—'; }
const PERSONAL_MAIL_DOMAINS = new Set(['gmail.com','yahoo.com','icloud.com','outlook.com','hotmail.com','protonmail.com','aol.com','mail.com','gmx.com','zoho.com']);
function avatarKindForEmail(email:string){ const domain = (email||'').split('@')[1]?.toLowerCase().trim() || ''; return (PERSONAL_MAIL_DOMAINS.has(domain) || [...PERSONAL_MAIL_DOMAINS].some(d=>domain.endsWith('.'+d))) ? 'user' as const : 'building' as const; }
function avatarLabelForEmail(email:string){ return avatarKindForEmail(email)==='building' ? 'Organization' : 'Personal'; }
function AvatarIcon({email, size=18}:{email:string; size?:number}){ return <UniformIcon name={avatarKindForEmail(email)} size={size} />; }

async function api(action:string, args:any){
  const res = await fetch("/api/workspace/actions", {method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body: JSON.stringify({action, args})});
  const json = await res.json().catch(()=>({}));
  if(!res.ok || json.error) throw new Error(typeof json.error==='string'? json.error : (json.error?.message || `Request failed (${res.status})`));
  return json.data;
}
function uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }

export default function App(){
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [onlyAttachment, setOnlyAttachment] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>('Primary');
  const [view, setView] = useState<View>('inbox');
  const [previousView, setPreviousView] = useState<View>('inbox');
  const [starred, setStarred] = useState<Set<string>>(new Set(['e3','e7','e2']));
  const [readIds, setReadIds] = useState<Set<string>>(new Set(SAMPLE.filter(e=>!e.unread).map(e=>e.id)));
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [deletedForever, setDeletedForever] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [prefsId, setPrefsId] = useState<string|null>(null);
  const [userEmails, setUserEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openEmailId, setOpenEmailId] = useState<string|null>(null);
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
  const [rail, setRail] = useState<string|null>(null);
  const [tasksDone, setTasksDone] = useState<Set<string>>(new Set(['t2']));

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');
  const [viewLoading, setViewLoading] = useState(true);
  const [viewError, setViewError] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const showLoading = isLoading || busy;

  const [theme] = useState<'system'|'light'|'dark'>('light');
  const [profileName, setProfileName] = useState('Alex Morgan');
  const [profileEmail, setProfileEmail] = useState('alex.morgan@leadmaster.com');
  const [signature, setSignature] = useState('Best,\nAlex Morgan\nLeadMaster · Sales Lead\nalex.morgan@leadmaster.com');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(true);
  const [notifSound, setNotifSound] = useState(false);
  const [replyBehavior, setReplyBehavior] = useState<'reply'|'reply-all'>('reply');
  const [vacationOn, setVacationOn] = useState(false);
  const [vacationSubject, setVacationSubject] = useState('Out of office — back Monday');
  const [vacationBody, setVacationBody] = useState('Thanks for your message! I’m out of office and will reply when I’m back on Monday. For urgent leads, contact team@leadmaster.com.');

  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>(DEFAULT_SCHEDULED);
  const [outbox, setOutbox] = useState<OutboxItem[]>(DEFAULT_OUTBOX);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({name:'', triggerType:'sender' as 'sender'|'subject', contains:'', action:'label' as Rule['action'], actionValue:'Work'});
  const [showTemplateForm, setShowTemplateForm] = useState(false);
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
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [panelContactsOpen, setPanelContactsOpen] = useState(true);
  const [panelCalendarOpen, setPanelCalendarOpen] = useState(true);
  const [panelNotesOpen, setPanelNotesOpen] = useState(true);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({name:'', email:'', company:'', phone:'', role:'', location:''});
  const [contacts, setContacts] = useState<Contact[]>(DEFAULT_CONTACTS);
  const [reminders, setReminders] = useState<Reminder[]>(DEFAULT_REMINDERS);
  const [notes, setNotes] = useState<NoteItem[]>(DEFAULT_NOTES);
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

  useEffect(()=>{
    setViewLoading(true); setViewError(false);
    const t = setTimeout(()=>setViewLoading(false), 800);
    return ()=>clearTimeout(t);
  },[view]);
  function retryCurrentView(){
    setViewError(false); setViewLoading(true);
    setTimeout(()=>setViewLoading(false), 800);
  }
  function simulateError(){ setViewLoading(false); setViewError(true); }

  const allEmails = useMemo(()=> [...userEmails, ...SAMPLE].filter(e=>!deletedForever.has(e.id)), [userEmails, deletedForever]);
  useEffect(()=>{ document.documentElement.setAttribute('data-theme','light'); },[theme]);

  async function reloadRecords(){
    setIsLoading(true); setLoadError('');
    try{
      const [prefsData, msgsData, tplData, ruleData, schedData, contactsData, remindersData, notesData] = await Promise.all([
        api("records.list", {collection:'leadmaster_prefs'}),
        api("records.list", {collection:'leadmaster_messages'}),
        api("records.list", {collection:'leadmaster_templates'}),
        api("records.list", {collection:'leadmaster_rules'}),
        api("records.list", {collection:'leadmaster_scheduled'}),
        api("records.list", {collection:'leadmaster_contacts'}),
        api("records.list", {collection:'leadmaster_reminders'}),
        api("records.list", {collection:'leadmaster_notes'}),
      ]);
      const prefsRec = prefsData?.records?.[0];
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
      }
      const msgs = (msgsData?.records||[]).map((r:any)=>{ const v=r.value||{}; return {id:r.id, sender: v.kind==='sent'?'Me':(v.to||'Me'), email: v.kind==='sent'?'me@leadmaster.com':(v.to||''), initials:'Me', color:'#111111', subject:v.subject||'(no subject)', snippet:(v.body||'').slice(0,110)||'Draft — no body yet.', body:v.body||'', category:'Primary' as Category, label:null, date:'Today', time:'Now', unread: v.kind==='draft', attachment:false, folder: v.kind==='sent'?'sent':'drafts' as Folder, isUser:true} as Email; });
      setUserEmails(msgs);
      if((tplData?.records||[]).length){ setTemplates(tplData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id}))); }
      if((ruleData?.records||[]).length){ setRules(ruleData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id}))); }
      if((schedData?.records||[]).length){ setScheduled(schedData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id}))); }
      if((contactsData?.records||[]).length){ setContacts(contactsData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id}))); }
      if((remindersData?.records||[]).length){ setReminders(remindersData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id}))); }
      if((notesData?.records||[]).length){ setNotes(notesData.records.map((r:any)=>({...r.value, id:r.value?.id||r.id, recordId:r.id}))); }
    }catch(e){ const msg = e instanceof Error? e.message : String(e); setLoadError(`Couldn’t load saved LeadMaster data — ${msg}. Your sample inbox is still shown.`); }
    finally{ setIsLoading(false); }
  }
  useEffect(()=>{ reloadRecords(); },[]);
  async function handleRetry(){ await reloadRecords(); }

  async function savePrefs(next?:any){
    const value = {starred:[...(next?.starred||starred)], read:[...(next?.read||readIds)], archived:[...(next?.archived||archived)], deleted:[...(next?.deleted||deleted)], deletedForever:[...(next?.deletedForever||deletedForever)], snoozed:[...(next?.snoozed||snoozed)], theme:'light', density: next?.density||density, profileName: next?.profileName||profileName, profileEmail: next?.profileEmail||profileEmail, signature: next?.signature||signature, notifEmail: next?.notifEmail ?? notifEmail, notifDesktop: next?.notifDesktop ?? notifDesktop, notifSound: next?.notifSound ?? notifSound, replyBehavior: next?.replyBehavior||replyBehavior, vacationOn: next?.vacationOn ?? vacationOn, vacationSubject: next?.vacationSubject||vacationSubject, vacationBody: next?.vacationBody||vacationBody, componentOrder: next?.componentOrder||componentOrder, componentHidden: next?.componentHidden || [...hiddenComponents], senderNotes: next?.senderNotes||senderNotes};
    try{ if(prefsId) await api("records.replace", {collection:'leadmaster_prefs', id:prefsId, value}); else { const created = await api("records.create", {collection:'leadmaster_prefs', value, idempotency_key:'leadmaster-prefs-v1'}); if(created?.id) setPrefsId(created.id); } setActionError(''); }
    catch(e){ setActionError('Could not save that change — it is shown here but not stored yet.'); }
  }

  function toggleStar(id:string, e?:React.MouseEvent){ e?.stopPropagation(); const next = new Set(starred); next.has(id)? next.delete(id): next.add(id); setStarred(next); savePrefs({starred:next}); setStatus(next.has(id)?'Starred — priority lead saved':'Removed from starred'); }
  function markRead(id:string){ if(readIds.has(id)) return; const next=new Set(readIds); next.add(id); setReadIds(next); savePrefs({read:next}); }
  function doArchive(id:string){ const next=new Set(archived); next.add(id); setArchived(next); savePrefs({archived:next}); setStatus('Archived'); setOpenEmailId(null); }
  function doDelete(id:string){ const next=new Set(deleted); next.add(id); setDeleted(next); savePrefs({deleted:next}); setStatus('Moved to Deleted'); setOpenEmailId(null); }
  function doSnooze(id:string){ const next=new Set(snoozed); next.add(id); setSnoozed(next); savePrefs({snoozed:next}); setStatus('Snoozed until tomorrow morning'); }
  function restoreEmail(id:string){ const next=new Set(deleted); next.delete(id); setDeleted(next); savePrefs({deleted:next}); setStatus('Restored to Inbox'); }
  function deleteForever(id:string){ const nextDel=new Set(deleted); nextDel.delete(id); const nextForever=new Set(deletedForever); nextForever.add(id); setDeleted(nextDel); setDeletedForever(nextForever); savePrefs({deleted:nextDel, deletedForever:nextForever}); setStatus('Deleted forever'); }
  function emptyTrash(){ if(!confirmEmpty){ setConfirmEmpty(true); setStatus('Tap Empty Trash again to confirm — this cannot be undone.'); return; } const nextForever=new Set(deletedForever); deleted.forEach(id=>nextForever.add(id)); setDeletedForever(nextForever); setDeleted(new Set()); setConfirmEmpty(false); savePrefs({deleted:new Set(), deletedForever:nextForever}); setStatus('Trash emptied'); }

  const filtered = useMemo(()=>{
    let list = allEmails.filter(e=>!deleted.has(e.id));
    if(view==='inbox') list = list.filter(e=> e.folder==='inbox' && !archived.has(e.id) && !snoozed.has(e.id) && e.category===activeTab);
    else if(view==='sent') list = list.filter(e=> e.folder==='sent');
    else if(view==='deleted') list = list.filter(e=> deleted.has(e.id));
    else list = list.filter(()=>false);
    if(search.trim()){ const q=search.toLowerCase(); list = list.filter(e=> (e.sender+' '+e.subject+' '+e.snippet+' '+e.body+' '+e.email).toLowerCase().includes(q)); }
    if(onlyAttachment) list = list.filter(e=> e.attachment);
    return list;
  },[allEmails, view, activeTab, search, onlyAttachment, archived, deleted, snoozed]);

  const q = search.trim().toLowerCase();
  const filteredOutbox = useMemo(()=> outbox.filter(o=> !q || (o.subject+' '+o.to+' '+o.body).toLowerCase().includes(q)), [outbox, q]);
  const filteredTemplates = useMemo(()=> templates.filter(t=> !q || (t.name+' '+t.subject+' '+t.body+' '+t.category).toLowerCase().includes(q)), [templates, q]);
  const filteredRules = useMemo(()=> rules.filter(r=> !q || (r.name+' '+r.contains+' '+r.action).toLowerCase().includes(q)), [rules, q]);
  const filteredScheduled = useMemo(()=> scheduled.filter(s=> !q || (s.subject+' '+s.to+' '+s.body+' '+s.when).toLowerCase().includes(q)), [scheduled, q]);

  const counts = useMemo(()=>{
    const inbox = allEmails.filter(e=> e.folder==='inbox' && !archived.has(e.id) && !snoozed.has(e.id) && !deleted.has(e.id));
    return { inboxUnread: inbox.filter(e=> !readIds.has(e.id)).length, inboxTotal: inbox.length, sent: allEmails.filter(e=> e.folder==='sent' && !deleted.has(e.id)).length, deleted: deleted.size, outbox: outbox.length, scheduled: scheduled.length, tabUnread: (c:Category)=> inbox.filter(e=> e.category===c && !readIds.has(e.id)).length };
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
    setSenderNoteDraft(senderNotes[email] || SENDER_INFO[email]?.notes || '');
  }
  function senderInfoFor(email:string, name:string, company?:string){
    const c = contacts.find(x=>x.email.toLowerCase()===email.toLowerCase());
    const d = SENDER_INFO[email] || {role:c?.role||'Contact', phone:c?.phone||'—', location:c?.location||'—', labels:company||c?.company||'Contact', lastContacted:'—', notes:''};
    return {role:c?.role||d.role, phone:c?.phone||d.phone, location:c?.location||d.location, labels:d.labels, lastContacted:d.lastContacted, notes: senderNotes[email] || d.notes, company: c?.company || company || ''};
  }
  function addSenderToContacts(){
    if(!selectedSender) return;
    if(contacts.some(c=>c.email.toLowerCase()===selectedSender.email.toLowerCase())){ setStatus(`${selectedSender.name} is already in Contacts.`); return; }
    const info = senderInfoFor(selectedSender.email, selectedSender.name, selectedSender.company);
    const item: Contact = {id:uid(), name:selectedSender.name, email:selectedSender.email, company:info.company, phone:info.phone==='—'?'':info.phone, role:info.role, location:info.location==='—'?'':info.location};
    setContacts(prev=>[item, ...prev]); setStatus(`Added ${item.name} to Contacts.`);
    (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_contacts', value:item, idempotency_key:`leadmaster-contact-${item.id}`}); if(created?.id) setContacts(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError('Contact saved here, but could not store it yet.'); } })();
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
    const key = `leadmaster-msg-${uid()}`; const row = {kind, to:compose.to.trim()||'Me', subject:compose.subject.trim()||'(no subject)', body:compose.body, _key:key}; const rows=[row];
    setBusy(true); let saved=0; let error:string|null=null;
    try{ for(const r of rows){ await createRow(r); saved+=1; } }catch(e){ error = e instanceof Error? e.message : String(e); }
    let reloadError:string|null=null; try{ await reloadRecords(); }catch(e){ reloadError = e instanceof Error? e.message : String(e); }
    setBusy(false);
    if(error){ setStatus(`Saved ${saved} of ${rows.length} — ${error}. ${reloadError?`Reload also failed: ${reloadError}`:''} Your message is still in the compose window.`); setActionError(error); return; }
    setComposeOpen(false); setCompose({to:'',cc:'',bcc:'',subject:'',body:'',showCc:false}); setStatus(kind==='sent'? `Message sent — saved ${saved} of ${rows.length}. Find it in Sent.` : `Draft saved — saved ${saved} of ${rows.length}.`); if(kind==='sent') setView('sent'); setOpenEmailId(null);
  }
  function scheduleCompose(){ if(!compose.to.trim()){ setStatus('Add a recipient before scheduling.'); return; } const item: ScheduledItem = {id:uid(), to:compose.to, subject:compose.subject||'(no subject)', body:compose.body, when: scheduleWhen || schedulePick || 'Tomorrow · 9:00 AM'}; setScheduled(prev=>[item, ...prev]); setComposeOpen(false); setCompose({to:'',cc:'',bcc:'',subject:'',body:'',showCc:false}); setView('scheduled'); setStatus('Scheduled — find it in Scheduled.'); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_scheduled', value:item, idempotency_key:`leadmaster-sched-${item.id}`}); if(created?.id) setScheduled(prev=>prev.map(s=>s.id===item.id?{...s, recordId:created.id}:s)); }catch{ setActionError('Scheduled locally, but could not save it yet.'); } })(); }
  function toggleSelectAll(){ if(selected.size===filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(e=>e.id))); }
  function bulkArchive(){ const next=new Set(archived); selected.forEach(id=>next.add(id)); setArchived(next); savePrefs({archived:next}); setStatus(`${selected.size} archived`); setSelected(new Set()); }
  function bulkDelete(){ const next=new Set(deleted); selected.forEach(id=>next.add(id)); setDeleted(next); savePrefs({deleted:next}); setStatus(`${selected.size} moved to Deleted`); setSelected(new Set()); }

  function resendOutbox(id:string){ setOutbox(prev=>prev.map(o=>o.id===id?{...o, status:'Sending' as const, attempt:'Sending now…', error:undefined}:o)); setStatus('Resending…'); setTimeout(()=>{ setOutbox(prev=>prev.map(o=>o.id===id?{...o, status:'Queued' as const, attempt:'Queued · Will retry in 2 minutes'}:o)); setStatus('Queued again — it will send on the next attempt.'); }, 900); }
  function cancelOutbox(id:string){ setOutbox(prev=>prev.filter(o=>o.id!==id)); setStatus('Outbox message cancelled.'); }
  function sendAllNow(){ if(outbox.length===0){ setStatus('Outbox is already clear.'); return; } setOutbox(prev=>prev.map(o=>({...o, status:'Sending' as const, attempt:'Sending now…', error:undefined}))); setStatus('Sending all outbox messages…'); setTimeout(()=>{ setOutbox([]); setStatus('All outbox messages sent — Outbox is clear.'); }, 1000); }
  function sendNowScheduled(item:ScheduledItem){ setScheduled(prev=>prev.filter(s=>s.id!==item.id)); setStatus(`“${item.subject}” sent now — find it in Sent.`); if(item.recordId){ api("records.delete", {collection:'leadmaster_scheduled', id:item.recordId}).catch(()=>setActionError('Could not delete the scheduled record yet.')); } }
  function cancelScheduled(item:ScheduledItem){ setScheduled(prev=>prev.filter(s=>s.id!==item.id)); setStatus('Scheduled message cancelled.'); if(item.recordId){ api("records.delete", {collection:'leadmaster_scheduled', id:item.recordId}).catch(()=>setActionError('Could not delete the scheduled record yet.')); } }
  function openEditSchedule(item:ScheduledItem){ setScheduleForm({id:item.id, to:item.to, subject:item.subject, body:item.body, when:item.when}); setShowScheduleForm(true); setSchedulePicker({id:item.id, when:item.when, dateTime:''}); }
  function saveSchedulePicker(){ if(!schedulePicker) return; const label = schedulePicker.dateTime ? new Date(schedulePicker.dateTime).toLocaleString([], {weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : schedulePicker.when; setScheduled(prev=>prev.map(s=>s.id===schedulePicker.id?{...s, when:label}:s)); setScheduleForm(prev=>({...prev, when:label})); setSchedulePicker(null); setShowScheduleForm(false); setStatus(`Schedule updated — will send ${label}.`); }
  function saveScheduleForm(){ if(!scheduleForm.to.trim()){ setStatus('Add a recipient for the scheduled message.'); return; } if(scheduleForm.id){ setScheduled(prev=>prev.map(s=>s.id===scheduleForm.id?{...s, to:scheduleForm.to, subject:scheduleForm.subject, body:scheduleForm.body, when:scheduleForm.when}:s)); setStatus('Schedule updated.'); const existing = scheduled.find(s=>s.id===scheduleForm.id); if(existing?.recordId){ api("records.replace", {collection:'leadmaster_scheduled', id:existing.recordId, value:{...scheduleForm}}).catch(()=>setActionError('Could not save the schedule change yet.')); } } else { const item: ScheduledItem = {id:uid(), to:scheduleForm.to, subject:scheduleForm.subject, body:scheduleForm.body, when:scheduleForm.when}; setScheduled(prev=>[item, ...prev]); setStatus('Scheduled message created.'); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_scheduled', value:item, idempotency_key:`leadmaster-sched-${item.id}`}); if(created?.id) setScheduled(prev=>prev.map(s=>s.id===item.id?{...s, recordId:created.id}:s)); }catch{ setActionError('Scheduled locally, but could not save it yet.'); } })(); } setShowScheduleForm(false); setSchedulePicker(null); }

  function useTemplate(t:Template){ openCompose('template', undefined, t); }
  function openEditTemplate(t?:Template){ if(t) setTemplateForm({id:t.id, name:t.name, subject:t.subject, body:t.body, category:t.category}); else setTemplateForm({id:'', name:'', subject:'', body:'', category:'Sales'}); setShowTemplateForm(true); }
  function saveTemplateForm(){ if(!templateForm.name.trim() || !templateForm.subject.trim()){ setStatus('Give the template a name and subject.'); return; } if(templateForm.id){ setTemplates(prev=>prev.map(t=>t.id===templateForm.id?{...t, name:templateForm.name, subject:templateForm.subject, body:templateForm.body, category:templateForm.category}:t)); setStatus('Template updated.'); const ex = templates.find(t=>t.id===templateForm.id); if(ex?.recordId) api("records.replace", {collection:'leadmaster_templates', id:ex.recordId, value:{...templateForm}}).catch(()=>setActionError('Could not save the template change yet.')); } else { const item: Template = {id:uid(), name:templateForm.name, subject:templateForm.subject, body:templateForm.body, category:templateForm.category}; setTemplates(prev=>[item, ...prev]); setStatus('Template created.'); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_templates', value:item, idempotency_key:`leadmaster-tpl-${item.id}`}); if(created?.id) setTemplates(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError('Template saved locally, but could not store it yet.'); } })(); } setShowTemplateForm(false); }
  function duplicateTemplate(t:Template){ const copy: Template = {id:uid(), name:`${t.name} (copy)`, subject:t.subject, body:t.body, category:t.category}; setTemplates(prev=>[copy, ...prev]); setStatus(`Duplicated “${t.name}”.`); }
  function deleteTemplate(t:Template){ setTemplates(prev=>prev.filter(x=>x.id!==t.id)); setStatus(`Deleted template “${t.name}”.`); if(t.recordId) api("records.delete", {collection:'leadmaster_templates', id:t.recordId}).catch(()=>setActionError('Could not delete the template record yet.')); }

  function toggleRule(id:string){ const next = rules.map(r=>r.id===id?{...r, enabled:!r.enabled}:r); setRules(next); const changed = next.find(r=>r.id===id); setStatus(changed?.enabled?`Rule “${changed.name}” turned on.`:`Rule “${changed.name}” turned off.`); if(changed?.recordId) api("records.replace", {collection:'leadmaster_rules', id:changed.recordId, value:changed}).catch(()=>setActionError('Could not save the rule change yet.')); }
  function saveRuleForm(){ if(!ruleForm.name.trim() || !ruleForm.contains.trim()){ setStatus('Give the rule a name and a “contains” value.'); return; } const item: Rule = {id:uid(), name:ruleForm.name, triggerType:ruleForm.triggerType, contains:ruleForm.contains, action:ruleForm.action, actionValue:ruleForm.actionValue, enabled:true}; setRules(prev=>[item, ...prev]); setShowRuleForm(false); setRuleForm({name:'', triggerType:'sender', contains:'', action:'label', actionValue:'Work'}); setStatus('Automation rule added.'); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_rules', value:item, idempotency_key:`leadmaster-rule-${item.id}`}); if(created?.id) setRules(prev=>prev.map(r=>r.id===item.id?{...r, recordId:created.id}:r)); }catch{ setActionError('Rule saved locally, but could not store it yet.'); } })(); }
  function deleteRule(id:string){ const t = rules.find(r=>r.id===id); setRules(prev=>prev.filter(r=>r.id!==id)); setStatus('Rule deleted.'); if(t?.recordId) api("records.delete", {collection:'leadmaster_rules', id:t.recordId}).catch(()=>setActionError('Could not delete the rule record yet.')); }

  function runAssistant(kind:'summary'|'drafts'|'cleanup'|'priority'){
    setAssistantTab(kind); const inbox = allEmails.filter(e=> e.folder==='inbox' && !deleted.has(e.id) && !archived.has(e.id)); const unread = inbox.filter(e=>!readIds.has(e.id));
    if(kind==='summary'){ setAssistantResult(`Inbox summary · ${unread.length} unread of ${inbox.length} in Inbox.\n\n• Top priority: Priya Sharma (Acme Health) asked for a proposal by Thursday — $48,000/yr opportunity.\n• Daniel Okafor (Northwind) wants enterprise pricing for 120 seats.\n• Lena Fischer (Bright Labs) confirmed interest in 40 seats and onboarding next Monday.\n• Marcus Webb (Harbor Retail) is waiting on the pilot one-pager before Friday.\n\nSuggested next step: Send the Acme proposal first, then the Northwind pricing. Both are time-sensitive.`); }
    if(kind==='drafts'){ setAssistantResult('Draft replies ready — pick one and it will open in Compose.\n\n1) To Priya Sharma: “Thanks, Priya — proposal coming today. I’ll include onboarding and the January start.”\n2) To Daniel Okafor: “Thanks, Daniel — enterprise pricing for 120 seats + SSO pilot is on its way.”\n3) To Lena Fischer: “Great news, Lena — we can start onboarding Monday. Timeline attached.”'); }
    if(kind==='cleanup'){ setAssistantResult(`Smart cleanup found newsletters and old promos that can be archived or removed.\n\n• Archive newsletters — archive newsletter mail and keep starred / unread.\n• Delete old promos — move old read Promotions to Deleted.\n\nNothing is deleted forever unless you choose Delete old promos.`); }
    if(kind==='priority'){ setAssistantResult('Priority leads — ranked by value + urgency:\n\n1. Priya Sharma · Acme Health · $48,000/yr · Proposal due Thursday\n2. Daniel Okafor · Northwind · $96,000/yr · 120 seats, SSO + pilot\n3. Lena Fischer · Bright Labs · $32,000/yr · Onboarding Monday\n4. Marcus Webb · Harbor Retail · $24,500 pilot · Decision Friday\n\nAll four are in Primary. Star them to keep them at the top.'); }
  }
  function useAssistantDraft(index:number){
    const drafts = [
      {to:'priya@acmehealth.com', subject:'Re: Demo follow-up — Acme Health wants pricing', body:'Hi Priya,\n\nThanks again for the demo — I’m sending the proposal today. It includes pricing, onboarding, and the January start date you asked about.\n\nI’ll follow up Thursday if you need anything else.\n\nBest,\nAlex\n\n' + signature},
      {to:'daniel@northwind.co', subject:'Re: Interested in Enterprise — 120 seats', body:'Hi Daniel,\n\nThanks for reaching out — enterprise pricing for 120 seats, including SSO and a 30-day pilot, is on its way.\n\nI can hold the pilot slot through Friday. Want a quick call to walk through it?\n\nBest,\nAlex\n\n' + signature},
      {to:'lena@brightlabs.io', subject:'Re: Pricing for 40 seats + onboarding timeline', body:'Hi Lena,\n\nGreat news — we can start onboarding next Monday. I’ve attached the timeline and what we need from your team.\n\nLet me know if Monday still works.\n\nBest,\nAlex\n\n' + signature},
    ]; const d = drafts[index]||drafts[0]; setCompose({to:d.to, cc:'', bcc:'', subject:d.subject, body:d.body, showCc:false}); setComposeMode('new'); if(view!=='compose') setPreviousView(view); setOpenEmailId(null); setMobileSidebar(false); setView('compose');
  }
  function applyCleanup(){ const toArchive = allEmails.filter(e=> e.folder==='inbox' && e.category==='Promotions' && readIds.has(e.id) && !starred.has(e.id)).map(e=>e.id); const next = new Set(archived); toArchive.forEach(id=>next.add(id)); setArchived(next); savePrefs({archived:next}); setCleanupApplied(true); setAssistantResult(`Cleaned up ${toArchive.length} read Promotions messages. They are archived, not deleted.`); setStatus(`Cleaned up ${toArchive.length} messages.`); }
  function archiveNewsletters(){ const found = allEmails.filter(e=> e.folder==='inbox' && (e.sender.toLowerCase().includes('newsletter') || e.email.toLowerCase().includes('newsletter')) && !starred.has(e.id)); const next = new Set(archived); found.forEach(e=>next.add(e.id)); setArchived(next); savePrefs({archived:next}); setCleanupApplied(true); setAssistantResult(`Archived ${found.length} newsletter message(s). They are archived, not deleted.`); setStatus(`Archived ${found.length} newsletter(s).`); }
  function deleteOldPromos(){ const found = allEmails.filter(e=> e.folder==='inbox' && e.category==='Promotions' && readIds.has(e.id) && !starred.has(e.id)); const next = new Set(deleted); found.forEach(e=>next.add(e.id)); setDeleted(next); savePrefs({deleted:next}); setCleanupApplied(true); setAssistantResult(`Moved ${found.length} old read Promotions message(s) to Deleted. Restore them from Deleted if needed.`); setStatus(`Moved ${found.length} old promos to Deleted.`); }
  function saveSettings(){ savePrefs({}); setSettingsSaved(true); setStatus('Settings saved — profile, theme, and signature are stored.'); }

  // ——— Components Organizer (Settings only): reorder + persist ———
  function toggleComponent(k:View){ const n=new Set(expandedComponents); n.has(k)?n.delete(k):n.add(k); setExpandedComponents(n); }
  function reorderComponents(from:View, to:View){ if(from===to) return; const arr=[...componentOrder]; const fi=arr.indexOf(from); const ti=arr.indexOf(to); if(fi<0||ti<0) return; arr.splice(fi,1); arr.splice(ti,0,from); setComponentOrder(arr); setOrganizerSaved(false); setStatus(`Components reordered — ${componentLabel(from)} moved. Press Save organizer to save.`); }
  function resetComponentOrder(){ setComponentOrder(DEFAULT_COMPONENT_ORDER); setHiddenComponents(new Set()); setOrganizerSaved(false); setStatus('Component order reset — press Save organizer to save.'); }
  function toggleComponentVisibility(k:View){ const n=new Set(hiddenComponents); n.has(k)?n.delete(k):n.add(k); setHiddenComponents(n); setOrganizerSaved(false); setStatus(n.has(k)?`${componentLabel(k)} hidden from the sidebar — press Save organizer to save.`:`${componentLabel(k)} shown in the sidebar — press Save organizer to save.`); }
  function saveComponentOrder(){ savePrefs({componentOrder, componentHidden:[...hiddenComponents]}); setOrganizerSaved(true); setStatus('Components organizer saved — sidebar order updated.'); }
  function componentSummary(k:View):string{
    if(k==='inbox') return `${counts.inboxUnread} unread · ${counts.inboxTotal} in Inbox · Primary, Promotions, Social, Updates, Forums`;
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
  const filteredContacts = useMemo(()=> contacts.filter(c=> !contactSearch.trim() || (c.name+' '+c.email+' '+c.company).toLowerCase().includes(contactSearch.toLowerCase())), [contacts, contactSearch]);
  const sortedNotes = useMemo(()=> [...notes].sort((a,b)=> Number(b.pinned)-Number(a.pinned)), [notes]);
  const remindersForDay = useMemo(()=> reminders.filter(r=>r.date===selectedDay), [reminders, selectedDay]);
  const calendarCells = useMemo(()=>{ const y=calendarDate.getFullYear(); const m=calendarDate.getMonth(); const first=new Date(y,m,1); const startDay=first.getDay(); const days=new Date(y,m+1,0).getDate(); const cells:(number|null)[]=[]; for(let i=0;i<startDay;i++) cells.push(null); for(let d=1;d<=days;d++) cells.push(d); return cells; },[calendarDate]);
  function dateStrForDay(d:number){ const y=calendarDate.getFullYear(); const m=String(calendarDate.getMonth()+1).padStart(2,'0'); return `${y}-${m}-${String(d).padStart(2,'0')}`; }
  function saveContactForm(){ if(!contactForm.name.trim()||!contactForm.email.trim()){ setStatus('Add a name and email for the contact.'); return; } const item: Contact = {id:uid(), name:contactForm.name, email:contactForm.email, company:contactForm.company, phone:contactForm.phone, role:contactForm.role||'Contact', location:contactForm.location}; setContacts(prev=>[item, ...prev]); setShowContactForm(false); setContactForm({name:'', email:'', company:'', phone:'', role:'', location:''}); setStatus(`Added ${item.name} to Contacts.`); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_contacts', value:item, idempotency_key:`leadmaster-contact-${item.id}`}); if(created?.id) setContacts(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError('Contact saved here, but could not store it yet.'); } })(); }
  function deleteContact(c:Contact){ setContacts(prev=>prev.filter(x=>x.id!==c.id)); setStatus(`Deleted ${c.name}.`); if(c.recordId) api("records.delete", {collection:'leadmaster_contacts', id:c.recordId}).catch(()=>setActionError('Could not delete the contact record yet.')); }
  function saveReminderForm(){ if(!reminderForm.title.trim()){ setStatus('Add a title for the reminder.'); return; } const item: Reminder = {id:uid(), title:reminderForm.title, date:reminderForm.date, time:reminderForm.time, done:false}; setReminders(prev=>[item, ...prev]); setShowReminderForm(false); setReminderForm({title:'', date:selectedDay, time:'09:00'}); setStatus(`Reminder added for ${item.date} · ${item.time}.`); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_reminders', value:item, idempotency_key:`leadmaster-reminder-${item.id}`}); if(created?.id) setReminders(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError('Reminder saved here, but could not store it yet.'); } })(); }
  function toggleReminder(r:Reminder){ const next={...r, done:!r.done}; setReminders(prev=>prev.map(x=>x.id===r.id?next:x)); if(r.recordId) api("records.replace", {collection:'leadmaster_reminders', id:r.recordId, value:next}).catch(()=>setActionError('Could not save the reminder change yet.')); }
  function deleteReminder(r:Reminder){ setReminders(prev=>prev.filter(x=>x.id!==r.id)); setStatus('Reminder deleted.'); if(r.recordId) api("records.delete", {collection:'leadmaster_reminders', id:r.recordId}).catch(()=>setActionError('Could not delete the reminder record yet.')); }
  function saveNoteForm(){ if(!noteForm.title.trim()){ setStatus('Give the note a title.'); return; } if(noteForm.id){ const next={title:noteForm.title, body:noteForm.body, pinned:noteForm.pinned}; setNotes(prev=>prev.map(x=>x.id===noteForm.id?{...x, ...next}:x)); const ex=notes.find(x=>x.id===noteForm.id); if(ex?.recordId) api("records.replace", {collection:'leadmaster_notes', id:ex.recordId, value:{...ex, ...next}}).catch(()=>setActionError('Could not save the note change yet.')); setStatus('Note updated.'); } else { const item: NoteItem = {id:uid(), title:noteForm.title, body:noteForm.body, pinned:noteForm.pinned}; setNotes(prev=>[item, ...prev]); setStatus('Note added.'); (async()=>{ try{ const created = await api("records.create", {collection:'leadmaster_notes', value:item, idempotency_key:`leadmaster-note-${item.id}`}); if(created?.id) setNotes(prev=>prev.map(x=>x.id===item.id?{...x, recordId:created.id}:x)); }catch{ setActionError('Note saved here, but could not store it yet.'); } })(); } setShowNoteForm(false); setNoteForm({id:'', title:'', body:'', pinned:false}); }
  function togglePinNote(n:NoteItem){ const next={...n, pinned:!n.pinned}; setNotes(prev=>prev.map(x=>x.id===n.id?next:x)); if(n.recordId) api("records.replace", {collection:'leadmaster_notes', id:n.recordId, value:next}).catch(()=>setActionError('Could not save the note change yet.')); }
  function deleteNote(n:NoteItem){ setNotes(prev=>prev.filter(x=>x.id!==n.id)); setStatus('Note deleted.'); if(n.recordId) api("records.delete", {collection:'leadmaster_notes', id:n.recordId}).catch(()=>setActionError('Could not delete the note record yet.')); }
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

  const viewTitle = view==='compose'?'Compose': view==='inbox'? activeTab : view==='sent'?'Sent': view==='outbox'?'Outbox': view==='deleted'?'Deleted': view==='assistant'?'Assistant': view==='automation'?'Automation': view==='templates'?'Templates': view==='scheduled'?'Scheduled':'Settings';
  const goView = (v:View)=>{ if(v==='compose'){ openComposeTab(); return; } if(view==='compose') setPreviousView(view); setView(v); setOpenEmailId(null); setSelected(new Set()); setMobileSidebar(false); setConfirmEmpty(false); setViewError(false); };
  const badgeFor = (k:View)=> k==='inbox'?counts.inboxUnread : k==='outbox'?counts.outbox : k==='deleted'?counts.deleted : k==='scheduled'?counts.scheduled : 0;
  const NAV: {k:View; label:string; icon:IconName; badge:number}[] = [
    ...componentOrder.filter(k=>k!=='settings' && !hiddenComponents.has(k)).map(k=>({k, label:componentLabel(k), icon:componentIcon(k), badge:badgeFor(k)})),
    {k:'settings', label:'Settings', icon:'settings', badge:0},
  ];

  const stateBar = (
    <div className="mx-1 sm:mx-2 mt-2 space-y-2">
      {showLoading && <div role="status" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><Spinner/><span className="text-[13px] font-medium">{busy?'Saving…':'Loading LeadMaster…'}</span><span className="text-[12px] text-[var(--text-3)]">Please wait</span></div>}
      {(loadError || actionError) && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-[var(--text)] bg-[var(--surface)] px-3 py-2.5"><UniformIcon name="alert" size={18}/><span className="flex-1 min-w-[180px] text-[13px] font-medium">{loadError || actionError}</span>{loadError && <button onClick={handleRetry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]"><UniformIcon name="refresh" size={15}/> Retry</button>}<button onClick={()=>{setLoadError(''); setActionError('');}} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[13px]">Dismiss</button></div>}
      {status && !showLoading && <div className="flex flex-wrap items-center gap-2"><span className="bg-[var(--text)] text-[var(--surface)] text-[13px] px-3 py-2 rounded-lg">{status}</span><button onClick={()=>setStatus('')} className="text-[13px] underline underline-offset-2">Dismiss</button></div>}
      {settingsSaved && view==='settings' && <div className="flex items-center gap-2 bg-[var(--text)] text-[var(--surface)] text-[13px] px-3 py-2 rounded-lg"><UniformIcon name="check" size={16}/> Settings saved.<button onClick={()=>setSettingsSaved(false)} className="underline underline-offset-2 ml-1">Dismiss</button></div>}
    </div>
  );

  const LoadingState = (
    <div className="mx-1 sm:mx-2 mt-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-8" role="status" aria-label="Loading">
      <div className="flex flex-col items-center text-center py-4"><Spinner size={28}/><p className="mt-3 text-[15px] font-medium">Loading...</p><p className="text-[13px] text-[var(--text-3)] mt-1">Loading {viewTitle} — please wait.</p></div>
      <div className="space-y-3 mt-4" aria-hidden="true">{[0,1,2,3,4].map(i=>(
        <div key={i} className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[var(--surface-3)] lm-shimmer shrink-0"/><div className="flex-1 space-y-2"><div className="h-3 rounded-full bg-[var(--surface-3)] lm-shimmer w-[38%]"/><div className="h-3 rounded-full bg-[var(--surface-3)] lm-shimmer w-[72%]"/></div><div className="h-3 w-12 rounded-full bg-[var(--surface-3)] lm-shimmer shrink-0"/></div>
      ))}</div>
    </div>
  );
  const ErrorState = (
    <div className="mx-1 sm:mx-2 mt-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 sm:p-10 text-center" role="alert">
      <div className="mx-auto w-14 h-14 rounded-full border-2 border-[var(--text)] grid place-items-center"><UniformIcon name="alert" size={28}/></div>
      <h2 className="text-[20px] font-medium mt-4">Something went wrong</h2>
      <p className="text-[14px] text-[var(--text-3)] mt-1 max-w-[420px] mx-auto">We couldn&apos;t load this view. Please try again.</p>
      <div className="flex flex-wrap justify-center gap-2 mt-5"><button onClick={retryCurrentView} className="px-6 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] font-medium">Retry</button><button onClick={()=>goView('inbox')} className="px-6 py-2.5 rounded-full border border-[var(--text)] bg-[var(--surface)] text-[14px]">Go to Inbox</button></div>
    </div>
  );

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="pt-2" />
      <nav className="px-0 text-[14px] overflow-y-auto" aria-label="LeadMaster navigation">
        {NAV.map(item=>(
          <button key={item.k} disabled={viewLoading && view!==item.k} onClick={()=>goView(item.k)} className={`w-full flex items-center gap-3 pl-6 pr-3 py-[9px] rounded-r-full text-left ${view===item.k?'bg-[var(--text)] text-[var(--surface)] font-medium':'hover:bg-[var(--surface-2)] text-[var(--text-2)]'}`}>
            <UniformIcon name={item.icon} size={20}/><span className="flex-1 truncate">{item.label}</span>{item.badge>0 && <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${view===item.k?'bg-[var(--surface)] text-[var(--text)]':'bg-[var(--text)] text-[var(--surface)]'}`}>{item.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="mt-auto p-4 text-[12px] text-[var(--text-3)] leading-relaxed hidden lg:block"><p className="font-medium text-[var(--text-2)]">LeadMaster</p><p>Turn conversations into customers.</p><p className="mt-2">{counts.inboxUnread} unread · {counts.scheduled} scheduled</p></div>
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

  const senderButton = (email:Email) => (
    <>
      <button onClick={(e)=>{e.stopPropagation(); openSender(email.sender, email.email, email.company);}} className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center text-[13px] font-medium shrink-0 hidden sm:grid" aria-label={`Open profile for ${email.sender}`} title={email.sender}><AvatarIcon email={email.email} size={18} /></button>
      <button onClick={(e)=>{e.stopPropagation(); openSender(email.sender, email.email, email.company);}} className={`text-left shrink-0 break-words text-[14px] underline-offset-2 hover:underline ${!readIds.has(email.id)?'font-bold':'font-normal'}`} aria-label={`Open profile for ${email.sender}`}>{email.sender}{email.company?` · ${email.company}`:''}</button>
    </>
  );

  const mailList = (
    <div className="bg-[var(--surface)] rounded-2xl overflow-hidden gmail-shadow mx-1 sm:mx-2">
      {filtered.length===0 ? <div className="p-10 sm:p-16 text-center"><UniformIcon name="inbox" size={40} className="mx-auto text-[var(--text-3)]"/><h2 className="text-[18px] mt-3">Nothing in {viewTitle}</h2><p className="text-[14px] text-[var(--text-3)] mt-1 max-w-[420px] mx-auto">{view==='deleted'?'Deleted is empty. Restored mail returns to Inbox.': search? `No results for “${search}”. Try a different sender, subject, or lead.` : 'You are all caught up.'}</p><button onClick={()=>{setSearch(''); setOnlyAttachment(false); goView('inbox');}} className="mt-4 px-5 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px]">Back to Inbox</button></div> : filtered.map(email=>{
        const isUnread = !readIds.has(email.id); const isSel = selected.has(email.id); const rowPad = density==='compact'?'py-1.5':'py-2.5';
        return <div key={email.id} className={`group relative flex items-center gap-1 sm:gap-2 px-2 sm:px-3 border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-[var(--surface-2)] ${isSel?'bg-[var(--surface-2)]':''} ${previewEmailId===email.id?'bg-[var(--surface-2)]':''} ${rowPad}`} onClick={()=>{ if(previewMode){ setPreviewEmailId(email.id); markRead(email.id); } else { setOpenEmailId(email.id); markRead(email.id); } }} onDoubleClick={()=>{ setOpenEmailId(email.id); markRead(email.id); }} title="Click to preview or open · Double-click to open full detail">
          <input type="checkbox" checked={isSel} onChange={e=>{e.stopPropagation(); const n=new Set(selected); n.has(email.id)?n.delete(email.id):n.add(email.id); setSelected(n);}} onClick={e=>e.stopPropagation()} className="accent-black w-4 h-4 shrink-0" aria-label={`Select ${email.subject}`}/>
          <button onClick={e=>toggleStar(email.id,e)} className="p-1 shrink-0" aria-label="Star">{starred.has(email.id)?<span className="text-[18px] leading-none">★</span>:<UniformIcon name="star" size={18}/>}</button>
          <span className="hidden sm:flex items-center gap-2 shrink-0">{senderButton(email)}</span>
          <span className="sm:hidden min-w-0"><button onClick={(e)=>{e.stopPropagation(); openSender(email.sender, email.email, email.company);}} className="text-[14px] font-medium underline-offset-2 hover:underline text-left">{email.sender}</button></span>
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3"><span className="min-w-0 flex-1 flex items-center gap-2"><span className="break-words text-[14px] leading-snug"><span className={isUnread?'font-bold':''}>{email.subject}</span><span className="text-[var(--text-3)] font-normal"> — {email.snippet}</span></span>{email.value && <span className="hidden md:inline-flex shrink-0 text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] font-medium">{email.value}</span>}{email.label && <span className="hidden md:inline-flex shrink-0 text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)]">{email.label}</span>}{email.attachment && <UniformIcon name="paperclip" size={15}/>}</span></div>
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
      <div className="p-4 sm:p-5"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center font-medium shrink-0"><AvatarIcon email={previewEmail.email} size={20} /></span><div className="min-w-0"><button onClick={()=>openSender(previewEmail.sender, previewEmail.email, previewEmail.company)} className="font-medium hover:underline text-left">{previewEmail.sender}</button><p className="text-[12px] text-[var(--text-3)] truncate">&lt;{previewEmail.email}&gt; · {previewEmail.date} · {previewEmail.time} · {previewEmail.category}{previewEmail.label?` · ${previewEmail.label}`:''}</p></div></div><h3 className="text-[18px] font-medium leading-snug mt-3">{previewEmail.subject}</h3>{previewEmail.company && <p className="mt-1 text-[12px]"><span className="px-2 py-0.5 rounded-full border border-[var(--border)]">{previewEmail.company}</span>{previewEmail.value && <span className="ml-1 px-2 py-0.5 rounded-full border border-[var(--border)]">{previewEmail.value}</span>}</p>}{detailPreviewMode==='html' && containsHtml(previewEmail.body) ? <div className="mt-3 text-[14px] leading-relaxed border border-[var(--border)] rounded-xl p-3 bg-[var(--background)]" dangerouslySetInnerHTML={{__html: sanitizeHtml(previewEmail.body)}} /> : <p className="whitespace-pre-line text-[14px] leading-relaxed mt-3">{previewEmail.body.slice(0,1200)}{previewEmail.body.length>1200?'…':''}</p>}{previewEmail.attachment && <p className="flex items-center gap-2 text-[13px] mt-3"><UniformIcon name="paperclip" size={15}/> attachment.pdf · 248 KB · Preview only</p>}<div className="flex flex-wrap gap-2 mt-4"><button onClick={()=>openCompose('reply', previewEmail)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="reply" size={14}/> Reply</button><button onClick={()=>openCompose('forward', previewEmail)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="forward" size={14}/> Forward</button><button onClick={()=>doArchive(previewEmail.id)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="archive" size={14}/> Archive</button><button onClick={()=>doDelete(previewEmail.id)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="trash" size={14}/> Delete</button><button onClick={()=>doSnooze(previewEmail.id)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1"><UniformIcon name="clock" size={14}/> Snooze</button><button onClick={()=>openComposeTab(previewEmail.email)} className="px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Compose to sender</button></div></div>
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
            {composeDiscardConfirm ? <span className="flex items-center gap-2 ml-auto"><span className="text-[13px] font-medium">Discard this draft?</span><button onClick={discardComposeConfirmed} className="px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Discard draft</button><button onClick={()=>setComposeDiscardConfirm(false)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px]">Keep editing</button></span> : <button onClick={()=>setComposeDiscardConfirm(true)} className="ml-auto px-5 py-3 rounded-full hover:bg-[var(--surface-2)] text-[14px]">Discard</button>}
          </div>
          <p className="text-[12px] text-[var(--text-3)] mt-3">Sending saves a copy in Sent. Attachments: attach files / insert photo — file uploads are not available yet.</p>
        </div>
      </section>
    </div>
  );

  const mainContent = (
    <>
      {view==='compose' && composeTab}
      {view==='inbox' && !openEmail && (
        <div className="flex gap-0 sm:gap-1 overflow-x-auto px-1 mt-1 border-b border-[var(--border)]">
          {TABS.map(t=>{ const active = activeTab===t.name; const unread = counts.tabUnread(t.name); const preview = allEmails.find(e=> e.category===t.name && e.folder==='inbox'); return <button key={t.name} disabled={viewLoading} onClick={()=>setActiveTab(t.name)} className={`flex-1 min-w-[118px] sm:min-w-[150px] text-left px-2 sm:px-3 py-2.5 sm:py-3 ${active?'tab-active':''} disabled:opacity-50`} aria-label={`${t.name} tab`}><span className="flex items-center gap-2 text-[14px] font-medium"><UniformIcon name={t.icon} size={19}/><span className="truncate">{t.name}</span>{unread>0 && <span className="ml-auto text-[11px] font-bold bg-[var(--text)] text-[var(--surface)] rounded-full px-2 py-0.5 shrink-0">{unread} new</span>}</span><span className="hidden sm:block text-[12px] text-[var(--text-3)] break-words mt-0.5 leading-snug">{preview? `${preview.sender} — ${preview.subject}` : t.desc}</span></button>; })}
        </div>
      )}
      {(view==='inbox'||view==='sent'||view==='deleted') && !openEmail && (
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-[48px] text-[var(--text-3)]">
          <label className="flex items-center gap-1 p-1"><input type="checkbox" disabled={viewLoading} checked={filtered.length>0 && selected.size===filtered.length} onChange={toggleSelectAll} className="accent-black w-4 h-4" aria-label="Select all"/><UniformIcon name="chevron-down" size={16}/></label>
          <button disabled={viewLoading} onClick={async()=>{ setStatus('Refreshing…'); retryCurrentView(); await reloadRecords(); if(!loadError) setStatus('LeadMaster refreshed'); }} className="p-2 rounded-full hover:bg-[var(--surface-3)] disabled:opacity-50" aria-label="Refresh">{isLoading? <Spinner/> : <UniformIcon name="refresh" size={18}/>}</button>
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
            <div className="flex items-start gap-3 mt-5"><button onClick={()=>openSender(openEmail.sender, openEmail.email, openEmail.company)} className="w-10 h-10 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center font-medium shrink-0" aria-label={`Open profile for ${openEmail.sender}`}><AvatarIcon email={openEmail.email} size={20} /></button><div className="min-w-0"><button onClick={()=>openSender(openEmail.sender, openEmail.email, openEmail.company)} className="font-medium hover:underline underline-offset-2 text-left">{openEmail.sender} <span className="text-[13px] text-[var(--text-3)] font-normal">&lt;{openEmail.email}&gt;</span></button><p className="text-[13px] text-[var(--text-3)]">to me · {openEmail.category}{openEmail.label?` · ${openEmail.label}`:''}</p></div></div>
            <div className="flex flex-wrap items-center gap-2 mt-5"><span className="text-[12px] font-medium">Message preview:</span><button onClick={()=>setDetailPreviewMode('text')} className={`px-3 py-1.5 rounded-full text-[12px] ${detailPreviewMode==='text'?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`}>Text</button><button onClick={()=>setDetailPreviewMode('html')} className={`px-3 py-1.5 rounded-full text-[12px] ${detailPreviewMode==='html'?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`}>HTML</button><span className="text-[12px] text-[var(--text-3)]">{detailPreviewMode==='html' ? 'HTML is rendered safely — scripts are removed.' : 'Plain-text view'}</span></div>
            {detailPreviewMode==='html' && containsHtml(openEmail.body) ? <div className="mt-4 border border-[var(--border)] rounded-xl p-4 bg-[var(--background)] text-[15px] leading-relaxed" dangerouslySetInnerHTML={{__html: sanitizeHtml(openEmail.body)}} /> : <p className="whitespace-pre-line leading-[1.7] text-[15px] mt-6">{openEmail.body}</p>}
            {openEmail.attachment && <div className="mt-6 flex items-center gap-3 border border-[var(--border)] rounded-xl p-3 max-w-[340px]"><UniformIcon name="paperclip" size={18}/><div><p className="text-[14px] font-medium">attachment.pdf</p><p className="text-[12px] text-[var(--text-3)]">248 KB · Preview only in LeadMaster</p></div><button onClick={()=>setStatus('Attachment preview is a demo — file downloads are not available yet.')} className="ml-auto text-[14px] underline underline-offset-2">View</button></div>}
            <div className="flex flex-wrap gap-2 mt-8"><button onClick={()=>openCompose('reply', openEmail)} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] hover:bg-[var(--surface-2)]"><UniformIcon name="reply" size={17}/> Reply</button><button onClick={()=>openCompose('forward', openEmail)} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] hover:bg-[var(--surface-2)]"><UniformIcon name="forward" size={17}/> Forward</button>{openEmail.folder==='drafts' && <button onClick={()=>openCompose('draft', openEmail)} className="px-5 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)]">Continue draft</button>}</div>
          </div>
        </article>
      ) : (view==='inbox'||view==='sent'||view==='deleted') ? (previewMode && previewLayout==='vertical' && previewEmail ? <div className="flex flex-col lg:flex-row gap-3 mx-1 sm:mx-2 items-start"><div className="flex-1 min-w-0 w-full">{mailList}</div><div className="flex-1 min-w-0 w-full lg:max-w-[440px] lg:sticky lg:top-[132px]">{previewPanel}</div></div> : <>{mailList}{previewPanel}</>) : null}

      {view==='outbox' && (
        <div className="mx-1 sm:mx-2">
          <div className="flex flex-wrap items-center gap-2 mb-3"><h2 className="text-[20px] font-medium">Outbox</h2><span className="text-[13px] text-[var(--text-3)]">{filteredOutbox.length} waiting · Queued, Sending, and Failed in one place.</span><button disabled={viewLoading || outbox.length===0} onClick={sendAllNow} className="ml-auto flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] disabled:opacity-50"><UniformIcon name="send" size={16}/> Send All Now</button><button disabled={viewLoading} onClick={()=>retryCurrentView()} className="px-4 py-2.5 rounded-full border border-[var(--border)] text-[14px] flex items-center gap-1.5 disabled:opacity-50"><UniformIcon name="refresh" size={16}/> Refresh</button></div>
          <div className="bg-[var(--surface)] rounded-2xl gmail-shadow overflow-hidden border border-[var(--border)]">
            {filteredOutbox.length===0 ? <div className="p-10 text-center"><UniformIcon name="sent" size={36} className="mx-auto text-[var(--text-3)]"/><p className="mt-3 font-medium">Outbox is clear</p><p className="text-[13px] text-[var(--text-3)] mt-1">Everything you sent has left the Outbox.</p></div> : filteredOutbox.map(o=>(
              <div key={o.id} className="p-4 sm:p-5 border-b border-[var(--border)] last:border-0 flex flex-col sm:flex-row gap-3"><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium truncate">{o.subject}</p><span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] font-bold">{o.status}</span></div><p className="text-[13px] text-[var(--text-3)] mt-1"><span className="inline-grid w-6 h-6 rounded-full bg-[var(--text)] text-[var(--surface)] place-items-center align-middle mr-1.5"><AvatarIcon email={o.to} size={14} /></span>To <button onClick={()=>openSender(o.to.split('@')[0].replace(/[._]/g,' '), o.to)} className="underline underline-offset-2 font-medium text-[var(--text)]">{o.to}</button> · {o.attempt}</p><p className="text-[14px] mt-2 line-clamp-2">{o.body}</p>{o.error && <p className="flex gap-1.5 items-start text-[13px] mt-2"><UniformIcon name="alert" size={16}/>{o.error}</p>}</div><div className="flex sm:flex-col gap-2 shrink-0"><button disabled={viewLoading} onClick={()=>resendOutbox(o.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-50"><UniformIcon name="restore" size={15}/> Resend</button><button disabled={viewLoading} onClick={()=>cancelOutbox(o.id)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] disabled:opacity-50">Cancel</button></div></div>
            ))}
          </div>
          <div className="mt-3 bg-[var(--surface)] rounded-2xl p-4 gmail-shadow flex gap-3 border border-[var(--border)]"><UniformIcon name="alert" size={18}/><p className="text-[13px] text-[var(--text-3)] leading-relaxed"><span className="font-medium text-[var(--text)]">Failed messages stay here</span> until you resend or cancel them. Queued messages send automatically when LeadMaster reconnects.</p></div>
        </div>
      )}

      {view==='assistant' && (
        <div className="mx-1 sm:mx-2">
          <div className="bg-[var(--text)] text-[var(--surface)] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center"><div className="flex-1"><div className="flex items-center gap-3"><span className="w-9 h-9 rounded-full border border-current grid place-items-center"><UniformIcon name="assistant" size={20}/></span><h2 className="text-[22px] font-medium">LeadMaster Assistant</h2></div><p className="text-[14px] opacity-80 mt-2 max-w-[620px]">Your inbox, summarized. Ask Assistant to draft replies, surface priority leads, and clean up the noise — then you decide what to send.</p></div><span className="text-[12px] border border-current px-3 py-1.5 rounded-full">{counts.inboxUnread} unread · {counts.inboxTotal} in Inbox</span></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {[{k:'summary' as const, t:'Summarize inbox', d:'A tight briefing on what matters today.', i:'spark' as IconName},{k:'drafts' as const, t:'Draft reply suggestions', d:'Three ready-to-send replies for top leads.', i:'reply' as IconName},{k:'cleanup' as const, t:'Smart cleanup', d:'Archive read promos — keep the important mail.', i:'zap' as IconName},{k:'priority' as const, t:'Priority leads / emails', d:'Ranked by value, urgency, and reply needed.', i:'flame' as IconName}].map(c=>(
              <button key={c.k} disabled={viewLoading} onClick={()=>runAssistant(c.k)} className={`text-left bg-[var(--surface)] rounded-2xl p-4 gmail-shadow border-2 disabled:opacity-50 ${assistantTab===c.k?'border-[var(--text)]':'border-[var(--border)]'}`}><UniformIcon name={c.i} size={20}/><p className="font-medium mt-2">{c.t}</p><p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed">{c.d}</p><span className="inline-block mt-3 text-[13px] font-medium underline underline-offset-2">Run →</span></button>
            ))}
          </div>
          <div className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mt-4 border border-[var(--border)]">
            <p className="font-medium">{assistantTab==='summary'?'Inbox summary':assistantTab==='drafts'?'Draft reply suggestions':assistantTab==='cleanup'?'Smart cleanup':'Priority leads'}</p>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-[var(--text-2)] mt-2 min-h-[90px]">{assistantResult || 'Choose a card above — Assistant will build a summary, drafts, cleanup plan, or priority list from your current inbox.'}</p>
            {assistantTab==='summary' && <button disabled={viewLoading} onClick={()=>runAssistant('summary')} className="mt-3 px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-50">Summarize Inbox</button>}
            {assistantTab==='drafts' && <div className="grid sm:grid-cols-3 gap-3 mt-3">
              {[{n:'Priya Sharma', c:'Acme Health', b:'Proposal coming today — onboarding + January start included.', i:0},{n:'Daniel Okafor', c:'Northwind', b:'Enterprise pricing for 120 seats + SSO pilot on its way.', i:1},{n:'Lena Fischer', c:'Bright Labs', b:'Onboarding can start Monday — timeline attached.', i:2}].map(d=>(
                <article key={d.n} className="border border-[var(--border)] rounded-xl p-3 flex flex-col"><p className="font-medium">{d.n}</p><p className="text-[12px] text-[var(--text-3)]">{d.c}</p><p className="text-[13px] mt-2 flex-1 leading-relaxed">{d.b}</p><button disabled={viewLoading} onClick={()=>useAssistantDraft(d.i)} className="mt-3 px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-50">Use Draft</button></article>
              ))}
            </div>}
            {assistantTab==='cleanup' && <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <article className="border border-[var(--border)] rounded-xl p-4"><div className="flex items-center gap-2"><UniformIcon name="archive" size={18}/><p className="font-medium">Archive newsletters</p></div><p className="text-[13px] text-[var(--text-3)] mt-2 leading-relaxed">Archive newsletter mail. Starred and unread mail stays in Inbox.</p><button disabled={viewLoading} onClick={archiveNewsletters} className="mt-3 px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-50">Archive newsletters</button></article>
              <article className="border border-[var(--border)] rounded-xl p-4"><div className="flex items-center gap-2"><UniformIcon name="trash" size={18}/><p className="font-medium">Delete old promos</p></div><p className="text-[13px] text-[var(--text-3)] mt-2 leading-relaxed">Move old read Promotions to Deleted. Restore them from Deleted if needed.</p><button disabled={viewLoading} onClick={deleteOldPromos} className="mt-3 px-4 py-2 rounded-full border border-[var(--border)] text-[13px] disabled:opacity-50">Delete old promos</button></article>
              <div className="sm:col-span-2 flex flex-wrap gap-2"><button disabled={viewLoading} onClick={applyCleanup} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] disabled:opacity-50">Apply cleanup</button>{cleanupApplied && <span className="text-[13px] flex items-center gap-1"><UniformIcon name="check" size={16}/> Cleanup applied</span>}</div>
            </div>}
            {assistantTab==='priority' && <div className="grid sm:grid-cols-2 gap-3 mt-3">{[{n:'Priya Sharma', c:'Acme Health', v:'$48,000 / yr', d:'Proposal due Thursday'}, {n:'Daniel Okafor', c:'Northwind', v:'$96,000 / yr', d:'120 seats · SSO + pilot'}, {n:'Lena Fischer', c:'Bright Labs', v:'$32,000 / yr', d:'Onboarding Monday'}, {n:'Marcus Webb', c:'Harbor Retail', v:'$24,500 pilot', d:'Decision Friday'}].filter(p=> !q || (p.n+' '+p.c).toLowerCase().includes(q)).map(p=>(<div key={p.n} className="border border-[var(--border)] rounded-xl p-3"><span className="inline-grid w-8 h-8 rounded-full bg-[var(--text)] text-[var(--surface)] place-items-center align-middle mr-2"><AvatarIcon email={contacts.find(c=>c.name===p.n)?.email || ''} size={18} /></span><button onClick={()=>openSender(p.n, contacts.find(c=>c.name===p.n)?.email || '')} className="font-medium hover:underline">{p.n}</button><span className="text-[var(--text-3)] font-normal"> · {p.c}</span><p className="text-[13px] mt-1"><span className="font-medium">{p.v}</span> · {p.d}</p></div>))}</div>}
          </div>
        </div>
      )}

      {view==='automation' && (
        <div className="mx-1 sm:mx-2">
          <div className="flex flex-wrap items-center gap-3 mb-3"><h2 className="text-[20px] font-medium">Automation</h2><span className="text-[13px] text-[var(--text-3)]">{rules.filter(r=>r.enabled).length} of {rules.length} rules on</span><button disabled={viewLoading} onClick={()=>setShowRuleForm(!showRuleForm)} className="ml-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] disabled:opacity-50"><UniformIcon name="plus" size={17}/> Add Rule</button></div>
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
            <article key={t.id} className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 flex flex-col border border-[var(--border)]"><span className="text-[11px] font-bold uppercase tracking-wide">{t.category}</span><h3 className="font-medium text-[17px] mt-1">{t.name}</h3><p className="text-[13px] font-medium mt-2 line-clamp-1">{t.subject}</p><p className="text-[13px] text-[var(--text-3)] leading-relaxed mt-1 line-clamp-2 flex-1 whitespace-pre-line">{t.body}</p><div className="flex flex-wrap gap-1.5 mt-4"><button disabled={viewLoading} onClick={()=>useTemplate(t)} className="px-3.5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] disabled:opacity-50">Use Template</button><button disabled={viewLoading} onClick={()=>openEditTemplate(t)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="edit" size={13}/> Edit</button><button disabled={viewLoading} onClick={()=>duplicateTemplate(t)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="copy" size={13}/> Duplicate</button><button disabled={viewLoading} onClick={()=>deleteTemplate(t)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="trash" size={13}/> Delete</button></div></article>
          ))}</div>
          {filteredTemplates.length===0 && <div className="bg-[var(--surface)] rounded-2xl p-8 text-center text-[var(--text-3)] text-[14px] border border-[var(--border)] mt-3">No templates match “{search}”.</div>}
        </div>
      )}

      {view==='scheduled' && (
        <div className="mx-1 sm:mx-2">
          <div className="flex flex-wrap items-center gap-3 mb-3"><h2 className="text-[20px] font-medium">Scheduled</h2><span className="text-[13px] text-[var(--text-3)]">{filteredScheduled.length} send-later messages</span><button disabled={viewLoading} onClick={()=>{setScheduleForm({id:'', to:'', subject:'', body:'', when:'Tomorrow · 9:00 AM'}); setShowScheduleForm(true); setSchedulePicker(null);}} className="ml-auto flex items-center gap-3 px-4 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] disabled:opacity-50"><UniformIcon name="plus" size={17}/> New scheduled</button></div>
          {showScheduleForm && <div className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-4 border border-[var(--border)]"><p className="font-medium">{scheduleForm.id?'Edit schedule':'New scheduled message'}</p><div className="grid sm:grid-cols-2 gap-3 mt-4"><label className="text-[13px]">To<input value={scheduleForm.to} onChange={e=>setScheduleForm({...scheduleForm, to:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">Send at<input value={scheduleForm.when} onChange={e=>setScheduleForm({...scheduleForm, when:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px] sm:col-span-2">Subject<input value={scheduleForm.subject} onChange={e=>setScheduleForm({...scheduleForm, subject:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px] sm:col-span-2">Body<textarea value={scheduleForm.body} onChange={e=>setScheduleForm({...scheduleForm, body:e.target.value})} rows={4} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none resize-y"/></label></div><div className="flex justify-end gap-2 mt-4"><button onClick={()=>{setShowScheduleForm(false); setSchedulePicker(null);}} className="px-4 py-2 rounded-full hover:bg-[var(--surface-2)]">Cancel</button><button onClick={saveScheduleForm} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)]">Save schedule</button></div></div>}
          {schedulePicker && <div className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-4 border-2 border-[var(--text)]"><p className="font-medium flex items-center gap-2"><UniformIcon name="calendar" size={18}/> Edit Schedule — choose date &amp; time</p><p className="text-[13px] text-[var(--text-3)] mt-1">Current: {schedulePicker.when}</p><label className="block text-[13px] mt-4">Date &amp; time<input type="datetime-local" value={schedulePicker.dateTime} onChange={e=>setSchedulePicker({...schedulePicker, dateTime:e.target.value})} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><div className="flex flex-wrap gap-2 mt-3">{['Tomorrow · 9:00 AM','Friday · 8:30 AM','Monday · 10:00 AM'].map(p=><button key={p} onClick={()=>setSchedulePicker({...schedulePicker, when:p})} className={`px-3 py-1.5 rounded-full border text-[13px] ${schedulePicker.when===p?'bg-[var(--text)] text-[var(--surface)]':'border-[var(--border)]'}`}>{p}</button>)}</div><div className="flex justify-end gap-2 mt-4"><button onClick={()=>setSchedulePicker(null)} className="px-4 py-2 rounded-full hover:bg-[var(--surface-2)]">Cancel</button><button onClick={saveSchedulePicker} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)]">Save schedule</button></div></div>}
          <div className="space-y-3">{filteredScheduled.map(s=>(
            <div key={s.id} className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 flex flex-col sm:flex-row gap-3 border border-[var(--border)]"><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium truncate">{s.subject}</p><span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] font-medium flex items-center gap-1"><UniformIcon name="clock" size={12}/> {s.when}</span></div><p className="text-[13px] text-[var(--text-3)] mt-1"><span className="inline-grid w-6 h-6 rounded-full bg-[var(--text)] text-[var(--surface)] place-items-center align-middle mr-1.5"><AvatarIcon email={s.to} size={14} /></span>To <button onClick={()=>openSender(s.to.split('@')[0].replace(/[._]/g,' '), s.to)} className="underline underline-offset-2 font-medium text-[var(--text)]">{s.to}</button> · Scheduled for {s.when}</p><p className="text-[14px] text-[var(--text-2)] mt-2 line-clamp-2 whitespace-pre-line">{s.body}</p></div><div className="flex sm:flex-col gap-2 shrink-0"><button disabled={viewLoading} onClick={()=>openEditSchedule(s)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="edit" size={14}/> Edit schedule</button><button disabled={viewLoading} onClick={()=>sendNowScheduled(s)} className="px-4 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px] flex items-center gap-1 disabled:opacity-50"><UniformIcon name="send" size={14}/> Send now</button><button disabled={viewLoading} onClick={()=>cancelScheduled(s)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[13px] disabled:opacity-50">Cancel</button></div></div>
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
          <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]"><h3 className="font-medium">Notifications</h3><div className="space-y-3 mt-3 text-[14px]">{[[notifEmail, setNotifEmail, 'Email notifications', 'Get an email when a priority lead replies'], [notifDesktop, setNotifDesktop, 'Desktop notifications', 'Show a banner for new Primary mail'], [notifSound, setNotifSound, 'Sounds', 'Play a sound for new mail']].map(([val, setter, label, desc]:any, i)=><label key={i} className="flex items-start gap-3 cursor-pointer"><input type="checkbox" disabled={viewLoading} checked={val} onChange={e=>{setter(e.target.checked); savePrefs({[i===0?'notifEmail':i===1?'notifDesktop':'notifSound']:e.target.checked});}} className="accent-black w-4 h-4 mt-0.5"/><span><span className="block">{label}</span><span className="block text-[13px] text-[var(--text-3)]">{desc}</span></span></label>)}</div></section>
          <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]"><h3 className="font-medium">Default reply behavior</h3><div className="flex flex-wrap gap-2 mt-3">{([['reply','Reply'],['reply-all','Reply all']] as const).map(([v,l])=><button key={v} disabled={viewLoading} onClick={()=>{setReplyBehavior(v); savePrefs({replyBehavior:v});}} className={`px-4 py-2 rounded-full border disabled:opacity-50 ${replyBehavior===v?'bg-[var(--text)] text-[var(--surface)]':'border-[var(--border)]'}`}>{l}</button>)}</div><p className="text-[13px] text-[var(--text-3)] mt-2">Reply buttons in email detail follow this default.</p></section>
          <section className="bg-[var(--surface)] rounded-2xl gmail-shadow p-4 sm:p-5 mb-3 border border-[var(--border)]"><div className="flex items-center justify-between gap-3"><div><h3 className="font-medium">Vacation responder</h3><p className="text-[13px] text-[var(--text-3)] mt-1">Auto-reply while you are away.</p></div><button disabled={viewLoading} onClick={()=>{const next=!vacationOn; setVacationOn(next); savePrefs({vacationOn:next});}} role="switch" aria-checked={vacationOn} className={`w-11 h-6 rounded-full relative shrink-0 border border-[var(--border)] disabled:opacity-50 ${vacationOn?'bg-[var(--text)]':'bg-[var(--surface-3)]'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-all ${vacationOn?'left-[22px] bg-[var(--surface)]':'left-0.5 bg-white'}`}/></button></div>{vacationOn && <div className="grid gap-3 mt-4"><label className="text-[13px]">Subject<input value={vacationSubject} onChange={e=>setVacationSubject(e.target.value)} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"/></label><label className="text-[13px]">Message<textarea value={vacationBody} onChange={e=>setVacationBody(e.target.value)} rows={4} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none resize-y"/></label></div>}</section>
          <div className="flex flex-wrap gap-2"><button disabled={viewLoading} onClick={saveSettings} className="px-6 py-2.5 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px] disabled:opacity-50">Save Settings</button><button onClick={()=>{setDensity('comfortable'); setSignature('Best,\nAlex Morgan\nLeadMaster · Sales Lead\nalex.morgan@leadmaster.com'); setStatus('Settings reset to LeadMaster defaults.');}} className="px-5 py-2.5 rounded-full border border-[var(--border)] text-[14px]">Reset to defaults</button></div>
          {settingsSaved && <p className="flex items-center gap-2 text-[13px] font-medium mt-3"><UniformIcon name="check" size={16}/> Settings saved — profile, theme, and signature are stored.</p>}
          <p className="text-[12px] text-[var(--text-3)] mt-3">Settings are saved to your LeadMaster workspace. Vacation responder only applies when turned on.</p>
        </div>
      )}

      {view==='inbox' && !openEmail && <div className="grid sm:grid-cols-3 gap-3 mx-1 sm:mx-2 mt-4">
        {[{t:'Focus first', d:'Primary holds the leads that need a reply. Promotions and Social wait quietly underneath.', i:'spark' as IconName}, {t:'Triage in seconds', d:'Hover any row to archive, delete, or snooze. Star what you need to find again.', i:'zap' as IconName}, {t:'Assistant does the busywork', d:'Summaries, draft replies, cleanup, and priority leads — in one panel.', i:'assistant' as IconName}].map(x=><div key={x.t} className="bg-[var(--surface)] rounded-2xl p-4 gmail-shadow border border-[var(--border)]"><UniformIcon name={x.i} size={18}/><p className="font-medium mt-2">{x.t}</p><p className="text-[13px] text-[var(--text-3)] leading-relaxed mt-1">{x.d}</p></div>)}
      </div>}
    </>
  );

  const rightPanel = rightPanelOpen ? (
    <aside className="hidden xl:block w-[320px] shrink-0 sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)]" style={{top:'calc(var(--safe-area-inset-top) + 64px)'}}>
      <div className="flex items-center gap-2 p-3 border-b border-[var(--border)]"><UniformIcon name="panel" size={18}/><p className="font-medium flex-1">Workspace</p><button onClick={()=>setRightPanelOpen(false)} className="p-1.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Collapse right panel"><UniformIcon name="chevron-right" size={17}/></button></div>
      {/* Contacts */}
      <section className="border-b border-[var(--border)]">
        <button onClick={()=>setPanelContactsOpen(!panelContactsOpen)} className="w-full flex items-center gap-2 px-3 py-3 text-left" aria-expanded={panelContactsOpen}><UniformIcon name="contacts" size={18}/><span className="font-medium flex-1">Contacts</span><span className="text-[12px] text-[var(--text-3)]">{contacts.length}</span><UniformIcon name={panelContactsOpen?'chevron-down':'chevron-right'} size={16}/></button>
        {panelContactsOpen && <div className="px-3 pb-3">
          {isLoading ? <div className="flex items-center gap-2 text-[13px]"><Spinner/> Loading contacts…</div> : <><div className="flex items-center gap-2 border border-[var(--border)] rounded-full px-3 py-2 bg-[var(--background)]"><UniformIcon name="search" size={16}/><input value={contactSearch} onChange={e=>setContactSearch(e.target.value)} placeholder="Search contacts" className="flex-1 min-w-0 bg-transparent outline-none text-[13px]" aria-label="Search contacts"/></div>
          <button onClick={()=>setShowContactForm(!showContactForm)} className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]"><UniformIcon name="plus" size={15}/> Add Contact</button>
          {showContactForm && <div className="mt-2 border border-[var(--border)] rounded-xl p-3 space-y-2"><label className="block text-[12px]">Name<input value={contactForm.name} onChange={e=>setContactForm({...contactForm, name:e.target.value})} className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label><label className="block text-[12px]">Email<input value={contactForm.email} onChange={e=>setContactForm({...contactForm, email:e.target.value})} className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label><label className="block text-[12px]">Company<input value={contactForm.company} onChange={e=>setContactForm({...contactForm, company:e.target.value})} className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label><label className="block text-[12px]">Phone<input value={contactForm.phone} onChange={e=>setContactForm({...contactForm, phone:e.target.value})} className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label><div className="flex gap-2"><button onClick={saveContactForm} className="flex-1 px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Save</button><button onClick={()=>setShowContactForm(false)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px]">Cancel</button></div></div>}
          <div className="mt-2 space-y-1 max-h-[260px] overflow-y-auto">{filteredContacts.map(c=>(<div key={c.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-[var(--surface-2)]"><button onClick={()=>openSender(c.name, c.email, c.company)} className="flex items-center gap-2 flex-1 min-w-0 text-left"><span className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center text-[12px] shrink-0"><AvatarIcon email={c.email} size={18} /></span><span className="min-w-0"><span className="block text-[13px] font-medium truncate">{c.name}</span><span className="block text-[12px] text-[var(--text-3)] truncate">{c.email}</span></span></button><button onClick={()=>deleteContact(c)} className="p-1 rounded-full hover:bg-[var(--surface-3)]" aria-label={`Delete ${c.name}`}><UniformIcon name="trash" size={15}/></button></div>))}{filteredContacts.length===0 && <p className="text-[13px] text-[var(--text-3)] p-2">No contacts match “{contactSearch}”.</p>}</div></>}
        </div>}
      </section>
      {/* Calendar / Reminders */}
      <section className="border-b border-[var(--border)]">
        <button onClick={()=>setPanelCalendarOpen(!panelCalendarOpen)} className="w-full flex items-center gap-2 px-3 py-3 text-left" aria-expanded={panelCalendarOpen}><UniformIcon name="calendar" size={18}/><span className="font-medium flex-1">Calendar &amp; Reminders</span><span className="text-[12px] text-[var(--text-3)]">{reminders.filter(r=>!r.done).length} open</span><UniformIcon name={panelCalendarOpen?'chevron-down':'chevron-right'} size={16}/></button>
        {panelCalendarOpen && <div className="px-3 pb-3">
          {isLoading ? <div className="flex items-center gap-2 text-[13px]"><Spinner/> Loading reminders…</div> : <>
          <div className="flex items-center justify-between"><button onClick={()=>setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth()-1,1))} className="p-1.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Previous month">‹</button><p className="font-medium text-[13px]">{calendarDate.toLocaleString([], {month:'long', year:'numeric'})}</p><button onClick={()=>setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth()+1,1))} className="p-1.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Next month">›</button></div>
          <div className="grid grid-cols-7 gap-1 text-center text-[12px] mt-2">{['S','M','T','W','T','F','S'].map(d=><span key={d} className="text-[var(--text-3)] py-1">{d}</span>)}{calendarCells.map((d,i)=>{ if(d===null) return <span key={i}/>; const ds=dateStrForDay(d); const has=reminders.some(r=>r.date===ds); return <button key={i} onClick={()=>{setSelectedDay(ds); setReminderForm(prev=>({...prev, date:ds}));}} className={`py-1.5 rounded-full ${ds===selectedDay?'bg-[var(--text)] text-[var(--surface)]':has?'border border-[var(--text)]':''}`}>{d}{has && ds!==selectedDay ? <span className="block w-1 h-1 bg-[var(--text)] rounded-full mx-auto"/>:null}</button>; })}</div>
          <p className="text-[12px] text-[var(--text-3)] mt-2">Selected: {selectedDay} · {remindersForDay.length} reminder{remindersForDay.length===1?'':'s'}</p>
          <button onClick={()=>{setShowReminderForm(!showReminderForm); setReminderForm(prev=>({...prev, date:selectedDay}));}} className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-[13px]"><UniformIcon name="plus" size={15}/> Add Reminder</button>
          {showReminderForm && <div className="mt-2 border border-[var(--border)] rounded-xl p-3 space-y-2"><label className="block text-[12px]">Title<input value={reminderForm.title} onChange={e=>setReminderForm({...reminderForm, title:e.target.value})} placeholder="Reminder title" className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label><div className="grid grid-cols-2 gap-2"><label className="block text-[12px]">Date<input type="date" value={reminderForm.date} onChange={e=>setReminderForm({...reminderForm, date:e.target.value})} className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label><label className="block text-[12px]">Time<input type="time" value={reminderForm.time} onChange={e=>setReminderForm({...reminderForm, time:e.target.value})} className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label></div><div className="flex gap-2"><button onClick={saveReminderForm} className="flex-1 px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">Save reminder</button><button onClick={()=>setShowReminderForm(false)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px]">Cancel</button></div></div>}
          <div className="mt-2 space-y-1 max-h-[220px] overflow-y-auto">{reminders.map(r=>(<label key={r.id} className="flex items-start gap-2 p-2 rounded-xl hover:bg-[var(--surface-2)]"><input type="checkbox" checked={r.done} onChange={()=>toggleReminder(r)} className="accent-black w-4 h-4 mt-0.5"/><span className={`flex-1 min-w-0 ${r.done?'line-through text-[var(--text-3)]':''}`}><span className="block text-[13px] font-medium leading-snug">{r.title}</span><span className="block text-[12px] text-[var(--text-3)]">{r.date} · {r.time}</span></span><button onClick={(e)=>{e.preventDefault(); deleteReminder(r);}} className="p-1 rounded-full hover:bg-[var(--surface-3)]" aria-label={`Delete ${r.title}`}><UniformIcon name="trash" size={14}/></button></label>))}{reminders.length===0 && <p className="text-[13px] text-[var(--text-3)] p-2">No reminders yet.</p>}</div>
          </>}
        </div>}
      </section>
      {/* Notes */}
      <section>
        <button onClick={()=>setPanelNotesOpen(!panelNotesOpen)} className="w-full flex items-center gap-2 px-3 py-3 text-left" aria-expanded={panelNotesOpen}><UniformIcon name="note" size={18}/><span className="font-medium flex-1">Notes</span><span className="text-[12px] text-[var(--text-3)]">{notes.length}</span><UniformIcon name={panelNotesOpen?'chevron-down':'chevron-right'} size={16}/></button>
        {panelNotesOpen && <div className="px-3 pb-4">
          {isLoading ? <div className="flex items-center gap-2 text-[13px]"><Spinner/> Loading notes…</div> : <>
          <button onClick={()=>{setShowNoteForm(!showNoteForm); setNoteForm({id:'', title:'', body:'', pinned:false});}} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]"><UniformIcon name="plus" size={15}/> Add Note</button>
          {showNoteForm && <div className="mt-2 border border-[var(--border)] rounded-xl p-3 space-y-2"><label className="block text-[12px]">Title<input value={noteForm.title} onChange={e=>setNoteForm({...noteForm, title:e.target.value})} className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px]"/></label><label className="block text-[12px]">Body<textarea value={noteForm.body} onChange={e=>setNoteForm({...noteForm, body:e.target.value})} rows={3} className="w-full mt-0.5 border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--surface)] outline-none text-[13px] resize-y"/></label><label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={noteForm.pinned} onChange={e=>setNoteForm({...noteForm, pinned:e.target.checked})} className="accent-black w-4 h-4"/> Pin note</label><div className="flex gap-2"><button onClick={saveNoteForm} className="flex-1 px-3 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[13px]">{noteForm.id?'Update note':'Save note'}</button><button onClick={()=>setShowNoteForm(false)} className="px-3 py-2 rounded-full border border-[var(--border)] text-[13px]">Cancel</button></div></div>}
          <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">{sortedNotes.map(n=>(<article key={n.id} className="border border-[var(--border)] rounded-xl p-3"><div className="flex items-start gap-2"><p className="font-medium text-[13px] flex-1 leading-snug">{n.pinned && <span className="inline-flex items-center gap-1 mr-1"><UniformIcon name="pin" size={13}/> Pinned · </span>}{n.title}</p><button onClick={()=>togglePinNote(n)} className={`p-1 rounded-full ${n.pinned?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label={n.pinned?'Unpin note':'Pin note'}><UniformIcon name="pin" size={14}/></button></div><p className="text-[13px] text-[var(--text-2)] whitespace-pre-line leading-relaxed mt-1">{n.body}</p><div className="flex gap-1 mt-2"><button onClick={()=>{setNoteForm({id:n.id, title:n.title, body:n.body, pinned:n.pinned}); setShowNoteForm(true);}} className="px-2.5 py-1.5 rounded-full border border-[var(--border)] text-[12px] flex items-center gap-1"><UniformIcon name="edit" size={12}/> Edit</button><button onClick={()=>deleteNote(n)} className="px-2.5 py-1.5 rounded-full border border-[var(--border)] text-[12px] flex items-center gap-1"><UniformIcon name="trash" size={12}/> Delete</button></div></article>))}{notes.length===0 && <p className="text-[13px] text-[var(--text-3)] p-2">No notes yet.</p>}</div>
          </>}
        </div>}
      </section>
      <div className="p-3 border-t border-[var(--border)] flex gap-1">
        {[{k:'calendar', icon:'calendar' as IconName, label:'Calendar'}, {k:'keep', icon:'keep' as IconName, label:'Keep'}, {k:'tasks', icon:'tasks' as IconName, label:'Tasks'}, {k:'contacts', icon:'contacts' as IconName, label:'Contacts'}].map(r=><button key={r.k} onClick={()=>setRail(rail===r.k?null:r.k)} className={`w-10 h-10 rounded-full grid place-items-center ${rail===r.k?'bg-[var(--text)] text-[var(--surface)]':'hover:bg-[var(--surface-2)]'}`} aria-label={r.label} title={r.label}><UniformIcon name={r.icon} size={20}/></button>)}
      </div>
      {rail && <div className="m-3 mt-0 bg-[var(--surface)] rounded-2xl gmail-shadow p-4 border border-[var(--border)]">
        <div className="flex justify-between items-center"><p className="font-medium capitalize">{rail}</p><button onClick={()=>setRail(null)} aria-label="Close panel"><UniformIcon name="x" size={17}/></button></div>
        {rail==='calendar' && <div className="mt-3 text-[13px] space-y-2"><p className="font-medium">Tue · Aurora Launch Review · 10:00 AM</p><p>Wed · Design critique · 2:00 PM</p><p>Fri · Lisbon trip begins</p></div>}
        {rail==='keep' && <div className="mt-3 space-y-2 text-[13px]"><div className="border border-[var(--border)] rounded-xl p-3"><p className="font-medium">Launch checklist</p><p className="text-[var(--text-3)]">3 items left · Copy, QA, go / no-go</p></div></div>}
        {rail==='tasks' && <div className="mt-3 space-y-2 text-[13px]">{[['t1','Reply to Maya about homepage copy'],['t2','Confirm Lisbon check-in'],['t3','Review PR #482']].map(([id,txt])=><label key={id} className="flex gap-2 items-center"><input type="checkbox" checked={tasksDone.has(id)} onChange={()=>{const n=new Set(tasksDone); n.has(id)?n.delete(id):n.add(id); setTasksDone(n);}} className="accent-black w-4 h-4"/><span className={tasksDone.has(id)?'line-through text-[var(--text-3)]':''}>{txt}</span></label>)}</div>}
        {rail==='contacts' && <div className="mt-3 space-y-3">{SAMPLE.slice(0,5).map(c=><div key={c.id} className="flex items-center gap-2 text-[13px]"><span className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center text-[12px]"><AvatarIcon email={c.email} size={18} /></span><div><p className="font-medium">{c.sender}</p><p className="text-[var(--text-3)]">{c.email}</p></div></div>)}</div>}
      </div>}
    </aside>
  ) : (
    <aside className="hidden xl:flex flex-col items-center gap-1 w-[56px] shrink-0 sticky top-[64px] h-[calc(100vh-64px)] pt-2 border-l border-[var(--border)]" style={{top:'calc(var(--safe-area-inset-top) + 64px)'}}>
      <button onClick={()=>setRightPanelOpen(true)} className="px-2 py-2 rounded-full grid place-items-center bg-[var(--text)] text-[var(--surface)] text-[12px] font-medium" aria-label="Open Workspace panel">Work<br/>space</button>
      <button onClick={()=>{setRightPanelOpen(true); setPanelContactsOpen(true);}} className="w-10 h-10 rounded-full grid place-items-center hover:bg-[var(--surface-2)]" aria-label="Open contacts"><UniformIcon name="contacts" size={20}/></button>
      <button onClick={()=>{setRightPanelOpen(true); setPanelCalendarOpen(true);}} className="w-10 h-10 rounded-full grid place-items-center hover:bg-[var(--surface-2)]" aria-label="Open calendar"><UniformIcon name="calendar" size={20}/></button>
      <button onClick={()=>{setRightPanelOpen(true); setPanelNotesOpen(true);}} className="w-10 h-10 rounded-full grid place-items-center hover:bg-[var(--surface-2)]" aria-label="Open notes"><UniformIcon name="note" size={20}/></button>
    </aside>
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

  return (
    <div data-safe-area-inset-root className="min-h-screen w-full bg-[var(--background)] overflow-x-clip" style={{boxSizing:'border-box', paddingTop:'var(--safe-area-inset-top)'}}>
      <header data-safe-area-sticky-top className="sticky z-40 bg-[var(--background)] border-b border-[var(--border)]" style={{top:'var(--safe-area-inset-top)'}}>
        <div className="flex items-center gap-1 sm:gap-3 px-2 sm:px-4 h-[64px]">
          <button onClick={()=>{ if(window.innerWidth<768) setMobileSidebar(true); else setSidebarOpen(!sidebarOpen); }} className="p-2.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Show or hide navigation"><UniformIcon name="menu" size={20}/></button>
          <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={()=>{goView('inbox');}}><span className="w-9 h-9 rounded-lg bg-[var(--text)] text-[var(--surface)] grid place-items-center"><UniformIcon name="inbox" size={20}/></span><span className="hidden sm:inline text-[22px] tracking-tight font-bold">LeadMaster</span></div>
          <div className="flex-1 max-w-[720px] mx-1 sm:mx-4">
            <div className={`flex items-center gap-2 rounded-full px-3 sm:px-4 h-[48px] border border-[var(--border)] ${showFilters?'bg-[var(--surface)] shadow':'bg-[var(--surface-2)]'}`}><UniformIcon name="search" size={20}/><input value={search} onChange={e=>{setSearch(e.target.value); setOpenEmailId(null);}} placeholder="Search leads & mail" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-[var(--text-3)]" aria-label="Search mail"/>{search && <button onClick={()=>setSearch('')} aria-label="Clear search" className="p-1 rounded-full hover:bg-[var(--surface-3)]"><UniformIcon name="x" size={16}/></button>}<button onClick={()=>setShowFilters(!showFilters)} className={`p-1.5 rounded-full ${showFilters?'bg-[var(--text)] text-[var(--surface)]':''}`} aria-label="Show search options"><UniformIcon name="filter" size={19}/></button></div>
            {showFilters && <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-auto top-[62px] w-[calc(100%-16px)] max-w-[560px] bg-[var(--surface)] rounded-2xl gmail-shadow p-4 z-50 text-[14px] border border-[var(--border)]"><p className="font-medium mb-3">Search options</p><label className="flex items-center gap-3 py-2"><input type="checkbox" checked={onlyAttachment} onChange={e=>setOnlyAttachment(e.target.checked)} className="accent-black w-4 h-4"/> Has attachment</label><label className="flex items-center gap-3 py-2">Category <select value={activeTab} onChange={e=>setActiveTab(e.target.value as Category)} className="border border-[var(--border)] rounded-lg px-2 py-1 bg-[var(--surface)]"><option>Primary</option><option>Promotions</option><option>Social</option><option>Updates</option><option>Forums</option></select></label><div className="flex justify-end gap-2 mt-3"><button onClick={()=>{setOnlyAttachment(false); setSearch(''); setShowFilters(false);}} className="px-4 py-2 rounded-full hover:bg-[var(--surface-2)]">Clear</button><button onClick={()=>setShowFilters(false)} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)]">Search</button></div></div>}
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button onClick={()=>setRightPanelOpen(!rightPanelOpen)} className={`px-3 py-2 rounded-full hover:bg-[var(--surface-3)] text-[13px] font-medium whitespace-nowrap ${rightPanelOpen?'bg-[var(--text)] text-[var(--surface)]':'border border-[var(--border)]'}`} aria-label="Show or hide Workspace panel" title="Show or hide Contacts, Calendar and Notes panel">Workspace</button>
            <button onClick={simulateError} title="Simulate error" aria-label="Simulate error" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-[13px] hover:bg-[var(--surface-2)]"><UniformIcon name="alert" size={16}/> <span className="hidden lg:inline">Simulate error</span></button>
            <button onClick={()=>setShowHelp(!showHelp)} className="p-2.5 rounded-full hover:bg-[var(--surface-3)] hidden sm:block" aria-label="Help"><UniformIcon name="help" size={21}/></button>
            <button onClick={()=>goView('settings')} className="p-2.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Settings"><UniformIcon name="settings" size={21}/></button>
            <button onClick={()=>setShowApps(!showApps)} className="p-2.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Apps"><UniformIcon name="apps" size={20}/></button>
            <button onClick={()=>setShowProfile(!showProfile)} className="ml-1 w-9 h-9 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center font-medium" aria-label="Profile">A</button>
          </div>
        </div>
        <div className="sm:hidden px-3 pb-2"><button onClick={simulateError} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] text-[12px]"><UniformIcon name="alert" size={14}/> Simulate error</button></div>
        {(showHelp||showSettings||showApps||showProfile) && <div className="absolute right-2 sm:right-4 top-[64px] w-[320px] max-w-[calc(100vw-16px)] bg-[var(--surface)] rounded-2xl gmail-shadow p-4 z-50 border border-[var(--border)]">
          {showHelp && <div><p className="font-medium">Help — LeadMaster</p><p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed">Search filters this view live. Star, archive, snooze and delete are on every row. Use Assistant for summaries, Automation for rules, Templates for fast replies, and Scheduled for send-later.</p><button onClick={()=>setShowHelp(false)} className="mt-3 text-[14px] underline underline-offset-2">Close</button></div>}
          {showSettings && <div><p className="font-medium">Quick settings</p><p className="text-[13px] text-[var(--text-3)] mt-1">Density</p><div className="flex gap-2 mt-2">{(['comfortable','compact'] as const).map(d=><button key={d} onClick={()=>{setDensity(d); savePrefs({density:d});}} className={`px-3 py-2 rounded-full border capitalize ${density===d?'bg-[var(--text)] text-[var(--surface)]':'border-[var(--border)]'}`}>{d}</button>)}</div><button onClick={()=>{setShowSettings(false); goView('settings');}} className="mt-4 text-[14px] underline underline-offset-2">Open full Settings →</button></div>}
          {showApps && <div><p className="font-medium mb-3">Apps</p><div className="grid grid-cols-3 gap-3 text-center text-[12px]">{[['Calendar','calendar'],['Drive','inbox'],['Docs','templates'],['Sheets','tasks'],['Meet','contacts'],['Photos','assistant']].map(([n,ic])=><button key={n} onClick={()=>setStatus(`${n} opens in the apps rail — use the icons on the right.`)} className="p-3 rounded-xl hover:bg-[var(--surface-2)] flex flex-col items-center gap-1"><UniformIcon name={ic as IconName} size={22}/>{n}</button>)}</div></div>}
          {showProfile && <div className="text-center"><div className="w-16 h-16 rounded-full bg-[var(--text)] text-[var(--surface)] grid place-items-center text-2xl mx-auto">A</div><p className="font-medium mt-2">{profileName}</p><p className="text-[13px] text-[var(--text-3)]">{profileEmail}</p><button onClick={()=>{setShowProfile(false); goView('settings');}} className="mt-3 px-4 py-2 rounded-full border border-[var(--border)] text-[14px]">Manage profile</button></div>}
        </div>}
      </header>

      <div className="flex items-start">
        <aside className={`hidden md:block shrink-0 sticky top-[64px] h-[calc(100vh-64px)] ${sidebarOpen?'w-[256px]':'w-[72px]'} transition-all overflow-hidden`} style={{top:'calc(var(--safe-area-inset-top) + 64px)'}}>
          {sidebarOpen ? sidebar : <div className="pt-2 flex flex-col items-center gap-1">{NAV.map(k=><button key={k.k} onClick={()=>goView(k.k)} className={`w-11 h-11 grid place-items-center rounded-full ${view===k.k?'bg-[var(--text)] text-[var(--surface)]':'hover:bg-[var(--surface-2)]'}`} aria-label={k.label} title={k.label}><UniformIcon name={k.icon} size={20}/></button>)}</div>}
        </aside>
        {mobileSidebar && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setMobileSidebar(false)}/><div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--background)] p-2 pt-4 overflow-y-auto">{sidebar}</div></div>}

        <main className="flex-1 min-w-0 px-1 sm:px-3 pb-6">
          {stateBar}
          {viewError ? ErrorState : viewLoading ? LoadingState : mainContent}
        </main>

        {rightPanel}
      </div>

      {senderProfile}

      {htmlDialogOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center p-3" role="dialog" aria-label="Insert HTML"><div className="absolute inset-0 bg-black/40" onClick={()=>setHtmlDialogOpen(false)} /><div className="relative w-full max-w-[640px] bg-[var(--surface)] rounded-2xl gmail-shadow border border-[var(--border)] overflow-hidden max-h-[92vh] overflow-y-auto"><div className="flex items-center justify-between bg-[var(--surface-2)] px-4 py-3"><p className="font-medium flex items-center gap-2"><UniformIcon name="html" size={18}/> Insert HTML</p><button onClick={()=>setHtmlDialogOpen(false)} className="p-1.5 rounded-full hover:bg-[var(--surface-3)]" aria-label="Close HTML dialog"><UniformIcon name="x" size={18}/></button></div><div className="p-4"><p className="text-[13px] text-[var(--text-3)]">Paste HTML or choose a preset. Scripts are stripped on insert. Preview shows how it will render.</p><label className="block text-[13px] font-medium mt-3">Preset<select value={htmlTemplate} onChange={e=>{setHtmlTemplate(e.target.value); const t=HTML_SNIPPETS.find(x=>x.name===e.target.value); if(t) setHtmlDialogValue(t.html);}} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none"><option value="">Choose a preset — Button, Table, Divider, Image, Signature Block, Callout Box…</option>{HTML_SNIPPETS.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select></label><label className="block text-[13px] font-medium mt-3">HTML code<textarea value={htmlDialogValue} onChange={e=>setHtmlDialogValue(e.target.value)} rows={10} placeholder={'<p><strong>Hello</strong> — paste HTML here</p>'} className="w-full mt-1 border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface)] outline-none text-[13px] font-mono resize-y" aria-label="HTML code"/></label><label className="flex items-center gap-2 text-[13px] mt-3"><input type="checkbox" checked={htmlDialogPreview} onChange={e=>setHtmlDialogPreview(e.target.checked)} className="accent-black w-4 h-4"/> Preview HTML</label>{htmlDialogPreview && htmlDialogValue && <div className="mt-3"><p className="text-[12px] font-medium mb-1">Preview</p><div className="border border-[var(--border)] rounded-xl p-3 bg-[var(--background)] text-[14px]" dangerouslySetInnerHTML={{__html: sanitizeHtml(htmlDialogValue)}} /></div>}<div className="flex justify-end gap-2 mt-4"><button onClick={()=>setHtmlDialogOpen(false)} className="px-4 py-2 rounded-full border border-[var(--border)] text-[14px]">Cancel</button><button onClick={insertHtmlFromDialog} className="px-5 py-2 rounded-full bg-[var(--text)] text-[var(--surface)] text-[14px]">Insert HTML</button></div></div></div></div>}


    </div>
  );
}
