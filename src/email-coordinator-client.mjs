function deliveryError(message,outcome) {
  const error=new Error(message);
  error.deliveryOutcome=outcome;
  return error;
}

/** Send only through the single LeadMASTER SES coordinator; never fall back to SMTP locally. */
export async function sendThroughEmailCoordinator(env,options) {
  const binding=env?.EMAIL_COORDINATOR;
  if(!binding || typeof binding.idFromName!=='function' || typeof binding.get!=='function') {
    throw deliveryError('Email coordinator is unavailable','not_accepted');
  }
  const id=options.id || options.messageId || crypto.randomUUID();
  const job={
    id,
    to:options.to,
    subject:options.subject,
    text:options.text,
    ...(options.html===undefined||options.html===null||options.html===''?{}:{html:options.html}),
    ...(typeof options.fromEmail==='string' && options.fromEmail ? {fromEmail:options.fromEmail} : {}),
    ...(typeof options.fromName==='string' && options.fromName ? {fromName:options.fromName} : {}),
    ...(typeof options.replyTo==='string' && options.replyTo ? {replyTo:options.replyTo} : {}),
    messageId:options.messageId || id
  };
  try {
    const stub=binding.get(binding.idFromName('ses-global'));
    const response=await stub.fetch('https://email-coordinator.internal/send',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(job)
    });
    let result;
    try { result=await response.json(); } catch { throw deliveryError('Email submission result is unknown','unknown'); }
    if(!response.ok) {
      throw deliveryError('Email submission result is unknown','unknown');
    }
    if(result?.status==='accepted') return result;
    if(result?.status==='failed') throw deliveryError('Email was not accepted by the sending service','not_accepted');
    if(result?.status==='deferred_quota' || result?.status==='blocked_clock') {
      const error=deliveryError('Email submission is temporarily unavailable','not_accepted');
      error.retryAfterSeconds=result.retryAfterSeconds;
      throw error;
    }
    throw deliveryError('Email submission result is unknown','unknown');
  } catch(error) {
    if(error?.deliveryOutcome) throw error;
    throw deliveryError('Email submission result is unknown','unknown');
  }
}
