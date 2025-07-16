import { create } from 'zustand';
import { produce } from 'immer';

const useSimulationDataStore = create((set) => ({
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
  updateItemDates: (itemId, startDate, endDate) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          if (!item.modifications) {
            item.modifications = []; // Ensure modifications array is initialized
          }
          if (item.parseddata.startdate !== startDate) {
            item.modifications.push({
              field: 'startdate',
              previousValue: item.parseddata.startdate,
              newValue: startDate,
            });
          }
          if (item.parseddata.enddate !== endDate) {
            item.modifications.push({
              field: 'enddate',
              previousValue: item.parseddata.enddate,
              newValue: endDate,
            });
          }
          item.parseddata.startdate = startDate; // Update start date
          item.parseddata.enddate = endDate; // Update end date
          console.log('updateItemDates - modifications:', JSON.stringify(item.modifications)); // Debug modifications array
        }
      })
    ),
  getItemDates: (itemId) => {
    const state = useSimulationDataStore.getState();
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
          item.parseddata.paused = { enabled, start, end };
        }
      })
    ),
  getItemPausedState: (itemId) => {
    const state = useSimulationDataStore.getState();
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.paused || { enabled: false, start: '', end: '' };
  },
  updateItemBookings: (itemId, bookings) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          item.modifications.push({
            field: 'bookings',
            previousValue: JSON.stringify(item.parseddata.booking),
            newValue: JSON.stringify(bookings),
          });
          item.parseddata.booking = bookings;
          console.log('updateItemBookings - modifications:', item.modifications); // Debug modifications array
        }
      })
    ),
  getItemBookings: (itemId) => {
    const state = useSimulationDataStore.getState();
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.booking || [];
  },
  updateItemGroups: (itemId, groups) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          item.modifications.push({
            field: 'groups',
            previousValue: JSON.stringify(item.parseddata.group),
            newValue: JSON.stringify(groups),
          });
          item.parseddata.group = groups; // Update groups in global state
          console.log('updateItemGroups - modifications:', item.modifications); // Debug modifications array
        }
      })
    ),
  getItemGroups: (itemId) => {
    const state = useSimulationDataStore.getState();
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.group || []; // Retrieve groups from global state
  },
}));

export default useSimulationDataStore;