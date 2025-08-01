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
    <Box sx={{ border: '1px solid #ccc', borderRadius: 4, p: 2, display: 'inline-flex', flexDirection: 'column' }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        Events
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
        <Box sx={{ maxHeight: 300, overflowY: 'auto', flex: '1 1 auto' }}>
          <EventList scenarioId={scenarioId} selectedDate={selectedDate} onDateChange={handleDateChange} />
        </Box>
        {/* Vertical divider */}
        <Box sx={{
          width: '1px',
          backgroundColor: '#ccc',
          mx: 2,
          alignSelf: 'stretch'
        }} />
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <EventCalendar scenarioId={scenarioId} selectedDate={selectedDate} onDateChange={handleDateChange} />
        </Box>
      </Box>
    </Box>
  );
}

export default EventPicker;
