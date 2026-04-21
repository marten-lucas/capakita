import React from 'react';
import { Stack, Text, Paper, Group, Box } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useSelector, useDispatch } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { useOverlayData } from '../../../hooks/useOverlayData';
import DayControl from './BookingDayControl';
import { getSegmentOverlapIssues, minutesToTime, normalizeTimeInput, timeToMinutes } from '../../../utils/timeUtils';

function cloneBookingTimes(times) {
  return Array.isArray(times)
    ? times.map((time) => ({
      ...time,
      segments: Array.isArray(time.segments)
        ? time.segments.map((segment) => ({ ...segment }))
        : [],
    }))
    : [];
}

function clampMinutes(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSuggestedRange(existingSegments = [], fallbackStart = '08:00', fallbackDurationMinutes = 120, preferredStartMinutes = null) {
  if (Number.isFinite(preferredStartMinutes)) {
    const start = clampMinutes(Math.round(preferredStartMinutes), 0, 24 * 60 - 15);
    const end = clampMinutes(start + fallbackDurationMinutes, start + 15, 24 * 60);
    return {
      start: minutesToTime(start),
      end: minutesToTime(end),
    };
  }

  const sortedSegments = (existingSegments || [])
    .map((segment) => ({
      start: timeToMinutes(segment.booking_start),
      end: timeToMinutes(segment.booking_end),
    }))
    .filter((segment) => segment.start !== null && segment.end !== null && segment.end > segment.start)
    .sort((a, b) => a.end - b.end);

  if (sortedSegments.length > 0) {
    const lastSegment = sortedSegments[sortedSegments.length - 1];
    const nextStart = Math.min(lastSegment.end + 30, 23 * 60 + 30);
    const nextEnd = Math.min(nextStart + fallbackDurationMinutes, 23 * 60 + 59);

    if (nextEnd > nextStart) {
      return {
        start: minutesToTime(nextStart),
        end: minutesToTime(nextEnd),
      };
    }
  }

  return {
    start: fallbackStart,
    end: minutesToTime((timeToMinutes(fallbackStart) || 0) + fallbackDurationMinutes),
  };
}

function getDayTimeByAbbr(times, dayAbbr) {
  return Array.isArray(times)
    ? times.find((time) => time.day_name === dayAbbr)
    : undefined;
}

function notifyOverlap(dayAbbr) {
  notifications.show({
    color: 'red',
    title: 'Zeit überschneidet sich',
    message: `Am Tag ${dayAbbr} dürfen sich Zeiten nicht überlappen.`,
  });
}

function hasDayOverlap(dayTime) {
  return getSegmentOverlapIssues(dayTime?.segments).length > 0;
}

function WeeklyOverview({ daysOfWeek, bookingTimes }) {
  const dayWidths = 100 / daysOfWeek.length;

  return (
    <Paper withBorder p="sm" radius="md">
      <Text fw={600} mb="xs">Wochenübersicht</Text>
      <Box
        style={{
          position: 'relative',
          height: 88,
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid var(--mantine-color-gray-3)',
          background: 'linear-gradient(180deg, rgba(8,55,67,0.03), rgba(242,110,46,0.03))',
        }}
      >
        {daysOfWeek.map((day, index) => {
          const dayData = Array.isArray(bookingTimes) ? bookingTimes.find((t) => t.day_name === day.abbr) : undefined;
          const segments = dayData?.segments || [];
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
                padding: 8,
              }}
            >
              <Text size="xs" fw={700} c="dimmed" mb={4}>
                {day.abbr}
              </Text>
              <Box
                style={{
                  position: 'relative',
                  height: 34,
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

                  return (
                    <Box
                      key={`${day.abbr}-${segIdx}`}
                      style={{
                        position: 'absolute',
                        left: `${(start / (24 * 60)) * 100}%`,
                        top: 6,
                        width: `${Math.max(((end - start) / (24 * 60)) * 100, 2)}%`,
                        height: 22,
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
    </Paper>
  );
}

function BookingDetail({ index, booking }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const { baseScenario, getEffectiveDataItem, getEffectiveBookings } = useOverlayData();

  const item = getEffectiveDataItem(selectedItemId);
  const isCapacityItem = item?.type === 'capacity';

  const baseScenarioId = baseScenario?.id;
  const baseBookingsObj = baseScenarioId ? getEffectiveBookings(selectedItemId) : {};
  const baseBooking = booking?.id ? baseBookingsObj?.[booking.id] : undefined;

  const parentItemId = selectedItemId;

  const handleUpdateBooking = (updatedBooking) => {
    if (!selectedScenarioId || !selectedItemId || !booking?.id) return;

    if (baseScenarioId) {
      const isIdenticalToBase = baseBooking && JSON.stringify(updatedBooking) === JSON.stringify(baseBooking);
      if (isIdenticalToBase) {
        dispatch({
          type: 'simOverlay/removeBookingOverlay',
          payload: {
            scenarioId: selectedScenarioId,
            itemId: selectedItemId,
            bookingId: booking.id
          }
        });
      } else {
        dispatch({
          type: 'simOverlay/setBookingOverlay',
          payload: {
            scenarioId: selectedScenarioId,
            itemId: selectedItemId,
            bookingId: booking.id,
            overlayData: updatedBooking
          }
        });
      }
    } else {
      dispatch({
        type: 'simBooking/updateBooking',
        payload: {
          scenarioId: selectedScenarioId,
          dataItemId: selectedItemId,
          bookingId: booking.id,
          updates: updatedBooking
        }
      });
    }
  };

  const handleDayToggle = (dayAbbr, isEnabled) => {
    const newTimes = cloneBookingTimes(booking.times);
    const dayIndex = newTimes.findIndex((t) => t.day_name === dayAbbr);

    if (isEnabled && dayIndex === -1) {
      const dayNr = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayAbbr) + 1;
      const suggestedRange = getSuggestedRange([], '08:00', 120);
      newTimes.push({
        day: dayNr,
        day_name: dayAbbr,
        segments: [{
          id: `${parentItemId}-${index}-${dayAbbr}-${Date.now()}`,
          booking_start: suggestedRange.start,
          booking_end: suggestedRange.end,
          category: isCapacityItem ? 'pedagogical' : undefined
        }]
      });
    } else if (!isEnabled && dayIndex !== -1) {
      newTimes.splice(dayIndex, 1);
    }

    const nextDayTime = getDayTimeByAbbr(newTimes, dayAbbr);
    if (nextDayTime && hasDayOverlap(nextDayTime)) {
      notifyOverlap(dayAbbr);
      return;
    }

    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleAddSegment = (dayAbbr, preferredStartMinutes = null) => {
    const newTimes = cloneBookingTimes(booking.times).map((t) => {
      if (t.day_name !== dayAbbr) return t;

      const suggestedRange = getSuggestedRange(t.segments, '13:00', 120, preferredStartMinutes);

      return {
        ...t,
        segments: [
          ...t.segments.map((s) => ({ ...s })),
          {
            id: `${parentItemId}-${index}-${dayAbbr}-${Date.now()}`,
            booking_start: suggestedRange.start,
            booking_end: suggestedRange.end,
            category: isCapacityItem ? 'pedagogical' : undefined
          }
        ]
      };
    });

    const nextDayTime = getDayTimeByAbbr(newTimes, dayAbbr);
    if (nextDayTime && hasDayOverlap(nextDayTime)) {
      notifyOverlap(dayAbbr);
      return;
    }

    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleTimeChange = (dayAbbr, segIdx, newValues) => {
    const nextStart = normalizeTimeInput(newValues?.start);
    const nextEnd = normalizeTimeInput(newValues?.end);

    if (!nextStart || !nextEnd) return;

    const startMinutes = timeToMinutes(nextStart);
    const endMinutes = timeToMinutes(nextEnd);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;

    const newTimes = cloneBookingTimes(booking.times).map((t) => {
      if (t.day_name === dayAbbr) {
        const newSegments = t.segments.map((seg, i) =>
          i === segIdx
            ? {
              ...seg,
              booking_start: nextStart,
              booking_end: nextEnd
            }
            : { ...seg }
        );
        return { ...t, segments: newSegments };
      }
      return t;
    });

    const nextDayTime = getDayTimeByAbbr(newTimes, dayAbbr);
    if (nextDayTime && hasDayOverlap(nextDayTime)) {
      notifyOverlap(dayAbbr);
      return;
    }

    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleRemoveSegment = (dayAbbr, segIdx) => {
    const newTimes = cloneBookingTimes(booking.times).map((t) => {
      if (t.day_name === dayAbbr && t.segments.length > 1) {
        const newSegments = t.segments.filter((_, i) => i !== segIdx).map(s => ({ ...s }));
        return { ...t, segments: newSegments };
      }
      return t;
    });

    const nextDayTime = getDayTimeByAbbr(newTimes, dayAbbr);
    if (nextDayTime && hasDayOverlap(nextDayTime)) {
      notifyOverlap(dayAbbr);
      return;
    }

    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleCategoryChange = (dayAbbr, segIdx, category) => {
    const newTimes = cloneBookingTimes(booking.times).map((t) => {
      if (t.day_name === dayAbbr) {
        const newSegments = t.segments.map((seg, i) =>
          i === segIdx ? { ...seg, category } : { ...seg }
        );
        return { ...t, segments: newSegments };
      }
      return t;
    });

    const nextDayTime = getDayTimeByAbbr(newTimes, dayAbbr);
    if (nextDayTime && hasDayOverlap(nextDayTime)) {
      notifyOverlap(dayAbbr);
      return;
    }

    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const daysOfWeek = [
    { label: 'Montag', abbr: 'Mo' }, { label: 'Dienstag', abbr: 'Di' },
    { label: 'Mittwoch', abbr: 'Mi' }, { label: 'Donnerstag', abbr: 'Do' },
    { label: 'Freitag', abbr: 'Fr' }
  ];

  const startDate = booking.startdate ? new Date(booking.startdate) : null;
  const endDate = booking.enddate ? new Date(booking.enddate) : null;

  return (
    <Stack gap="md">
      <Paper withBorder p="sm" radius="md">
        <Text fw={600} mb="xs">Gültigkeitszeitraum der Buchung</Text>
        <Group grow>
          <DatePickerInput
            label="Gültig von"
            value={startDate}
            onChange={(date) => handleUpdateBooking({ 
              ...booking, 
              startdate: date ? date.toISOString().split('T')[0] : '' 
            })}
            placeholder="Datum wählen"
            clearable
          />
          <DatePickerInput
            label="Gültig bis"
            value={endDate}
            onChange={(date) => handleUpdateBooking({ 
              ...booking, 
              enddate: date ? date.toISOString().split('T')[0] : '' 
            })}
            placeholder="Datum wählen"
            clearable
          />
        </Group>
      </Paper>

      <WeeklyOverview daysOfWeek={daysOfWeek} bookingTimes={booking.times} />

      <Paper withBorder p="sm" radius="md">
        <Text fw={600} mb="md">Tageszeiten</Text>
        <Stack gap="xs">
          {daysOfWeek.map((day) => {
              const dayData = Array.isArray(booking.times)
                ? booking.times.find((t) => t.day_name === day.abbr)
                : undefined;
            return (
              <DayControl
                key={day.abbr}
                dayLabel={day.label}
                dayAbbr={day.abbr}
                dayData={dayData}
                onToggle={(enabled) => handleDayToggle(day.abbr, enabled)}
                onAddSegment={() => handleAddSegment(day.abbr)}
                onAddSegmentAt={(minutes) => handleAddSegment(day.abbr, minutes)}
                onRemoveSegment={(sIdx) => handleRemoveSegment(day.abbr, sIdx)}
                onTimeChange={(sIdx, vals) => handleTimeChange(day.abbr, sIdx, vals)}
                isCapacity={isCapacityItem}
                onCategoryChange={(sIdx, category) => handleCategoryChange(day.abbr, sIdx, category)}
              />
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}

export default BookingDetail;
