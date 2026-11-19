const sequences = {
  receive: [660, 880, 1040],
  sent: [660, 990],
  deleted: [520, 390]
};

export function createMailSoundPlayer() {
  let context = null;
  let closed = false;
  function unlock() {
    if (closed) return;
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      if (!context) context = new Audio();
      if (context.state === 'suspended') void context.resume?.();
    } catch { /* Audio is optional; mail actions must never depend on it. */ }
  }
  function play(kind) {
    if (closed || !context || !sequences[kind]) return;
    try {
      const now = context.currentTime || 0;
      sequences[kind].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.105);
        gain.gain.exponentialRampToValueAtTime(0.035, now + index * 0.105 + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.105 + 0.13);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + index * 0.105);
        oscillator.stop(now + index * 0.105 + 0.14);
      });
    } catch { /* Audio playback is best-effort. */ }
  }
  function close() {
    closed = true;
    try { void context?.close?.(); } catch { /* Ignore browser audio shutdown errors. */ }
    context = null;
  }
  return { unlock, play, close };
}

export function createMailSoundTracker() {
  let initialized = false;
  const inboxIds = new Set();
  const sentStates = new Map();
  return function track(inbox = [], sent = []) {
    const events = [];
    if (!initialized) {
      initialized = true;
      for (const item of inbox) if (item?.id) inboxIds.add(item.id);
      for (const item of sent) if (item?.id) sentStates.set(item.id, String(item.delivery_status || item.status || item.queue_status || '').toLowerCase());
      return events;
    }
    for (const item of inbox) {
      if (!item?.id || inboxIds.has(item.id)) continue;
      inboxIds.add(item.id);
      events.push('receive');
    }
    for (const item of sent) {
      if (!item?.id) continue;
      const state = String(item.delivery_status || item.status || item.queue_status || '').toLowerCase();
      const previous = sentStates.get(item.id);
      if (['accepted', 'delivered'].includes(state) && previous !== state && !['accepted', 'delivered'].includes(previous || '')) events.push('sent');
      sentStates.set(item.id, state);
    }
    return events;
  };
}
