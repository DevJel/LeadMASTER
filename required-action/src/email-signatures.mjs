const SIGNATURES = {
  "hello@work.jelvan.pro": {
    text: "\n\n—\nJelvan Ricolcol\nhello@work.jelvan.pro",
    html: '<div data-leadmaster-signature="jelvan" style="margin-top:24px;padding-top:14px;border-top:1px solid #d9dee7;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6"><strong style="color:#0f172a">Jelvan Ricolcol</strong><br><a href="mailto:hello@work.jelvan.pro" style="color:#2563eb;text-decoration:none">hello@work.jelvan.pro</a></div>'
  },
  "hello@operavaglobal.com": {
    text: "\n\n—\nOPERAVA Global Solutions\nOperate. Automate. Accelerate.\nhttps://www.operavaglobal.com\nhello@operavaglobal.com",
    html: '<div data-leadmaster-signature="operava" style="margin-top:24px;padding-top:14px;border-top:1px solid #d9dee7;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6"><strong style="color:#0f172a">OPERAVA Global Solutions</strong><br><span>Operate. Automate. Accelerate.</span><br><a href="https://www.operavaglobal.com" style="color:#2563eb;text-decoration:none">www.operavaglobal.com</a><br><a href="mailto:hello@operavaglobal.com" style="color:#2563eb;text-decoration:none">hello@operavaglobal.com</a></div>'
  }
};
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const textToHtml = value => '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937">' + escapeHtml(value).replace(/\r?\n/g,'<br>') + '</div>';
const htmlToText = value => String(value).replace(/<\s*br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
export function withSenderSignature(message) {
  const sender = String(message.fromEmail || '').trim().toLowerCase();
  const signature = SIGNATURES[sender];
  if (!signature) return message;
  const marker = sender === 'hello@work.jelvan.pro' ? 'data-leadmaster-signature="jelvan"' : 'data-leadmaster-signature="operava"';
  const currentHtml = typeof message.html === 'string' && message.html.trim() ? message.html : textToHtml(message.text || '');
  const currentText = typeof message.text === 'string' && message.text.trim() ? message.text : htmlToText(currentHtml);
  if (currentHtml.includes(marker) || currentText.includes(signature.text.trim())) return {...message, text:currentText, html:currentHtml};
  return {...message, text:currentText + signature.text, html:currentHtml + signature.html};
}
