import React from 'react';
import { Box } from '@mantine/core';
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
    if (!window.confirm('Diesen Buchungsblock wirklich löschen?')) return;
    dispatch(deleteBookingThunk({
      scenarioId: selectedScenarioId,
      dataItemId: selectedItemId,
      bookingId: booking.id
    }));
  };

  const SummaryComponent = React.useCallback(({ item }) => <BookingCards item={item} />, []);
  const DetailComponent = React.useCallback(({ item, index }) => <BookingDetail index={index} booking={item} />, []);

  if (!selectedItem) return null;

  return (
    <Box>
      <AccordionListDetail
        items={bookings}
        SummaryComponent={SummaryComponent}
        DetailComponent={DetailComponent}
        AddButtonLabel="Buchungszeitraum hinzufügen"
        onAdd={handleAddBooking}
        onDelete={handleDeleteBooking}
        emptyText="Keine Buchungszeiten vorhanden."
      />
    </Box>
  );
}

export default SimDataBookingTab;
