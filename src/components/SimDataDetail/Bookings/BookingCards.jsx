import React from 'react';
import { Text, Group, Box, Avatar } from '@mantine/core';
import { consolidateBookingSummary } from '../../../utils/bookingUtils';

// Helper to calculate total hours from booking segments
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

function BookingCards({ item, index }) {
  const booking = item;
  let dateRangeText = '';
  if (booking.startdate && booking.enddate) {
    dateRangeText = `von ${booking.startdate} bis ${booking.enddate}`;
  } else if (booking.startdate) {
    dateRangeText = `ab ${booking.startdate}`;
  } else if (booking.enddate) {
    dateRangeText = `bis ${booking.enddate}`;
  }
  
  const hoursText = getBookingHours(booking.times);

  return (
    <Group wrap="nowrap" gap="sm">
      <Avatar color="blue" radius="xl" size="sm">
        {index + 1}
      </Avatar>
      <Box>
        <Text size="sm" fw={500}>
          {hoursText} {dateRangeText}
        </Text>
        <Text size="xs" c="dimmed">
          {consolidateBookingSummary(booking.times)}
        </Text>
      </Box>
    </Group>
  );
}

export default BookingCards;
