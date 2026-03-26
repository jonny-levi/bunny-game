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
