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
      const id = booking.id;
      state.bookingsByScenario[scenarioId][dataItemId][id] = { ...booking, overlays: {} };
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
        if (!item.id) return;
        if (Array.isArray(item.times)) {
          if (!state.bookingsByScenario[scenarioId][item.id]) state.bookingsByScenario[scenarioId][item.id] = {};
          const bookingId = item.id;
          state.bookingsByScenario[scenarioId][item.id][bookingId] = { ...item, overlays: {} };
          return;
        }
        const bookingsArr = item.booking || item.bookings;
        if (Array.isArray(bookingsArr)) {
          bookingsArr.forEach((booking) => {
            const id = booking.id;
            state.bookingsByScenario[scenarioId][item.id][id] = { ...booking, overlays: {} };
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