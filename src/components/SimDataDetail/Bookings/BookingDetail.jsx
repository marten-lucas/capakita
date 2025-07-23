import React from 'react';
import {
  Typography, Box, Button, Divider, TextField, Switch, Slider,
} from '@mui/material';
import { convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../../../utils/dateUtils';
import { valueToTime } from '../../../utils/timeUtils';
import ModMonitor from '../ModMonitor';
import useSimScenarioStore from '../../../store/simScenarioStore';
import useSimDataStore from '../../../store/simDataStore';
import useSimBookingStore from '../../../store/simBookingStore';
import DayControl from './BookingDayControl';

// BookingDetail component
function BookingDetail({ index }) {
  // Get scenario and item selection
  const selectedScenarioId = useSimScenarioStore(state => state.selectedScenarioId);
  const selectedItemId = useSimScenarioStore(state => state.selectedItems?.[selectedScenarioId]);
  const dataItems = useSimDataStore(state => state.getDataItems(selectedScenarioId));
  const item = dataItems?.find(i => i.id === selectedItemId);

  // Use booking store for bookings and deleteBooking
  const bookings = useSimBookingStore(state => state.getSelectedItemBookings());
  const deleteBooking = useSimBookingStore(state => state.deleteBooking);
  const updateBooking = useSimBookingStore(state => state.updateBooking);
  const booking = bookings?.[index];
  const originalBooking = item?.originalParsedData?.booking?.[index];
  const type = item?.type;
  const parentItemId = selectedItemId;
  const isManualEntry = item?.rawdata?.source === 'manual entry';

  // Helper to update the booking in the store
  const handleUpdateBooking = (updatedBooking) => {
    if (!selectedScenarioId || !selectedItemId || !booking?.id) return;
    updateBooking(selectedScenarioId, selectedItemId, booking.id, updatedBooking);
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
    const updatedBooking = {
      ...booking,
      [field]: convertYYYYMMDDtoDDMMYYYY(value),
    };
    handleUpdateBooking(updatedBooking);
  };

  // Prüft, ob ein einzelner Tag (Mo, Di, ...) im Booking geändert wurde
  function isDayModified(localTimes, origTimes, dayAbbr) {
    const l = Array.isArray(localTimes) ? localTimes.find(t => t.day_name === dayAbbr) : undefined;
    const o = Array.isArray(origTimes) ? origTimes.find(t => t.day_name === dayAbbr) : undefined;
    if (!l && !o) return false;
    if (!l || !o) return true;
    // Vergleiche Segmente
    if (!Array.isArray(l.segments) && !Array.isArray(o.segments)) return false;
    if (!Array.isArray(l.segments) || !Array.isArray(o.segments)) return true;
    if (l.segments.length !== o.segments.length) return true;
    for (let i = 0; i < l.segments.length; ++i) {
      const ls = l.segments[i], os = o.segments[i];
      if (ls.booking_start !== os.booking_start || ls.booking_end !== os.booking_end) return true;
      // Prüfe auch groupId für Mitarbeiter
      if (type === 'capacity') {
        if ((ls.groupId || '') !== (os.groupId || '')) return true;
      }
    }
    return false;
  }

  const daysOfWeek = [
    { label: 'Montag', abbr: 'Mo' }, { label: 'Dienstag', abbr: 'Di' },
    { label: 'Mittwoch', abbr: 'Mi' }, { label: 'Donnerstag', abbr: 'Do' },
    { label: 'Freitag', abbr: 'Fr' }
  ];


  // Restore-Funktion für einen Tag
  const handleRestoreDay = (dayAbbr) => {
    if (!originalBooking) return;
    const updatedBooking = {
      ...booking,
      times: (() => {
        const origDay = Array.isArray(originalBooking.times)
          ? originalBooking.times.find(t => t.day_name === dayAbbr)
          : undefined;
        let newTimes = Array.isArray(booking.times) ? [...booking.times] : [];
        const idx = newTimes.findIndex(t => t.day_name === dayAbbr);
        if (origDay) {
          // Replace or add the restored day
          if (idx !== -1) {
            newTimes[idx] = JSON.parse(JSON.stringify(origDay));
          } else {
            newTimes.push(JSON.parse(JSON.stringify(origDay)));
          }
        } else {
          // Remove the day if it doesn't exist in the original booking
          if (idx !== -1) {
            newTimes = newTimes.filter((_, i) => i !== idx);
          }
        }
        return newTimes;
      })(),
    };
    handleUpdateBooking(updatedBooking);
  };

  // Restore-Funktion für das gesamte Booking

  // Restore für Start-/Enddatum
  const handleRestoreBookingDate = (field) => {
    if (!originalBooking) return;
    const updatedBooking = {
      ...booking,
      [field]: originalBooking[field] || '',
    };
    handleUpdateBooking(updatedBooking);
  };

  // Handler for deleting a booking
  const handleDeleteBooking = () => {
    if (!selectedScenarioId || !selectedItemId || !booking?.id) return;
    deleteBooking(selectedScenarioId, selectedItemId, booking.id);
  };

  if (!booking) return null;

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
            value={convertDDMMYYYYtoYYYYMMDD(booking.startdate)}
            onChange={(e) => handleDateChange('startdate', e.target.value)}
          />
          <ModMonitor
            itemId={parentItemId}
            field={`booking-${index}-startdate`}
            value={booking.startdate}
            originalValue={originalBooking ? originalBooking.startdate : undefined}
            onRestore={() => handleRestoreBookingDate('startdate')}
            title="Startdatum auf importierten Wert zurücksetzen"
            confirmMsg="Startdatum auf importierten Wert zurücksetzen?"
          />
          <Typography>bis</Typography>
          <TextField
            label="Enddatum"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={convertDDMMYYYYtoYYYYMMDD(booking.enddate)}
            onChange={(e) => handleDateChange('enddate', e.target.value)}
          />
          <ModMonitor
            itemId={parentItemId}
            field={`booking-${index}-enddate`}
            value={booking.enddate}
            originalValue={originalBooking ? originalBooking.enddate : undefined}
            onRestore={() => handleRestoreBookingDate('enddate')}
            title="Enddatum auf importierten Wert zurücksetzen"
            confirmMsg="Enddatum auf importierten Wert zurücksetzen?"
          />
        </Box>
        {daysOfWeek.map(day => {
          const dayMod = originalBooking && !isManualEntry
            ? isDayModified(booking.times, originalBooking.times, day.abbr)
            : false;
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
              <>
                {dayMod && (
                  <ModMonitor
                    itemId={parentItemId}
                    field={`booking-${index}-${day.abbr}`}
                    value={JSON.stringify(booking.times?.find(t => t.day_name === day.abbr))}
                    originalValue={
                      originalBooking
                        ? JSON.stringify(originalBooking.times?.find(t => t.day_name === day.abbr))
                        : undefined
                    }
                    onRestore={() => handleRestoreDay(day.abbr)}
                    title="Tag auf importierte Werte zurücksetzen"
                    confirmMsg={`${day.label} auf importierte Werte zurücksetzen?`}
                    iconProps={{ sx: { mr: 1 } }}
                  />
                )}
              </>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          size="small"
          color="error"
          onClick={e => { e.stopPropagation(); handleDeleteBooking(); }}
        >
          Löschen
        </Button>
      </Box>
    </Box>
  );
}

export default BookingDetail;
