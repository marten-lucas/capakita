import {
  Typography, Box
} from '@mui/material';
import { useState, useEffect } from 'react';
import SimulationDataTab from './SimDataDetail/SimulationDataTab';
import useSimScenarioStore from '../store/simScenarioStore';
import useSimDataStore from '../store/simDataStore'; // <-- import your data store

function SimDataDetailForm({ scenarioId, simDataStore, simGroupStore, simBookingStore, simFinancialsStore, simQualificationStore }) {
  // Get selected item id for this scenario
  const selectedItemId = useSimScenarioStore(state => state.selectedItems?.[scenarioId]);
  // Get the item from the data store
  const item = useSimDataStore(state => state.getDataItem(scenarioId, selectedItemId));

  const updateItemDates = useSimScenarioStore(state => state.updateItemDates);
  const addItemToScenario = useSimScenarioStore(state => state.addItemToScenario);

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
        scenarioId={scenarioId}
        simDataStore={simDataStore}
        simGroupStore={simGroupStore}
        simBookingStore={simBookingStore}
        simFinancialsStore={simFinancialsStore}
        simQualificationStore={simQualificationStore}
        lastAddedBookingIdx={lastAddedBookingIdx}
        lastAddedGroupIdx={lastAddedGroupIdx}
        importedBookingCount={importedBookingCount}
        importedGroupCount={importedGroupCount}
        updateItemDates={updateItemDates}
        addItemToScenario={addItemToScenario}
      />
    </Box>
  );
}

export default SimDataDetailForm;
