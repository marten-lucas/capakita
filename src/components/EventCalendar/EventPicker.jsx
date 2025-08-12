import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import IconButton from '@mui/material/IconButton';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useSelector, useDispatch } from 'react-redux';
import { setReferenceDate, updateWeeklyChartData } from '../../store/chartSlice';
import EventCalendar from './EventCalendar';
import EventList from './EventList';

function EventPicker({ scenarioId }) {
  const dispatch = useDispatch();
  const referenceDate = useSelector(state => state.chart[scenarioId]?.referenceDate || null);
  const [selectedDate, setSelectedDate] = useState(referenceDate || null);
  const [anchorEl, setAnchorEl] = useState(null);
  const inputRef = useRef();

  useEffect(() => {
    if (!selectedDate && referenceDate) {
      setSelectedDate(referenceDate);
    }
  }, [referenceDate, selectedDate]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    dispatch(setReferenceDate({ scenarioId, date }));
    dispatch(updateWeeklyChartData(scenarioId));
    // Remove auto-close: setAnchorEl(null);
  };

  const handleOpen = (event) => {
    if (open) {
      // If already open, close it (toggle behavior)
      setAnchorEl(null);
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  // Label for the field
  const label = "Stichtag";

  return (
    <FormControl
      variant="outlined"
      size="small"
      sx={{
        minWidth: 160,
        maxWidth: 220,
        mr: 1,
        verticalAlign: 'middle'
      }}
    >
      <InputLabel htmlFor="event-picker-input">{label}</InputLabel>
      <OutlinedInput
        id="event-picker-input"
        label={label}
        inputRef={inputRef}
        value={selectedDate || referenceDate || ''}
        readOnly
        endAdornment={
          <IconButton
            size="small"
            onClick={handleOpen}
            edge="end"
            aria-label="Stichtag auswählen"
            tabIndex={-1}
            sx={{ p: 0, mr: 0.5 }} // reduce padding and add a small right margin
          >
            <CalendarTodayIcon fontSize="small" />
          </IconButton>
        }
        onClick={handleOpen}
        sx={{
          cursor: 'pointer',
          height: 40,
          pr: 1, // reduce right padding to move icon left
          background: open ? '#f5f5f5' : undefined
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
        PaperProps={{
          sx: {
            p: 2,
            minWidth: 350,
            maxWidth: 600,
            maxHeight: 380,
            display: 'flex',
            flexDirection: 'row',
            gap: 2
          },
          // Prevent popover from closing on interaction inside
          onMouseDown: (e) => e.stopPropagation()
        }}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        disableScrollLock
      >
        <Box sx={{ maxHeight: 340, overflowY: 'auto', minWidth: 150 }}>
          <EventList
            scenarioId={scenarioId}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            // No onClose here, so expanding/clicking tree does not close popover
          />
        </Box>
        <Box sx={{
          width: '1px',
          backgroundColor: '#ccc',
          mx: 1,
          alignSelf: 'stretch'
        }} />
        <Box sx={{ minWidth: 200 }}>
          <EventCalendar
            scenarioId={scenarioId}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            // No onClose here, so expanding/clicking tree does not close popover
          />
        </Box>
      </Popover>
    </FormControl>
  );
}

export default EventPicker;
