import React from 'react';
import { Text, Group, Box, Avatar } from '@mantine/core';
import { consolidateBookingSummary } from '../../../utils/bookingUtils';
import { calculateSegmentMinutes, formatDurationHours } from '../../../utils/timeUtils';

// Helper to calculate total hours from booking segments
function getBookingHours(times) {
  if (!times || times.length === 0) return '0 h';
  let totalMinutes = 0;
  times.forEach((dayTime) => {
    if (Array.isArray(dayTime.segments)) {
      dayTime.segments.forEach((segment) => {
        const minutes = calculateSegmentMinutes(segment);
        if (minutes && minutes > 0) totalMinutes += minutes;
      });
    }
  });
  return formatDurationHours(totalMinutes);
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
