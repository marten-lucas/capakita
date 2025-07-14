import {
  Typography, Box, Tabs, Tab, TextField, Paper, Accordion, AccordionSummary, AccordionDetails, Switch, Slider, Divider, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CommentIcon from '@mui/icons-material/Comment';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState, useEffect } from 'react';

// --- Hilfsfunktionen für die neue BookingAccordion ---

// Konvertiert DD.MM.YYYY zu YYYY-MM-DD
const convertDDMMYYYYtoYYYYMMDD = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('.');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
};

// Konvertiert YYYY-MM-DD zu DD.MM.YYYY
const convertYYYYMMDDtoDDMMYYYY = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return '';
};

// Konvertiert eine Zeit (HH:MM) in einen Slider-Wert (0-47 für Halbstunden-Intervalle)
const timeToValue = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 2 + minutes / 30;
};

// Konvertiert einen Slider-Wert zurück in eine Zeit (HH:MM)
const valueToTime = (value) => {
  const hours = Math.floor(value / 2);
  const minutes = (value % 2) * 30;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

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
    const timeStr = dayTime.segments.map(s => `${s.booking_start}-${s.booking_end}`).join(', ');
    if (currentGroup && currentGroup.timeStr === timeStr) {
      currentGroup.endDay = dayTime.day_name;
    } else {
      if (currentGroup) grouped.push(currentGroup);
      currentGroup = {
        startDay: dayTime.day_name,
        endDay: dayTime.day_name,
        timeStr: timeStr,
      };
    }
  }
  if (currentGroup) grouped.push(currentGroup);

  return grouped.map(g => {
    const dayPart = g.startDay === g.endDay ? g.startDay : `${g.startDay}-${g.endDay}`;
    return `${dayPart} ${g.timeStr}`;
  }).join(', ');
}

// --- Neue interaktive Komponenten ---

function DayControl({ dayLabel, dayAbbr, dayData, onToggle, onTimeChange, onAddSegment, onRemoveSegment, type }) {
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
                  sx={{ flex: 1 }}
                />
                {segments.length > 1 && (
                  <button
                    style={{ marginLeft: 4 }}
                    onClick={() => onRemoveSegment(dayAbbr, idx)}
                    title="Segment entfernen"
                  >−</button>
                )}
              </Box>
            ))}
            {/* Button nur für Mitarbeiter (capacity) */}
            {type === 'capacity' && (
              <button onClick={() => onAddSegment(dayAbbr)} style={{ marginTop: 2 }}>+ Zeitbereich</button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function BookingAccordion({ booking, index, type }) {
  const [bookingState, setBookingState] = useState(booking);

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

  const daysOfWeek = [
    { label: 'Montag', abbr: 'Mo' }, { label: 'Dienstag', abbr: 'Di' },
    { label: 'Mittwoch', abbr: 'Mi' }, { label: 'Donnerstag', abbr: 'Do' },
    { label: 'Freitag', abbr: 'Fr' }
  ];

  const { startdate, enddate, times } = bookingState;
  let dateRangeText = '';
  if (startdate && enddate) {
    dateRangeText = `von ${startdate} bis ${enddate}`;
  } else if (startdate) {
    dateRangeText = `ab ${startdate}`;
  } else if (enddate) {
    dateRangeText = `bis ${enddate}`;
  }

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>
          Buchung {index + 1}: {dateRangeText}
          {dateRangeText ? ': ' : ''}
          {consolidateBookingSummary(times)}
        </Typography>
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
          <Typography>bis</Typography>
          <TextField
            label="Enddatum"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={convertDDMMYYYYtoYYYYMMDD(bookingState.enddate)}
            onChange={(e) => handleDateChange('enddate', e.target.value)}
          />
        </Box>
        <Divider sx={{ my: 2 }} />
        {daysOfWeek.map(day => (
          <DayControl
            key={day.abbr}
            dayLabel={day.label}
            dayAbbr={day.abbr}
            dayData={bookingState.times?.find(t => t.day_name === day.abbr)}
            onToggle={handleDayToggle}
            onTimeChange={handleTimeChange}
            onAddSegment={handleAddSegment}
            onRemoveSegment={handleRemoveSegment}
            type={type}
          />
        ))}
      </AccordionDetails>
    </Accordion>
  );
}

function BookingCards({ bookings, type }) {
  if (!bookings || bookings.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Buchungszeiten vorhanden.</Typography>;
  }
  return (
    <Box>
      {bookings.map((booking, idx) => (
        <BookingAccordion key={idx} booking={booking} index={idx} type={type} />
      ))}
    </Box>
  );
}

function GroupAccordion({ group, index, allGroups }) {
  const [groupState, setGroupState] = useState(group);

  useEffect(() => {
    setGroupState(group);
  }, [group]);

  const handleDateChange = (field, value) => {
    setGroupState(prev => ({
      ...prev,
      [field]: convertYYYYMMDDtoDDMMYYYY(value)
    }));
  };

  const handleGroupChange = (event) => {
    const newGroupId = parseInt(event.target.value, 10);
    const newGroupName = allGroups[newGroupId] || `Gruppe ${newGroupId}`;
    setGroupState(prev => ({
      ...prev,
      id: newGroupId,
      name: newGroupName,
    }));
  };

  const { id, name, start, end } = groupState;
  let dateRangeText = '';
  if (start && end) {
    dateRangeText = `von ${start} bis ${end}`;
  } else if (start) {
    dateRangeText = `ab ${start}`;
  } else if (end) {
    dateRangeText = `bis ${end}`;
  }

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>
          {name}{dateRangeText ? `: ${dateRangeText}` : ''}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box display="flex" flexDirection="column" gap={3}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Gruppe</FormLabel>
            <RadioGroup
              row
              aria-label="gruppe"
              name={`gruppe-radio-buttons-group-${index}`}
              value={id ? String(id) : ''}
              onChange={handleGroupChange}
            >
              {Object.entries(allGroups).map(([groupId, groupName]) => (
                <FormControlLabel key={groupId} value={groupId} control={<Radio />} label={groupName} />
              ))}
            </RadioGroup>
          </FormControl>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              label="Startdatum"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={convertDDMMYYYYtoYYYYMMDD(start)}
              onChange={(e) => handleDateChange('start', e.target.value)}
            />
            <Typography>bis</Typography>
            <TextField
              label="Enddatum"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={convertDDMMYYYYtoYYYYMMDD(end)}
              onChange={(e) => handleDateChange('end', e.target.value)}
            />
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

function GroupCards({ groups, allGroups }) {
  if (!groups || groups.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Gruppenzuordnungen vorhanden.</Typography>;
  }
  return (
    <Box>
      {groups.map((group, idx) => (
        <GroupAccordion key={idx} group={group} index={idx} allGroups={allGroups} />
      ))}
    </Box>
  );
}

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

  const initialStartDate = item?.parseddata?.startdate ? item.parseddata.startdate.split('.').reverse().join('-') : '';
  const initialEndDate = item?.parseddata?.enddate ? item.parseddata.enddate.split('.').reverse().join('-') : '';

  // Update local state if item changes
  useEffect(() => {
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
  }, [item, initialStartDate, initialEndDate]);

  if (!item) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">
          Wählen Sie einen Eintrag aus, um Details anzuzeigen.
        </Typography>
      </Box>
    );
  }

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
          </Box>
          <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>Buchungszeiten:</Typography>
          <BookingCards bookings={item.parseddata?.booking} type={item.type} />
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Gruppen:</Typography>
          <GroupCards groups={item.parseddata?.group} allGroups={allGroups} />
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

export default SimDataDetail;
