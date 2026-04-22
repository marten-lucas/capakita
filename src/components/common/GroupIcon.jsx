import { Icon } from '@iconify/react';
import { normalizeGroupIcon } from '../../utils/groupIcons';

function GroupIcon({ icon, size = 20, color = 'currentColor', className, style, ...others }) {
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