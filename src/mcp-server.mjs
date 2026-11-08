/** Experimental read-only MCP endpoint. It cannot enqueue or send email. */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod/v4';
import { validateEmailJob } from './email-queue-core.mjs';

const SECRET = /^[A-Za-z0-9_-]{43,128}$/;
const MAX_BODY = 100000;
const encoder = new TextEncoder();
const reply = (body, status, headers = {}) => Response.json(body, { status, headers: {'cache-control':'no-store','x-content-type-options':'nosniff',...headers} });
const text = value => ({ content: [{ type:'text', text:JSON.stringify(value) }] });

async function secretValue(binding) {
  try { const v=typeof binding?.get === 'function' ? await binding.get() : binding; return typeof v === 'string' && SECRET.test(v) ? v : null; } catch { return null; }
}
async function equalToken(a,b) {
  const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(a)),crypto.subtle.digest('SHA-256',encoder.encode(b))]);
  const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;
  for(let i=0;i<aa.length;i++) diff |= aa[i]^bb[i];
  return diff === 0;
}
async function boundedBody(request) {
  if(!request.body) throw new TypeError('Missing body');
  const reader=request.body.getReader(),chunks=[];let size=0;
  try { for (;;) {const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){try{await reader.cancel()}catch{};throw new RangeError('Too large')}chunks.push(value)} }
  finally {reader.releaseLock()}
  const bytes=new Uint8Array(size);let off=0;for(const chunk of chunks){bytes.set(chunk,off);off+=chunk.byteLength}
  return bytes;
}
function makeServer() {
  const server=new McpServer({name:'leadmaster',version:'0.1.0'});
  server.registerTool('get_email_capabilities',{
    title:'Get email integration capabilities',
    description:'Describe this MCP integration. This does not check live service health.',
    inputSchema:{}, annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  },async()=>text({mcp:'experimental',tools:['get_email_capabilities','validate_email'],sendAvailable:false,deliveryStatusAvailable:false,transport:'AWS SES SMTP (when configured)',note:'This endpoint cannot send, queue or check email. Availability requires a separate deployment and authorization.'}));
  server.registerTool('validate_email',{
    title:'Validate an email',
    description:'Check message shape against LeadMASTER queue rules without sending, saving or checking delivery.',
    inputSchema:{to:z.string().max(254),subject:z.string().max(300),text:z.string().max(100000),html:z.string().max(100000).optional()},
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
  },async ({to,subject,text:body,html})=>{
    const job={id:'mcp-validation',to,subject,text:body,...(html === undefined ? {} : {html})};
    try {validateEmailJob(job); if(encoder.encode(JSON.stringify(job)).length>100000) throw new Error('Too large');return text({valid:true,sent:false,note:'Format validation only; sender verification, consent, account quotas and delivery are not checked.'});}
    catch {return text({valid:false,sent:false,note:'The message does not meet LeadMASTER queue input requirements.'});}
  });
  return server;
}
/** This is deliberately opt-in and uses a separate random token, not SES or email API credentials. */
export async function handleMcp(request,env) {
  if(env?.MCP_EXPERIMENTAL_ENABLED !== 'true') return reply({error:'Service unavailable'},503);
  const expected=await secretValue(env.MCP_ACCESS_TOKEN);
  if(!expected) return reply({error:'Service unavailable'},503);
  const auth=/^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(request.headers.get('authorization')||'');
  if(!auth || !(await equalToken(auth[1],expected))) return reply({error:'Unauthorized'},401,{'www-authenticate':'Bearer'});
  // Browser requests must supply an explicitly allowed origin; never reflect arbitrary origins.
  const origin=request.headers.get('origin');
  if(origin && (!env.MCP_ALLOWED_ORIGIN || origin!==env.MCP_ALLOWED_ORIGIN)) return reply({error:'Forbidden'},403);
  if(request.method!=='POST') return reply({error:'Method not allowed'},405,{allow:'POST'});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'')) return reply({error:'Invalid request'},415);
  let bytes;try{bytes=await boundedBody(request)}catch(e){return reply({error:'Invalid request'},e instanceof RangeError?413:400)}
  try {
    const server=makeServer();
    const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    await server.connect(transport);
    const safeRequest=new Request(request.url,{method:'POST',headers:request.headers,body:bytes});
    const result=await transport.handleRequest(safeRequest);
    const headers=new Headers(result.headers);headers.set('cache-control','no-store');headers.set('x-content-type-options','nosniff');
    return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
  } catch {return reply({error:'Service unavailable'},503)}
}
