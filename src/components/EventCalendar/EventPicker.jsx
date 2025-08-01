import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSelector, useDispatch } from 'react-redux';
import { setReferenceDate, updateWeeklyChartData } from '../../store/chartSlice';
import EventCalendar from './EventCalendar';
import EventList from './EventList';

function EventPicker({ scenarioId }) {
  const dispatch = useDispatch();
  const referenceDate = useSelector(state => state.chart[scenarioId]?.referenceDate || null);
  const [selectedDate, setSelectedDate] = useState(referenceDate || null);
  const [expanded, setExpanded] = useState(false);

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

  const handleAccordionChange = (event, isExpanded) => {
    setExpanded(isExpanded);
  };

  return (
    <Accordion expanded={expanded} onChange={handleAccordionChange} sx={{ mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">
          Stichtag: {selectedDate || referenceDate || '-'}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
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
      </AccordionDetails>
    </Accordion>
  );
}

export default EventPicker;
