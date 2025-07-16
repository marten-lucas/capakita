import RestoreIcon from '@mui/icons-material/Restore';
import { useEffect } from 'react';
import useModMonitorStore from '../../store/modMonitorStore';

/**
 * ModMonitor: Monitors a specific field of an item for modifications.
 * Props:
 *   itemId: string | number (unique identifier for the monitored item)
 *   field: string (name of the field being monitored)
 *   value: any
 *   originalValue: any
 *   onRestore: function
 *   title: string (tooltip)
 *   confirmMsg: string (optional, confirmation message)
 *   iconProps: object (optional, extra props for icon)
 */
function ModMonitor({ itemId, field, value, originalValue, onRestore, title, confirmMsg, iconProps }) {
  const { setFieldModification, resetFieldModification, isFieldModified } = useModMonitorStore();

  // Track modifications using useEffect
  useEffect(() => {
    const modified = value !== originalValue;
    if (modified) {
      setFieldModification(itemId, field, true);
    } else {
      resetFieldModification(itemId, field);
    }
  }, [itemId, field, value, originalValue, setFieldModification, resetFieldModification]);

  if (!isFieldModified(itemId, field)) return null;

  const handleClick = (e) => {
    e.stopPropagation?.();
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    onRestore?.();
    resetFieldModification(itemId, field); // Reset modification state after restoring
  };

  return (
    <RestoreIcon
      color="warning"
      sx={{ cursor: 'pointer', ...iconProps?.sx }}
      titleAccess={title}
      onClick={handleClick}
      {...iconProps}
    />
  );
}

export default ModMonitor;
