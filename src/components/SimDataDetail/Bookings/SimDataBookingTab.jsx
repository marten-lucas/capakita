import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ModMonitor from '../ModMonitor';
import BookingCards from './BookingCards';
import { useSelector, useDispatch } from 'react-redux';

function SimDataBookingTab() {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const dataItems = useSelector(state => {
    const scenarioData = state.simData.dataByScenario[selectedScenarioId] || {};
    return Object.values(scenarioData);
  });
  const selectedItem = dataItems?.find(item => item.id === selectedItemId);

  // Use booking slice for bookings
  const bookings = useSelector(state => {
    if (!selectedScenarioId || !selectedItemId) return [];
    const scenarioBookings = state.simBooking.bookingsByScenario[selectedScenarioId] || {};
    return Object.values(scenarioBookings[selectedItemId] || {});
  });

  React.useEffect(() => {
    console.log('[SimDataBookingTab] bookings:', bookings);
  }, [bookings]);

  // Handler to add a new booking
  const handleAddBooking = () => {
    if (!selectedScenarioId || !selectedItemId) return;
    dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId: selectedScenarioId,
        dataItemId: selectedItemId,
        booking: {
          startdate: '',
          enddate: '',
          times: [],
        }
      }
    });
  };

  // Restore all bookings to original
  const handleRestoreBooking = (itemId, originalBookings) => {
    // Implement your restore logic here, e.g. dispatch an action to replace all bookings for the item
    dispatch({
      type: 'simBooking/importBookings',
      payload: {
        scenarioId: selectedScenarioId,
        items: [{ id: itemId, booking: originalBookings }]
      }
    });
  };

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
