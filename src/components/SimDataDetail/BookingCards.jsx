import { Typography, Box } from '@mui/material';
import BookingAccordion from './BookingAccordion';

function BookingCards({
  bookings, type, allGroups, lastAddedIndex, onDelete, importedCount,
  originalBookings, onRestoreBooking
}) {
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
          onDelete={onDelete}
          canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
          originalBooking={Array.isArray(originalBookings) ? originalBookings[idx] : undefined}
          onRestoreBooking={onRestoreBooking}
        />
      ))}
    </Box>
  );
}

export default BookingCards;