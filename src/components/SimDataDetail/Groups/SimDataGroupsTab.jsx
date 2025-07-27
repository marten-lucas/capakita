import React from 'react';
import { Typography, Box } from '@mui/material';
import ModMonitor from '../ModMonitor';
import GroupCards from './GroupCards';
import { useSelector } from 'react-redux';
import { selectDataItemsByScenario } from '../../../store/simDataSlice';

function SimDataGroupsTab() {
  // Get scenario and item selection
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  
  // Get groups from simGroup store instead of item.groups
  const groups = useSelector(state => {
    if (!selectedScenarioId || !selectedItemId) return [];
    const scenarioGroups = state.simGroup.groupsByScenario[selectedScenarioId] || {};
    const itemGroupsObj = scenarioGroups[selectedItemId] || {};
    return Object.values(itemGroupsObj);
  });

  if (!selectedItemId) return null;

  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2, mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Gruppen:
          <ModMonitor
            itemId={selectedItemId}
            field="groups"
            value={JSON.stringify(groups)}
            originalValue={undefined}
            // onRestore logic can be implemented as needed
            title="Alle Gruppen auf importierte Werte zurücksetzen"
            confirmMsg="Alle Gruppen auf importierten Wert zurücksetzen?"
          />
        </Typography>
      </Box>
      <GroupCards />
    </Box>
  );
}

export default SimDataGroupsTab;
