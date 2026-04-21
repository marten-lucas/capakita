import { Box } from '@mantine/core';
import { normalizeGroupIcon } from '../../utils/groupIcons';

function TablerIcon({ icon, size = 20, color = 'currentColor', className, style, ...others }) {
  const iconName = normalizeGroupIcon(icon);

  return (
    <Box
      component="i"
      aria-hidden="true"
      className={['ti', `ti-${iconName}`, className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        fontSize: size,
        lineHeight: 1,
        color,
        ...style,
      }}
      {...others}
    />
  );
}

export default TablerIcon;