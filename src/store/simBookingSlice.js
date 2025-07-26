import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  bookingsByScenario: {},
};

const EMPTY_BOOKINGS = [];

const simBookingSlice = createSlice({
  name: 'simBooking',
  initialState,
  reducers: {
    addBooking(state, action) {
      const { scenarioId, dataItemId, booking } = action.payload;
      if (!state.bookingsByScenario[scenarioId]) state.bookingsByScenario[scenarioId] = {};
      const itemId = String(dataItemId);
      if (!state.bookingsByScenario[scenarioId][itemId]) state.bookingsByScenario[scenarioId][itemId] = {};
      const id = String(booking.id || Date.now());
      state.bookingsByScenario[scenarioId][itemId][id] = {
        ...booking,
        id,
        overlays: {},
      };
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
        const itemId = String(item.id || Date.now());
        if (Array.isArray(item.times)) {
          if (!state.bookingsByScenario[scenarioId][itemId]) state.bookingsByScenario[scenarioId][itemId] = {};
          const bookingId = String(item.id || Date.now());
          state.bookingsByScenario[scenarioId][itemId][bookingId] = {
            ...item,
            id: bookingId,
            overlays: {},
          };
          return;
        }
        const bookingsArr = item.booking || item.bookings;
        if (Array.isArray(bookingsArr)) {
          if (!state.bookingsByScenario[scenarioId][itemId]) state.bookingsByScenario[scenarioId][itemId] = {};
          bookingsArr.forEach((booking) => {
            const id = String(booking.id || Date.now());
            state.bookingsByScenario[scenarioId][itemId][id] = {
              ...booking,
              id,
              overlays: {},
            };
          });
        }
      });
    },
    deleteAllBookingsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      if (state.bookingsByScenario[scenarioId]) {
        delete state.bookingsByScenario[scenarioId][itemId];
      }
    },
    deleteAllBookingsForScenario(state, action) {
      const { scenarioId } = action.payload;
      delete state.bookingsByScenario[scenarioId];
    },
  },
});

export const {
  addBooking,
  updateBooking,
  deleteBooking,
  importBookings,
  deleteAllBookingsForItem,
  deleteAllBookingsForScenario,
} = simBookingSlice.actions;

export const getBookings = createSelector(
  [
    state => state.simBooking.bookingsByScenario,
    (state, scenarioId) => scenarioId,
    (state, scenarioId, itemId) => itemId
  ],
  (bookingsByScenario, scenarioId, itemId) => {
    if (!scenarioId || !itemId || !bookingsByScenario[scenarioId]) return EMPTY_BOOKINGS;
    const itemBookings = bookingsByScenario[scenarioId][itemId];
    return itemBookings ? Object.values(itemBookings) : EMPTY_BOOKINGS;
  }
);

export default simBookingSlice.reducer;