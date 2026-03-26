// Israel time utilities
export function getIsraelTime(): Date {
  const now = new Date();
  // Israel is UTC+2 (winter) or UTC+3 (summer/DST)
  const israelOffset = isIsraelDST(now) ? 3 : 2;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + israelOffset * 3600000);
}

function isIsraelDST(date: Date): boolean {
  const month = date.getUTCMonth(); // 0-indexed
  // Rough: DST from late March to late October
  return month >= 2 && month <= 9;
}

export type TimeOfDay = 'night' | 'sunrise' | 'day' | 'sunset';

export function getTimeOfDay(): TimeOfDay {
  const h = getIsraelTime().getHours();
  if (h >= 6 && h < 8) return 'sunrise';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'sunset';
  return 'night';
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export function getSeason(): Season {
  const m = getIsraelTime().getMonth(); // 0-indexed
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function getDayNightTint(): { color: number; alpha: number } {
  const tod = getTimeOfDay();
  switch (tod) {
    case 'night': return { color: 0x1a1a4e, alpha: 0.4 };
    case 'sunrise': return { color: 0xff8844, alpha: 0.15 };
    case 'sunset': return { color: 0xff6622, alpha: 0.2 };
    case 'day': return { color: 0xffffff, alpha: 0 };
  }
}
