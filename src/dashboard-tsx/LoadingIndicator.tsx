import './loading-indicator.css';

type LoadingIndicatorProps = {
  /** Describe the actual in-flight operation; do not imply completion. */
  label: string;
  compact?: boolean;
};

export function LoadingIndicator({label, compact = false}: LoadingIndicatorProps) {
  return <div className={`lm-loading${compact ? ' lm-loading--compact' : ''}`} role="status" aria-live="polite">
    <svg className="lm-loading-art" viewBox="0 0 120 120" width="120" height="120" fill="none" aria-hidden="true">
      <g className="lm-loading-building">
        <rect x="50" y="14" width="20" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M54 20h3M63 20h3M54 24h3M63 24h3M58 18v4M58 26v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <line className="lm-loading-dash" x1="60" y1="32" x2="60" y2="46" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 4" strokeLinecap="round" />
      <g className="lm-loading-envelope">
        <rect x="30" y="48" width="60" height="34" rx="3" fill="white" stroke="currentColor" strokeWidth="1.8" />
        <polyline className="lm-loading-flap" points="30,48 60,70 90,48" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <line className="lm-loading-dash lm-loading-dash--second" x1="60" y1="84" x2="60" y2="90" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 4" strokeLinecap="round" />
      <g className="lm-loading-person">
        <circle cx="60" cy="96" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M52 108a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
    <div className="lm-loading-dots" aria-hidden="true"><span /><span /><span /></div>
    <div className="lm-loading-bar" aria-hidden="true"><div className="lm-loading-fill" /></div>
    <p className="lm-loading-title">Loading LeadMASTER…</p>
    <p className="lm-loading-label">{label}</p>
  </div>;
}
