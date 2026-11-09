/** Extract conservative ASCII mailbox addresses from arbitrary CSV or plain text. */
export function extractRecipientEmails(text){
 if(typeof text!=='string')throw new TypeError('Expected text');
 const candidate=/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/gi;
 const local=/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;
 const label=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
 const seen=new Set(),emails=[];
 for(const match of text.matchAll(candidate)){
  const before=match.index>0?text[match.index-1]:'';
  const end=match.index+match[0].length,after=text[end]||'';
  // Avoid extracting a misleading ASCII fragment from adjacent Unicode letters or numbers.
  if((before&&/[\p{L}\p{N}@]/u.test(before))||(after&&/[\p{L}\p{N}@_-]/u.test(after)))continue;
  const value=match[0].replace(/\.+$/,'').toLowerCase();
  const at=value.lastIndexOf('@'),user=value.slice(0,at),host=value.slice(at+1),parts=host.split('.');
  if(value.length>254||user.length>64||!local.test(user)||parts.length<2||parts.some(x=>!label.test(x))||!/[a-z]/i.test(parts.at(-1)))continue;
  if(!seen.has(value)){seen.add(value);emails.push(value)}
 }
 return emails;
}
