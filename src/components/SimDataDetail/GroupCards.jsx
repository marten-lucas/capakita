import {
  Typography, Box,
} from '@mui/material';
import React from 'react';
import GroupDetail from './GroupDetail';
import useSimScenarioDataStore from '../../store/simScenarioStore';
import useAppSettingsStore from '../../store/appSettingsStore';

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

function GroupCards({ itemId, lastAddedIndex, importedCount, originalGroups, onRestoreGroup, isManualEntry }) {
  const { getItemGroups, updateItemGroups, getItemBookings } = useSimScenarioDataStore((state) => ({
    getItemGroups: state.getItemGroups,
    updateItemGroups: state.updateItemGroups,
    getItemBookings: state.getItemBookings,
  }));

  // Get all groups from AppSettingsStore
  const allGroups = useAppSettingsStore(state => {
    const groups = state.groups;
    const lookup = {};
    groups.forEach(g => {
      lookup[g.id] = g.name;
    });
    return lookup;
  });

  const groups = getItemGroups(itemId);
  const bookings = getItemBookings(itemId); // Add this to trigger re-renders when bookings change

  const handleUpdateGroup = (index, updatedGroup) => {
    const updatedGroups = groups.map((g, idx) => (idx === index ? updatedGroup : g));
    updateItemGroups(itemId, updatedGroups); // Persist changes to global state
  };

  const handleDeleteGroup = (index) => {
    const updatedGroups = groups.filter((_, idx) => idx !== index);
    updateItemGroups(itemId, updatedGroups);
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
          <GroupDetail
            key={`${idx}-${bookings.length}`} 
            group={group}
            index={idx}
            allGroups={allGroups}
            defaultExpanded={lastAddedIndex === idx}
            onDelete={handleDeleteGroup}
            canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
            isModified={isMod}
            onRestore={onRestoreGroup}
            originalGroup={orig}
            onUpdateGroup={(updatedGroup) => handleUpdateGroup(idx, updatedGroup)}
            isManualEntry={isManualEntry}
            parentItemId={itemId}
          />
        );
      })}
    </Box>
  );
}

export default GroupCards;