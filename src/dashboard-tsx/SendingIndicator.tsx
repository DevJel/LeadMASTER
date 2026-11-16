
/** The caller must derive this state from the request or authoritative server data. */
export type SendingPhase = 'submitting' | 'queued' | 'sending' | 'accepted' | 'failed' | 'unknown';
const descriptions: Record<SendingPhase, {title:string; detail:string; step:number}> = {
  submitting:{title:'Sending…',detail:'Submitting your message…',step:-1},
  queued:{title:'Queued for sending',detail:'Queue acceptance does not mean delivery.',step:0},
  sending:{title:'Sending…',detail:'Your message is being sent.',step:1},
  accepted:{title:'Accepted for sending',detail:'Acceptance does not mean delivery.',step:2},
  failed:{title:'Sending failed',detail:'Check the message status before trying again.',step:-1},
  unknown:{title:'Sending status unknown',detail:'Do not resend until you check the message status.',step:-1},
};

export function SendingIndicator({phase}:{phase:SendingPhase}) {
  const {title,detail,step}=descriptions[phase];
  const pending=phase==='submitting'||phase==='queued'||phase==='sending';
  const steps=['Queued','Sending','Accepted'];
  return <section className="lm-send" role={phase==='failed'||phase==='unknown'?'alert':'status'} aria-live="polite">
    <svg className="lm-send-art" viewBox="0 0 220 90" fill="none" aria-hidden="true">
      <circle cx="28" cy="45" r="16" fill="white" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="28" cy="40" r="3.5" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M21 53a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path className={pending?'lm-send-path':''} d="M44 45 Q110 8 176 45" stroke="currentColor" strokeWidth="1.8" strokeDasharray="4 5" strokeLinecap="round"/>
      <circle cx="192" cy="45" r="16" fill="white" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="185" y="38" width="14" height="13" rx="1" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M188 42h2M192 42h2M188 46h2M192 46h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      {pending&&<g className="lm-send-plane"><circle cx="-8" cy="2" r="1.2" fill="currentColor" opacity=".35"/><circle cx="-13" cy="3" r="1" fill="currentColor" opacity=".2"/><path d="M0 -6 10 0 0 6 3 0Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M0 -6 3 0 0 6" stroke="white" strokeWidth="1" strokeLinecap="round"/></g>}
    </svg>
    <p className="lm-send-title">{title}</p><p className="lm-send-description">{detail}</p>
    <div className="lm-send-steps" aria-label="Sending stages">{steps.map((label,index)=><div className="lm-send-step-wrap" key={label}>
      <div className={`lm-send-step${step===index?' lm-send-step--active':step>index?' lm-send-step--done':''}`}>
        <span className="lm-send-step-dot" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{step>index||index===2?<path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>:index===0?<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round"/></>:<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinejoin="round"/>}</svg></span><span>{label}{step===index?<span className="lm-send-sr-only">, current status</span>:null}</span>
      </div>{index<steps.length-1&&<span className="lm-send-line" aria-hidden="true"/>}
    </div>)}</div>
    {pending&&<div className="lm-send-bar" aria-hidden="true"><span/></div>}
  </section>;
}
