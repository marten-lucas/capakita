import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails, Button
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import React from 'react';
import GroupDetail from './GroupDetail';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { addGroup } from '../../../store/simGroupSlice';
import { useOverlayData } from '../../../hooks/useOverlayData';

const EMPTY_ARRAY = [];

// Memoized selector to prevent unnecessary re-renders
const selectGroups = createSelector(
  [
    (state) => state.simGroup.groupsByScenario,
    (state, selectedScenarioId, baseScenarioId) => ({ selectedScenarioId, baseScenarioId }),
    (state, selectedScenarioId, baseScenarioId, selectedItemId) => selectedItemId
  ],
  (groupsByScenario, { selectedScenarioId, baseScenarioId }, selectedItemId) => {
    if (!selectedScenarioId || !selectedItemId) return EMPTY_ARRAY;
    
    // Try current scenario first
    const currentScenarioGroups = groupsByScenario[selectedScenarioId];
    if (currentScenarioGroups && currentScenarioGroups[selectedItemId]) {
      const itemGroupsObj = currentScenarioGroups[selectedItemId];
      return Object.values(itemGroupsObj);
    }
    
    // If no groups in current scenario and we have a base scenario, try base
    if (baseScenarioId) {
      const baseScenarioGroups = groupsByScenario[baseScenarioId];
      if (baseScenarioGroups && baseScenarioGroups[selectedItemId]) {
        const itemGroupsObj = baseScenarioGroups[selectedItemId];
        return Object.values(itemGroupsObj);
      }
    }
    
    return EMPTY_ARRAY;
  }
);

function GroupCards() {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  
  // Use overlay hook to get base scenario info
  const { baseScenario } = useOverlayData();
  
  // Use memoized selector for groups
  const groups = useSelector(state => 
    selectGroups(state, selectedScenarioId, baseScenario?.id, selectedItemId)
  );

  // Add group logic
  const handleAddGroup = () => {
    if (!selectedItemId || !selectedScenarioId) return;
    const newGroup = {
      kindId: selectedItemId,
      groupId: '', // Set default groupId or let user pick
      start: '',
      end: '',
    };
    dispatch(addGroup({
      scenarioId: selectedScenarioId,
      dataItemId: selectedItemId,
      group: newGroup
    }));
  };

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

  if (!groups || groups.length === 0) {
    // Show add button even if no groups exist
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddGroup}
          >
            Gruppe hinzufügen
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">Keine Gruppenzuordnungen vorhanden.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddGroup}
        >
          Gruppe hinzufügen
        </Button>
      </Box>
      {groups.map((group, idx) => {
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
            key={`${group.id}-${groups.length}`}
            expanded={expandedIdx === idx}
            onChange={handleAccordionChange(idx)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                {(group.name || 'Gruppenzuordnung')}{dateRangeText ? `: ${dateRangeText}` : ''}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <GroupDetail index={idx} group={group} />
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

export default GroupCards;