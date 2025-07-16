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
          item.parseddata.startdate = startDate;
          item.parseddata.enddate = endDate;
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
}));

export default useSimulationDataStore;