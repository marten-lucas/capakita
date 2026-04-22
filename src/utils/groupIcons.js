export const DEFAULT_GROUP_ICON = 'material-symbols:groups';

const LEGACY_GROUP_ICON_MAP = {
  '👥': 'material-symbols:groups',
  '🧒': 'material-symbols:child-care',
  '🏫': 'material-symbols:school',
  '⭐': 'material-symbols:star',
  '🌈': 'openmoji:rainbow',
  '🚀': 'openmoji:rocket',
  '🦊': 'openmoji:fox',
  '🐻': 'openmoji:bear',
  '🐰': 'openmoji:rabbit-face',
  '🐸': 'openmoji:frog',
  '🦋': 'openmoji:butterfly',
  '🐞': 'openmoji:lady-beetle',
  '🐝': 'openmoji:bee',
  '🎒': 'openmoji:backpack',
  '☀️': 'openmoji:sun',
  '🌙': 'openmoji:crescent-moon',
  '🌸': 'openmoji:flower',
  '🌳': 'openmoji:evergreen-tree',
  'mdi:groups': 'material-symbols:groups',
  'mdi:school': 'material-symbols:school',
  'mdi:star': 'material-symbols:star',
  'mdi:fox': 'openmoji:fox',
  'mdi:bear': 'openmoji:bear',
  'mdi:rabbit': 'openmoji:rabbit-face',
  'mdi:frog': 'openmoji:frog',
  'mdi:butterfly': 'openmoji:butterfly',
  'mdi:ladybug': 'openmoji:lady-beetle',
  'mdi:bee': 'openmoji:bee',
  'mdi:weather-sunny': 'openmoji:sun',
  'mdi:weather-night': 'openmoji:crescent-moon',
  'mdi:rainbow': 'openmoji:rainbow',
  'mdi:flower': 'openmoji:flower',
  'mdi:tree': 'openmoji:evergreen-tree',
  users: 'material-symbols:groups',
  school: 'material-symbols:school',
  star: 'material-symbols:star',
  rainbow: 'openmoji:rainbow',
  rocket: 'openmoji:rocket',
  sun: 'openmoji:sun',
  moon: 'openmoji:crescent-moon',
  flower: 'openmoji:flower',
  tree: 'openmoji:evergreen-tree',
};

function createIconEntry(icon, label, searchTerms = []) {
  return { icon, label, searchTerms };
}

