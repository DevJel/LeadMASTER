/** Cloudflare Queue / Durable Object adapter; not a public enqueue endpoint. */
import { connect } from 'cloudflare:sockets';
import { sendSesEmail } from './ses-smtp.mjs';
import { EmailDispatchCore } from './email-queue-core.mjs';
import { consumeEmailBatch } from './queue-batch.mjs';
import { routeHttp } from './http-router.mjs';
export class EmailCoordinator {
  constructor(ctx,env) {
    // Require an explicit quota no greater than the verified SES limit.
    const configured=Number(env.SES_MAX_MESSAGES_PER_SECOND);
    this.core=new EmailDispatchCore({storage:ctx.storage,ratePerSecond:configured,maxPer24h:Number(env.SES_MAX_MESSAGES_PER_DAY),send:message=>sendSesEmail({connect,env,...message})});
  }
  async fetch(request) {
    if(request.method!=='POST')return new Response(null,{status:405});
    try {
      // Only an internal Durable Object binding should reach this handler.
      const job=await request.json();const result=await this.core.dispatch(job);
      return Response.json(result,{headers:{'cache-control':'no-store'}});
    } catch {return Response.json({status:'unavailable'},{status:503,headers:{'cache-control':'no-store'}});}
  }
}
export default {
  async fetch(request,env) { return routeHttp(request,env); },
  async queue(batch,env) {
    // One fixed identity coordinates all LeadMASTER email for the configured
    // SES account and region. Do not create a second sending path.
    const stub=env.EMAIL_COORDINATOR.get(env.EMAIL_COORDINATOR.idFromName('ses-global'));
    await consumeEmailBatch(batch,stub);
  }
};
