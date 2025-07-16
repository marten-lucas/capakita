import { create } from 'zustand';
import { produce } from 'immer';

const useSimulationDataStore = create((set, get) => ({
  simulationData: [], // Removed localStorage loading
  groupsLookup: {}, // Removed localStorage loading
  selectedItem: null, // Add selectedItem state

  setSimulationData: (data) => {
    set({ simulationData: data });
  },
  setGroupsLookup: (lookup) => {
    set({ groupsLookup: lookup });
  },
  setSelectedItem: (item) => {
    set({ selectedItem: item }); // Add setSelectedItem function
  },
  clearAllData: () => {
    set({ simulationData: [], groupsLookup: {}, selectedItem: null });
  },

  // Helper function to add modification to item
  addModification: (itemId, field, previousValue, newValue) => {
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          if (!item.modifications) {
            item.modifications = [];
          }
          // Remove any existing modification for this field
          item.modifications = item.modifications.filter(m => m.field !== field);
          // Add new modification if values are different
          if (previousValue !== newValue) {
            item.modifications.push({
              field,
              previousValue,
              newValue,
              timestamp: new Date().toISOString()
            });
          }
          // Update selectedItem if it's the same item
          if (state.selectedItem && state.selectedItem.id === itemId) {
            state.selectedItem = item;
          }
        }
      })
    );
  },

  updateItemDates: (itemId, startDate, endDate) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          if (!item.modifications) {
            item.modifications = [];
          }
          // Track startdate modification
          if (item.parseddata.startdate !== startDate) {
            item.modifications = item.modifications.filter(m => m.field !== 'startdate');
            if (item.originalParsedData.startdate !== startDate) {
              item.modifications.push({
                field: 'startdate',
                previousValue: item.originalParsedData.startdate,
                newValue: startDate,
                timestamp: new Date().toISOString()
              });
            }
          }
          // Track enddate modification
          if (item.parseddata.enddate !== endDate) {
            item.modifications = item.modifications.filter(m => m.field !== 'enddate');
            if (item.originalParsedData.enddate !== endDate) {
              item.modifications.push({
                field: 'enddate',
                previousValue: item.originalParsedData.enddate,
                newValue: endDate,
                timestamp: new Date().toISOString()
              });
            }
          }
          item.parseddata.startdate = startDate;
          item.parseddata.enddate = endDate;
          // Update selectedItem if it's the same item
          if (state.selectedItem && state.selectedItem.id === itemId) {
            state.selectedItem = item;
          }
          console.log('updateItemDates - modifications:', JSON.stringify(item.modifications));
        }
      })
    ),

  getItemDates: (itemId) => {
    const state = get();
    const item = state.simulationData.find((i) => i.id === itemId);
    if (!item) {
      console.error(`Item with ID ${itemId} not found in simulationData`);
      return null;
    }
    return item.parseddata ? { startdate: item.parseddata.startdate, enddate: item.parseddata.enddate } : null;
  },

  updateItemPausedState: (itemId, enabled, start, end) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          const previousValue = JSON.stringify(item.parseddata.paused || { enabled: false, start: '', end: '' });
          const newValue = JSON.stringify({ enabled, start, end });
          
          item.parseddata.paused = { enabled, start, end };
          
          // Track modification
          if (!item.modifications) {
            item.modifications = [];
          }
          item.modifications = item.modifications.filter(m => m.field !== 'paused');
          if (previousValue !== newValue) {
            item.modifications.push({
              field: 'paused',
              previousValue,
              newValue,
              timestamp: new Date().toISOString()
            });
          }
          
          // Update selectedItem if it's the same item
          if (state.selectedItem && state.selectedItem.id === itemId) {
            state.selectedItem = item;
          }
        }
      })
    ),

  getItemPausedState: (itemId) => {
    const state = get();
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.paused || { enabled: false, start: '', end: '' };
  },

  updateItemBookings: (itemId, bookings) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          const previousValue = JSON.stringify(item.parseddata.booking);
          const newValue = JSON.stringify(bookings);
          
          if (!item.modifications) {
            item.modifications = [];
          }
          item.modifications = item.modifications.filter(m => m.field !== 'bookings');
          if (previousValue !== newValue) {
            item.modifications.push({
              field: 'bookings',
              previousValue,
              newValue,
              timestamp: new Date().toISOString()
            });
          }
          
          item.parseddata.booking = bookings;
          
          // Update selectedItem if it's the same item
          if (state.selectedItem && state.selectedItem.id === itemId) {
            state.selectedItem = item;
          }
          console.log('updateItemBookings - modifications:', item.modifications);
        }
      })
    ),

  getItemBookings: (itemId) => {
    const state = get();
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.booking || [];
  },

  updateItemGroups: (itemId, groups) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          const previousValue = JSON.stringify(item.parseddata.group);
          const newValue = JSON.stringify(groups);
          
          if (!item.modifications) {
            item.modifications = [];
          }
          item.modifications = item.modifications.filter(m => m.field !== 'groups');
          if (previousValue !== newValue) {
            item.modifications.push({
              field: 'groups',
              previousValue,
              newValue,
              timestamp: new Date().toISOString()
            });
          }
          
          item.parseddata.group = groups;
          
          // Update selectedItem if it's the same item
          if (state.selectedItem && state.selectedItem.id === itemId) {
            state.selectedItem = item;
          }
          console.log('updateItemGroups - modifications:', item.modifications);
        }
      })
    ),

  getItemGroups: (itemId) => {
    const state = get();
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.group || [];
  },
}));

export default useSimulationDataStore;