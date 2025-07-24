import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails, Button
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import React from 'react';
import GroupDetail from './GroupDetail';
import { useSelector, useDispatch } from 'react-redux';

function GroupCards() {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const dataItems = useSelector(state => {
    const scenarioData = state.simData.dataByScenario[selectedScenarioId] || {};
    return Object.values(scenarioData);
  });
  const item = dataItems?.find(i => i.id === selectedItemId);

  // Read groups directly from the item (not from scenario store)
  const groups = React.useMemo(() => item?.groups || [], [item]);
  const bookings = item?.bookings || [];

  // Add group logic
  const handleAddGroup = () => {
    if (!item) return;
    const newGroup = {
      id: Date.now().toString(),
      name: 'Neue Gruppe',
      start: '',
      end: '',
      // Add other default fields as needed
    };
    const updatedGroups = [...groups, newGroup];
    dispatch({
      type: 'simData/updateDataItem',
      payload: {
        scenarioId: selectedScenarioId,
        itemId: item.id,
        updates: { groups: updatedGroups }
      }
    });
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
              <GroupDetail index={idx} />
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

export default GroupCards;