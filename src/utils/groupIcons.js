export const DEFAULT_GROUP_ICON = 'users';

const LEGACY_GROUP_ICON_MAP = {
  '👥': 'users',
  '🧒': 'users',
  '🏫': 'school',
  '⭐': 'star',
  '🌈': 'rainbow',
  '🚀': 'rocket',
  '🦊': 'users',
  '🐻': 'users',
  '🐰': 'users',
  '🐸': 'users',
  '🦋': 'users',
  '🐞': 'users',
  '🐝': 'users',
  '🎒': 'school',
  '☀️': 'sun',
  '🌙': 'moon',
  '🌸': 'flower',
  '🌳': 'tree',
};

export function normalizeGroupIcon(icon) {
  if (!icon) return DEFAULT_GROUP_ICON;

  const value = String(icon).trim();
  if (!value) return DEFAULT_GROUP_ICON;

  if (LEGACY_GROUP_ICON_MAP[value]) {
    return LEGACY_GROUP_ICON_MAP[value];
  }

  if (value.startsWith('ti ti-')) {
    return value.slice(6);
  }

  if (value.startsWith('ti-')) {
    return value.slice(3);
  }

  return value;
}