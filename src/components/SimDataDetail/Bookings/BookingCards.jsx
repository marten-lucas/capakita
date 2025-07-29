import React from 'react';
import { Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BookingDetail from './BookingDetail';
import { useSelector } from 'react-redux';
import { consolidateBookingSummary } from '../../../utils/bookingUtils';
import { createSelector } from '@reduxjs/toolkit';


// Hilfsfunktion analog zu SimDataList
function getBookingHours(times) {
  if (!times || times.length === 0) return '0 h';
  let totalMinutes = 0;
  times.forEach(dayTime => {
    if (Array.isArray(dayTime.segments)) {
      dayTime.segments.forEach(seg => {
        if (seg.booking_start && seg.booking_end) {
          const [sh, sm] = seg.booking_start.split(':').map(Number);
          const [eh, em] = seg.booking_end.split(':').map(Number);
          const mins = (eh * 60 + em) - (sh * 60 + sm);
          if (mins > 0) totalMinutes += mins;
        }
      });
    }
  });
  return `${(totalMinutes / 60).toFixed(1)} h`;
}

const EMPTY_BOOKINGS = [];
function BookingCards() {
  // Use selector for bookings of the selected item
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems[selectedScenarioId]);
  const baseScenarioId = useSelector(state => {
    const scenario = state.simScenario.scenarios.find(s => s.id === selectedScenarioId);
    return scenario?.baseScenarioId || null;
  });

  // Memoized selector for bookings with overlay support
  const bookingsSelector = React.useMemo(() =>
    createSelector(
      [
        state => state.simBooking.bookingsByScenario,
        state => state.simOverlay.overlaysByScenario,
        () => selectedScenarioId,
        () => baseScenarioId,
        () => selectedItemId
      ],
      (bookingsByScenario, overlaysByScenario, scenarioId, baseScenarioId, itemId) => {
        if (!scenarioId || !itemId) return EMPTY_BOOKINGS;

        // Overlay support for based scenarios
        const overlayBookings = overlaysByScenario[scenarioId]?.bookings?.[itemId];
        if (overlayBookings) {
          return Object.values(overlayBookings);
        }

        // Try current scenario first
        const scenarioBookings = bookingsByScenario[scenarioId];
        if (scenarioBookings && scenarioBookings[itemId]) {
          return Object.values(scenarioBookings[itemId]);
        }

        // If no bookings in current scenario and we have a base scenario, try base
        if (baseScenarioId) {
          const baseScenarioBookings = bookingsByScenario[baseScenarioId];
          if (baseScenarioBookings && baseScenarioBookings[itemId]) {
            return Object.values(baseScenarioBookings[itemId]);
          }
        }

        return EMPTY_BOOKINGS;
      }
    ),
    [selectedScenarioId, baseScenarioId, selectedItemId]
  );

  const bookings = useSelector(bookingsSelector);

  // Track expanded accordion index
  const [expandedIdx, setExpandedIdx] = React.useState(bookings && bookings.length > 0 ? 0 : null);

  // Expand last booking when bookings length increases
  const prevLengthRef = React.useRef(bookings ? bookings.length : 0);
  React.useEffect(() => {
    if (bookings && bookings.length > prevLengthRef.current) {
      setExpandedIdx(bookings.length - 1);
    }
    prevLengthRef.current = bookings ? bookings.length : 0;
  }, [bookings]);

  const handleAccordionChange = (idx) => (event, expanded) => {
    setExpandedIdx(expanded ? idx : null);
  };


  if (!bookings || bookings.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Buchungszeiten vorhanden.</Typography>;
  }

  return (
    <Box>
      {bookings.map((booking, idx) => {
        // Zeitraum-Text
        let dateRangeText = '';
        if (booking.startdate && booking.enddate) {
          dateRangeText = `von ${booking.startdate} bis ${booking.enddate}`;
        } else if (booking.startdate) {
          dateRangeText = `ab ${booking.startdate}`;
        } else if (booking.enddate) {
          dateRangeText = `bis ${booking.enddate}`;
        }

        // Stunden-Summe
        const hoursText = getBookingHours(booking.times);

        return (
          <Accordion
            key={idx}
            expanded={expandedIdx === idx}
            onChange={handleAccordionChange(idx)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box>
                <Typography variant="subtitle1">{`Buchung ${idx + 1}:`}  <Box component="span" fontWeight='fontWeightMedium'>{hoursText} {dateRangeText}</Box></Typography>
                <Typography variant="caption">{consolidateBookingSummary(booking.times)}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <BookingDetail
                index={idx}
              />
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

export default BookingCards;