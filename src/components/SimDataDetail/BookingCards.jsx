import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails, Button,
  Divider, TextField, Switch, Slider, Select, MenuItem
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestoreIcon from '@mui/icons-material/Restore';
import { useState, useEffect } from 'react';
import { convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../../utils/dateUtils';
import { timeToValue, valueToTime, segmentsEqual } from '../../utils/timeUtils';

// Erstellt eine zusammenfassende Textdarstellung der Buchungszeiten
function consolidateBookingSummary(times) {
  if (!times || times.length === 0) return 'Keine Zeiten definiert';

  const dayOrder = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const relevantTimes = times
    .filter(t => t.segments && t.segments.length > 0)
    .sort((a, b) => dayOrder.indexOf(a.day_name) - dayOrder.indexOf(b.day_name));

  if (relevantTimes.length === 0) return 'Keine Zeiten definiert';

  const grouped = [];
  let currentGroup = null;

  for (const dayTime of relevantTimes) {
    // Vergleiche Segmente als Array, nicht als String!
    if (
      currentGroup &&
      segmentsEqual(currentGroup.segments, dayTime.segments)
    ) {
      currentGroup.endDay = dayTime.day_name;
    } else {
      if (currentGroup) grouped.push(currentGroup);
      currentGroup = {
        startDay: dayTime.day_name,
        endDay: dayTime.day_name,
        segments: dayTime.segments
      };
    }
  }
  if (currentGroup) grouped.push(currentGroup);

  return grouped.map(g => {
    const dayPart = g.startDay === g.endDay ? g.startDay : `${g.startDay}-${g.endDay}`;
    const timeStr = g.segments.map(s => `${s.booking_start}-${s.booking_end}`).join(', ');
    return `${dayPart} ${timeStr}`;
  }).join(', ');
}

// --- Neue interaktive Komponenten ---

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
  booking, index, type, allGroups, defaultExpanded, onDelete, canDelete,
  originalBooking, onRestoreBooking,
}) {
  const [bookingState, setBookingState] = useState(booking);
  const [expanded, setExpanded] = useState(!!defaultExpanded);

  useEffect(() => {
    setBookingState(booking);
  }, [booking]);

  const handleDayToggle = (dayAbbr, isEnabled) => {
    setBookingState(prev => {
      const newTimes = [...(prev.times || [])];
      const dayIndex = newTimes.findIndex(t => t.day_name === dayAbbr);

      if (isEnabled && dayIndex === -1) {
        const dayNr = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayAbbr) + 1;
        newTimes.push({ day: dayNr, day_name: dayAbbr, segments: [{ booking_start: '08:00', booking_end: '16:00' }] });
      } else if (!isEnabled && dayIndex !== -1) {
        newTimes.splice(dayIndex, 1);
      }
      return { ...prev, times: newTimes };
    });
  };

  // Bugfix: Segmente tief kopieren, damit nur ein Segment hinzugefügt wird
  const handleAddSegment = (dayAbbr) => {
    setBookingState(prev => {
      const newTimes = prev.times.map(t =>
        t.day_name === dayAbbr
          ? { ...t, segments: [...t.segments, { booking_start: '13:00', booking_end: '16:00' }] }
          : t
      );
      return { ...prev, times: newTimes };
    });
  };

  const handleTimeChange = (dayAbbr, segIdx, newValues) => {
    setBookingState(prev => {
      const newTimes = prev.times.map(t => {
        if (t.day_name === dayAbbr) {
          const newSegments = t.segments.map((seg, i) =>
            i === segIdx
              ? { ...seg, booking_start: valueToTime(newValues[0]), booking_end: valueToTime(newValues[1]) }
              : seg
          );
          return { ...t, segments: newSegments };
        }
        return t;
      });
      return { ...prev, times: newTimes };
    });
  };

  const handleRemoveSegment = (dayAbbr, segIdx) => {
    setBookingState(prev => {
      const newTimes = prev.times.map(t => {
        if (t.day_name === dayAbbr && t.segments.length > 1) {
          const newSegments = t.segments.filter((_, i) => i !== segIdx);
          return { ...t, segments: newSegments };
        }
        return t;
      });
      return { ...prev, times: newTimes };
    });
  };

  const handleDateChange = (field, value) => {
    setBookingState(prev => ({
      ...prev,
      [field]: convertYYYYMMDDtoDDMMYYYY(value)
    }));
  };

  const handleGroupChange = (dayAbbr, segIdx, groupId) => {
    setBookingState(prev => {
      const newTimes = prev.times.map(t => {
        if (t.day_name === dayAbbr) {
          const newSegments = t.segments.map((seg, i) =>
            i === segIdx
              ? { ...seg, groupId }
              : seg
          );
          return { ...t, segments: newSegments };
        }
        return t;
      });
      return { ...prev, times: newTimes };
    });
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

  // Prüft, ob das gesamte Booking geändert wurde
  function isBookingModified(localBooking, origBooking) {
    if (!origBooking) return false;
    // Vergleiche Start/Enddatum
    if (localBooking.startdate !== origBooking.startdate || localBooking.enddate !== origBooking.enddate) return true;
    // Vergleiche alle Tage
    const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
    for (const day of days) {
      if (isDayModified(localBooking.times, origBooking.times, day)) return true;
    }
    return false;
  }

  const daysOfWeek = [
    { label: 'Montag', abbr: 'Mo' }, { label: 'Dienstag', abbr: 'Di' },
    { label: 'Mittwoch', abbr: 'Mi' }, { label: 'Donnerstag', abbr: 'Do' },
    { label: 'Freitag', abbr: 'Fr' }
  ];

  // Prüfe, ob Booking geändert ist
  const isMod = originalBooking ? isBookingModified(bookingState, originalBooking) : false;

  const { startdate, enddate, times } = bookingState;
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
    setBookingState(prev => {
      const origDay = Array.isArray(originalBooking.times)
        ? originalBooking.times.find(t => t.day_name === dayAbbr)
        : undefined;
      let newTimes = Array.isArray(prev.times) ? [...prev.times] : [];
      const idx = newTimes.findIndex(t => t.day_name === dayAbbr);
      if (origDay) {
        // Tag existiert im Import: ersetze oder füge ein
        if (idx !== -1) {
          newTimes[idx] = JSON.parse(JSON.stringify(origDay));
        } else {
          newTimes.push(JSON.parse(JSON.stringify(origDay)));
        }
      } else {
        // Tag existiert nicht im Import: entferne falls vorhanden
        if (idx !== -1) {
          newTimes = newTimes.filter((_, i) => i !== idx);
        }
      }
      return { ...prev, times: newTimes };
    });
  };

  // Restore-Funktion für das gesamte Booking
  const handleRestoreAll = () => {
    if (window.confirm('Buchung auf importierte Adebis-Daten zurücksetzen?')) {
      onRestoreBooking && onRestoreBooking(index);
    }
  };

  // Prüft, ob das Start-/Enddatum geändert wurde (analog zu isDateModified)
  function isBookingDateModified(field) {
    if (!originalBooking) return false;
    const orig = originalBooking[field];
    const local = bookingState[field];
    if (!orig && !local) return false;
    if (!orig || !local) return true;
    // orig: DD.MM.YYYY, local: DD.MM.YYYY
    return orig !== local;
  }

  // Restore für Start-/Enddatum
  const handleRestoreBookingDate = (field) => {
    if (!originalBooking) return;
    setBookingState(prev => ({
      ...prev,
      [field]: originalBooking[field] || ''
    }));
  };

  return (
    <Accordion expanded={expanded} onChange={() => setExpanded(e => !e)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ flex: 1 }}>
          Buchung {index + 1}: {dateRangeText}
          {dateRangeText ? ': ' : ''}
          {consolidateBookingSummary(times)}
        </Typography>
        {isMod && (
          <RestoreIcon
            color="warning"
            sx={{ ml: 1, cursor: 'pointer' }}
            titleAccess="Komplette Buchung auf importierte Werte zurücksetzen"
            onClick={e => {
              e.stopPropagation();
              handleRestoreAll();
            }}
          />
        )}
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
            value={convertDDMMYYYYtoYYYYMMDD(bookingState.startdate)}
            onChange={(e) => handleDateChange('startdate', e.target.value)}
          />
          {/* Restore-Icon für Startdatum */}
          {isBookingDateModified('startdate') && (
            <RestoreIcon
              color="warning"
              sx={{ cursor: 'pointer' }}
              titleAccess="Startdatum auf importierten Wert zurücksetzen"
              onClick={() => {
                if (window.confirm('Startdatum auf importierten Wert zurücksetzen?')) {
                  handleRestoreBookingDate('startdate');
                }
              }}
            />
          )}
          <Typography>bis</Typography>
          <TextField
            label="Enddatum"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={convertDDMMYYYYtoYYYYMMDD(bookingState.enddate)}
            onChange={(e) => handleDateChange('enddate', e.target.value)}
          />
          {/* Restore-Icon für Enddatum */}
          {isBookingDateModified('enddate') && (
            <RestoreIcon
              color="warning"
              sx={{ cursor: 'pointer' }}
              titleAccess="Enddatum auf importierten Wert zurücksetzen"
              onClick={() => {
                if (window.confirm('Enddatum auf importierten Wert zurücksetzen?')) {
                  handleRestoreBookingDate('enddate');
                }
              }}
            />
          )}
        </Box>
        <Divider sx={{ my: 2 }} />
        {daysOfWeek.map(day => {
          const dayMod = originalBooking
            ? isDayModified(bookingState.times, originalBooking.times, day.abbr)
            : false;
          return (
            <Box key={day.abbr} display="flex" alignItems="center">
              {/* Icon jetzt VOR dem Label */}
              {dayMod && (
                <RestoreIcon
                  color="warning"
                  sx={{ mr: 1, cursor: 'pointer' }}
                  titleAccess="Tag auf importierte Werte zurücksetzen"
                  onClick={() => {
                    if (window.confirm(`${day.label} auf importierte Werte zurücksetzen?`)) {
                      handleRestoreDay(day.abbr);
                    }
                  }}
                />
              )}
              <DayControl
                dayLabel={day.label}
                dayAbbr={day.abbr}
                dayData={bookingState.times?.find(t => t.day_name === day.abbr)}
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

function BookingCards({
  bookings, type, allGroups, lastAddedIndex, onDelete, importedCount,
  originalBookings, onRestoreBooking
}) {
  if (!bookings || bookings.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Buchungszeiten vorhanden.</Typography>;
  }
  return (
    <Box>
      {bookings.map((booking, idx) => (
        <BookingAccordion
          key={idx}
          booking={booking}
          index={idx}
          type={type}
          allGroups={allGroups}
          defaultExpanded={lastAddedIndex === idx}
          onDelete={onDelete}
          canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
          originalBooking={Array.isArray(originalBookings) ? originalBookings[idx] : undefined}
          onRestoreBooking={onRestoreBooking}
        />
      ))}
    </Box>
  );
}

export default BookingCards;