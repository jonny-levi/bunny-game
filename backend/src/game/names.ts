const prefixes = [
  'Mochi', 'Boba', 'Waffles', 'Nugget', 'Pepper', 'Pickles', 'Dumpling', 'Truffle',
  'Biscuit', 'Pudding', 'Noodle', 'Tofu', 'Churro', 'Crumble', 'Muffin', 'Pancake',
  'Toffee', 'Fudge', 'Marshmallow', 'Cookie', 'Pretzel', 'Brownie', 'Cupcake',
  'Sprinkles', 'Caramel', 'Ginger', 'Cinnamon', 'Nutmeg', 'Clover', 'Pebble',
  'Button', 'Snowball', 'Fluffernutter', 'Sir Hops', 'Captain Floof', 'Professor Wiggle',
  'Lord Nibbles', 'Duchess Flopsy', 'Baron Von Bun', 'Princess Thumper', 'Agent Fuzzy',
  'Bun Bun', 'Jellybean', 'Poppy', 'Daisy', 'Hazel', 'Olive', 'Basil', 'Rosemary',
  'Butterscotch', 'Snickerdoodle', 'Macaron', 'Tiramisu', 'Espresso', 'Latte',
];

const suffixes = [
  '', '', '', '', // weighted toward no suffix
  ' Jr.', ' III', ' the Great', ' the Brave', ' McFluff',
  ' von Hoppington', ' Thunderpaws', ' Softears',
];

const usedNames = new Set<string>();

export function generateMixedBunnyName(parentAName: string, parentBName: string): string {
  const clean = (value: string) => value.trim().replace(/[^a-zA-Z]/g, '').toLowerCase();
  const cap = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  const a = clean(parentAName);
  const b = clean(parentBName);
  if (a.length < 2 || b.length < 2) return generateBunnyName();

  const combos = [
    a.slice(0, Math.ceil(a.length / 2)) + b.slice(Math.floor(b.length / 2)),
    b.slice(0, Math.ceil(b.length / 2)) + a.slice(Math.floor(a.length / 2)),
    a.slice(0, 2) + b.slice(-2),
    b.slice(0, 2) + a.slice(-2),
    a[0] + b[1] + a.slice(-2),
    b[0] + a[1] + b.slice(-2),
  ]
    .map(name => cap(name.slice(0, 8)))
    .filter(name => name.length >= 3);

  for (const name of combos.sort(() => Math.random() - 0.5)) {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  return generateBunnyName();
}

export function generateBunnyName(): string {
  for (let i = 0; i < 100; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const name = prefix + suffix;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // fallback
  const name = prefixes[Math.floor(Math.random() * prefixes.length)] + '-' + Date.now().toString(36).slice(-3);
  usedNames.add(name);
  return name;
}
