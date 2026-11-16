/** Stream a JSON request with a strict byte cap before parsing. */
export async function readBoundedJson(request,max){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))throw Error('content-type');
 if(Number(request.headers.get('content-length')||0)>max||!request.body)throw Error('large or empty');
 const reader=request.body.getReader();let size=0,parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('large')}parts.push(value)}
 const merged=new Uint8Array(size);let at=0;for(const part of parts){merged.set(part,at);at+=part.length}
 const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(merged));
 if(!result||typeof result!=='object'||Array.isArray(result))throw Error('invalid');
 return result;
}
