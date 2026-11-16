// LeadMASTER states for the React dashboard. Needs public/lm-states.css.
// All artwork is transparent and drawn in currentColor, so it adapts to the surface it sits on.
import React, { useEffect, useRef } from "react";

const S = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };

export function LoadingState({ title = "Loading LeadMASTER…", subtitle = "Loading inbox…", className = "" }) {
  return (
    <div className={"lm-state " + className} role="status" aria-live="polite">
      <svg className="lm-load-svg" viewBox="0 0 120 120" aria-hidden="true">
        <g className="lm-building" {...S}><rect x="50" y="14" width="20" height="16" rx="1.5"/><path d="M54 20h3M63 20h3M54 24h3M63 24h3M58 18v4M58 26v4"/></g>
        <line className="lm-dash" x1="60" y1="32" x2="60" y2="46" {...S}/>
        <g className="lm-env"><rect x="30" y="48" width="60" height="34" rx="3" {...S}/><polyline className="lm-flap" points="30,48 60,70 90,48" {...S}/></g>
        <line className="lm-dash lm-dash2" x1="60" y1="84" x2="60" y2="90" {...S}/>
        <g className="lm-person" {...S}><circle cx="60" cy="96" r="4"/><path d="M52 108a8 8 0 0 1 16 0"/></g>
      </svg>
      <div className="lm-dots" aria-hidden="true"><i/><i/><i/></div>
      <div className="lm-bar" aria-hidden="true"><i/></div>
      <p className="lm-state-title">{title}</p>
      <p className="lm-state-sub">{subtitle}</p>
    </div>
  );
}

const STAGES = ["queued", "sending", "delivered"];
const STEP_ICONS = [
  <svg key="q" viewBox="0 0 24 24" {...S} strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  <svg key="s" viewBox="0 0 24 24" {...S} strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>,
  <svg key="d" viewBox="0 0 24 24" {...S} strokeWidth="2.2"><path d="M20 6 9 17l-5-5"/></svg>,
];
const LABELS = ["Queued", "Sending", "Delivered"];

/** stage is driven by real status: "queued" | "sending" | "delivered". No fake timers. */
export function SendingState({ stage = "sending", subtitle, className = "" }) {
  const i = Math.max(0, STAGES.indexOf(stage));
  const sub = subtitle || ["Waiting in the sending list…", "Sending to recipient…", "Accepted by the sending service"][i];
  const path = "M44 45 Q110 8 176 45";
  return (
    <div className={"lm-state " + className} role="status" aria-live="polite">
      <svg className="lm-send-svg" viewBox="0 0 220 90" aria-hidden="true">
        <circle cx="28" cy="45" r="16" {...S}/><circle cx="28" cy="40" r="3.5" {...S}/><path d="M21 53a7 7 0 0 1 14 0" {...S}/>
        <path className="lm-flight" d={path} {...S}/>
        <circle cx="192" cy="45" r="16" {...S}/><rect x="185" y="38" width="14" height="13" rx="1" {...S}/><path d="M188 42h2M192 42h2M188 46h2M192 46h2" {...S}/>
        {i < 2 && (
          <g fill="currentColor"><animateMotion dur="2.2s" repeatCount="indefinite" path={path} rotate="auto"/>
            <circle cx="-8" cy="2" r="1.2" opacity=".35"/><circle cx="-13" cy="3" r="1" opacity=".2"/>
            <path d="M0 -6 L10 0 L0 6 L3 0 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></g>
        )}
      </svg>
      <p className="lm-state-title">{i === 2 ? "Sent" : "Sending…"}</p>
      <p className="lm-state-sub">{sub}</p>
      <div className="lm-steps" aria-hidden="true">
        {STAGES.map((s, n) => (
          <React.Fragment key={s}>
            {n > 0 && <div className={"lm-step-line" + (n <= i ? " done" : "")}/>}
            <div className={"lm-step" + (n < i ? " done" : n === i ? " on" : "")}><b>{STEP_ICONS[n]}</b><span>{LABELS[n]}</span></div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** Confirmation. Enter does NOT confirm a delete; Esc cancels; focus starts on the safe button. */
export function ConfirmDialog({ open, title = "Delete this item?", description = "This moves the item to Deleted.", itemName, itemMeta,
  confirmLabel = "Yes, delete", cancelLabel = "No, keep it", busy = false, onConfirm, onCancel }) {
  const keep = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement; keep.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="lm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className="lm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="lm-cd-t" aria-describedby="lm-cd-d">
        <button className="lm-dialog-x" type="button" aria-label="Close" onClick={onCancel}>×</button>
        <div className="lm-dialog-icon" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" {...S}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>
        </div>
        <h2 id="lm-cd-t">{title}</h2>
        <p id="lm-cd-d">{description}</p>
        {itemName && <div className="lm-item"><div><span className="n">{itemName}</span>{itemMeta && <span className="e">{itemMeta}</span>}</div></div>}
        <div className="lm-actions">
          <button ref={keep} type="button" className="lm-btn no" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="lm-btn yes" onClick={onConfirm} disabled={busy}>{busy ? "Deleting…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ kind = "mailbox", title, subtitle, className = "" }) {
  const art = kind === "contacts"
    ? <><circle cx="80" cy="44" r="15"/><path d="M50 98a30 30 0 0 1 60 0"/><g opacity=".45"><circle cx="36" cy="58" r="9"/><path d="M18 98a18 18 0 0 1 18-18"/><circle cx="124" cy="58" r="9"/><path d="M142 98a18 18 0 0 0-18-18"/></g></>
    : <><path d="M24 52 80 18l56 34v46a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V52Z"/><path d="m24 52 56 34 56-34"/><path d="M52 100h56" opacity=".35" strokeDasharray="3 5"/></>;
  return (
    <div className={"lm-state lm-state-empty " + className}>
      <svg viewBox="0 0 160 120" aria-hidden="true"><g {...S}>{art}</g></svg>
      <p className="lm-state-title">{title}</p>{subtitle && <p className="lm-state-sub">{subtitle}</p>}
    </div>
  );
}
