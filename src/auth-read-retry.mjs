// Retry only read-only authentication dependencies. Never use this for OTP
// attempts, challenge consumption, session writes, or email delivery.
export async function readAuthDependency(read, {deadline, accept = () => true, attempts = 3, perAttemptMs = 1200, delays = [100,200]} = {}) {
  let lastError = new Error('Authentication dependency unavailable');
  for (let index=0; index<attempts; index++) {
    const remaining=deadline-Date.now();
    if (remaining<=0) break;
    let timer;
    try {
      const value=await Promise.race([
        Promise.resolve().then(read),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Authentication read timed out')),Math.min(perAttemptMs,remaining));})
      ]);
      if (accept(value)) return value;
    } catch (error) { lastError=error; }
    finally {clearTimeout(timer);}
    const delay=Math.min(delays[index] || 0,Math.max(0,deadline-Date.now()));
    if(index+1<attempts && delay>0) await new Promise(resolve=>setTimeout(resolve,delay));
  }
  throw lastError;
}
