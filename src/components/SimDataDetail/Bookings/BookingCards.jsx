import React from 'react';
import { Text, Group, Box, Avatar, Stack, Badge } from '@mantine/core';
import { consolidateBookingSummary } from '../../../utils/bookingUtils';
import { calculateSegmentMinutes, formatDurationHours, timeToMinutes } from '../../../utils/timeUtils';

const TIMELINE_START_MINUTES = 6 * 60;
const TIMELINE_END_MINUTES = 19 * 60;
const TIMELINE_TOTAL_MINUTES = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES;

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

function BookingWeeklyOverview({ bookingTimes }) {
  const daysOfWeek = [
    { abbr: 'Mo' },
    { abbr: 'Di' },
    { abbr: 'Mi' },
    { abbr: 'Do' },
    { abbr: 'Fr' },
  ];
  const dayWidths = 100 / daysOfWeek.length;

  return (
    <Box
      style={{
        position: 'relative',
        height: 54,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--mantine-color-gray-3)',
        background: 'linear-gradient(180deg, rgba(8,55,67,0.03), rgba(242,110,46,0.03))',
      }}
    >
      {daysOfWeek.map((day, index) => {
        const dayData = Array.isArray(bookingTimes) ? bookingTimes.find((t) => t.day_name === day.abbr) : undefined;
        const segments = dayData?.segments || [];
        const totalMinutes = segments.reduce((minutes, segment) => {
          const start = timeToMinutes(segment.booking_start);
          const end = timeToMinutes(segment.booking_end);
          const duration = start !== null && end !== null ? end - start : 0;
          return duration > 0 ? minutes + duration : minutes;
        }, 0);
        const pedagogicalMinutes = segments.reduce((minutes, segment) => {
          const start = timeToMinutes(segment.booking_start);
          const end = timeToMinutes(segment.booking_end);
          const duration = start !== null && end !== null ? end - start : 0;
          if (duration <= 0) return minutes;
          return segment.category === 'administrative' ? minutes : minutes + duration;
        }, 0);
        const administrativeMinutes = segments.reduce((minutes, segment) => {
          const start = timeToMinutes(segment.booking_start);
          const end = timeToMinutes(segment.booking_end);
          const duration = start !== null && end !== null ? end - start : 0;
          if (duration <= 0) return minutes;
          return segment.category === 'administrative' ? minutes + duration : minutes;
        }, 0);
        const hoursLabel = totalMinutes > 0 ? formatDurationHours(totalMinutes) : '';

        return (
          <Box
            key={day.abbr}
            style={{
              position: 'absolute',
              left: `${index * dayWidths}%`,
              top: 0,
              width: `${dayWidths}%`,
              bottom: 0,
              borderLeft: index === 0 ? 'none' : '1px solid rgba(8,55,67,0.08)',
              padding: 6,
            }}
          >
            <Group justify="space-between" align="center" gap={4} mb={4}>
              <Text size="10px" fw={700} c="dimmed">
                {day.abbr}
              </Text>
              <Group gap={3} wrap="nowrap">
                {hoursLabel && (
                  <Badge size="xs" variant="light" color="gray">
                    {hoursLabel}
                  </Badge>
                )}
                {pedagogicalMinutes > 0 && (
                  <Badge size="xs" variant="light" color="blue">
                    {formatDurationHours(pedagogicalMinutes)}
                  </Badge>
                )}
                {administrativeMinutes > 0 && (
                  <Badge size="xs" variant="light" color="violet">
                    {formatDurationHours(administrativeMinutes)}
                  </Badge>
                )}
              </Group>
            </Group>
            <Box
              style={{
                position: 'relative',
                height: 18,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid rgba(8,55,67,0.1)',
              }}
            >
              {segments.map((segment, segIdx) => {
                const start = timeToMinutes(segment.booking_start);
                const end = timeToMinutes(segment.booking_end);
                if (start === null || end === null || end <= start) return null;

                const clippedStart = Math.max(start, TIMELINE_START_MINUTES);
                const clippedEnd = Math.min(end, TIMELINE_END_MINUTES);
                if (clippedEnd <= clippedStart) return null;

                return (
                  <Box
                    key={`${day.abbr}-${segIdx}`}
                    style={{
                      position: 'absolute',
                      left: `${((clippedStart - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100}%`,
                      top: 3,
                      width: `${Math.max(((clippedEnd - clippedStart) / TIMELINE_TOTAL_MINUTES) * 100, 2)}%`,
                      height: 10,
                      borderRadius: 999,
                      background: segment.category === 'administrative'
                        ? 'linear-gradient(135deg, rgba(145,65,172,0.65), rgba(145,65,172,0.35))'
                        : 'linear-gradient(135deg, rgba(34,139,230,0.72), rgba(34,139,230,0.4))',
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function formatGermanDate(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function BookingCards({ item, index }) {
  const booking = item;
  const start = formatGermanDate(booking.startdate);
  const end = formatGermanDate(booking.enddate);
  let dateRangeText = '';
  if (start && end) {
    dateRangeText = `von ${start} bis ${end}`;
  } else if (start) {
    dateRangeText = `ab ${start}`;
  } else if (end) {
    dateRangeText = `bis ${end}`;
  }
  
  const hoursText = getBookingHours(booking.times);

  return (
    <Stack gap={6} w="100%">
      <Group wrap="nowrap" gap="sm" align="flex-start">
        <Avatar color="blue" radius="xl" size="sm">
          {index + 1}
        </Avatar>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500}>
            {hoursText} {dateRangeText}
          </Text>
          <Text size="xs" c="dimmed">
            {consolidateBookingSummary(booking.times)}
          </Text>
        </Box>
      </Group>
      <Box>
        <Box h={18} />
        <BookingWeeklyOverview bookingTimes={booking.times} />
      </Box>
    </Stack>
  );
}

export default BookingCards;
