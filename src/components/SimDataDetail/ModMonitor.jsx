import RestoreIcon from '@mui/icons-material/Restore';
import useSimScenarioDataStore from '../../store/simScenarioStore';

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
  const { 
    isFieldModified, 
    getOriginalValue,
    getEffectiveSimulationData 
  } = useSimScenarioDataStore();

  // Check if item is manually added
  const effectiveData = getEffectiveSimulationData();
  const item = effectiveData.find(item => item.id === itemId);
  const isManualEntry = item?.rawdata?.source === 'manual entry';

  // Don't show ModMonitor for manually added items
  if (isManualEntry) return null;

  // Get original value if not provided
  const computedOriginalValue = originalValue !== undefined 
    ? originalValue 
    : getOriginalValue(itemId, field);

  // Check if field is modified (pure function call, no state updates)
  const modified = isFieldModified(itemId, field, value, computedOriginalValue);

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

