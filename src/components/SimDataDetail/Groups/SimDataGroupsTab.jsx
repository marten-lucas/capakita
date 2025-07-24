import React from 'react';
import { Typography, Box } from '@mui/material';
import ModMonitor from '../ModMonitor';
import GroupCards from './GroupCards';
import { useSelector } from 'react-redux';

function SimDataGroupsTab() {
  // Get scenario and item selection
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const dataItems = useSelector(state => {
    const scenarioData = state.simData.dataByScenario[selectedScenarioId] || {};
    return Object.values(scenarioData);
  });
  const item = dataItems?.find(i => i.id === selectedItemId);

  if (!item) return null;

  const groups = item.groups || [];

  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2, mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Gruppen:
          <ModMonitor
            itemId={item.id}
            field="groups"
            value={JSON.stringify(groups)}
            originalValue={JSON.stringify(item.originalParsedData?.group || [])}
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
