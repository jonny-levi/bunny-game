// Simple Web Audio tone generator for placeholder sounds
let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function isMuted(): boolean { return muted; }
export function toggleMute(): boolean { muted = !muted; return muted; }

export function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.15) {
  if (muted) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* ignore */ }
}

export function playFeed() { playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 100); }
export function playClean() { playTone(800, 0.05, 'sine'); setTimeout(() => playTone(1000, 0.05, 'sine'), 80); }
export function playPlay() { playTone(440, 0.08); setTimeout(() => playTone(554, 0.08), 80); setTimeout(() => playTone(659, 0.12), 160); }
export function playSleep() { playTone(220, 0.3, 'sine', 0.08); }
export function playMedicine() { playTone(330, 0.15, 'triangle'); }
export function playBreed() { playTone(440, 0.1, 'sine'); setTimeout(() => playTone(660, 0.15, 'sine'), 120); }
export function playClick() { playTone(1000, 0.03, 'square', 0.1); }
export function playAlert() { playTone(440, 0.2); setTimeout(() => playTone(330, 0.3), 200); }

// Simple background music loop
let bgInterval: number | null = null;
export function startBGMusic() {
  if (bgInterval) return;
  const notes = [262, 294, 330, 349, 330, 294, 262, 247];
  let i = 0;
  bgInterval = window.setInterval(() => {
    if (!muted) playTone(notes[i % notes.length], 0.15, 'triangle', 0.04);
    i++;
  }, 500);
}
export function stopBGMusic() {
  if (bgInterval) { clearInterval(bgInterval); bgInterval = null; }
}
