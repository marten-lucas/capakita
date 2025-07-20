import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  OutlinedInput,
  Typography,
  Divider
} from '@mui/material';
import useChartStore from '../../store/chartStore';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

function extractDatesOfInterest(simulationData) {
  const dateChanges = new Map();
  const today = new Date().toISOString().split('T')[0];

  const addChange = (date, type, name) => {
    if (!dateChanges.has(date)) {
      dateChanges.set(date, { date, changes: [] });
    }
    dateChanges.get(date).changes.push({ type, name });
  };

  const addDayToDate = (dateStr) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  };

  simulationData?.forEach(item => {
    const itemType = item.type === 'demand' ? 'Kind' : 'Mitarbeiter';

    // Item start/end dates
    if (item.parseddata?.startdate) {
      const startDate = item.parseddata.startdate.split('.').reverse().join('-');
      addChange(startDate, `Neu: ${itemType}`, item.name);
    }
    if (item.parseddata?.enddate) {
      const endDate = item.parseddata.enddate.split('.').reverse().join('-');
      const effectiveEndDate = addDayToDate(endDate);
      addChange(effectiveEndDate, `Verabschiedung: ${itemType}`, item.name);
    }

    // Group start/end dates
    if (item.parseddata?.group) {
      item.parseddata.group.forEach(group => {
        if (group.start) {
          const groupStart = group.start.split('.').reverse().join('-');
          addChange(groupStart, `Gruppenwechsel: ${itemType}`, `${item.name} → ${group.name}`);
        }
        if (group.end) {
          const groupEnd = group.end.split('.').reverse().join('-');
          const effectiveGroupEnd = addDayToDate(groupEnd);
          addChange(effectiveGroupEnd, `Gruppenwechsel: ${itemType}`, `${item.name} verlässt ${group.name}`);
        }
      });
    }

    // Booking start/end dates
    if (item.parseddata?.booking) {
      item.parseddata.booking.forEach(booking => {
        if (booking.startdate) {
          const bookingStart = booking.startdate.split('.').reverse().join('-');
          addChange(bookingStart, `Buchungsänderung: ${itemType}`, `${item.name} neue Zeiten`);
        }
        if (booking.enddate) {
          const bookingEnd = booking.enddate.split('.').reverse().join('-');
          const effectiveBookingEnd = addDayToDate(bookingEnd);
          addChange(effectiveBookingEnd, `Buchungsänderung: ${itemType}`, `${item.name} Zeiten enden`);
        }
      });
    }

    // Pause start/end dates
    if (item.parseddata?.paused?.enabled) {
      if (item.parseddata.paused.start) {
        addChange(item.parseddata.paused.start, `Pause: ${itemType}`, `${item.name} beginnt Pause`);
      }
      if (item.parseddata.paused.end) {
        const effectivePauseEnd = addDayToDate(item.parseddata.paused.end);
        addChange(effectivePauseEnd, `Pause: ${itemType}`, `${item.name} beendet Pause`);
      }
    }
  });

  // Filter future dates and sort
  return Array.from(dateChanges.values())
    .filter(item => item.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function ChartFilterForm({ showStichtag = false, showZeitdimension = false, chartToggle, simulationData }) {
  const {
    // Weekly filters
    stichtag,
    setStichtag,
    selectedGroups,
    setSelectedGroups,
    selectedQualifications,
    setSelectedQualifications,
    availableGroups,
    availableQualifications,
    
    // Midterm filters
    midtermTimeDimension,
    setMidtermTimeDimension,
    midtermSelectedGroups,
    setMidtermSelectedGroups,
    midtermSelectedQualifications,
    setMidtermSelectedQualifications
  } = useChartStore();

  // Use appropriate filters based on what charts are visible
  const currentGroups = showZeitdimension && !showStichtag ? midtermSelectedGroups : selectedGroups;
  const currentQualifications = showZeitdimension && !showStichtag ? midtermSelectedQualifications : selectedQualifications;
  
  const handleGroupChange = (event) => {
    const value = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;
    if (showZeitdimension && !showStichtag) {
      setMidtermSelectedGroups(value);
    } else {
      setSelectedGroups(value);
    }
    // Sync both if both charts are visible
    if (showStichtag && showZeitdimension) {
      setMidtermSelectedGroups(value);
    }
  };

  const handleQualificationChange = (event) => {
    const value = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;
    if (showZeitdimension && !showStichtag) {
      setMidtermSelectedQualifications(value);
    } else {
      setSelectedQualifications(value);
    }
    // Sync both if both charts are visible
    if (showStichtag && showZeitdimension) {
      setMidtermSelectedQualifications(value);
    }
  };

  // Dates of Interest for weekly chart
  const datesOfInterest = useMemo(() => {
    if (!showStichtag || !simulationData) return [];
    return extractDatesOfInterest(simulationData);
  }, [showStichtag, simulationData]);

  // Determine if second row is needed
  const showSecondRow = showStichtag || (showStichtag && datesOfInterest.length > 0) || showZeitdimension;

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Filter
      </Typography>
      {/* First row: Toggles, Groups, Qualifications (always visible) */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: showSecondRow ? 2 : 0 }}>
        {/* Chart toggles (if provided) */}
        {chartToggle && (
          <Box sx={{ minWidth: 220 }}>{chartToggle}</Box>
        )}
        {/* Groups */}
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Gruppen</InputLabel>
          <Select
            multiple
            value={currentGroups}
            onChange={handleGroupChange}
            input={<OutlinedInput label="Gruppen" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected
                  .filter((value) => Object.prototype.hasOwnProperty.call(availableGroups, value))
                  .map((value) => (
                    <Chip key={value} label={availableGroups[value]} size="small" />
                  ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {Object.entries(availableGroups).map(([id, name]) => (
              <MenuItem key={id} value={id}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Qualifications */}
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Qualifikationen</InputLabel>
          <Select
            multiple
            value={currentQualifications}
            onChange={handleQualificationChange}
            input={<OutlinedInput label="Qualifikationen" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected
                  .filter((value) => Object.prototype.hasOwnProperty.call(availableQualifications, value))
                  .map((value) => (
                    <Chip key={value} label={availableQualifications[value]} size="small" />
                  ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {Object.entries(availableQualifications).map(([key, name]) => (
              <MenuItem key={key} value={key}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      {/* Second row: Stichtag, Dates of Interest, Zeitdimension */}
      {showSecondRow && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          {/* Stichtag - only for Weekly */}
          {showStichtag && (
            <FormControl sx={{ minWidth: 200 }}>
              <TextField
                label="Stichtag"
                type="date"
                value={stichtag}
                onChange={(e) => setStichtag(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                size="small"
              />
            </FormControl>
          )}
          {/* Dates of Interest selector (with InputLabel, single row) */}
          {showStichtag && datesOfInterest.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="dates-of-interest-label">Dates of Interest</InputLabel>
              <Select
                labelId="dates-of-interest-label"
                label="Dates of Interest"
                displayEmpty
                value={datesOfInterest.find(item => item.date === stichtag)?.date || ""}
                onChange={(e) => setStichtag(e.target.value)}
                renderValue={selected => {
                  if (!selected) return <span style={{ color: '#888' }}>Dates of Interest</span>;
                  const item = datesOfInterest.find(i => i.date === selected);
                  if (!item) return <span style={{ color: '#888' }}>Dates of Interest</span>;
                  const changesSummary = item.changes.reduce((acc, change) => {
                    const key = change.type.split(':')[0];
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {});
                  const summaryText = Object.entries(changesSummary)
                    .map(([type, count]) => `${count} ${type}${count > 1 ? (type === 'Neu' ? 'e' : type === 'Verabschiedung' ? 'en' : '') : ''}`)
                    .join(', ');
                  return (
                    <span>
                      {new Date(item.date).toLocaleDateString('de-DE')}
                      {summaryText ? ` – ${summaryText}` : ''}
                    </span>
                  );
                }}
              >
                {datesOfInterest.map(item => {
                  const changesSummary = item.changes.reduce((acc, change) => {
                    const key = change.type.split(':')[0];
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {});
                  const summaryText = Object.entries(changesSummary)
                    .map(([type, count]) => `${count} ${type}${count > 1 ? (type === 'Neu' ? 'e' : type === 'Verabschiedung' ? 'en' : '') : ''}`)
                    .join(', ');
                  return (
                    <MenuItem key={item.date} value={item.date}>
                      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontWeight: 500 }}>
                          {new Date(item.date).toLocaleDateString('de-DE')}
                        </span>
                        {summaryText && (
                          <span style={{ fontSize: '0.9em', color: '#888' }}>
                            {summaryText}
                          </span>
                        )}
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          )}
          {/* Zeitdimension - only for Midterm */}
          {showZeitdimension && (
            <FormControl sx={{ minWidth: 150 }} size="small">
              <InputLabel>Zeitdimension</InputLabel>
              <Select
                value={midtermTimeDimension}
                onChange={(e) => setMidtermTimeDimension(e.target.value)}
                label="Zeitdimension"
              >
                <MenuItem value="week">Woche</MenuItem>
                <MenuItem value="month">Monat</MenuItem>
                <MenuItem value="quarter">Quartal</MenuItem>
                <MenuItem value="year">Jahr</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default ChartFilterForm;
