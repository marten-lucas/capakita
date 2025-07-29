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
      const itemId = String(dataItemId);
      if (!state.bookingsByScenario[scenarioId][itemId]) state.bookingsByScenario[scenarioId][itemId] = {};
      const bookingKey = String(booking.id || createId('booking'));
      state.bookingsByScenario[scenarioId][itemId][bookingKey] = {
        ...booking,
        id: bookingKey
      };
    },
    updateBooking(state, action) {
      const { scenarioId, dataItemId, bookingId, updates } = action.payload;
      const itemId = String(dataItemId);
      const id = String(bookingId);

      // Ensure the nested structure exists
      if (!state.bookingsByScenario[scenarioId]) {
        state.bookingsByScenario[scenarioId] = {};
      }
      if (!state.bookingsByScenario[scenarioId][itemId]) {
        state.bookingsByScenario[scenarioId][itemId] = {};
      }

      // Check if booking exists, if not create it
      if (!state.bookingsByScenario[scenarioId][itemId][id]) {
        // Create new booking if it doesn't exist
        state.bookingsByScenario[scenarioId][itemId][id] = {
          id,
          startdate: '',
          enddate: '',
          times: [],
          rawdata: {},
        };
      }

      // Update the booking
      state.bookingsByScenario[scenarioId][itemId][id] = {
        ...state.bookingsByScenario[scenarioId][itemId][id],
        ...updates,
      
      };
    },
    deleteBooking(state, action) {
      const { scenarioId, dataItemId, bookingId } = action.payload;
      const itemId = String(dataItemId);
      const id = String(bookingId);
      if (state.bookingsByScenario[scenarioId]?.[itemId]) {
        delete state.bookingsByScenario[scenarioId][itemId][id];
      }
    },
    importBookings(state, action) {
      const { scenarioId, items } = action.payload;
      if (!state.bookingsByScenario[scenarioId]) state.bookingsByScenario[scenarioId] = {};
      items.forEach(item => {
        const itemKey = String(item.dataItemId);
        if (!state.bookingsByScenario[scenarioId][itemKey]) state.bookingsByScenario[scenarioId][itemKey] = {};
        const bookingKey = String(item.id || createId('booking'));
        state.bookingsByScenario[scenarioId][itemKey][bookingKey] = {
          ...item,
          id: bookingKey,
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
    loadBookingsByScenario(state, action) {
      state.bookingsByScenario = action.payload || {};
    },
  },
});

// Thunk for adding a booking, overlay-aware
export const addBookingThunk = ({ scenarioId, dataItemId, booking }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  if (isBasedScenario) {
    // Overlay: set booking overlay
    dispatch({
      type: 'simOverlay/setBookingOverlay',
      payload: {
        scenarioId,
        itemId: dataItemId,
        bookingId: booking.id,
        overlayData: booking
      }
    });
  } else {
    dispatch(simBookingSlice.actions.addBooking({ scenarioId, dataItemId, booking }));
  }
};

// Thunk for updating a booking, overlay-aware
export const updateBookingThunk = ({ scenarioId, dataItemId, bookingId, updates }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  if (isBasedScenario) {
    // Get base booking
    const baseScenarioId = scenario.baseScenarioId;
    const baseBooking = state.simBooking.bookingsByScenario[baseScenarioId]?.[dataItemId]?.[bookingId];
    const updatedBooking = { ...baseBooking, ...updates, id: bookingId };
    const isIdenticalToBase = baseBooking && JSON.stringify(updatedBooking) === JSON.stringify(baseBooking);
    if (isIdenticalToBase) {
      // Remove overlay if matches base
      dispatch({
        type: 'simOverlay/removeBookingOverlay',
        payload: { scenarioId, itemId: dataItemId, bookingId }
      });
    } else {
      // Set overlay if different from base
      dispatch({
        type: 'simOverlay/setBookingOverlay',
        payload: {
          scenarioId,
          itemId: dataItemId,
          bookingId,
          overlayData: updatedBooking
        }
      });
    }
  } else {
    dispatch(simBookingSlice.actions.updateBooking({ scenarioId, dataItemId, bookingId, updates }));
  }
};

export const {
  addBooking,
  updateBooking,
  deleteBooking,
  importBookings,
  deleteAllBookingsForItem,
  deleteAllBookingsForScenario,
  loadBookingsByScenario,
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