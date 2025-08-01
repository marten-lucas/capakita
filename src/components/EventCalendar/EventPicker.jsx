import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import EventCalendar from './EventCalendar';
import EventList from './EventList';
import { useSelector, useDispatch } from 'react-redux';
import { setReferenceDate, updateWeeklyChartData } from '../../store/chartSlice';

function EventPicker({ scenarioId }) {
  const dispatch = useDispatch();
  const referenceDate = useSelector(state => state.chart[scenarioId]?.referenceDate || null);
  const [selectedDate, setSelectedDate] = useState(referenceDate || null);

  useEffect(() => {
    if (!selectedDate && referenceDate) {
      setSelectedDate(referenceDate);
    }
  }, [referenceDate, selectedDate]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    dispatch(setReferenceDate({ scenarioId, date }));
    dispatch(updateWeeklyChartData(scenarioId));
  };

  return (
    <Box sx={{ border: '1px solid #ccc', borderRadius: 4, p: 2, minWidth: 500, maxWidth: 600 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        Events
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
            <EventList scenarioId={scenarioId} selectedDate={selectedDate} onDateChange={handleDateChange} />
          </Box>
        </Grid>
        <Grid item xs={6}>
          <EventCalendar scenarioId={scenarioId} selectedDate={selectedDate} onDateChange={handleDateChange} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default EventPicker;
