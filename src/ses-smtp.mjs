/** SES SMTP transport for a Cloudflare Worker. No HTTP handler is exported.
 * Caller must enforce authentication, sender authorization, rate limits and
 * durable send-state/idempotency before invoking this module.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const HOST = /^email-smtp\.[a-z0-9-]+\.amazonaws\.com$/;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const utf8b64 = (s) => {
  const bytes = encoder.encode(s);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
const wrap = (s) => s.match(/.{1,76}/g)?.join('\r\n') ?? '';
function mailbox(value) {
  if (typeof value !== 'string' || value.length > 254 || !EMAIL.test(value) || value.includes('..')) throw new TypeError('Invalid email address');
  return value;
}
function buildMessage({ from, fromName, replyTo, configurationSet, to, subject, text, html }) {
  mailbox(from); mailbox(to);
  if (fromName !== undefined && (typeof fromName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 .'-]{0,63}$/.test(fromName))) throw new TypeError('Invalid sender name');
  const fromHeader = fromName ? `${fromName} <${from}>` : from;
  if (typeof subject !== 'string' || !subject.trim() || /[\r\n\x00-\x1f\x7f]/.test(subject) || encoder.encode(subject).length > 300) throw new TypeError('Invalid subject');
  if (typeof text !== 'string' || !text.trim() || encoder.encode(text).length > 200000) throw new TypeError('Invalid message body');
  if (html !== undefined && (typeof html !== 'string' || !html.trim() || encoder.encode(html).length > 200000)) throw new TypeError('Invalid HTML body');
  // UTF-8 base64 avoids SMTP dot-stuffing and keeps transfer lines short.
  // Split encoded words to avoid RFC 2047's 75-character limit.
  const chars = Array.from(subject); const words = []; let chunk = '';
  for (const char of chars) {
    if (encoder.encode(chunk + char).length > 39) { words.push(chunk); chunk = ''; }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  const encodedSubject = words.map(word => `=?UTF-8?B?${utf8b64(word)}?=`).join('\r\n ');
  const headers = [`From: ${fromHeader}`, `To: ${to}`, ...(replyTo ? [`Reply-To: ${mailbox(replyTo)}`] : []), ...(configurationSet ? [`X-SES-CONFIGURATION-SET: ${configurationSet}`] : []), `Subject: ${encodedSubject}`, 'MIME-Version: 1.0'];
  if (html === undefined) return [...headers, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(text)), ''].join('\r\n');
  // The body is base64 encoded; a random boundary cannot occur in a body line.
  const boundary = 'leadmaster-' + crypto.randomUUID();
  return [...headers, `Content-Type: multipart/alternative; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(text)), `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(html)), `--${boundary}--`, ''].join('\r\n');
}
class ReplyReader {
  constructor(reader) { this.reader = reader; this.buffer = ''; }
  async reply() {
    const lines = []; let code;
    for (;;) {
      let i = this.buffer.indexOf('\r\n');
      while (i < 0) {
        const result = await this.reader.read();
        if (result.done) throw new Error('SMTP connection closed');
        this.buffer += decoder.decode(result.value, { stream: true });
        if (this.buffer.length > 16384) throw new Error('SMTP response too large');
        i = this.buffer.indexOf('\r\n');
      }
      const line = this.buffer.slice(0, i); this.buffer = this.buffer.slice(i + 2);
      const m = /^(\d{3})([ -])/.exec(line);
      if (!m || (code && code !== m[1]) || lines.length >= 100) throw new Error('Invalid SMTP response');
      code = m[1]; lines.push(line);
      if (m[2] === ' ') return Number(code);
    }
  }
}
async function secret(value) {
  const result = typeof value?.get === 'function' ? await value.get() : value;
  if (typeof result !== 'string' || !result || /[\r\n\x00-\x1f\x7f]/.test(result) || encoder.encode(result).length > 512) throw new Error('SMTP configuration unavailable');
  return result;
}
/**
 * connect: Cloudflare sockets connect() supplied by caller.
 * env: SES_SMTP_HOST, SES_SMTP_USERNAME, SES_SMTP_PASSWORD, SES_FROM_EMAIL.
 * Returns accepted only after SES responds 250 to DATA. 'unknown' errors mean
 * delivery may have occurred: caller MUST reconcile and must not blindly retry.
 */
export async function sendSesEmail({ connect, env, to, subject, text, html, fromName, fromEmail, replyTo, timeoutMs = 15000 }) {
  if (!env || typeof connect !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) throw new Error('SMTP configuration unavailable');
  const from = mailbox(fromEmail || env.SES_FROM_EMAIL); const configurationSet = typeof env.SES_CONFIGURATION_SET === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(env.SES_CONFIGURATION_SET) ? env.SES_CONFIGURATION_SET : undefined; const message = buildMessage({ from, fromName, replyTo, configurationSet, to, subject, text, html });
  const [host, username, password] = await Promise.all([secret(env.SES_SMTP_HOST), secret(env.SES_SMTP_USERNAME), secret(env.SES_SMTP_PASSWORD)]);
  if (!HOST.test(host)) throw new Error('SMTP configuration unavailable');
  let socket; let timer; let dataSent = false; let accepted = false;
  try {
    socket = connect({ hostname: host, port: 465 }, { secureTransport: 'on' });
    const run = async () => {
      await socket.opened;
      const reader = socket.readable.getReader(); const writer = socket.writable.getWriter(); const replies = new ReplyReader(reader);
      async function expect(allowed) { const code = await replies.reply(); if (!allowed.includes(code)) throw new Error('SMTP request rejected'); }
      async function command(value, allowed) { await writer.write(encoder.encode(value + '\r\n')); await expect(allowed); }
      await expect([220]);
      await command('EHLO leadmaster.local', [250]);
      await command('AUTH PLAIN ' + utf8b64('\0' + username + '\0' + password), [235]);
      await command(`MAIL FROM:<${from}>`, [250]);
      await command(`RCPT TO:<${to}>`, [250,251]);
      await command('DATA', [354]);
      // A timeout or disconnect from this point is an ambiguous delivery.
      dataSent = true;
      await writer.write(encoder.encode(message + '.\r\n'));
      await expect([250]); accepted = true;
      return { status: 'accepted' };
    };
    return await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SMTP request timed out')), timeoutMs); })]);
  } catch (error) {
    const result = new Error(dataSent && !accepted ? 'SMTP delivery outcome unknown' : 'SMTP delivery failed');
    result.deliveryOutcome = dataSent && !accepted ? 'unknown' : 'not_accepted';
    throw result;
  } finally {
    clearTimeout(timer);
    try { await socket?.close(); } catch { /* The connection may already be closed. */ }
  }
}
