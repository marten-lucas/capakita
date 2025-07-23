import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import React from 'react';
import GroupDetail from './GroupDetail';
import useSimScenarioDataStore from '../../../store/simScenarioStore';

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

function GroupCards({ itemId, importedCount, originalGroups, onRestoreGroup, isManualEntry }) {
  const { getItemGroups, updateItemGroups, getItemBookings, getGroupDefs } = useSimScenarioDataStore((state) => ({
    getItemGroups: state.getItemGroups,
    updateItemGroups: state.updateItemGroups,
    getItemBookings: state.getItemBookings,
    getGroupDefs: state.getGroupDefs,
  }));

  // Use scenario-based groupdefs for lookup
  const allGroups = React.useMemo(() => {
    const defs = getGroupDefs();
    const lookup = {};
    defs.forEach(g => {
      lookup[g.id] = g.name;
    });
    return lookup;
  }, [getGroupDefs]);

  const groups = getItemGroups(itemId);
  const bookings = getItemBookings(itemId);

  // Track expanded accordion index
  const [expandedIdx, setExpandedIdx] = React.useState(groups && groups.length > 0 ? 0 : null);

  // Expand last group when groups length increases
  const prevLengthRef = React.useRef(groups ? groups.length : 0);
  React.useEffect(() => {
    if (groups && groups.length > prevLengthRef.current) {
      setExpandedIdx(groups.length - 1);
    }
    prevLengthRef.current = groups ? groups.length : 0;
  }, [groups]);

  const handleAccordionChange = (idx) => (event, expanded) => {
    setExpandedIdx(expanded ? idx : null);
  };

  const handleUpdateGroup = (index, updatedGroup) => {
    const updatedGroups = groups.map((g, idx) => (idx === index ? updatedGroup : g));
    updateItemGroups(itemId, updatedGroups);
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

        // Use dateRangeText logic for header
        const { start, end } = group;
        let dateRangeText = '';
        if (start && end) {
          dateRangeText = `von ${start} bis ${end}`;
        } else if (start) {
          dateRangeText = `ab ${start}`;
        } else if (end) {
          dateRangeText = `bis ${end}`;
        }

        return (
          <Accordion
            key={`${idx}-${bookings.length}`}
            expanded={expandedIdx === idx}
            onChange={handleAccordionChange(idx)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                {(group.name || 'Gruppenzuordnung')}{dateRangeText ? `: ${dateRangeText}` : ''}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <GroupDetail
                group={group}
                index={idx}
                allGroups={allGroups}
                onDelete={handleDeleteGroup}
                canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
                isModified={isMod}
                onRestore={onRestoreGroup}
                originalGroup={orig}
                onUpdateGroup={(updatedGroup) => handleUpdateGroup(idx, updatedGroup)}
                isManualEntry={isManualEntry}
                parentItemId={itemId}
              />
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

export default GroupCards;