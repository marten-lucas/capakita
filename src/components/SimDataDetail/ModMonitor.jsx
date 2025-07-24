import RestoreIcon from '@mui/icons-material/Restore';
import { useSelector, useDispatch } from 'react-redux';

/**
 * ModMonitor: Monitors a specific field of an item for modifications.
 * Props:
 *   itemId: string | number (unique identifier for the monitored item)
 *   field: string (name of the field being monitored)
 *   value: any
 *   originalValue: any (optional, will be computed if not provided)
 *   onRestore: function
 *   title: string (tooltip)
 *   confirmMsg: string (optional, confirmation message)
 *   iconProps: object (optional, extra props for icon)
 */
function ModMonitor({ itemId, field, value, originalValue, onRestore, title, confirmMsg, iconProps }) {
  // Replace with Redux state and actions
  const someState = useSelector(state => state.simScenario.someState);
  const dispatch = useDispatch();

  // Find the item in the current scenario for manual entry check
  let item = null;
  if (Array.isArray(someState)) {
    item = someState.find(i => i.id === itemId);
  }
  const isManualEntry = item?.rawdata?.source === 'manual entry';

  // Don't show ModMonitor for manually added items
  if (isManualEntry) return null;

  // Fallback: always show the restore icon (no modification logic)
  // You may want to hide this if you want to only show when value !== originalValue
  // For now, show only if value !== originalValue
  const computedOriginalValue = originalValue;
  const modified = computedOriginalValue !== undefined && JSON.stringify(value) !== JSON.stringify(computedOriginalValue);

  if (!modified) return null;

  const handleClick = (e) => {
    e.stopPropagation?.();
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    onRestore?.();
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

