import {
  Typography, Box,
} from '@mui/material';
import React from 'react';
import GroupAccordion from './GroupAccordion';
import useSimulationDataStore from '../../store/simulationDataStore';

// Helper: compare groups for modification
function groupsModified(localGroups, origGroups) {
  if (!Array.isArray(localGroups) && !Array.isArray(origGroups)) return false;
  if (!Array.isArray(localGroups) || !Array.isArray(origGroups)) return true;
  if (localGroups.length !== origGroups.length) return true;
  for (let i = 0; i < localGroups.length; ++i) {
    const l = localGroups[i], o = origGroups[i];
    if (String(l.id) !== String(o.id)) return true;
    if (l.start !== o.start) return true;
    if (l.end !== o.end) return true;
  }
  return false;
}

function GroupCards({ itemId, allGroups, lastAddedIndex, importedCount, originalGroups, onRestoreGroup }) {
  const { getItemGroups, updateItemGroups } = useSimulationDataStore((state) => ({
    getItemGroups: state.getItemGroups,
    updateItemGroups: state.updateItemGroups,
  }));

  const groups = getItemGroups(itemId);

  const handleUpdateGroup = (index, updatedGroup) => {
    const updatedGroups = groups.map((g, idx) => (idx === index ? updatedGroup : g));
    updateItemGroups(itemId, updatedGroups); // Persist changes to global state
  };

  if (!groups || groups.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Gruppenzuordnungen vorhanden.</Typography>;
  }

  return (
    <Box>
      {groups.map((group, idx) => {
        const orig = Array.isArray(originalGroups) ? originalGroups[idx] : undefined;
        const isMod = orig ? groupsModified([group], [orig]) : false;
        return (
          <GroupAccordion
            key={idx}
            group={group}
            index={idx}
            allGroups={allGroups}
            defaultExpanded={lastAddedIndex === idx}
            onDelete={(index) => updateItemGroups(itemId, groups.filter((_, i) => i !== index))}
            canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
            isModified={isMod}
            onRestore={onRestoreGroup}
            originalGroup={orig}
            onUpdateGroup={(updatedGroup) => handleUpdateGroup(idx, updatedGroup)}
          />
        );
      })}
    </Box>
  );
}

export default GroupCards;