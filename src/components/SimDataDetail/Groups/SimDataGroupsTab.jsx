import React from 'react';
import { Typography, Box } from '@mui/material';
import GroupCards from './GroupCards';
import { useSelector } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';

function SimDataGroupsTab() {
  // Get scenario and item selection
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const { getEffectiveDataItem } = useOverlayData();
  const item = getEffectiveDataItem(selectedItemId);

  if (!selectedItemId || !item) return null;

  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2, mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Gruppen:
        </Typography>
      </Box>
      <GroupCards itemId={selectedItemId} />
    </Box>
  );
}

export default SimDataGroupsTab;


