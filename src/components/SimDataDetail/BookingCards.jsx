import { Typography, Box } from '@mui/material';
import BookingDetail from './BookingDetail';
import useSimScenarioDataStore from '../../store/simScenarioStore';

function BookingDetails({
  itemId, type, importedCount, originalBookings, onRestoreBooking, onDelete, isManualEntry
}) {
  const { getItemBookings, updateItemBookings } = useSimScenarioDataStore((state) => ({
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
        <BookingDetail
          key={idx}
          booking={booking}
          index={idx}
          type={type}
          canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
          originalBooking={Array.isArray(originalBookings) ? originalBookings[idx] : undefined}
          onRestoreBooking={onRestoreBooking}
          onUpdateBooking={(updatedBooking) => handleUpdateBooking(idx, updatedBooking)}
          onDelete={onDelete}
          isManualEntry={isManualEntry}
          parentItemId={itemId}
        />
      ))}
    </Box>
  );
}

export default BookingDetails;