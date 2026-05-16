const CUTE_NAMES = [
  'Mochi', 'Boba', 'Pudding', 'Waffle', 'Tofu', 'Noodle', 'Dumpling',
  'Cookie', 'Muffin', 'Pretzel', 'Biscuit', 'Truffle', 'Mocha', 'Latte',
  'Cinnamon', 'Maple', 'Honey', 'Clover', 'Pebble', 'Nugget', 'Pippin',
  'Sprout', 'Button', 'Pickle', 'Gizmo', 'Widget', 'Nibbles', 'Bubbles',
  'Fuzzy', 'Snickers', 'Marshmallow', 'Caramel', 'Toffee', 'Churro',
];

export function randomBunnyName(): string {
  return CUTE_NAMES[Math.floor(Math.random() * CUTE_NAMES.length)];
}


export function mixedBabyBunnyName(parentAName: string, parentBName: string): string {
  const clean = (value: string) => value.trim().replace(/[^a-zA-Z]/g, '').toLowerCase();
  const cap = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  const a = clean(parentAName);
  const b = clean(parentBName);
  if (a.length < 2 || b.length < 2) return randomBunnyName();
  const combos = [
    a.slice(0, Math.ceil(a.length / 2)) + b.slice(Math.floor(b.length / 2)),
    b.slice(0, Math.ceil(b.length / 2)) + a.slice(Math.floor(a.length / 2)),
    a.slice(0, 2) + b.slice(-2),
    b.slice(0, 2) + a.slice(-2),
    a[0] + b[1] + a.slice(-2),
    b[0] + a[1] + b.slice(-2),
  ].map(name => cap(name.slice(0, 8))).filter(name => name.length >= 3);
  return combos[Math.floor(Math.random() * combos.length)] || randomBunnyName();
}
