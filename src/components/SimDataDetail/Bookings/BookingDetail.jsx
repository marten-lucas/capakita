import React from 'react';
import {
  Typography, Box, Button, Divider, TextField, Switch, Slider,
} from '@mui/material';
import { convertDDMMYYYYtoYYYYMMDD } from '../../../utils/dateUtils';
import { valueToTime } from '../../../utils/timeUtils';
import { useSelector, useDispatch } from 'react-redux';
import DayControl from './BookingDayControl';
import { useOverlayData } from '../../../hooks/useOverlayData';

// BookingDetail component
function BookingDetail({ index, booking }) {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const { baseScenario, getEffectiveDataItem, getEffectiveBookings } = useOverlayData();
  const item = getEffectiveDataItem(selectedItemId);

  // Get base booking for overlay comparison
  const baseScenarioId = baseScenario?.id;
  const baseBookingsObj = baseScenarioId ? getEffectiveBookings(selectedItemId) : {};
  const baseBooking = booking?.id ? baseBookingsObj?.[booking.id] : undefined;

  const type = item?.type;
  const parentItemId = selectedItemId;

  // Helper to update the booking in the store or overlay
  const handleUpdateBooking = (updatedBooking) => {
    if (!selectedScenarioId || !selectedItemId || !booking?.id) return;

    // If in a based scenario, use overlays
    if (baseScenarioId) {
      // Compare with base booking
      const isIdenticalToBase = baseBooking && JSON.stringify(updatedBooking) === JSON.stringify(baseBooking);
      if (isIdenticalToBase) {
        // Remove overlay if matches base
        dispatch({
          type: 'simOverlay/removeBookingOverlay',
          payload: {
            scenarioId: selectedScenarioId,
            itemId: selectedItemId,
            bookingId: booking.id
          }
        });
      } else {
        // Set overlay if different from base
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
      // Regular scenario - update directly in simBooking
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
    // Deep clone booking and times
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
          booking_end: '16:00'
        }]
      });
    } else if (!isEnabled && dayIndex !== -1) {
      newTimes.splice(dayIndex, 1);
    }
    const updatedBooking = { ...booking, times: newTimes };
    handleUpdateBooking(updatedBooking);
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
              booking_end: '16:00'
            }
          ]
        }
        : { ...t, segments: t.segments.map(s => ({ ...s })) }
    );
    const updatedBooking = { ...booking, times: newTimes };
    handleUpdateBooking(updatedBooking);
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
    const updatedBooking = { ...booking, times: newTimes };
    handleUpdateBooking(updatedBooking);
  };

  const handleRemoveSegment = (dayAbbr, segIdx) => {
    const newTimes = booking.times.map((t) => {
      if (t.day_name === dayAbbr && t.segments.length > 1) {
        const newSegments = t.segments.filter((_, i) => i !== segIdx).map(s => ({ ...s }));
        return { ...t, segments: newSegments };
      }
      return { ...t, segments: t.segments.map(s => ({ ...s })) };
    });
    const updatedBooking = { ...booking, times: newTimes };
    handleUpdateBooking(updatedBooking);
  };

  const handleDateChange = (field, value) => {
    // value from date picker is always YYYY-MM-DD, store as such
    const updatedBooking = {
      ...booking,
      [field]: value,
    };
    handleUpdateBooking(updatedBooking);
  };

  // Prüft, ob ein einzelner Tag (Mo, Di, ...) im Booking geändert wurde

  const daysOfWeek = [
    { label: 'Montag', abbr: 'Mo' }, { label: 'Dienstag', abbr: 'Di' },
    { label: 'Mittwoch', abbr: 'Mi' }, { label: 'Donnerstag', abbr: 'Do' },
    { label: 'Freitag', abbr: 'Fr' }
  ];



  // Helper to ensure date is valid for date picker
  const getDatePickerValue = (dateStr) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return convertDDMMYYYYtoYYYYMMDD(dateStr);
    return '';
  };

  return (
    <Box sx={{ mb: 3 }}>

      <Box>
        <Box display="flex" gap={2} sx={{ mb: 2, alignItems: 'center' }}>
          <Typography>gültig von</Typography>
          <TextField
            label="Startdatum"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={getDatePickerValue(booking.startdate)}
            onChange={(e) => handleDateChange('startdate', e.target.value)}
          />
          <Typography>bis</Typography>
          <TextField
            label="Enddatum"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={getDatePickerValue(booking.enddate)}
            onChange={(e) => handleDateChange('enddate', e.target.value)}
          />
        </Box>
        {daysOfWeek.map(day => {
          return (
            <Box key={day.abbr} display="flex" alignItems="center">
              <DayControl
                dayLabel={day.label}
                dayAbbr={day.abbr}
                dayData={booking.times?.find(t => t.day_name === day.abbr)}
                onToggle={handleDayToggle}
                onTimeChange={handleTimeChange}
                onAddSegment={handleAddSegment}
                onRemoveSegment={handleRemoveSegment}
                type={type}
              />
              
            </Box>
          );
        })}
      </Box>
      
    </Box>
  );
}

export default BookingDetail;
