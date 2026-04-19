import React from 'react';
import { Stack, Text, Paper, Group, Box } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import DayControl from './BookingDayControl';
import { valueToTime } from '../../../utils/timeUtils';

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
    const newTimes = Array.isArray(booking.times) ? booking.times.map(t => ({ ...t, segments: t.segments.map(s => ({ ...s })) })) : [];
    const dayIndex = newTimes.findIndex((t) => t.day_name === dayAbbr);

    if (isEnabled && dayIndex === -1) {
      const dayNr = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayAbbr) + 1;
      newTimes.push({
        day: dayNr,
        day_name: dayAbbr,
        segments: [{
          id: `${parentItemId}-${index}-${dayAbbr}-${Date.now()}`,
          booking_start: '08:00',
          booking_end: '16:00',
          category: isCapacityItem ? 'pedagogical' : undefined
        }]
      });
    } else if (!isEnabled && dayIndex !== -1) {
      newTimes.splice(dayIndex, 1);
    }
    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleAddSegment = (dayAbbr) => {
    const newTimes = booking.times.map((t) =>
      t.day_name === dayAbbr
        ? {
          ...t,
          segments: [
            ...t.segments.map(s => ({ ...s })),
            {
              id: `${parentItemId}-${index}-${dayAbbr}-${Date.now()}`,
              booking_start: '13:00',
              booking_end: '16:00',
              category: isCapacityItem ? 'pedagogical' : undefined
            }
          ]
        }
        : { ...t, segments: t.segments.map(s => ({ ...s })) }
    );
    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleTimeChange = (dayAbbr, segIdx, newValues) => {
    const newTimes = booking.times.map((t) => {
      if (t.day_name === dayAbbr) {
        const newSegments = t.segments.map((seg, i) =>
          i === segIdx
            ? {
              ...seg,
              booking_start: valueToTime(newValues[0]),
              booking_end: valueToTime(newValues[1])
            }
            : { ...seg }
        );
        return { ...t, segments: newSegments };
      }
      return { ...t, segments: t.segments.map(s => ({ ...s })) };
    });
    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleRemoveSegment = (dayAbbr, segIdx) => {
    const newTimes = booking.times.map((t) => {
      if (t.day_name === dayAbbr && t.segments.length > 1) {
        const newSegments = t.segments.filter((_, i) => i !== segIdx).map(s => ({ ...s }));
        return { ...t, segments: newSegments };
      }
      return { ...t, segments: t.segments.map(s => ({ ...s })) };
    });
    handleUpdateBooking({ ...booking, times: newTimes });
  };

  const handleCategoryChange = (dayAbbr, segIdx, category) => {
    const newTimes = booking.times.map((t) => {
      if (t.day_name === dayAbbr) {
        const newSegments = t.segments.map((seg, i) =>
          i === segIdx ? { ...seg, category } : { ...seg }
        );
        return { ...t, segments: newSegments };
      }
      return { ...t, segments: t.segments.map((s) => ({ ...s })) };
    });
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

      <Paper withBorder p="sm" radius="md">
        <Text fw={600} mb="md">Tageszeiten</Text>
        <Stack gap="xs">
          {daysOfWeek.map((day) => {
            const dayData = booking.times.find((t) => t.day_name === day.abbr);
            return (
              <DayControl
                key={day.abbr}
                dayLabel={day.label}
                dayAbbr={day.abbr}
                dayData={dayData}
                onToggle={(enabled) => handleDayToggle(day.abbr, enabled)}
                onAddSegment={() => handleAddSegment(day.abbr)}
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
