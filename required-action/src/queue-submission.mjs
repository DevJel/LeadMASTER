/** A queue exception can occur after acceptance; do not assume the submission failed. */
export async function submitInOrder(operations) {
 let confirmed = 0;
 for (const operation of operations) {
  try { await operation(); confirmed++; }
  catch { return { status: 'submission_unconfirmed', confirmed }; }
 }
 return { status: 'queued', confirmed };
}

/** Ancillary writes must never change the reported outcome of a completed enqueue. */
export async function writeBestEffort(operations) {
 for (const operation of operations) { try { await operation(); } catch {} }
}
