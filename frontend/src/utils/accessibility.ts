export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function motionDuration(ms: number): number {
  return prefersReducedMotion() ? Math.min(ms, 150) : ms;
}

export function announce(message: string) {
  if (typeof document === 'undefined') return;
  const target = document.getElementById('sr-status');
  if (!target) return;
  target.textContent = '';
  window.setTimeout(() => { target.textContent = message; }, 20);
}
