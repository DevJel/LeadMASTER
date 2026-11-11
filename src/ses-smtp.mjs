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
function mailboxList(value,label,max=100) {
  const list=Array.isArray(value)?value:[value];
  if(!list.length||list.length>max)throw new TypeError('Invalid '+label+' addresses');
  return [...new Set(list.map(mailbox))];
}
function buildMessage({ from, fromName, replyTo, configurationSet, messageId, to, cc, subject, text, html }) {
  mailbox(from);
  const toList=mailboxList(to,'To',500),ccList=cc===undefined?[]:mailboxList(cc,'CC',100);
  if (fromName !== undefined && (typeof fromName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 .'-]{0,63}$/.test(fromName))) throw new TypeError('Invalid sender name');
  const fromHeader = fromName ? `${fromName} <${from}>` : from;
  if (typeof subject !== 'string' || !subject.trim() || /[\r\n\x00-\x1f\x7f]/.test(subject) || encoder.encode(subject).length > 300) throw new TypeError('Invalid subject');
  const hasText = typeof text === 'string' && Boolean(text.trim());
  const hasHtml = typeof html === 'string' && Boolean(html.trim());
  if (!hasText && !hasHtml) throw new TypeError('Add a text or HTML message body');
  if (text !== undefined && (typeof text !== 'string' || encoder.encode(text).length > 200000)) throw new TypeError('Invalid text body');
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
  const headers = [`From: ${fromHeader}`, `To: ${toList.join(', ')}`, ...(ccList.length ? [`Cc: ${ccList.join(', ')}`] : []), ...(replyTo ? [`Reply-To: ${mailbox(replyTo)}`] : []), ...(messageId && /^[0-9a-f-]{36}$/i.test(messageId) ? [`X-LeadMASTER-Message-ID: ${messageId}`, `X-SES-MESSAGE-TAGS: leadmaster_message_id=${messageId}`] : []), ...(configurationSet ? [`X-SES-CONFIGURATION-SET: ${configurationSet}`] : []), `Subject: ${encodedSubject}`, 'MIME-Version: 1.0'];
  if (!hasHtml) return [...headers, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(text)), ''].join('\r\n');
  if (!hasText) return [...headers, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(utf8b64(html)), ''].join('\r\n');
  // When both versions are supplied, use multipart/alternative.
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
export async function sendSesEmail({ connect, env, to, cc, bcc, subject, text, html, fromName, fromEmail, replyTo, messageId, timeoutMs = 15000, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!env || typeof connect !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) throw new Error('SMTP configuration unavailable');
  const from = mailbox(fromEmail || env.SES_FROM_EMAIL);
  const toList=mailboxList(to,'To',1000);
  const toSet=new Set(toList);
  const ccList=(cc===undefined?[]:mailboxList(cc,'CC',1000)).filter(x=>!toSet.has(x));
  const copySet=new Set([...toSet,...ccList]);
  const bccList=(bcc===undefined?[]:mailboxList(bcc,'BCC',1000)).filter(x=>!copySet.has(x));
  const allRecipients=[...toList,...ccList,...bccList];
  if(!toList.length||allRecipients.length>1000)throw new TypeError('A send must contain 1 to 1,000 unique recipients');
  if(ccList.length+bccList.length>=50)throw new TypeError('CC and BCC must total fewer than 50 recipients when To recipients are present');
  const firstToCapacity=10-ccList.length-bccList.length;
  if(firstToCapacity<1)throw new TypeError('CC and BCC must total fewer than 10 recipients when To recipients are present');
  const chunks=[];
  chunks.push(toList.slice(0,firstToCapacity));
  for(let i=firstToCapacity;i<toList.length;i+=10)chunks.push(toList.slice(i,i+10));
  const configurationSet = typeof env.SES_CONFIGURATION_SET === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(env.SES_CONFIGURATION_SET) ? env.SES_CONFIGURATION_SET : undefined;
  const messages=chunks.map((chunk,i)=>buildMessage({from,fromName,replyTo,configurationSet,messageId:chunks.length>1&&messageId?messageId+'-'+(i+1):messageId,to:chunk,cc:i===0&&ccList.length?ccList:undefined,subject,text,html}));

  const [host, username, password] = await Promise.all([secret(env.SES_SMTP_HOST), secret(env.SES_SMTP_USERNAME), secret(env.SES_SMTP_PASSWORD)]);
  if (!HOST.test(host)) throw new Error('SMTP configuration unavailable');
  let socket; let timer; let dataSent = false; let accepted = false;
  try {
    socket = connect({ hostname: host, port: 587 }, { secureTransport: 'starttls' });
    const run = async () => {
      await socket.opened;
      let reader = socket.readable.getReader();
      let writer = socket.writable.getWriter();
      let replies = new ReplyReader(reader);
      async function expect(allowed) { const code = await replies.reply(); if (!allowed.includes(code)) throw new Error('SMTP request rejected'); }
      async function command(value, allowed) { await writer.write(encoder.encode(value + '\r\n')); await expect(allowed); }
      await expect([220]);
      await command('EHLO leadmaster.local', [250]);
      await command('STARTTLS', [220]);
      reader.releaseLock(); writer.releaseLock();
      socket = socket.startTls();
      await socket.opened;
      reader = socket.readable.getReader(); writer = socket.writable.getWriter(); replies = new ReplyReader(reader);
      await command('EHLO leadmaster.local', [250]);
      await command('AUTH PLAIN ' + utf8b64('\0' + username + '\0' + password), [235]);
      for(let i=0;i<chunks.length;i++){
        const chunk=chunks[i],isFirst=i===0;
        const envelope=[...chunk,...(isFirst?ccList:[]),...(isFirst?bccList:[])];
        const message=messages[i];
        await command(`MAIL FROM:<${from}>`,[250]);
        for(const recipient of envelope)await command(`RCPT TO:<${recipient}>`,[250,251]);
        await command('DATA',[354]);
        dataSent=true;
        await writer.write(encoder.encode(message+'.\r\n'));
        await expect([250]);accepted=true;
        if(i<chunks.length-1)await sleep(1000);
      }
      return {status:'accepted'};
    };
    return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('SMTP request timed out')),timeoutMs);})]);
  } catch(error) {
    const result=new Error(dataSent&&!accepted?'SMTP delivery outcome unknown':'SMTP delivery failed');
    result.deliveryOutcome=dataSent&&!accepted?'unknown':'not_accepted';
    throw result;
  } finally {
    clearTimeout(timer);
    try{await socket?.close();}catch{/* The socket may already be closed. */}
  }
}
