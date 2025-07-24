import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  bookingsByScenario: {},
};

const simBookingSlice = createSlice({
  name: 'simBooking',
  initialState,
  reducers: {
    addBooking(state, action) {
      const { scenarioId, dataItemId, booking } = action.payload;
      if (!state.bookingsByScenario[scenarioId]) state.bookingsByScenario[scenarioId] = {};
      if (!state.bookingsByScenario[scenarioId][dataItemId]) state.bookingsByScenario[scenarioId][dataItemId] = {};
      const id = booking.id || Date.now();
      state.bookingsByScenario[scenarioId][dataItemId][id] = { ...booking, id, overlays: {} };
    },
    updateBooking(state, action) {
      const { scenarioId, dataItemId, bookingId, updates } = action.payload;
      if (!state.bookingsByScenario[scenarioId]?.[dataItemId]?.[bookingId]) return;
      state.bookingsByScenario[scenarioId][dataItemId][bookingId] = {
        ...state.bookingsByScenario[scenarioId][dataItemId][bookingId],
        ...updates,
        overlays: {
          ...state.bookingsByScenario[scenarioId][dataItemId][bookingId].overlays,
          ...updates.overlays
        }
      };
    },
    deleteBooking(state, action) {
      const { scenarioId, dataItemId, bookingId } = action.payload;
      if (state.bookingsByScenario[scenarioId]?.[dataItemId]) {
        delete state.bookingsByScenario[scenarioId][dataItemId][bookingId];
      }
    },
    importBookings(state, action) {
      const { scenarioId, items } = action.payload;
      if (!state.bookingsByScenario[scenarioId]) state.bookingsByScenario[scenarioId] = {};
      items.forEach(item => {
        const itemId = item.id || Date.now();
        if (Array.isArray(item.times)) {
          if (!state.bookingsByScenario[scenarioId][itemId]) state.bookingsByScenario[scenarioId][itemId] = {};
          const bookingId = item.id || Date.now();
          state.bookingsByScenario[scenarioId][itemId][bookingId] = { ...item, id: bookingId, overlays: {} };
          return;
        }
        const bookingsArr = item.booking || item.bookings;
        if (Array.isArray(bookingsArr)) {
          if (!state.bookingsByScenario[scenarioId][itemId]) state.bookingsByScenario[scenarioId][itemId] = {};
          bookingsArr.forEach((booking) => {
            const id = booking.id || Date.now();
            state.bookingsByScenario[scenarioId][itemId][id] = { ...booking, id, overlays: {} };
          });
        }
      });
    },
    // ...existing code...
  },
});

export const {
  addBooking,
  updateBooking,
  deleteBooking,
  importBookings,
  // ...other actions...
} = simBookingSlice.actions;

export default simBookingSlice.reducer;