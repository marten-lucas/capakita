import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ModMonitor from '../ModMonitor';
import BookingCards from './BookingCards';
import useSimScenarioStore from '../../../store/simScenarioStore';
import useSimDataStore from '../../../store/simDataStore';
import useSimBookingStore from '../../../store/simBookingStore';

function SimDataBookingTab() {
  // Get scenario and item selection
  const selectedScenarioId = useSimScenarioStore(state => state.selectedScenarioId);
  const selectedItemId = useSimScenarioStore(state => state.selectedItems?.[selectedScenarioId]);
  const dataItems = useSimDataStore(state => state.getDataItems(selectedScenarioId));
  const selectedItem = dataItems?.find(item => item.id === selectedItemId);

  // Use booking store for bookings
  const bookings = useSimBookingStore(state =>
    selectedScenarioId && selectedItemId
      ? state.getSelectedItemBookings(selectedScenarioId, selectedItemId)
      : []
  );

  // Use booking store's addBooking
  const addBooking = useSimBookingStore(state => state.addBooking);

  // Handler to add a new booking
  const handleAddBooking = () => {
    if (!selectedScenarioId || !selectedItemId) return;
    // Add a minimal booking object, adjust as needed
    addBooking(selectedScenarioId, selectedItemId, {
      startdate: '',
      enddate: '',
      times: [],
    });
  };

  // Get bookings and handlers from scenario store
  const handleRestoreBooking = useSimScenarioStore(state => state.handleRestoreBooking);

  if (!selectedItem) return null;

  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddBooking}
        >
          Buchungszeitraum hinzufügen
        </Button>
        <ModMonitor
          itemId={selectedItem.id}
          field="bookings"
          value={JSON.stringify(bookings)}
          originalValue={JSON.stringify(selectedItem.originalParsedData?.booking || [])}
          onRestore={() => {
            selectedItem.originalParsedData?.booking &&
              handleRestoreBooking(selectedItem.id, JSON.parse(JSON.stringify(selectedItem.originalParsedData.booking)));
          }}
          title="Alle Buchungen auf importierte Werte zurücksetzen"
          confirmMsg="Alle Buchungen auf importierten Wert zurücksetzen?"
        />
      </Box>
      <BookingCards />
    </Box>
  );
}

export default SimDataBookingTab;

