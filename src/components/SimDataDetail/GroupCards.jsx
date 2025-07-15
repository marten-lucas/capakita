import {
  Typography, Box,
} from '@mui/material';
import React from 'react';
import GroupAccordion from './GroupAccordion';

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

function GroupCards({ groups, allGroups, lastAddedIndex, onDelete, importedCount, originalGroups, onRestoreGroup }) {
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
            onDelete={onDelete}
            canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
            isModified={isMod}
            onRestore={onRestoreGroup}
            originalGroup={orig}
          />
        );
      })}
    </Box>
  );
}

export default GroupCards;