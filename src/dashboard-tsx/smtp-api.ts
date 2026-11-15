// Same-origin client for the staged SMTP settings API. No secrets are persisted
// in browser storage and mutating requests are never retried automatically.
export type SmtpConfig = {name:string;email:string;server:string;username:string;password:string;port:465|587;security:'tls'|'starttls'};
export type SmtpConnection = {id:string;name:string;email:string;server:string;port:number;security:string;revision:number;verification_status:'verified'|'unverified'};
export type Activity = {counts:{queued:number;accepted:number;failed:number;unknown:number};items:{message_id:string;status:'queued'|'accepted'|'failed'|'unknown';created_at:number;updated_at:number}[];next:{createdAt:number;messageId:string}|null};
export class SmtpApiError extends Error { uncertain:boolean; constructor(message:string,uncertain=false){super(message);this.uncertain=uncertain} }
export function smtpApi(fetcher:typeof fetch=fetch){
 const path=(id:string)=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Invalid connection');return '/api/admin/smtp/'+encodeURIComponent(id)};
 async function request<T>(url:string,method='GET',body?:unknown):Promise<T>{
  let response:Response;try{response=await fetcher(url,{method,credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})})}catch{throw new SmtpApiError('The request could not be confirmed. Refresh before trying again.',method!=='GET')}
  let data:any;try{data=await response.json()}catch{throw new SmtpApiError('The response could not be read. Refresh before trying again.',method!=='GET')}
  if(!response.ok)throw new SmtpApiError(typeof data?.error==='string'?data.error:'The request failed.',method!=='GET'&&response.status>=500);
  return data as T;
 }
 return {
  list:()=>request<{connections:SmtpConnection[]}>('/api/admin/smtp'),
  create:(config:SmtpConfig)=>request<{id:string;revision:number;verification_status:string}>('/api/admin/smtp','POST',{config}),
  replace:(id:string,revision:number,config:SmtpConfig)=>request(path(id),'PUT',{revision,config}),
  revoke:(id:string,revision:number)=>request(path(id),'DELETE',{revision}),
  activity:(id:string,cursor?:{createdAt:number;messageId:string})=>{const q=new URLSearchParams({limit:'50'});if(cursor){q.set('before_time',String(cursor.createdAt));q.set('before_id',cursor.messageId)}return request<Activity>(path(id)+'/activity?'+q)},
 };
}
export type SmtpApi = ReturnType<typeof smtpApi>;
