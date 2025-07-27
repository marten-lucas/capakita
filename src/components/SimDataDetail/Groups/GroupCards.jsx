import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails, Button
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import React from 'react';
import GroupDetail from './GroupDetail';
import { useSelector, useDispatch } from 'react-redux';
import { selectDataItemsByScenario } from '../../../store/simDataSlice';
import { addGroup } from '../../../store/simGroupSlice';

function GroupCards() {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const dataItemsSelector = React.useMemo(
    () => (state) => selectDataItemsByScenario(state, selectedScenarioId),
    [selectedScenarioId]
  );
  const dataItems = useSelector(dataItemsSelector);
  const item = dataItems?.find(i => i.id === selectedItemId);

  // Read groups directly from the simGroup store using memoized selector
  const groups = useSelector(state => {
    if (!selectedScenarioId || !selectedItemId) return [];
    const scenarioGroups = state.simGroup.groupsByScenario[selectedScenarioId] || {};
    const itemGroupsObj = scenarioGroups[selectedItemId] || {};
    return Object.values(itemGroupsObj);
  });

  // Add group logic
  const handleAddGroup = () => {
    if (!selectedItemId || !selectedScenarioId) return;
    const newGroup = {
      kindId: selectedItemId,
      groupId: '', // Set default groupId or let user pick
      start: '',
      end: '',
      overlays: {}
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