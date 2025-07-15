import RestoreIcon from '@mui/icons-material/Restore';

/**
 * ModMonitor: Shows a restore icon if value !== originalValue, and calls onRestore on click (with optional confirmation).
 * Props:
 *   value: any
 *   originalValue: any
 *   onRestore: function
 *   title: string (tooltip)
 *   confirmMsg: string (optional, confirmation message)
 *   iconProps: object (optional, extra props for icon)
 */
function ModMonitor({ value, originalValue, onRestore, title, confirmMsg, iconProps }) {
  // Compare values for modification (shallow)
  const modified = value !== originalValue;
  if (!modified) return null;
  const handleClick = (e) => {
    e.stopPropagation?.();
    if (confirmMsg) {
      if (!window.confirm(confirmMsg)) return;
    }
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
