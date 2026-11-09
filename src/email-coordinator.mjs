import { connect } from 'cloudflare:sockets';
import { sendSesEmail } from './ses-smtp.mjs';
import { EmailDispatchCore } from './email-queue-core.mjs';

export class EmailCoordinator {
  constructor(ctx,env) {
    const configured=Number(env.SES_MAX_MESSAGES_PER_SECOND ?? 10);
    this.core=new EmailDispatchCore({
      storage:ctx.storage,
      ratePerSecond:configured,
      send:message=>sendSesEmail({connect,env,...message})
    });
  }

  async fetch(request) {
    const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
    if(request.method!=='POST') return new Response(null,{status:405,headers:{...headers,allow:'POST'}});
    if(!/^application\\/json(?:\\s*;|$)/i.test(request.headers.get('content-type')||'')) {
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
