import { Typography, Box } from '@mui/material';
import BookingAccordion from './BookingAccordion';
import useSimulationDataStore from '../../store/simulationDataStore';

function BookingCards({
  itemId, type, allGroups, lastAddedIndex, importedCount, originalBookings, onRestoreBooking, onDelete
}) {
  const { getItemBookings, updateItemBookings } = useSimulationDataStore((state) => ({
    getItemBookings: state.getItemBookings,
    updateItemBookings: state.updateItemBookings,
  }));

  const bookings = getItemBookings(itemId);

  const handleUpdateBooking = (index, updatedBooking) => {
    const updatedBookings = bookings.map((b, idx) => (idx === index ? updatedBooking : b));
    updateItemBookings(itemId, updatedBookings);
  };

  if (!bookings || bookings.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Buchungszeiten vorhanden.</Typography>;
  }

  return (
    <Box>
      {bookings.map((booking, idx) => (
        <BookingAccordion
          key={idx}
          booking={booking}
          index={idx}
          type={type}
          allGroups={allGroups}
          defaultExpanded={lastAddedIndex === idx}
          canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
          originalBooking={Array.isArray(originalBookings) ? originalBookings[idx] : undefined}
          onRestoreBooking={onRestoreBooking}
          onUpdateBooking={(updatedBooking) => handleUpdateBooking(idx, updatedBooking)}
          onDelete={onDelete}
        />
      ))}
    </Box>
  );
}

export default BookingCards;