export const GROUP_ICON_CATEGORIES = [
  {
    value: 'animals',
    label: 'Tiere',
    icons: [
      createIconEntry('openmoji:dog-face', 'Hund'),
      createIconEntry('openmoji:cat-face', 'Katze'),
      createIconEntry('openmoji:rabbit-face', 'Hase'),
      createIconEntry('openmoji:bear', 'Bär'),
      createIconEntry('openmoji:fox', 'Fuchs'),
      createIconEntry('openmoji:butterfly', 'Schmetterling'),
      createIconEntry('openmoji:lady-beetle', 'Marienkäfer'),
      createIconEntry('openmoji:penguin', 'Pinguin'),
      createIconEntry('openmoji:owl', 'Eule'),
      createIconEntry('openmoji:fish', 'Fisch'),
      createIconEntry('openmoji:turtle', 'Schildkröte'),
      createIconEntry('openmoji:horse-face', 'Pferd'),
      createIconEntry('openmoji:horse', 'Pferd stehend'),
      createIconEntry('openmoji:elephant', 'Elefant'),
      createIconEntry('openmoji:monkey-face', 'Affe'),
      createIconEntry('openmoji:koala', 'Koala'),
      createIconEntry('openmoji:duck', 'Ente'),
      createIconEntry('openmoji:cow-face', 'Kuh'),
      createIconEntry('openmoji:pig-face', 'Schwein'),
      createIconEntry('openmoji:tiger-face', 'Tiger'),
      createIconEntry('openmoji:crocodile', 'Krokodil'),
      createIconEntry('openmoji:dolphin', 'Delfin'),
      createIconEntry('openmoji:whale', 'Wal'),
      createIconEntry('openmoji:snail', 'Schnecke'),
      createIconEntry('openmoji:giraffe', 'Giraffe'),
      createIconEntry('openmoji:swan', 'Schwan'),
      createIconEntry('openmoji:beetle', 'Käfer'),
      createIconEntry('openmoji:black-cat', 'Schwarze Katze'),
      createIconEntry('openmoji:cat', 'Katze sitzend'),
      createIconEntry('openmoji:chicken', 'Huhn'),
      createIconEntry('openmoji:cow', 'Kuh stehend'),
      createIconEntry('openmoji:mouse-face', 'Maus'),
      createIconEntry('openmoji:poodle', 'Pudel'),
      createIconEntry('openmoji:spider', 'Spinne'),
      createIconEntry('openmoji:ant', 'Ameise'),
      createIconEntry('openmoji:hedgehog', 'Igel'),
    ],
  },
  {
    value: 'people',
    label: 'Menschen',
    icons: [
      createIconEntry('material-symbols:groups', 'Gruppe'),
      createIconEntry('material-symbols:group', 'Gruppe klein'),
      createIconEntry('material-symbols:person', 'Person'),
      createIconEntry('material-symbols:person-add', 'Person hinzufügen'),
      createIconEntry('material-symbols:child-care', 'Kind'),
      createIconEntry('material-symbols:child-care-outline', 'Kind outline'),
      createIconEntry('material-symbols:family-restroom', 'Familie'),
      createIconEntry('material-symbols:self-improvement', 'Betreuung'),
      createIconEntry('material-symbols:account-circle', 'Profil'),
      createIconEntry('material-symbols:account-box', 'Konto'),
      createIconEntry('material-symbols:account-tree', 'Ahnentafel'),
      createIconEntry('material-symbols:ad-group', 'Team'),
      createIconEntry('material-symbols:manage-accounts', 'Verwaltung'),
      createIconEntry('material-symbols:group-add', 'Gruppe hinzufügen'),
      createIconEntry('material-symbols:group-off', 'Gruppe aus'),
      createIconEntry('material-symbols:person-search', 'Person suchen'),
      createIconEntry('material-symbols:school', 'Schüler'),
      createIconEntry('material-symbols:school-outline', 'Schule outline'),
      createIconEntry('material-symbols:person-2', 'Person zu zweit'),
      createIconEntry('material-symbols:person-3', 'Person zu dritt'),
      createIconEntry('material-symbols:person-4', 'Person zu viert'),
      createIconEntry('material-symbols:diversity-4', 'Vielfalt vier'),
      createIconEntry('material-symbols:badge', 'Ausweis'),
      createIconEntry('material-symbols:badge-outline', 'Ausweis outline'),
      createIconEntry('material-symbols:supervisor-account', 'Aufsicht'),
      createIconEntry('material-symbols:engineering', 'Technik'),
      createIconEntry('material-symbols:support-agent', 'Support'),
      createIconEntry('material-symbols:workspace-premium', 'Arbeitsbereich'),
      createIconEntry('material-symbols:model-training', 'Training'),
      createIconEntry('material-symbols:face', 'Gesicht'),
      createIconEntry('material-symbols:face-3', 'Gesicht 3'),
      createIconEntry('material-symbols:face-4', 'Gesicht 4'),
      createIconEntry('material-symbols:group-work', 'Gruppenarbeit'),
      createIconEntry('material-symbols:person-apron', 'Person mit Schürze'),
      createIconEntry('material-symbols:diversity-1', 'Vielfalt 1'),
      createIconEntry('material-symbols:diversity-2', 'Vielfalt 2'),
    ],
  },
  {
    value: 'nature',
    label: 'Natur',
    icons: [
      createIconEntry('openmoji:christmas-tree', 'Tanne'),
      createIconEntry('openmoji:deciduous-tree', 'Baum'),
      createIconEntry('openmoji:evergreen-tree', 'Tanne'),
      createIconEntry('openmoji:fallen-leaf', 'Blatt'),
      createIconEntry('openmoji:leaf-fluttering-in-wind', 'Windblatt'),
      createIconEntry('openmoji:sun', 'Sonne'),
      createIconEntry('openmoji:crescent-moon', 'Mond'),
      createIconEntry('openmoji:full-moon', 'Vollmond'),
      createIconEntry('openmoji:rainbow', 'Regenbogen'),
      createIconEntry('openmoji:cloud', 'Wolke'),
      createIconEntry('openmoji:cloud-with-rain', 'Regenwolke'),
      createIconEntry('openmoji:cloud-with-snow', 'Schneewolke'),
      createIconEntry('openmoji:cloud-with-lightning', 'Gewitter'),
      createIconEntry('openmoji:foggy-mountain', 'Bergnebel'),
      createIconEntry('openmoji:mountain', 'Berg'),
      createIconEntry('openmoji:four-leaf-clover', 'Kleeblatt'),
      createIconEntry('openmoji:sunflower', 'Sonnenblume'),
      createIconEntry('openmoji:herb', 'Kraut'),
      createIconEntry('openmoji:seedling', 'Setzling'),
      createIconEntry('material-symbols:forest', 'Wald'),
      createIconEntry('material-symbols:park', 'Park'),
      createIconEntry('material-symbols:eco', 'Öko'),
      createIconEntry('material-symbols:nature', 'Natur'),
      createIconEntry('material-symbols:potted-plant', 'Topfpflanze'),
      createIconEntry('material-symbols:sunny', 'Sonne umrandet'),
      createIconEntry('material-symbols:rainy', 'Regen'),
      createIconEntry('material-symbols:beach-access', 'Strand'),
      createIconEntry('material-symbols:cloud', 'Wolke'),
      createIconEntry('openmoji:beach-with-umbrella', 'Strand'),
      createIconEntry('openmoji:cloud-with-rain', 'Regenwolke'),
      createIconEntry('openmoji:cloud-with-snow', 'Schneewolke'),
      createIconEntry('openmoji:cloud-with-lightning', 'Gewitterwolke'),
      createIconEntry('openmoji:foggy-mountain', 'Nebelberg'),
      createIconEntry('openmoji:snowflake', 'Schneeflocke'),
      createIconEntry('openmoji:volcano', 'Vulkan'),
      createIconEntry('openmoji:maple-leaf', 'Ahornblatt'),
    ],
  },
  {
    value: 'school',
    label: 'Schule',
    icons: [
      createIconEntry('openmoji:school', 'Schule'),
      createIconEntry('openmoji:backpack', 'Ranzen'),
      createIconEntry('openmoji:books', 'Bücher'),
      createIconEntry('openmoji:blue-book', 'Buch blau'),
      createIconEntry('openmoji:closed-book', 'Buch zu'),
      createIconEntry('openmoji:notebook', 'Heft'),
      createIconEntry('openmoji:notebook-with-decorative-cover', 'Heft dekoriert'),
      createIconEntry('openmoji:pencil', 'Stift'),
      createIconEntry('openmoji:abacus', 'Abakus'),
      createIconEntry('openmoji:bus', 'Bus'),
      createIconEntry('openmoji:calendar', 'Kalender'),
      createIconEntry('openmoji:graduation-cap', 'Abschlusskappe'),
      createIconEntry('openmoji:microscope', 'Mikroskop'),
      createIconEntry('openmoji:artist-palette', 'Palette'),
      createIconEntry('openmoji:musical-note', 'Note'),
      createIconEntry('openmoji:musical-score', 'Notenblatt'),
      createIconEntry('openmoji:laptop', 'Laptop'),
      createIconEntry('material-symbols:school-outline', 'Schule outline'),
      createIconEntry('material-symbols:book', 'Buch'),
      createIconEntry('material-symbols:book-2', 'Buch 2'),
      createIconEntry('material-symbols:book-3', 'Buch 3'),
      createIconEntry('material-symbols:book-4', 'Buch 4'),
      createIconEntry('material-symbols:book-5', 'Buch 5'),
      createIconEntry('material-symbols:book-6', 'Buch 6'),
      createIconEntry('material-symbols:book-4-spark', 'Buch 4 mit Glanz'),
      createIconEntry('material-symbols:book-4-spark-outline', 'Buch 4 mit Glanz outline'),
      createIconEntry('material-symbols:bookmark', 'Lesezeichen'),
      createIconEntry('material-symbols:bookmark-outline', 'Lesezeichen outline'),
      createIconEntry('material-symbols:bookmark-added', 'Lesezeichen hinzugefügt'),
      createIconEntry('material-symbols:bookmark-manager', 'Lesezeichen-Verwaltung'),
      createIconEntry('material-symbols:whiteboard', 'Tafel'),
      createIconEntry('material-symbols:calendar-month', 'Monatskalender'),
      createIconEntry('material-symbols:schedule', 'Stundenplan'),
      createIconEntry('material-symbols:piano', 'Klavier'),
      createIconEntry('material-symbols:computer', 'Computer'),
      createIconEntry('material-symbols:palette', 'Palette'),
    ],
  },
  {
    value: 'symbols',
    label: 'Symbole',
    icons: [
      createIconEntry('openmoji:star', 'Stern'),
      createIconEntry('openmoji:rocket', 'Rakete'),
      createIconEntry('openmoji:light-bulb', 'Glühbirne'),
      createIconEntry('openmoji:check-mark', 'Haken'),
      createIconEntry('openmoji:check-box-with-check', 'Checkbox'),
      createIconEntry('openmoji:black-circle', 'Schwarzer Kreis'),
      createIconEntry('openmoji:white-circle', 'Weißer Kreis'),
      createIconEntry('openmoji:sparkles', 'Glitzer'),
      createIconEntry('openmoji:party-popper', 'Party'),
      createIconEntry('openmoji:fire', 'Feuer'),
      createIconEntry('material-symbols:star', 'Stern'),
      createIconEntry('material-symbols:favorite', 'Herz'),
      createIconEntry('material-symbols:rocket-launch', 'Rakete'),
      createIconEntry('material-symbols:music-note', 'Musik'),
      createIconEntry('material-symbols:lightbulb', 'Licht'),
      createIconEntry('material-symbols:flag', 'Flagge'),
      createIconEntry('material-symbols:check-circle', 'Haken rund'),
      createIconEntry('material-symbols:radio-button-unchecked', 'Kreis leer'),
      createIconEntry('material-symbols:target', 'Ziel'),
      createIconEntry('material-symbols:heart-plus', 'Herz plus'),
      createIconEntry('openmoji:balloon', 'Ballon'),
      createIconEntry('openmoji:confetti-ball', 'Konfetti'),
      createIconEntry('openmoji:wrapped-gift', 'Geschenk'),
      createIconEntry('openmoji:red-heart', 'Herz rot'),
      createIconEntry('openmoji:blue-heart', 'Herz blau'),
      createIconEntry('openmoji:yellow-heart', 'Herz gelb'),
      createIconEntry('openmoji:green-heart', 'Herz grün'),
      createIconEntry('openmoji:purple-heart', 'Herz lila'),
      createIconEntry('openmoji:black-heart', 'Herz schwarz'),
      createIconEntry('material-symbols:help', 'Hilfe'),
      createIconEntry('material-symbols:info', 'Info'),
      createIconEntry('material-symbols:warning', 'Warnung'),
      createIconEntry('material-symbols:error', 'Fehler'),
      createIconEntry('material-symbols:add', 'Plus'),
      createIconEntry('material-symbols:remove', 'Minus'),
      createIconEntry('material-symbols:celebration', 'Feier'),
    ],
  },
];

