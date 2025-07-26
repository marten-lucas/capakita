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
  
  const dataItemsSelector = React.useMemo(
    () => (state) => {
      if (!selectedScenarioId) return [];
      return selectDataItemsByScenario(state, selectedScenarioId);
    },
    [selectedScenarioId]
  );
  const dataItems = useSelector(dataItemsSelector);
  
  const item = React.useMemo(() => {
    if (!selectedItemId || !dataItems) return null;
    return dataItems.find(i => i.id === selectedItemId) || null;
  }, [dataItems, selectedItemId]);

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
