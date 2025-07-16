import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails, Button,
  Divider, TextField, Switch, Slider, Select, MenuItem
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import { convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../../utils/dateUtils';
import { timeToValue, valueToTime } from '../../utils/timeUtils';
import ModMonitor from './ModMonitor';
import { consolidateBookingSummary } from '../../utils/bookingUtils';

// DayControl component
function DayControl({ dayLabel, dayAbbr, dayData, onToggle, onTimeChange, onAddSegment, onRemoveSegment, onGroupChange, type, allGroups }) {
  const isActive = !!dayData;
  const segments = isActive ? dayData.segments : [];

  return (
    <Box display="flex" alignItems="flex-start" gap={2} sx={{ mb: 1 }}>
      <Typography sx={{ width: 80, mt: 1 }}>{dayLabel}</Typography>
      <Switch checked={isActive} onChange={(e) => onToggle(dayAbbr, e.target.checked)} />
      <Box sx={{ flex: 1, px: 2 }}>
        {isActive && (
          <Box>
            {segments.map((seg, idx) => (
              <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                <Box sx={{ flex: 1, minWidth: 220, maxWidth: 400 }}>
                  <Slider
                    value={[
                      timeToValue(seg.booking_start),
                      timeToValue(seg.booking_end)
                    ]}
                    onChange={(_, newValue) => onTimeChange(dayAbbr, idx, newValue)}
                    min={0}
                    max={47}
                    step={1}
                    valueLabelFormat={valueToTime}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 14, label: '07:00' },
                      { value: 24, label: '12:00' },
                      { value: 33, label: '16:30' },
                    ]}
                  />
                </Box>
                {/* Gruppenzuordnung nur für Mitarbeiter */}
                {type === 'capacity' && allGroups && (
                  <Select
                    size="small"
                    value={seg.groupId || ''}
                    onChange={e => onGroupChange(dayAbbr, idx, e.target.value)}
                    displayEmpty
                    sx={{ minWidth: 100 }}
                  >
                    <MenuItem value="">Gruppe unverändert</MenuItem>
                    {Object.entries(allGroups).map(([gid, gname]) => (
                      <MenuItem key={gid} value={gid}>{gname}</MenuItem>
                    ))}
                  </Select>
                )}
                {segments.length > 1 && (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ minWidth: 32, px: 1, ml: 0.5 }}
                    onClick={() => onRemoveSegment(dayAbbr, idx)}
                    title="Segment entfernen"
                  >−</Button>
                )}
              </Box>
            ))}
            {type === 'capacity' && (
              <Button
                size="small"
                variant="outlined"
                sx={{ mt: 0.5 }}
                onClick={() => onAddSegment(dayAbbr)}
              >+ Zeitbereich</Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function BookingAccordion({
  booking, index, type, allGroups, defaultExpanded, canDelete,
  originalBooking, onUpdateBooking, onDelete
}) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);

  const handleDayToggle = (dayAbbr, isEnabled) => {
    const updatedBooking = {
      ...booking,
      times: (() => {
        const newTimes = [...(booking.times || [])];
        const dayIndex = newTimes.findIndex((t) => t.day_name === dayAbbr);

        if (isEnabled && dayIndex === -1) {
          const dayNr = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayAbbr) + 1;
          newTimes.push({ day: dayNr, day_name: dayAbbr, segments: [{ booking_start: '08:00', booking_end: '16:00' }] });
        } else if (!isEnabled && dayIndex !== -1) {
          newTimes.splice(dayIndex, 1);
        }
        return newTimes;
      })(),
    };
    onUpdateBooking(updatedBooking);
  };

  const handleAddSegment = (dayAbbr) => {
    const updatedBooking = {
      ...booking,
      times: booking.times.map((t) =>
        t.day_name === dayAbbr
          ? { ...t, segments: [...t.segments, { booking_start: '13:00', booking_end: '16:00' }] }
          : t
      ),
    };
    onUpdateBooking(updatedBooking);
  };

  const handleTimeChange = (dayAbbr, segIdx, newValues) => {
    const updatedBooking = {
      ...booking,
      times: booking.times.map((t) => {
        if (t.day_name === dayAbbr) {
          const newSegments = t.segments.map((seg, i) =>
            i === segIdx
              ? { ...seg, booking_start: valueToTime(newValues[0]), booking_end: valueToTime(newValues[1]) }
              : seg
          );
          return { ...t, segments: newSegments };
        }
        return t;
      }),
    };
    onUpdateBooking(updatedBooking);
  };

  const handleRemoveSegment = (dayAbbr, segIdx) => {
    const updatedBooking = {
      ...booking,
      times: booking.times.map((t) => {
        if (t.day_name === dayAbbr && t.segments.length > 1) {
          const newSegments = t.segments.filter((_, i) => i !== segIdx);
          return { ...t, segments: newSegments };
        }
        return t;
      }),
    };
    onUpdateBooking(updatedBooking);
  };

  const handleDateChange = (field, value) => {
    const updatedBooking = {
      ...booking,
      [field]: convertYYYYMMDDtoDDMMYYYY(value),
    };
    onUpdateBooking(updatedBooking);
  };

  const handleGroupChange = (dayAbbr, segIdx, groupId) => {
    const updatedBooking = {
      ...booking,
      times: booking.times.map(t => {
        if (t.day_name === dayAbbr) {
          const newSegments = t.segments.map((seg, i) =>
            i === segIdx
              ? { ...seg, groupId }
              : seg
          );
          return { ...t, segments: newSegments };
        }
        return t;
      }),
    };
    onUpdateBooking(updatedBooking);
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

  const { startdate, enddate, times } = booking;
  let dateRangeText = '';
  if (startdate && enddate) {
    dateRangeText = `von ${startdate} bis ${enddate}`;
  } else if (startdate) {
    dateRangeText = `ab ${startdate}`;
  } else if (enddate) {
    dateRangeText = `bis ${enddate}`;
  }

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
    onUpdateBooking(updatedBooking);
  };

  // Restore-Funktion für das gesamte Booking
  const handleRestoreAll = () => {
    if (!originalBooking) return;
    const restoredBooking = JSON.parse(JSON.stringify(originalBooking));
    onUpdateBooking(restoredBooking);
  };

  // Restore für Start-/Enddatum
  const handleRestoreBookingDate = (field) => {
    if (!originalBooking) return;
    const updatedBooking = {
      ...booking,
      [field]: originalBooking[field] || '',
    };
    onUpdateBooking(updatedBooking);
  };

  return (
    <Accordion expanded={expanded} onChange={() => setExpanded(e => !e)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ flex: 1 }}>
          Buchung {index + 1}: {dateRangeText}
          {dateRangeText ? ': ' : ''}
          {consolidateBookingSummary(times)}
        </Typography>
        <ModMonitor
          itemId={booking.id}
          field={`booking-${index}`}
          value={JSON.stringify(booking)}
          originalValue={JSON.stringify(originalBooking || {})}
          onRestore={handleRestoreAll}
          title="Komplette Buchung auf importierte Werte zurücksetzen"
          confirmMsg="Buchung auf importierte Adebis-Daten zurücksetzen?"
          iconProps={{ sx: { ml: 1 } }}
        />
        {onDelete && canDelete && (
          <Button
            size="small"
            color="error"
            sx={{ ml: 2 }}
            onClick={e => { e.stopPropagation(); onDelete(index); }}
          >
            Löschen
          </Button>
        )}
      </AccordionSummary>
      <AccordionDetails>
        <Box display="flex" gap={2} sx={{ mb: 2, alignItems: 'center' }}>
          <TextField
            label="Startdatum"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={convertDDMMYYYYtoYYYYMMDD(booking.startdate)}
            onChange={(e) => handleDateChange('startdate', e.target.value)}
          />
          <ModMonitor
            itemId={booking.id}
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
            itemId={booking.id}
            field={`booking-${index}-enddate`}
            value={booking.enddate}
            originalValue={originalBooking ? originalBooking.enddate : undefined}
            onRestore={() => handleRestoreBookingDate('enddate')}
            title="Enddatum auf importierten Wert zurücksetzen"
            confirmMsg="Enddatum auf importierten Wert zurücksetzen?"
          />
        </Box>
        <Divider sx={{ my: 2 }} />
        {daysOfWeek.map(day => {
          const dayMod = originalBooking
            ? isDayModified(booking.times, originalBooking.times, day.abbr)
            : false;
          return (
            <Box key={day.abbr} display="flex" alignItems="center">
              {/* Icon jetzt VOR dem Label */}
              {dayMod && (
                <ModMonitor
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
              <DayControl
                dayLabel={day.label}
                dayAbbr={day.abbr}
                dayData={booking.times?.find(t => t.day_name === day.abbr)}
                onToggle={handleDayToggle}
                onTimeChange={handleTimeChange}
                onAddSegment={handleAddSegment}
                onRemoveSegment={handleRemoveSegment}
                onGroupChange={handleGroupChange}
                type={type}
                allGroups={allGroups}
              />
            </Box>
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
}

export default BookingAccordion;
