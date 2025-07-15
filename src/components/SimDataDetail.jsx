import {
  Typography, Box, Tabs, Tab, TextField, Paper, Accordion, AccordionSummary, AccordionDetails, Switch, Slider, Divider, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Select, MenuItem, InputLabel, Button
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CommentIcon from '@mui/icons-material/Comment';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import { useState, useEffect } from 'react';
import GroupCards from './SimDataDetail/GroupCards';
import BookingCards from './SimDataDetail/BookingCards';

// --- Import helper functions from utils ---
import { convertDDMMYYYYtoYYYYMMDD, convertYYYYMMDDtoDDMMYYYY, isDateModified } from '../utils/dateUtils';
import { timeToValue, valueToTime, segmentsEqual } from '../utils/timeUtils';

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

// --- Hauptkomponente ---

function SimDataDetail({ item, allGroups }) {
  const [tab, setTab] = useState(0);
  const [startDate, setStartDate] = useState(
    item?.parseddata?.startdate
      ? item.parseddata.startdate.split('.').reverse().join('-')
      : ''
  );
  const [endDate, setEndDate] = useState(
    item?.parseddata?.enddate
      ? item.parseddata.enddate.split('.').reverse().join('-')
      : ''
  );
  // --- Pause State ---
  const [pauseEnabled, setPauseEnabled] = useState(false);
  const [pauseStart, setPauseStart] = useState('');
  const [pauseEnd, setPauseEnd] = useState('');
  const [localItem, setLocalItem] = useState(item);
  const [lastAddedBookingIdx, setLastAddedBookingIdx] = useState(null);
  const [lastAddedGroupIdx, setLastAddedGroupIdx] = useState(null);
  const [importedBookingCount, setImportedBookingCount] = useState(0);
  const [importedGroupCount, setImportedGroupCount] = useState(0);

  const initialStartDate = item?.parseddata?.startdate ? item.parseddata.startdate.split('.').reverse().join('-') : '';
  const initialEndDate = item?.parseddata?.enddate ? item.parseddata.enddate.split('.').reverse().join('-') : '';

  // Update local state if item changes
  useEffect(() => {
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
  }, [item, initialStartDate, initialEndDate]);

  useEffect(() => {
    setLocalItem(item);
    setLastAddedBookingIdx(null);
    setLastAddedGroupIdx(null);

    // Zähle importierte Buchungen/Gruppen (aus Adebis)
    if (item?.rawdata?.source === 'adebis export') {
      setImportedBookingCount(Array.isArray(item?.originalParsedData?.booking) ? item.originalParsedData.booking.length : 0);
      setImportedGroupCount(Array.isArray(item?.originalParsedData?.group) ? item.originalParsedData.group.length : 0);
    } else {
      setImportedBookingCount(0);
      setImportedGroupCount(0);
    }
  }, [item]);

  // Buchungszeitraum hinzufügen
  const handleAddBooking = () => {
    setLocalItem(prev => {
      if (!prev) return prev;
      const newBooking = {
        startdate: '',
        enddate: '',
        times: []
      };
      const newBookings = [...(prev.parseddata?.booking || []), newBooking];
      setLastAddedBookingIdx(newBookings.length - 1);
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          booking: newBookings
        }
      };
    });
  };

  // Buchungszeitraum löschen
  const handleDeleteBooking = (idx) => {
    setLocalItem(prev => {
      if (!prev) return prev;
      const bookings = prev.parseddata?.booking || [];
      if (bookings.length <= idx) return prev;
      const newBookings = bookings.slice(0, idx).concat(bookings.slice(idx + 1));
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          booking: newBookings
        }
      };
    });
    setLastAddedBookingIdx(null);
  };

  // Gruppe hinzufügen
  const handleAddGroup = () => {
    setLocalItem(prev => {
      if (!prev) return prev;
      const newGroup = {
        id: '',
        name: '',
        start: '',
        end: ''
      };
      const newGroups = [...(prev.parseddata?.group || []), newGroup];
      setLastAddedGroupIdx(newGroups.length - 1);
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          group: newGroups
        }
      };
    });
  };

  // Gruppe löschen
  const handleDeleteGroup = (idx) => {
    setLocalItem(prev => {
      if (!prev) return prev;
      const groups = prev.parseddata?.group || [];
      if (groups.length <= idx) return prev;
      const newGroups = groups.slice(0, idx).concat(groups.slice(idx + 1));
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          group: newGroups
        }
      };
    });
    setLastAddedGroupIdx(null);
  };

  // Restore-Funktionen
  const handleRestoreStartDate = () => {
    if (window.confirm('Startdatum auf importierten Wert zurücksetzen?')) {
      setStartDate(initialStartDate);
    }
  };
  const handleRestoreEndDate = () => {
    if (window.confirm('Enddatum auf importierten Wert zurücksetzen?')) {
      setEndDate(initialEndDate);
    }
  };

  const handleRestoreBooking = (idx) => {
    if (!item?.originalParsedData?.booking) return;
    setLocalItem(prev => {
      if (!prev) return prev;
      const orig = item.originalParsedData.booking[idx];
      if (!orig) return prev;
      const newBookings = [...(prev.parseddata?.booking || [])];
      newBookings[idx] = JSON.parse(JSON.stringify(orig));
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          booking: newBookings
        }
      };
    });
  };

  const handleRestoreGroup = (idx) => {
    if (!item?.originalParsedData?.group) return;
    setLocalItem(prev => {
      if (!prev) return prev;
      const orig = item.originalParsedData.group[idx];
      if (!orig) return prev;
      const newGroups = [...(prev.parseddata?.group || [])];
      newGroups[idx] = JSON.parse(JSON.stringify(orig));
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          group: newGroups
        }
      };
    });
  };

  // Markierungen für modifizierte Felder
  const startDateModified = isDateModified(startDate, item?.originalParsedData?.startdate);
  const endDateModified = isDateModified(endDate, item?.originalParsedData?.enddate);

  // Guard: Wenn localItem nicht gesetzt, Hinweis anzeigen und return
  if (!localItem) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">
          Wählen Sie einen Eintrag aus, um Details anzuzeigen.
        </Typography>
      </Box>
    );
  }

  const bookingsMod = bookingsModified(localItem?.parseddata?.booking, item?.originalParsedData?.booking);
  const groupsMod = groupsModified(localItem?.parseddata?.group, item?.originalParsedData?.group);

  return (
    <Box
      bgcolor="background.paper"
      boxShadow={3}
      borderRadius={2}
      p={3}
      height="90%"
      display="flex"
      flexDirection="column"
      overflow="auto"
    >
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab icon={<CalendarTodayIcon />} label="Simulationsdaten" />
        <Tab icon={<CommentIcon />} label="Modifikationen" />
        <Tab icon={<DataObjectIcon />} label="Rohdaten" />
      </Tabs>
      {tab === 0 && (
        <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
          {/* Wiederhergestellte Datumsfelder für den Datensatz */}
          <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ minWidth: 90 }}>Zeitraum von</Typography>
            <TextField
              label=""
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              sx={{ width: 150 }}
            />
            {startDateModified && (
              <RestoreIcon
                color="warning"
                sx={{ cursor: 'pointer' }}
                titleAccess="Startdatum auf importierten Wert zurücksetzen"
                onClick={handleRestoreStartDate}
              />
            )}
            <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
            <TextField
              label=""
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              sx={{ width: 150 }}
            />
            {endDateModified && (
              <RestoreIcon
                color="warning"
                sx={{ cursor: 'pointer' }}
                titleAccess="Enddatum auf importierten Wert zurücksetzen"
                onClick={handleRestoreEndDate}
              />
            )}
          </Box>
          {/* Pausieren unter Zeitraum, Toggle linksbündig */}
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={pauseEnabled}
                  onChange={e => setPauseEnabled(e.target.checked)}
                />
              }
              label="Pausieren"
              sx={{ ml: 0 }}
            />
            {pauseEnabled && (
              <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                <TextField
                  label="von"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={pauseStart}
                  onChange={e => setPauseStart(e.target.value)}
                  sx={{ width: 130 }}
                />
                <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
                <TextField
                  label="bis"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={pauseEnd}
                  onChange={e => setPauseEnd(e.target.value)}
                  sx={{ width: 130 }}
                />
              </Box>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={2} sx={{ mb: 1 }}>
            <Typography variant="h6" sx={{ mt: 1, mb: 1, flex: 1 }}>
              Buchungszeiten:
              {bookingsMod && (
                <RestoreIcon
                  color="warning"
                  sx={{ ml: 1, verticalAlign: 'middle' }}
                  titleAccess="Alle Buchungen auf importierte Werte zurücksetzen"
                  onClick={() => {
                    if (window.confirm('Alle Buchungen auf importierte Adebis-Daten zurücksetzen?')) {
                      setLocalItem(prev => ({
                        ...prev,
                        parseddata: {
                          ...prev.parseddata,
                          booking: JSON.parse(JSON.stringify(item.originalParsedData?.booking || []))
                        }
                      }));
                    }
                  }}
                />
              )}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddBooking}
            >
              Buchungszeitraum hinzufügen
            </Button>
          </Box>
          <BookingCards
            bookings={localItem.parseddata?.booking}
            type={localItem.type}
            allGroups={allGroups}
            lastAddedIndex={lastAddedBookingIdx}
            onDelete={handleDeleteBooking}
            importedCount={importedBookingCount}
            originalBookings={item?.originalParsedData?.booking}
            onRestoreBooking={handleRestoreBooking}
          />
          <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2, mb: 1 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Gruppen:
              {groupsMod && (
                <RestoreIcon
                  color="warning"
                  sx={{ ml: 1, verticalAlign: 'middle' }}
                  titleAccess="Alle Gruppen auf importierte Werte zurücksetzen"
                  onClick={() => {
                    if (window.confirm('Alle Gruppen auf importierte Adebis-Daten zurücksetzen?')) {
                      setLocalItem(prev => ({
                        ...prev,
                        parseddata: {
                          ...prev.parseddata,
                          group: JSON.parse(JSON.stringify(item.originalParsedData?.group || []))
                        }
                      }));
                    }
                  }}
                />
              )}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddGroup}
            >
              Gruppe hinzufügen
            </Button>
          </Box>
          <GroupCards
            groups={localItem.parseddata?.group}
            allGroups={allGroups}
            lastAddedIndex={lastAddedGroupIdx}
            onDelete={handleDeleteGroup}
            importedCount={importedGroupCount}
            originalGroups={item?.originalParsedData?.group}
            onRestoreGroup={handleRestoreGroup}
          />
        </Box>
      )}
      {tab === 1 && (
        <Box flex={1} display="flex" flexDirection="column">
          <Typography variant="body2" color="text.secondary">
            Buchungen:
          </Typography>
          <pre style={{ fontSize: 12, marginTop: 8, flex: 1 }}>
            {JSON.stringify(item.parseddata?.buchungen, null, 2)}
          </pre>
        </Box>
      )}
      {tab === 2 && (
        <Box flex={1} display="flex" flexDirection="column">
          <Typography variant="body2" color="text.secondary">
            Rohdaten:
          </Typography>
          <pre style={{ fontSize: 12, marginTop: 8, flex: 1 }}>
            {JSON.stringify(item.rawdata, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
}

function bookingsModified(localBookings, origBookings) {
  if (!Array.isArray(localBookings) && !Array.isArray(origBookings)) return false;
  if (!Array.isArray(localBookings) || !Array.isArray(origBookings)) return true;
  if (localBookings.length !== origBookings.length) return true;
  for (let i = 0; i < localBookings.length; ++i) {
    const l = localBookings[i], o = origBookings[i];
    if (l.startdate !== o.startdate || l.enddate !== o.enddate) return true;
    if (!Array.isArray(l.times) && !Array.isArray(o.times)) continue;
    if (!Array.isArray(l.times) || !Array.isArray(o.times)) return true;
    if (l.times.length !== o.times.length) return true;
    for (let j = 0; j < l.times.length; ++j) {
      const lt = l.times[j], ot = o.times[j];
      if (lt.day !== ot.day || lt.day_name !== ot.day_name) return true;
      if (!Array.isArray(lt.segments) && !Array.isArray(ot.segments)) continue;
      if (!Array.isArray(lt.segments) || !Array.isArray(ot.segments)) return true;
      if (lt.segments.length !== ot.segments.length) return true;
      for (let k = 0; k < lt.segments.length; ++k) {
        const ls = lt.segments[k], os = ot.segments[k];
        if (ls.booking_start !== os.booking_start || ls.booking_end !== os.booking_end) return true;
      }
    }
  }
  return false;
}

function groupsModified(localGroups, origGroups) {
  if (!Array.isArray(localGroups) && !Array.isArray(origGroups)) return false;
  if (!Array.isArray(localGroups) || !Array.isArray(origGroups)) return true;
  if (localGroups.length !== origGroups.length) return true;
  for (let i = 0; i < localGroups.length; ++i) {
    const l = localGroups[i], o = origGroups[i];
    if (String(l.id) !== String(o.id)) return true;
    if (l.start !== o.start) return true;
    if (l.end !== o.end) return true;
  }
  return false;
}
export default SimDataDetail;
