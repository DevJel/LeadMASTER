import { connect } from 'cloudflare:sockets';
import { sendSesEmail } from './ses-smtp.mjs';
import { withSenderSignature } from './email-signatures.mjs';
import { EmailDispatchCore } from './email-queue-core.mjs';

export class EmailCoordinator {
  constructor(ctx,env) {
    this.env=env;
    const configured=Number(env.SES_MAX_MESSAGES_PER_SECOND ?? 10);
    this.core=new EmailDispatchCore({
      storage:ctx.storage,
      ratePerSecond:configured,
      send:message=>sendSesEmail({connect,env,...withSenderSignature(message)})
    });
  }

  async fetch(request) {
    const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/health') {
      const read=async binding=>{try{const value=typeof binding?.get==='function'?await binding.get():binding;return typeof value==='string'&&value.trim().length>0;}catch{return false;}};
      const [host,username,password]=await Promise.all([read(this.env.SES_SMTP_HOST),read(this.env.SES_SMTP_USERNAME),read(this.env.SES_SMTP_PASSWORD)]);
      const from=typeof this.env.SES_FROM_EMAIL==='string'&&/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(this.env.SES_FROM_EMAIL.trim());
      const healthy=host&&username&&password&&from;
      return Response.json({status:healthy?'healthy':'misconfigured',smtpConfigured:host&&username&&password,fromConfigured:from},{status:healthy?200:503,headers});
    }
    if(request.method!=='POST') return new Response(null,{status:405,headers:{...headers,allow:'POST'}});
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'')) {
      return Response.json({status:'invalid_request'},{status:415,headers});
    }
    const length=Number(request.headers.get('content-length')||0);
    if(length>300000) return Response.json({status:'invalid_request'},{status:413,headers});
    try {
      const text=await request.text();
      if(new TextEncoder().encode(text).byteLength>300000) return Response.json({status:'invalid_request'},{status:413,headers});
      const job=JSON.parse(text);
      const result=await this.core.dispatch(job);
      return Response.json(result,{headers});
    } catch(error) {
      if(error instanceof SyntaxError || error instanceof TypeError) {
        return Response.json({status:'invalid_request'},{status:400,headers});
      }
      return Response.json({status:'unavailable'},{status:503,headers});
    }
  }
}
