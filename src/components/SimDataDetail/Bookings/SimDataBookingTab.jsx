import React from 'react';
import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ModMonitor from '../ModMonitor';
import BookingCards from './BookingCards';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { addBookingThunk } from '../../../store/simBookingSlice';

function SimDataBookingTab() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);

  // Use overlay hook to get effective data
  const { getEffectiveDataItem, getEffectiveBookings } = useOverlayData();
  const selectedItem = getEffectiveDataItem(selectedItemId);
  const bookingsObj = getEffectiveBookings(selectedItemId);
  const bookings = Object.values(bookingsObj || {});

  // Handler to add a new booking
  const handleAddBooking = () => {
    if (!selectedScenarioId || !selectedItemId) return;
    const bookingId = Date.now();
    dispatch(addBookingThunk({
      scenarioId: selectedScenarioId,
      dataItemId: selectedItemId,
      booking: {
        id: bookingId,
        startdate: '',
        enddate: '',
        times: [],
        rawdata: {}
      }
    }));
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
  