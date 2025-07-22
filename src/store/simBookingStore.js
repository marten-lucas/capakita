import { create } from 'zustand';
import { produce } from 'immer';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

const useSimBookingStore = create((set, get) => ({
  // { [scenarioId]: { [dataItemId]: { [bookingId]: { ...bookingData, overlays: {...} } } } }
  bookingsByScenario: {},

  addBooking: (scenarioId, dataItemId, booking) =>
    set(produce((state) => {
      if (!state.bookingsByScenario[scenarioId]) state.bookingsByScenario[scenarioId] = {};
      if (!state.bookingsByScenario[scenarioId][dataItemId]) state.bookingsByScenario[scenarioId][dataItemId] = {};
      const id = booking.id || generateUID();
      state.bookingsByScenario[scenarioId][dataItemId][id] = { ...booking, id, overlays: {} };
    })),

  updateBooking: (scenarioId, dataItemId, bookingId, updates) =>
    set(produce((state) => {
      if (!state.bookingsByScenario[scenarioId]?.[dataItemId]?.[bookingId]) return;
      state.bookingsByScenario[scenarioId][dataItemId][bookingId] = {
        ...state.bookingsByScenario[scenarioId][dataItemId][bookingId],
        ...updates,
        overlays: {
          ...state.bookingsByScenario[scenarioId][dataItemId][bookingId].overlays,
          ...updates.overlays
        }
      };
    })),

  deleteBooking: (scenarioId, dataItemId, bookingId) =>
    set(produce((state) => {
      if (state.bookingsByScenario[scenarioId]?.[dataItemId]) {
        delete state.bookingsByScenario[scenarioId][dataItemId][bookingId];
      }
    })),

  getBookings: (scenarioId, dataItemId) => {
    const state = get();
    return Object.values(state.bookingsByScenario[scenarioId]?.[dataItemId] || {});
  },

  getBooking: (scenarioId, dataItemId, bookingId) => {
    const state = get();
    return state.bookingsByScenario[scenarioId]?.[dataItemId]?.[bookingId];
  },
}));

export default useSimBookingStore;
