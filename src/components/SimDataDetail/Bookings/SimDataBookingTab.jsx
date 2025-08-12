import React from 'react';
import { Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { addBookingThunk, deleteBookingThunk } from '../../../store/simBookingSlice';
import AccordionListDetail from '../../common/AccordionListDetail';
import BookingCards from './BookingCards';
import BookingDetail from './BookingDetail';

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
    const bookingId = Date.now().toString();
    const newBooking = {
      id: bookingId,
      startdate: '',
      enddate: '',
      times: [],
      rawdata: {}
    };
    dispatch(addBookingThunk({
      scenarioId: selectedScenarioId,
      dataItemId: selectedItemId,
      booking: newBooking
    }));
  };

  // Handler to delete a booking
  const handleDeleteBooking = (idx, booking) => {
    if (!selectedScenarioId || !selectedItemId || !booking?.id) return;
    dispatch(deleteBookingThunk({
      scenarioId: selectedScenarioId,
      dataItemId: selectedItemId,
      bookingId: booking.id
    }));
  };

  if (!selectedItem) return null;

  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <AccordionListDetail
        items={bookings}
        SummaryComponent={BookingCards}
        DetailComponent={({ item, index }) => <BookingDetail index={index} booking={item} />}
        AddButtonLabel="Buchungszeitraum hinzufügen"
        onAdd={handleAddBooking}
        onDelete={handleDeleteBooking}
        AddButtonProps={{ startIcon: <AddIcon /> }}
        emptyText="Keine Buchungszeiten vorhanden."
        emptyAlertSeverity='warning'
      />
    </Box>
  );
}

export default SimDataBookingTab;


