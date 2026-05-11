let audioCtx: AudioContext | null = null;

const MUTE_KEY = 'bunny:audio-muted';
const VOLUME_KEY = 'bunny:audio-volume';
export type AudioVolume = 0 | 0.4 | 1;

let volume: AudioVolume = readVolumePreference();
let muted = readMutedPreference() || volume === 0;

function readMutedPreference(): boolean {
  try { return window.localStorage.getItem(MUTE_KEY) === 'true'; } catch { return false; }
}

function readVolumePreference(): AudioVolume {
  try {
    const stored = window.localStorage.getItem(VOLUME_KEY);
    if (stored === '0') return 0;
    if (stored === '0.4') return 0.4;
    if (stored === '1') return 1;
  } catch { /* ignore */ }
  return readMutedPreference() ? 0 : 1;
}

function writeAudioPreference() {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  } catch { /* ignore */ }
}

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

export function isMuted(): boolean { return muted || volume === 0; }
export function getVolume(): AudioVolume { return isMuted() ? 0 : volume; }
export function getVolumeLabel(): string {
  const current = getVolume();
  if (current === 0) return 'Muted';
  if (current === 0.4) return 'Quiet';
  return 'On';
}
export function setVolume(next: AudioVolume): AudioVolume {
  volume = next;
  muted = next === 0;
  writeAudioPreference();
  return getVolume();
}
export function cycleVolume(): AudioVolume {
  const current = getVolume();
  return setVolume(current === 1 ? 0.4 : current === 0.4 ? 0 : 1);
}
export function toggleMute(): boolean {
  if (isMuted()) setVolume(1);
  else setVolume(0);
  return isMuted();
}

export function playTone(freq: number, duration: number, type: OscillatorType = 'sine', baseVolume = 0.15) {
  if (isMuted()) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    carrier.type = type;
    carrier.frequency.setValueAtTime(freq, now);
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(Math.max(3, freq / 9), now);
    modGain.gain.setValueAtTime(freq * 0.012, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(freq * 3.1, 900), now);
    filter.Q.setValueAtTime(0.72, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, baseVolume * getVolume()), now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(duration, 0.05) + 0.2);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + duration + 0.24);
    modulator.stop(now + duration + 0.24);
  } catch { /* ignore */ }
}

const schedule = (delay: number, fn: () => void) => window.setTimeout(fn, delay);
export function playFeed() { playTone(392, 0.12, 'triangle', 0.1); schedule(70, () => playTone(523, 0.11, 'sine', 0.12)); schedule(145, () => playTone(659, 0.14, 'triangle', 0.09)); }
export function playClean() { playTone(880, 0.06, 'sine', 0.07); schedule(65, () => playTone(1175, 0.07, 'sine', 0.06)); schedule(130, () => playTone(988, 0.09, 'triangle', 0.055)); }
export function playPlay() { playTone(440, 0.08, 'square', 0.08); schedule(80, () => playTone(554, 0.08, 'triangle', 0.09)); schedule(155, () => playTone(740, 0.16, 'sine', 0.08)); }
export function playSleep() { playTone(247, 0.38, 'sine', 0.055); schedule(180, () => playTone(196, 0.42, 'sine', 0.045)); }
export function playMedicine() { playTone(330, 0.13, 'triangle', 0.08); schedule(105, () => playTone(494, 0.18, 'sine', 0.07)); }
export function playBreed() { playTone(440, 0.1, 'sine', 0.08); schedule(95, () => playTone(660, 0.14, 'triangle', 0.08)); schedule(220, () => playTone(880, 0.22, 'sine', 0.06)); }
export function playClick() { playTone(880, 0.035, 'triangle', 0.065); }
export function playAlert() { playTone(392, 0.18, 'sawtooth', 0.09); schedule(180, () => playTone(294, 0.26, 'triangle', 0.08)); }
export function playEggTap() { playTone(392, 0.06, 'triangle', 0.07); schedule(70, () => playTone(523, 0.06, 'triangle', 0.065)); }
export function playCrack() { playTone(174, 0.045, 'sawtooth', 0.065); schedule(60, () => playTone(233, 0.055, 'sawtooth', 0.055)); }
export function playHatch() {
  playTone(523, 0.12, 'sine', 0.09);
  schedule(120, () => playTone(659, 0.12, 'sine', 0.09));
  schedule(240, () => playTone(784, 0.18, 'sine', 0.09));
  schedule(380, () => playTone(1046, 0.28, 'triangle', 0.075));
}

let bgInterval: number | null = null;
export function startBGMusic() {
  if (bgInterval) return;
  const notes = [262, 294, 330, 349, 330, 294, 262, 247];
  let i = 0;
  bgInterval = window.setInterval(() => {
    if (!isMuted() && window.localStorage.getItem('bunny:bg-music-enabled') === 'true') {
      playTone(notes[i % notes.length], 0.22, 'sine', 0.025);
    }
    i++;
  }, 900);
}
export function stopBGMusic() {
  if (bgInterval) { clearInterval(bgInterval); bgInterval = null; }
}
