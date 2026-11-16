// Foreground-only mail cues. Snapshots are authenticated server responses, not
// queue acknowledgements. Never store message contents or identifiers persistently.
export function createMailSoundTracker(clock = Date.now) {
  let ready = false, since = 0;
  const inboxSeen = new Set(), acceptedSeen = new Set(), previousSent = new Map();
  const timestamp = value => typeof value === 'number' ? value : Date.parse(value || '') || 0;
  const remember = (set, id) => { set.add(id); if (set.size > 2000) set.delete(set.values().next().value); };
  return (inbox, sent) => {
    const events = new Set();
    if (!ready) since = clock();
    for (const row of inbox) {
      if (!row || typeof row.id !== 'string') continue;
      if (ready && !inboxSeen.has(row.id) && timestamp(row.received_at) >= since) events.add('receive');
      remember(inboxSeen,row.id);
    }
    for (const row of sent) {
      if (!row || typeof row.id !== 'string') continue;
      const accepted = row.status === 'accepted';
      const wasKnown = previousSent.has(row.id);
      if (ready && accepted && !acceptedSeen.has(row.id) && ((wasKnown && previousSent.get(row.id) !== 'accepted') || (!wasKnown && timestamp(row.created_at) >= since))) events.add('sent');
      if (accepted) remember(acceptedSeen,row.id);
      previousSent.set(row.id,row.status);
    }
    // Keep only the current server window; seen sets prevent duplicate cues on re-entry.
    const current = new Set(sent.map(row => row?.id));
    for (const id of previousSent.keys()) if (!current.has(id)) previousSent.delete(id);
    ready = true;
    return [...events];
  };
}

export function createMailSoundPlayer() {
  let context = null;
  const patterns = { receive: [[660,0],[880,.11],[1040,.22]], sent: [[660,0],[990,.12]], deleted: [[520,0],[390,.11]] };
  function unlock() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context ||= new Audio();
      if (context.state === 'suspended') void context.resume().catch(()=>{});
    } catch {}
  }
  function play(type) {
    if (!context || context.state !== 'running' || !patterns[type] || document.visibilityState !== 'visible') return;
    try {
      for (const [frequency, delay] of patterns[type]) {
        const oscillator=context.createOscillator(), gain=context.createGain(), start=context.currentTime+delay;
        oscillator.type='sine'; oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(.0001,start); gain.gain.exponentialRampToValueAtTime(.045,start+.015); gain.gain.exponentialRampToValueAtTime(.0001,start+.13);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start+.15);
      }
    } catch {}
  }
  function close(){if(context){void context.close().catch(()=>{});context=null;}}
  return {unlock,play,close};
}
