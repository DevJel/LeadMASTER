import { LoadingIndicator } from "./LoadingIndicator";
import { SendingIndicator, type SendingPhase } from "./SendingIndicator";

type LoadingOverlayProps = { active: boolean; dismissed: boolean; onDismiss: () => void; label: string; statusLabel?: string; sendingPhase?: SendingPhase | null };

/** Hides only its visual layer on dismissal; the active request continues. */
export function LoadingOverlay({ active, dismissed, onDismiss, label, statusLabel = "Loading status", sendingPhase = null }: LoadingOverlayProps) {
  if (!active || dismissed) return null;
  return (
    <div data-lm-loading-overlay="true" className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/25 backdrop-blur-md" role="status" aria-live="polite">
      <section className="relative w-full max-w-[420px] min-h-[220px] flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl px-4 py-8" role="group" aria-label={sendingPhase ? "Sending status" : statusLabel}>
        <button type="button" onClick={onDismiss} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-[var(--text-2)] hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Dismiss loading overlay" title="Dismiss"><span aria-hidden="true">×</span></button>
        {sendingPhase ? <SendingIndicator phase={sendingPhase} /> : <LoadingIndicator label={label} />}
      </section>
    </div>
  );
}
