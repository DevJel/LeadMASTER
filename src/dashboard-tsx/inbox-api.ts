export type InboxRow={id:string;fromAddress:string;fromName:string;toAddress:string;subject:string;receivedAt:number|null;read:boolean};
export type InboxMessage=InboxRow & {textBody:string;attachments:number|null;sourceUrl:string|null};
const str=(x:unknown)=>typeof x==='string'?x:'';
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function row(value:unknown):InboxRow {if(!value||typeof value!=='object')throw Error('Invalid mailbox response');const v=value as Record<string,unknown>;if(typeof v.id!=='string'||!idPattern.test(v.id))throw Error('Invalid mailbox response');return {id:v.id,fromAddress:str(v.from_address),fromName:str(v.from_name),toAddress:str(v.to_address),subject:str(v.subject),receivedAt:typeof v.received_at==='number'&&Number.isFinite(v.received_at)?v.received_at:null,read:v.read_at!=null};}
export function inboxApi(fetcher:typeof fetch=fetch){
 async function get(path:string,signal?:AbortSignal):Promise<unknown>{const res=await fetcher(path,{credentials:'same-origin',cache:'no-store',signal});if(!res.ok)throw Error(res.status===401?'Your session has expired. Sign in again.':'Inbox is unavailable. Please try again.');try{return await res.json()}catch{throw Error('The Inbox response could not be read.')}}
 return {
  async list(query:string,signal?:AbortSignal){const params=new URLSearchParams({folder:'inbox'});if(query.trim())params.set('q',query.trim());const value=await get('/api/admin/mail?'+params,signal);if(!value||typeof value!=='object'||!Array.isArray((value as {items?:unknown}).items))throw Error('The Inbox response could not be read.');return ((value as {items:unknown[]}).items).map(row)},
  async message(id:string,signal?:AbortSignal):Promise<InboxMessage>{if(!idPattern.test(id))throw Error('Invalid message ID');const value=await get('/api/admin/mail/'+encodeURIComponent(id),signal);const base=row(value),v=value as Record<string,unknown>;if(base.id!==id)throw Error('The message response could not be verified.');const expected='/api/admin/mail/'+id+'/source';return {...base,textBody:str(v.text_body),attachments:typeof v.attachments==='number'&&Number.isInteger(v.attachments)&&v.attachments>=0?v.attachments:null,sourceUrl:v.download_url===expected?expected:null}}
 };
}
