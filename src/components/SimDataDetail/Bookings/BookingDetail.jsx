import React from 'react';
import { Alert, Stack, Text, Group } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useSelector, useDispatch } from 'react-redux';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useOverlayData } from '../../../hooks/useOverlayData';
import DayControl from './BookingDayControl';
import { getSegmentOverlapIssues, minutesToTime, normalizeTimeInput, timeToMinutes } from '../../../utils/timeUtils';

const TIMELINE_START_MINUTES = 6 * 60;
const TIMELINE_END_MINUTES = 19 * 60;

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

function getSuggestedRange(existingSegments = [], fallbackStart = '08:00', fallbackDurationMinutes = 30, preferredStartMinutes = null) {
  if (Number.isFinite(preferredStartMinutes)) {
    const maxStart = Math.max(TIMELINE_START_MINUTES, TIMELINE_END_MINUTES - fallbackDurationMinutes);
    const start = clampMinutes(Math.round(preferredStartMinutes), TIMELINE_START_MINUTES, maxStart);
    const end = clampMinutes(start + fallbackDurationMinutes, start + 15, TIMELINE_END_MINUTES);
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
    const nextStart = Math.min(lastSegment.end + 30, TIMELINE_END_MINUTES - 15);
    const nextEnd = Math.min(nextStart + fallbackDurationMinutes, TIMELINE_END_MINUTES);

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

function hasDayOverlap(dayTime) {
  return getSegmentOverlapIssues(dayTime?.segments).length > 0;
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
      const suggestedRange = getSuggestedRange([], '08:00', 30);
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
      return;
    }

    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleAddSegment = (dayAbbr, preferredStartMinutes = null) => {
    const newTimes = cloneBookingTimes(booking.times).map((t) => {
      if (t.day_name !== dayAbbr) return t;

      const suggestedRange = getSuggestedRange(t.segments, '13:00', 30, preferredStartMinutes);

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

    // Always save – inline alert shows/hides based on current state
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

    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const daysOfWeek = [
    { label: 'Montag', abbr: 'Mo' }, { label: 'Dienstag', abbr: 'Di' },
    { label: 'Mittwoch', abbr: 'Mi' }, { label: 'Donnerstag', abbr: 'Do' },
    { label: 'Freitag', abbr: 'Fr' }
  ];

  const overlapDays = React.useMemo(() => {
    if (!Array.isArray(booking.times)) return [];
    return booking.times
      .filter((t) => hasDayOverlap(t))
      .map((t) => {
        const day = daysOfWeek.find((d) => d.abbr === t.day_name);
        return day ? day.label : t.day_name;
      });
  }, [booking.times]); // eslint-disable-line react-hooks/exhaustive-deps

  const validityRange = [booking.startdate || null, booking.enddate || null];
  const [startDraft, setStartDraft] = React.useState(validityRange[0]);
  const [endDraft, setEndDraft] = React.useState(validityRange[1]);

  React.useEffect(() => {
    setStartDraft(booking.startdate || null);
    setEndDraft(booking.enddate || null);
  }, [booking.startdate, booking.enddate]);

  function isoFromValue(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return '';
  }

  const commitDate = (nextStart, nextEnd) => {
    handleUpdateBooking({
      ...booking,
      startdate: isoFromValue(nextStart),
      enddate: isoFromValue(nextEnd),
    });
  };

  return (
    <Stack gap="md">
      <Group align="center" wrap="nowrap" gap="sm">
        <Text fw={600} style={{ whiteSpace: 'nowrap' }}>Gültigkeitszeitraum</Text>
        <DatePickerInput
          placeholder="Von"
          value={startDraft}
          onChange={(value) => {
            setStartDraft(value);
            commitDate(value, endDraft);
          }}
          valueFormat="DD.MM.YYYY"
          clearable
          style={{ flex: 1 }}
          aria-label="Gültig ab"
        />
        <Text size="sm" c="dimmed">–</Text>
        <DatePickerInput
          placeholder="Bis"
          value={endDraft}
          onChange={(value) => {
            setEndDraft(value);
            commitDate(startDraft, value);
          }}
          valueFormat="DD.MM.YYYY"
          clearable
          style={{ flex: 1 }}
          aria-label="Gültig bis"
        />
      </Group>

      <Stack gap="md">
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
            />
          );
        })}
      </Stack>

      {overlapDays.length > 0 && (
        <Alert
          icon={<IconAlertTriangle size={14} />}
          color="red"
          variant="light"
          py={6}
          px="sm"
          styles={{ message: { fontSize: 'var(--mantine-font-size-xs)' } }}
        >
          {overlapDays.length === 1
            ? `Zeitüberschneidung am ${overlapDays[0]}`
            : `Zeitüberschneidungen: ${overlapDays.join(', ')}`}
        </Alert>
      )}
    </Stack>
  );
}

export default BookingDetail;
