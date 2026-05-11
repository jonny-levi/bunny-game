import { actionColors, palette, radii, spacing, typography } from './tokens';
import { ICONS, iconKey } from './Icon';

const assertToken = (condition: boolean, label: string) => {
  if (!condition) throw new Error(`Design token smoke failed: ${label}`);
};

assertToken(palette.brandPink === 0xff6b9d, 'brand pink');
assertToken(spacing.md === 12 && radii.lg === 16, 'spacing/radii');
assertToken(typography.families.display.includes('Fredoka'), 'display font');
assertToken(Number(actionColors.feed) !== Number(actionColors.clean), 'action colors distinct');
assertToken(iconKey('feed') === 'ui-icon-feed' && Object.keys(ICONS).length === 12, 'icons');
