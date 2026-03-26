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
