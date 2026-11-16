/** Store incoming app@leadmaster.jelvan.space messages for the admin mailbox and dashboard. */
const RECIPIENT = "app@leadmaster.jelvan.space";
const ADMIN_FORWARD = "admin@work.jelvan.pro";
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

function decodeMimeWords(value) {
  return String(value || "").replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (whole, charset, encoding, payload) => {
    try {
      let bytes;
      if (encoding.toLowerCase() === "b") {
        const binary = atob(payload.replace(/\s/g, ""));
        bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
      } else {
        const normalized = payload.replace(/_/g, " ");
        const binary = normalized.replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
      }
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return whole;
    }
  });
}

function displayName(fromHeader) {
  const value = String(fromHeader || "");
  const match = value.match(/^\s*"?([^"<]*)"?\s*<[^>]+>\s*$/);
  return match ? decodeMimeWords(match[1]).trim().slice(0, 200) || null : null;
}

export async function receiveInboundEmail(message, env) {
  const recipient = String(message?.to || "").trim().toLowerCase();
  if (recipient !== RECIPIENT) {
    message?.setReject?.("This LeadMASTER mailbox address is not configured.");
    return;
  }
  if (!env?.AUTH_DB || !env?.INBOUND_MAIL) throw new Error("Mailbox storage is not configured");
  const sender = String(message?.from || "").trim().toLowerCase();
  if (!sender || sender.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
    message.setReject("A valid sender address is required.");
    return;
  }
  if (Number(message.rawSize || 0) > MAX_MESSAGE_BYTES) {
    message.setReject("This message exceeds the LeadMASTER mailbox size limit.");
    return;
  }

  // The raw stream is single-use. Buffer it once, then store the original MIME.
  const raw = await new Response(message.raw).arrayBuffer();
  if (!raw.byteLength || raw.byteLength > MAX_MESSAGE_BYTES) {
    message.setReject("This message is empty or exceeds the LeadMASTER mailbox size limit.");
    return;
  }

  const headers = message.headers;
  const fromHeader = headers?.get?.("from") || "";
  const subject = decodeMimeWords(headers?.get?.("subject") || "").replace(/[\r\n\0]/g, " ").trim().slice(0, 998);
  const messageId = String(headers?.get?.("message-id") || "").replace(/[\r\n\0]/g, "").slice(0, 998) || null;
  const id = crypto.randomUUID();
  const receivedAt = Date.now();
  const r2Key = "inbound/" + receivedAt + "/" + id + ".eml";

  await env.INBOUND_MAIL.put(r2Key, raw, {
    httpMetadata: { contentType: "message/rfc822" },
    customMetadata: { messageId: messageId || "", recipient: RECIPIENT }
  });

  try {
    await env.AUTH_DB.prepare(
      "INSERT INTO inbound_mail (id,from_address,to_address,subject,message_id,received_at,r2_key,size_bytes,delivery_status,parse_status,from_name) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(id, sender, RECIPIENT, subject, messageId, receivedAt, r2Key, raw.byteLength, "received", "raw_stored", displayName(fromHeader)).run();
  } catch (error) {
    try { await env.INBOUND_MAIL.delete(r2Key); } catch {}
    throw error;
  }

  // Preserve the original email in the verified owner mailbox as well as the
  // admin-only LeadMASTER inbox. A forwarding failure does not discard the
  // message already committed to the dashboard.
  try {
    await message.forward(ADMIN_FORWARD, new Headers({ "X-LeadMASTER-Original-Recipient": RECIPIENT }));
  } catch (error) {
    console.error("LEADMASTER_ADMIN_FORWARD_FAILED", String(error?.message || error).slice(0, 300));
  }
  return { id, stored: true };
}
