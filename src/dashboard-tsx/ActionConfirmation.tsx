import React, { useEffect, useState } from 'react';

export type ActionConfirmationRequest = {
  title: string;
  message: string;
  itemLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Props = {
  request: ActionConfirmationRequest | null;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

export function ActionConfirmation({request,onCancel,onConfirm}:Props) {
  const [working,setWorking] = useState(false);
  useEffect(()=>{ setWorking(false); },[request]);
  useEffect(()=>{
    if(!request) return;
    const onKey=(event:KeyboardEvent)=>{ if(event.key==='Escape'&&!working) onCancel(); };
    document.addEventListener('keydown',onKey);
    return ()=>document.removeEventListener('keydown',onKey);
  },[request,working,onCancel]);
  if(!request) return null;
  return <div className="lm-confirm-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!working)onCancel();}}>
    <section className="lm-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="lm-confirm-title" aria-describedby="lm-confirm-message">
      <button className="lm-confirm-close" type="button" aria-label="Close confirmation" disabled={working} onClick={onCancel}>×</button>
      <div className="lm-confirm-icon" aria-hidden="true">
        <svg className="lm-confirm-trash" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M6 6l1 15h10l1-15"/><path d="M10 10v7M14 10v7"/></svg>
      </div>
      <h2 id="lm-confirm-title" className="lm-confirm-title">{request.title}</h2>
      <p id="lm-confirm-message" className="lm-confirm-message">{request.message}</p>
      {request.itemLabel && <div className="lm-confirm-item"><span className="lm-confirm-item-icon" aria-hidden="true">!</span><span>{request.itemLabel}</span></div>}
      <div className="lm-confirm-actions">
        <button type="button" className="lm-confirm-cancel" disabled={working} onClick={onCancel}>{request.cancelLabel||'Cancel'}</button>
        <button type="button" className="lm-confirm-accept" disabled={working} onClick={async()=>{setWorking(true);try{await onConfirm();}finally{setWorking(false);}}}>
          <span>{working?'Working…':request.confirmLabel||'Confirm'}</span>
        </button>
      </div>
      <p className="lm-confirm-note">This action will only be completed after you confirm.</p>
    </section>
  </div>;
}
