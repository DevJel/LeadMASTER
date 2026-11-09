/** Claim a soft-deleted inbound message before deleting its R2 object.
 * The persistent claim prevents restores while storage/database cleanup is
 * pending. Retrying after a partial failure is safe because R2 delete is
 * idempotent. The caller must enforce session, role and request origin first.
 */
export async function permanentlyDeleteInbound(db, bucket, id) {
  const claimed = await db.prepare(
    "UPDATE inbound_mail SET deletion_pending=1 WHERE id=? AND deleted_at IS NOT NULL RETURNING r2_key"
  ).bind(id).first();
  if (!claimed) return { deleted: false, reason: 'not_deleted' };
  try {
    await bucket.delete(claimed.r2_key);
    await db.prepare("DELETE FROM inbound_mail WHERE id=? AND deleted_at IS NOT NULL AND deletion_pending=1").bind(id).run();
    return { deleted: true };
  } catch {
    // Never clear the claim: an R2 delete might have succeeded before a
    // network or D1 failure. A retry must finish cleanup, not restore a row
    // pointing to an object that may already be gone.
    return { deleted: false, reason: 'retry' };
  }
}

export async function restoreInbound(db, id) {
  const result = await db.prepare(
    "UPDATE inbound_mail SET deleted_at=NULL WHERE id=? AND deleted_at IS NOT NULL AND deletion_pending=0"
  ).bind(id).run();
  return (result.meta?.changes || 0) > 0;
}
