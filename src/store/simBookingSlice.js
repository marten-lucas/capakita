import { createSlice, createSelector } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';

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
      const itemKey = String(dataItemId);
      if (!state.bookingsByScenario[scenarioId][itemKey]) state.bookingsByScenario[scenarioId][itemKey] = {};
      const bookingKey = createId('booking');
      state.bookingsByScenario[scenarioId][itemKey][bookingKey] = {
        ...booking,
        overlays: {},
      };
    },
    updateBooking(state, action) {
      const { scenarioId, dataItemId, bookingId, updates } = action.payload;
      const itemId = String(dataItemId);
      if (!state.bookingsByScenario[scenarioId]?.[itemId]?.[bookingId]) return;
      state.bookingsByScenario[scenarioId][itemId][bookingId] = {
        ...state.bookingsByScenario[scenarioId][itemId][bookingId],
        ...updates,
        overlays: updates.overlays
          ? { ...state.bookingsByScenario[scenarioId][itemId][bookingId].overlays, ...updates.overlays }
          : state.bookingsByScenario[scenarioId][itemId][bookingId].overlays
      };
    },
    deleteBooking(state, action) {
      const { scenarioId, dataItemId, bookingId } = action.payload;
      const itemId = String(dataItemId);
      if (state.bookingsByScenario[scenarioId]?.[itemId]) {
        delete state.bookingsByScenario[scenarioId][itemId][bookingId];
      }
    },
    importBookings(state, action) {
      const { scenarioId, items } = action.payload;
      if (!state.bookingsByScenario[scenarioId]) state.bookingsByScenario[scenarioId] = {};
      items.forEach(item => {
        const itemKey = String(item.dataItemId);
        if (!state.bookingsByScenario[scenarioId][itemKey]) state.bookingsByScenario[scenarioId][itemKey] = {};
        const bookingKey = createId('booking');
        state.bookingsByScenario[scenarioId][itemKey][bookingKey] = {
          ...item,
          overlays: {},
        };
      });
    },
    deleteAllBookingsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      const id = String(itemId);
      if (state.bookingsByScenario[scenarioId]) {
        delete state.bookingsByScenario[scenarioId][id];
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