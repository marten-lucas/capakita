import React from 'react';
import { Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ModMonitor from '../ModMonitor';
import BookingCards from './BookingCards';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { createSelector } from '@reduxjs/toolkit';
import { addBookingThunk } from '../../../store/simBookingSlice';

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

  // Memoized selector for bookings with overlay support (merged overlays over base)
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

        const overlayObj = overlaysByScenario[scenarioId]?.bookings?.[itemId] || {};
        const overlayArr = Object.values(overlayObj);

        if (baseScenarioId) {
          const baseObj = bookingsByScenario[baseScenarioId]?.[itemId] || {};
          const baseArr = Object.values(baseObj);
          // Merge overlays over base by id
          const merged = [...baseArr];
          overlayArr.forEach(overlay => {
            const idx = merged.findIndex(b => b.id === overlay.id);
            if (idx >= 0) merged[idx] = overlay;
            else merged.push(overlay);
          });
          return merged;
        }

        // Try current scenario first
        const scenarioBookings = bookingsByScenario[scenarioId];
        if (scenarioBookings && scenarioBookings[itemId]) {
          return Object.values(scenarioBookings[itemId]);
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
    dispatch(addBookingThunk({
      scenarioId: selectedScenarioId,
      dataItemId: selectedItemId,
      booking: {
        id: bookingId,
        startdate: '',
        enddate: '',
        times: [],
        rawdata: {}
      }
    }));
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


