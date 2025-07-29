import React from 'react';
import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ModMonitor from '../ModMonitor';
import BookingCards from './BookingCards';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { createSelector } from '@reduxjs/toolkit';

const EMPTY_BOOKINGS = [];

function SimDataBookingTab() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const baseScenarioId = useSelector(state => {
    const scenario = state.simScenario.scenarios.find(s => s.id === selectedScenarioId);
    return scenario?.baseScenarioId || null;
  });

  // Use overlay hook to get effective data
  const { getEffectiveDataItem } = useOverlayData();
  const selectedItem = getEffectiveDataItem(selectedItemId);

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

  // Handler to add a new booking
  const handleAddBooking = () => {
    if (!selectedScenarioId || !selectedItemId) return;
    const bookingId = Date.now();
    dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId: selectedScenarioId,
        dataItemId: selectedItemId,
        booking: {
          id: bookingId,
          startdate: '',
          enddate: '',
          times: [],
          rawdata: {}
        }
      }
    });
  };

  if (!selectedItem) return null;

  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddBooking}
        >
          Buchungszeitraum hinzufügen
        </Button>
        <ModMonitor
          itemId={selectedItemId}
          field="bookings"
          value={JSON.stringify(bookings)}
          originalValue={undefined}
          onRestore={undefined}
          title="Alle Buchungen auf importierte Werte zurücksetzen"
          confirmMsg="Alle Buchungen auf importierten Wert zurücksetzen?"
        />
      </Box>
      <BookingCards bookings={bookings} />
    </Box>
  );
}

export default SimDataBookingTab;

