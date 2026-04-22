export const DEFAULT_GROUP_ICON = 'mdi:account-group';

const LEGACY_GROUP_ICON_MAP = {
  '👥': 'mdi:account-group',
  '🧒': 'mdi:account-child',
  '🏫': 'mdi:school',
  '⭐': 'mdi:star',
  '🌈': 'mdi:rainbow',
  '🚀': 'mdi:rocket-launch',
  '🦊': 'mdi:fox',
  '🐻': 'mdi:bear',
  '🐰': 'mdi:rabbit',
  '🐸': 'mdi:frog',
  '🦋': 'mdi:butterfly',
  '🐞': 'mdi:ladybug',
  '🐝': 'mdi:bee',
  '🎒': 'mdi:backpack',
  '☀️': 'mdi:weather-sunny',
  '🌙': 'mdi:weather-night',
  '🌸': 'mdi:flower',
  '🌳': 'mdi:tree',
  users: 'mdi:account-group',
  school: 'mdi:school',
  star: 'mdi:star',
  rainbow: 'mdi:rainbow',
  rocket: 'mdi:rocket-launch',
  sun: 'mdi:weather-sunny',
  moon: 'mdi:weather-night',
  flower: 'mdi:flower',
  tree: 'mdi:tree',
};

export const GROUP_ICON_CATEGORIES = [
  {
    value: 'animals',
    label: 'Tiere',
    icons: [
      'mdi:dog',
      'mdi:cat',
      'mdi:rabbit',
      'mdi:fox',
      'mdi:bear',
      'mdi:bee',
      'mdi:butterfly',
      'mdi:ladybug',
      'mdi:penguin',
      'mdi:owl',
      'mdi:fish',
      'mdi:turtle',
      'mdi:horse',
      'mdi:elephant',
      'mdi:monkey',
      'mdi:koala',
      'mdi:panda',
      'mdi:duck',
      'mdi:cow',
      'mdi:pig',
      'mdi:sheep',
      'mdi:frog',
    ],
  },
  {
    value: 'people',
    label: 'Menschen',
    icons: [
      'mdi:account-group',
      'mdi:account-child',
      'mdi:account-school',
      'mdi:account-tie',
      'mdi:account-supervisor-circle',
      'mdi:account-multiple',
      'mdi:face-man',
      'mdi:face-woman',
      'mdi:family-tree',
      'mdi:human-male-female-child',
      'mdi:baby-face',
      'mdi:account-heart',
    ],
  },
  {
    value: 'nature',
    label: 'Natur',
    icons: [
      'mdi:tree',
      'mdi:pine-tree',
      'mdi:flower',
      'mdi:leaf',
      'mdi:weather-sunny',
      'mdi:weather-night',
      'mdi:weather-partly-cloudy',
      'mdi:weather-rainy',
      'mdi:weather-lightning',
      'mdi:weather-snowy',
      'mdi:rainbow',
    ],
  },
  {
    value: 'school',
    label: 'Schule',
    icons: [
      'mdi:school',
      'mdi:backpack',
      'mdi:book-open-page-variant',
      'mdi:notebook',
      'mdi:pencil',
      'mdi:abacus',
      'mdi:bus-school',
      'mdi:whiteboard',
      'mdi:calendar',
      'mdi:clock-outline',
      'mdi:ruler-square',
      'mdi:clipboard-text',
    ],
  },
  {
    value: 'symbols',
    label: 'Symbole',
    icons: [
      'mdi:star',
      'mdi:heart',
      'mdi:rocket-launch',
      'mdi:music',
      'mdi:lightbulb',
      'mdi:flag',
      'mdi:plus-circle',
      'mdi:circle-outline',
      'mdi:check-circle-outline',
      'mdi:sparkles',
      'mdi:target',
    ],
  },
];

export function normalizeGroupIcon(icon) {
  if (!icon) return DEFAULT_GROUP_ICON;

  const value = String(icon).trim();
  if (!value) return DEFAULT_GROUP_ICON;

  if (LEGACY_GROUP_ICON_MAP[value]) {
    return LEGACY_GROUP_ICON_MAP[value];
  }

  if (value.startsWith('mdi:')) {
    return value;
  }

  if (value.startsWith('mdi-')) {
    return `mdi:${value.slice(4)}`;
  }

  return value;
}

export function formatGroupIconLabel(icon) {
  const normalized = normalizeGroupIcon(icon);
  const rawName = normalized.includes(':') ? normalized.split(':')[1] : normalized;

  return rawName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}