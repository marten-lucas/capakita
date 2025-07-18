import {
  Typography, Box
} from '@mui/material';
import { useState, useEffect } from 'react';
import SimulationDataTab from './SimDataDetail/SimulationDataTab';
import useSimulationDataStore from '../store/simulationDataStore';
import useAppSettingsStore from '../store/appSettingsStore';
import React from 'react';

function SimDataDetailForm({ item }) {
  const updateItemDates = useSimulationDataStore(state => state.updateItemDates);

  // Get all groups from AppSettingsStore
  const allGroups = useAppSettingsStore(state => {
    const groups = state.groups;
    const lookup = {};
    groups.forEach(g => {
      lookup[g.id] = g.name;
    });
    return lookup;
  });

  const [lastAddedBookingIdx, setLastAddedBookingIdx] = useState(null);
  const [lastAddedGroupIdx, setLastAddedGroupIdx] = useState(null);
  const [importedBookingCount, setImportedBookingCount] = useState(0);
  const [importedGroupCount, setImportedGroupCount] = useState(0);

  // Update local state if item changes
  useEffect(() => {
    setLastAddedBookingIdx(null);
    setLastAddedGroupIdx(null);

    // Zähle importierte Buchungen/Gruppen (aus Adebis)
    if (item?.rawdata?.source === 'adebis export') {
      setImportedBookingCount(Array.isArray(item?.originalParsedData?.booking) ? item.originalParsedData.booking.length : 0);
      setImportedGroupCount(Array.isArray(item?.originalParsedData?.group) ? item.originalParsedData.group.length : 0);
    } else {
      setImportedBookingCount(0);
      setImportedGroupCount(0);
    }
  }, [item]);

  // Guard: Wenn item nicht gesetzt, Hinweis anzeigen und return
  if (!item) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">
          Wählen Sie einen Eintrag aus, um Details anzuzeigen.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      bgcolor="background.paper"
      boxShadow={3}
      borderRadius={2}
      p={3}
      height="90%"
      display="flex"
      flexDirection="column"
      overflow="auto"
    >
      <SimulationDataTab 
        item={item}
        allGroups={allGroups}
        lastAddedBookingIdx={lastAddedBookingIdx}
        lastAddedGroupIdx={lastAddedGroupIdx}
        importedBookingCount={importedBookingCount}
        importedGroupCount={importedGroupCount}
        updateItemDates={updateItemDates}
      />
    </Box>
  );
}

export default SimDataDetailForm;
