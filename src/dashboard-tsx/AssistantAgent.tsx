import {useMemo,useState,type FormEvent} from "react";

type ChatMessage = {role:"user"|"assistant";content:string};
export type AssistantPreparedEmail = {to:string;subject:string;text:string};
type AgentAction = {name:string;status:"completed"|"needs_review"|"needs_attention"};
type Props = {onPrepareEmail:(draft:AssistantPreparedEmail)=>void};
const labels:Record<string,string> = {
  get_inbox_overview:"Read inbox overview",
  search_inbox:"Search received messages",
  get_message:"Read a message",
  prepare_email:"Prepare an unsent email"
};
const actionStatus:Record<string,string> = {
  completed:"Completed",
  needs_review:"Needs your review",
  needs_attention:"Needs attention"
};
export function AssistantAgent({onPrepareEmail}:Props){
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [input,setInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [actions,setActions]=useState<AgentAction[]>([]);
  const [prepared,setPrepared]=useState<AssistantPreparedEmail|null>(null);
  const prompts=useMemo(()=>["Summarize my latest inbox messages","Find messages about pricing","Find the latest message from a sender and help me draft a reply"],[]);
  async function send(value=input){
    const content=value.trim();
    if(!content||busy)return;
    const next=[...messages,{role:"user" as const,content}];
    setMessages(next);setInput("");setBusy(true);setError("");setActions([]);setPrepared(null);
    try{
      const response=await fetch("/api/admin/assistant",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({messages:next})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(typeof data?.error==="string"?data.error:"The assistant request failed.");
      const reply=typeof data?.reply==="string"&&data.reply.trim()?data.reply:"The assistant returned no response.";
      setMessages(current=>[...current,{role:"assistant",content:reply}]);
      setActions(Array.isArray(data?.actions)?data.actions:[]);
      if(data?.prepared_email&&typeof data.prepared_email.to==="string"&&typeof data.prepared_email.subject==="string"&&typeof data.prepared_email.text==="string"){
        setPrepared({to:data.prepared_email.to,subject:data.prepared_email.subject,text:data.prepared_email.text});
      }
    }catch(e){setError(e instanceof Error?e.message:"The assistant could not complete this request.");}
    finally{setBusy(false);}
  }
  function submit(event:FormEvent){event.preventDefault();void send();}
  return <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] gmail-shadow overflow-hidden" aria-label="LeadMASTER AI agent">
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
      <span className="w-9 h-9 rounded-full bg-[var(--surface-2)] grid place-items-center text-[var(--text)]" aria-hidden="true">✦</span>
      <div className="min-w-0 flex-1"><p className="font-medium">AI Agent</p><p className="text-[12px] text-[var(--text-3)]">Cloudflare Workers AI · controlled mailbox tools</p></div>
      <span className="text-[11px] rounded-full border border-[var(--border)] px-2.5 py-1 text-[var(--text-3)]">Human approval for sending</span>
      <button type="button" disabled={busy||!messages.length} onClick={()=>{setMessages([]);setActions([]);setPrepared(null);setError("");}} className="text-[12px] underline underline-offset-2 disabled:opacity-40">New chat</button>
    </div>
    <div className="p-4 sm:p-5 space-y-3">
      {messages.length===0?<div className="py-4">
        <p className="text-[15px] font-medium">What would you like me to do?</p>
        <p className="text-[13px] text-[var(--text-3)] mt-1">I can search and read your received messages, summarize them, and prepare an email for you to review. I cannot send or change mailbox data autonomously.</p>
        <div className="flex flex-wrap gap-2 mt-4">{prompts.map(prompt=><button key={prompt} type="button" disabled={busy} onClick={()=>void send(prompt)} className="text-left text-[12px] rounded-full border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-2)] disabled:opacity-50">{prompt}</button>)}</div>
      </div>:<div className="space-y-3 max-h-[420px] overflow-y-auto" aria-live="polite">
        {messages.map((message,index)=><div key={index} className={message.role==="user"?"flex justify-end":"flex justify-start"}>
          <div className={message.role==="user"?"max-w-[92%] rounded-2xl rounded-br-md bg-[var(--text)] text-[var(--surface)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words":"max-w-[96%] rounded-2xl rounded-bl-md bg-[var(--surface-2)] text-[var(--text)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words"}><p className="text-[10px] uppercase tracking-wide opacity-60 mb-1">{message.role==="user"?"You":"LeadMASTER Assistant"}</p>{message.content}</div>
        </div>)}
        {busy&&<div className="flex items-center gap-2 text-[13px] text-[var(--text-3)]" role="status"><span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse"/> Thinking and checking permitted tools…</div>}
      </div>}
      {actions.length>0&&<div className="rounded-xl border border-[var(--border)] p-3">
        <p className="text-[12px] font-medium mb-2">Agent activity</p>
        <ul className="space-y-2">{actions.map((action,index)=><li key={index} className="flex items-center justify-between gap-3 text-[12px]"><span>{labels[action.name]||action.name}</span><span className="text-[var(--text-3)]">{actionStatus[action.status]||"Completed"}</span></li>)}</ul>
      </div>}
      {prepared&&<div className="rounded-xl border border-[var(--border)] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3"><p className="font-medium text-[13px]">Unsent email prepared</p><span className="text-[11px] border border-[var(--border)] rounded-full px-2 py-1">Review required</span></div>
        <p className="text-[12px] text-[var(--text-3)] mt-2">To: {prepared.to}</p>
        <p className="text-[13px] font-medium mt-1">{prepared.subject}</p>
        <p className="text-[12px] text-[var(--text-2)] mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto">{prepared.text}</p>
        <button type="button" onClick={()=>onPrepareEmail(prepared)} className="mt-3 rounded-full bg-[var(--text)] text-[var(--surface)] px-4 py-2.5 text-[13px] font-medium">Review in Compose</button>
      </div>}
      {error&&<p role="alert" className="text-[13px] text-red-600">{error}</p>}
      <form onSubmit={submit} className="flex items-end gap-2 border border-[var(--border)] rounded-2xl p-2 bg-[var(--background)]">
        <textarea value={input} onChange={event=>setInput(event.target.value)} maxLength={4000} rows={2} disabled={busy} placeholder="Ask LeadMASTER Assistant…" className="flex-1 min-w-0 resize-y bg-transparent px-2 py-2 text-[14px] outline-none disabled:opacity-50" aria-label="Message LeadMASTER Assistant"/>
        <button type="submit" disabled={busy||!input.trim()} className="shrink-0 rounded-full bg-[var(--text)] text-[var(--surface)] px-4 py-2.5 text-[13px] font-medium disabled:opacity-40">{busy?"Working…":"Send"}</button>
      </form>
      <p className="text-[11px] text-[var(--text-3)]">Email contents are treated as untrusted data. Sending, deleting, archiving, and automation changes are not performed by this agent.</p>
    </div>
  </section>;
}
