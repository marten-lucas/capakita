import { Icon, addCollection } from '@iconify/react';
import openmojiIcons from '@iconify-json/openmoji/icons.json';
import materialSymbolsIcons from '@iconify-json/material-symbols/icons.json';
import twemojiIcons from '@iconify-json/twemoji/icons.json';
import { normalizeGroupIcon } from '../../utils/groupIcons';

let iconCollectionsLoaded = false;

function ensureLocalIconCollectionsLoaded() {
  if (iconCollectionsLoaded) return;
  addCollection(openmojiIcons);
  addCollection(materialSymbolsIcons);
  addCollection(twemojiIcons);
  iconCollectionsLoaded = true;
}

function GroupIcon({ icon, size = 20, color = 'currentColor', className, style, ...others }) {
  ensureLocalIconCollectionsLoaded();
  const iconName = normalizeGroupIcon(icon);

  return (
    <Icon
      icon={iconName}
      width={size}
      height={size}
      color={color}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      {...others}
    />
  );
}

export default GroupIcon;