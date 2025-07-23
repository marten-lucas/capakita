import { create } from 'zustand';
import { produce } from 'immer';
import useSimScenarioStore from './simScenarioStore';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

// Utility: consolidateBookingTimes
function consolidateBookingTimes(booking) {
  if (!booking || booking.length === 0) return { text: 'Keine Buchungszeiten', hours: 0, segmentsPerDay: {} };
  const dayOrder = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  let totalMinutes = 0;
  const segmentsPerDay = {};

  booking.forEach(b => {
    if (b.times && b.times.length > 0) {
      b.times.forEach(dayTime => {
        if (dayOrder.includes(dayTime.day_name)) {
          let segs = [];
          if (Array.isArray(dayTime.segments)) {
            segs = dayTime.segments;
          } else if (typeof dayTime.segments === 'string') {
            const parts = dayTime.segments.split('|').filter(Boolean);
            for (let i = 0; i < parts.length - 1; i += 2) {
              if (parts[i] && parts[i + 1]) {
                segs.push({ booking_start: parts[i], booking_end: parts[i + 1] });
              }
            }
          }
          if (!segs.length && dayTime.booking_start && dayTime.booking_end) {
            segs = [{ booking_start: dayTime.booking_start, booking_end: dayTime.booking_end }];
          }
          if (!segmentsPerDay[dayTime.day_name]) segmentsPerDay[dayTime.day_name] = [];
          segs.forEach(seg => {
            if (seg.booking_start && seg.booking_end) {
              const [sh, sm] = seg.booking_start.split(':').map(Number);
              const [eh, em] = seg.booking_end.split(':').map(Number);
              const mins = (eh * 60 + em) - (sh * 60 + sm);
              if (mins > 0) totalMinutes += mins;
              segmentsPerDay[dayTime.day_name].push({
                start: seg.booking_start,
                end: seg.booking_end
              });
            }
          });
        }
      });
    }
  });
  return {
    hours: (totalMinutes / 60).toFixed(1),
    segmentsPerDay
  };
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

  // Returns all bookings for the currently selected item (using scenario store)
  getSelectedItemBookings: () => {
    const scenarioId = useSimScenarioStore.getState().selectedScenarioId;
    const itemId = useSimScenarioStore.getState().selectedItems?.[scenarioId];
    if (!scenarioId || !itemId) return [];
    return get().getBookings(scenarioId, itemId);
  },

  // Utility export
  consolidateBookingTimes,
}));

export default useSimBookingStore;
