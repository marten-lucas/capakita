import React from 'react';
import { Typography, Box, Avatar } from '@mui/material';
import { consolidateBookingSummary } from '../../../utils/bookingUtils';


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

// Summary component for a booking
function BookingCards({ item, index }) {
  const booking = item;
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
    <Box display="flex" alignItems="center" gap={2}>
      <Avatar sx={{ bgcolor: 'primary.main', color: 'white', width: 32, height: 32, fontWeight: 700 }}>
        {index + 1}
      </Avatar>
      <Box>
        <Typography variant="subtitle1">
          <Box component="span" fontWeight='fontWeightMedium'>{hoursText} {dateRangeText}</Box>
        </Typography>
        <Typography variant="caption">{consolidateBookingSummary(booking.times)}</Typography>
      </Box>
    </Box>
  );
}

export default BookingCards;