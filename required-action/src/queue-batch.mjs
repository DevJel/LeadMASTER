/** Process queue messages using an internal coordinator binding. */
export async function consumeEmailBatch(batch,stub) {
  for (const message of batch.messages) {
    try {
      const response=await stub.fetch('https://coordinator.invalid/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(message.body)});
      if(!response.ok){message.retry({delaySeconds:60});continue;}
      const {status,retryAfterSeconds}=await response.json();
      if(status==='accepted'||status==='failed'||status==='unknown'||status==='id_conflict') message.ack();
      else if(status==='deferred_quota' && Number.isInteger(retryAfterSeconds) && retryAfterSeconds>=1 && retryAfterSeconds<=86400) message.retry({delaySeconds:retryAfterSeconds});
      else message.retry({delaySeconds:60});
    } catch {message.retry({delaySeconds:60});}
  }
}
