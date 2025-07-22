import { useCallback } from 'react';
import useSimScenarioDataStore from '../store/simScenarioStore';

export function useBookingManager(itemId) {
  const { getItemBookings, updateItemBookings } = useSimScenarioDataStore();
  
  // Deep clone helper - extracted to ensure consistency
  const deepClone = useCallback((obj) => {
    if (typeof structuredClone === 'function') return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
  }, []);

  // Get bookings with guaranteed deep clone
  const getBookings = useCallback(() => {
    const bookings = getItemBookings(itemId);
    return deepClone(bookings);
  }, [itemId, getItemBookings, deepClone]);

  // Update single booking with deep clone protection
  const updateBooking = useCallback((bookingIndex, updatedBooking) => {
    const currentBookings = getBookings();
    const newBookings = currentBookings.map((booking, idx) => 
      idx === bookingIndex ? deepClone(updatedBooking) : booking
    );
    updateItemBookings(itemId, newBookings);
  }, [itemId, getBookings, updateItemBookings, deepClone]);

  // Add new booking
  const addBooking = useCallback(() => {
    const currentBookings = getBookings();
    const newBooking = {
      startdate: '',
      enddate: '',
      times: []
    };
    updateItemBookings(itemId, [...currentBookings, newBooking]);
  }, [itemId, getBookings, updateItemBookings]);

  // Delete booking
  const deleteBooking = useCallback((bookingIndex) => {
    const currentBookings = getBookings();
    const newBookings = currentBookings.filter((_, idx) => idx !== bookingIndex);
    updateItemBookings(itemId, newBookings);
  }, [itemId, getBookings, updateItemBookings]);

  // Restore all bookings
  const restoreBookings = useCallback((originalBookings) => {
    if (originalBookings) {
      updateItemBookings(itemId, deepClone(originalBookings));
    }
  }, [itemId, updateItemBookings, deepClone]);

  return {
    getBookings,
    updateBooking,
    addBooking,
    deleteBooking,
    restoreBookings
  };
}