export const GROUP_ICON_LOOKUP = Object.fromEntries(
  GROUP_ICON_CATEGORIES.flatMap((category) =>
    category.icons.map((entry) => [entry.icon, { ...entry, category: category.value, categoryLabel: category.label }])
  )
);

export function normalizeGroupIcon(icon) {
  if (!icon) return DEFAULT_GROUP_ICON;

  const value = String(icon).trim();
  if (!value) return DEFAULT_GROUP_ICON;

  if (LEGACY_GROUP_ICON_MAP[value]) {
    return LEGACY_GROUP_ICON_MAP[value];
  }

  if (value.startsWith('mdi:')) {
    return LEGACY_GROUP_ICON_MAP[value] || value;
  }

  if (value.startsWith('openmoji:') || value.startsWith('twemoji:') || value.startsWith('material-symbols:')) {
    return value;
  }

  if (value.startsWith('mdi-')) {
    return LEGACY_GROUP_ICON_MAP[`mdi:${value.slice(4)}`] || `material-symbols:${value.slice(4)}`;
  }

  return value;
}

export function formatGroupIconLabel(icon) {
  const normalized = normalizeGroupIcon(icon);
  const lookup = GROUP_ICON_LOOKUP[normalized];

  if (lookup?.label) return lookup.label;

  const rawName = normalized.includes(':') ? normalized.split(':')[1] : normalized;

  return rawName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}