import React from 'react';
import { Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BookingDetail from './BookingDetail';
import useSimScenarioDataStore from '../../store/simScenarioStore';
import { consolidateBookingSummary } from '../../utils/bookingUtils';


// Hilfsfunktion analog zu SimDataList
function getBookingHours(times) {
  if (!times || times.length === 0) return '0 h';
  let totalMinutes = 0;
  times.forEach(dayTime => {
    if (Array.isArray(dayTime.segments)) {
      dayTime.segments.forEach(seg => {
        if (seg.booking_start && seg.booking_end) {
          const [sh, sm] = seg.booking_start.split(':').map(Number);
          const [eh, em] = seg.booking_end.split(':').map(Number);
          const mins = (eh * 60 + em) - (sh * 60 + sm);
          if (mins > 0) totalMinutes += mins;
        }
      });
    }
  });
  return `${(totalMinutes / 60).toFixed(1)} h`;
}

function BookingCards({
  itemId, type, importedCount, originalBookings, onRestoreBooking, onDelete, isManualEntry
}) {
  const { getItemBookings, updateItemBookings } = useSimScenarioDataStore((state) => ({
    getItemBookings: state.getItemBookings,
    updateItemBookings: state.updateItemBookings,
  }));

  const bookings = getItemBookings(itemId);

  // Track expanded accordion index
  const [expandedIdx, setExpandedIdx] = React.useState(bookings && bookings.length > 0 ? 0 : null);

  // Expand last booking when bookings length increases
  const prevLengthRef = React.useRef(bookings ? bookings.length : 0);
  React.useEffect(() => {
    if (bookings && bookings.length > prevLengthRef.current) {
      setExpandedIdx(bookings.length - 1);
    }
    prevLengthRef.current = bookings ? bookings.length : 0;
  }, [bookings]);

  const handleAccordionChange = (idx) => (event, expanded) => {
    setExpandedIdx(expanded ? idx : null);
  };

  const handleUpdateBooking = (index, updatedBooking) => {
    const updatedBookings = bookings.map((b, idx) => (idx === index ? updatedBooking : b));
    updateItemBookings(itemId, updatedBookings);
  };

  if (!bookings || bookings.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Buchungszeiten vorhanden.</Typography>;
  }

  return (
    <Box>
      {bookings.map((booking, idx) => {
        // Zeitraum-Text
        let dateRangeText = '';
        if (booking.startdate && booking.enddate) {
          dateRangeText = `von ${booking.startdate} bis ${booking.enddate}`;
        } else if (booking.startdate) {
          dateRangeText = `ab ${booking.startdate}`;
        } else if (booking.enddate) {
          dateRangeText = `bis ${booking.enddate}`;
        }

        // Stunden-Summe
        const hoursText = getBookingHours(booking.times);

        return (
          <Accordion
            key={idx}
            expanded={expandedIdx === idx}
            onChange={handleAccordionChange(idx)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box>
                <Typography variant="subtitle1">{`Buchung ${idx + 1}:`}  <Box component="span" fontWeight='fontWeightMedium'>{hoursText} {dateRangeText}</Box></Typography>
                <Typography variant="caption">{consolidateBookingSummary(booking.times)}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <BookingDetail
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
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

export default BookingCards;