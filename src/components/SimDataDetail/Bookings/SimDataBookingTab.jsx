import React from 'react';
import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ModMonitor from '../ModMonitor';
import BookingCards from './BookingCards';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';

const EMPTY_BOOKINGS = [];

function SimDataBookingTab() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  // Get the selected item directly by key
  const selectedItem = useSelector(state => state.simData.dataByScenario[selectedScenarioId]?.[selectedItemId]);

  // Memoized selector for bookings
  const bookingsSelector = React.useMemo(() => 
    createSelector(
      [
        state => state.simBooking.bookingsByScenario,
        () => selectedScenarioId,
        () => selectedItemId
      ],
      (bookingsByScenario, scenarioId, itemId) => {
        if (!scenarioId || !itemId) return EMPTY_BOOKINGS;
        const scenarioBookings = bookingsByScenario[scenarioId];
        if (!scenarioBookings) return EMPTY_BOOKINGS;
        const itemBookings = scenarioBookings[itemId];
        return itemBookings ? Object.values(itemBookings) : EMPTY_BOOKINGS;
      }
    ),
    [selectedScenarioId, selectedItemId]
  );
  
  const bookings = useSelector(bookingsSelector);

  
  // Handler to add a new booking
  const handleAddBooking = () => {
    if (!selectedScenarioId || !selectedItemId) return;
    const bookingId = Date.now();
    dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId: selectedScenarioId,
        dataItemId: selectedItemId,
        booking: {
          id: bookingId,
          startdate: '',
          enddate: '',
          times: [],
          rawdata: {}
        }
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
          itemId={selectedItemId}
          field="bookings"
          value={JSON.stringify(bookings)}
          originalValue={undefined}
          onRestore={undefined}
          title="Alle Buchungen auf importierte Werte zurücksetzen"
          confirmMsg="Alle Buchungen auf importierten Wert zurücksetzen?"
        />
      </Box>
      <BookingCards bookings={bookings} />
    </Box>
  );
}

export default SimDataBookingTab;

