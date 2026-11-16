import { withTursoDatabase } from '../src/turso-database.mjs';

const RECIPIENT = "app@leadmaster.jelvan.space";
const ADMIN_FORWARD = "admin@work.jelvan.pro";
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

function clean(value, max = 998) {
  return String(value || "").replace(/[\r\n\x00-\x1f\x7f]/g, " ").trim().slice(0, max);
}
function decodeMimeWords(value) {
  return String(value || "").replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (whole, charset, encoding, payload) => {
    try {
      const binary = encoding.toLowerCase() === "b"
        ? atob(payload.replace(/\s/g, ""))
        : payload.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      return new TextDecoder(charset).decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
    } catch { return whole; }
  });
}
function parseDisplayName(value) {
  const match = String(value || "").match(/^\s*"?([^"<]*)"?\s*<[^>]+>\s*$/);
  return match ? decodeMimeWords(match[1]).trim().slice(0, 200) || null : null;
}

export default {
  async email(message, env) {
    env = await withTursoDatabase(env);
    const recipient = clean(message?.to, 254).toLowerCase();
    if (recipient !== RECIPIENT) {
      message.setReject("This LeadMASTER mailbox address is not configured.");
      return;
    }
    if (!env?.AUTH_DB || !env?.INBOUND_MAIL) throw new Error("Mailbox storage is not configured");

    const sender = clean(message?.from, 254).toLowerCase();
    if (!sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
      message.setReject("A valid sender address is required.");
      return;
    }
    if (Number(message.rawSize || 0) > MAX_MESSAGE_BYTES) {
      message.setReject("This message exceeds the LeadMASTER mailbox size limit.");
      return;
    }

    const raw = await new Response(message.raw).arrayBuffer();
    if (!raw.byteLength || raw.byteLength > MAX_MESSAGE_BYTES) {
      message.setReject("This message is empty or exceeds the LeadMASTER mailbox size limit.");
      return;
    }

    const headers = message.headers;
    const fromHeader = clean(headers?.get?.("from") || "", 998);
    const subject = decodeMimeWords(clean(headers?.get?.("subject") || "", 998)).slice(0, 998);
    const messageId = clean(headers?.get?.("message-id") || "", 998) || null;
    const existing = messageId
      ? await env.AUTH_DB.prepare("SELECT id FROM inbound_mail WHERE message_id=? AND to_address=? LIMIT 1").bind(messageId, RECIPIENT).first()
      : null;

    if (!existing) {
      const id = crypto.randomUUID();
      const receivedAt = Date.now();
      const r2Key = "inbound/" + receivedAt + "/" + id + ".eml";
      await env.INBOUND_MAIL.put(r2Key, raw, {
        httpMetadata: { contentType: "message/rfc822" },
        customMetadata: { messageId: messageId || "", recipient: RECIPIENT }
      });

      try {
        await env.AUTH_DB.batch([
          env.AUTH_DB.prepare(
            "INSERT INTO inbound_mail (id,from_address,to_address,subject,message_id,received_at,r2_key,size_bytes,delivery_status,parse_status,from_name) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
          ).bind(id, sender, RECIPIENT, subject, messageId, receivedAt, r2Key, raw.byteLength, "received", "raw_stored", parseDisplayName(fromHeader)),
          env.AUTH_DB.prepare(
            "INSERT INTO workspace_activity (id,actor_email,action,summary,target_id,created_at) VALUES (?,?,'email_received',?,?,?)"
          ).bind(crypto.randomUUID(), "system", "Received a new email from " + sender, id, receivedAt),
          env.AUTH_DB.prepare(
            "INSERT INTO mail_notifications (id,type,title,message,target_id,created_at) VALUES (?,'received','New email received',?,?,?)"
          ).bind(crypto.randomUUID(), "New message from " + sender, id, receivedAt)
        ]);
      } catch (error) {
        try { await env.INBOUND_MAIL.delete(r2Key); } catch {}
        throw error;
      }
    }

    // Keep the admin's verified mailbox and the admin-only dashboard in sync.
    // A forwarding error must not discard the successfully stored dashboard copy.
    try {
      await message.forward(ADMIN_FORWARD, new Headers({ "X-LeadMASTER-Original-Recipient": RECIPIENT }));
    } catch (error) {
      console.error("LEADMASTER_ADMIN_FORWARD_FAILED", String(error?.message || error).slice(0, 300));
    }
  },

  async fetch() {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
};
