export const BG_MUSIC_FLAG = 'bunny:bg-music-enabled';

export function isBgMusicEnabled(): boolean {
  try { return window.localStorage.getItem(BG_MUSIC_FLAG) === 'true'; } catch { return false; }
}

// Phase C placeholder: ambient pad layers will be preloaded and mixed here once the
// gated background-music feature is approved for production.
export function preloadAmbientPad() { /* intentionally gated */ }
