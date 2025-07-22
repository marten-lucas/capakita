import { create } from 'zustand';
import { produce } from 'immer';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

const useSimDataStore = create((set, get) => ({
  // { [scenarioId]: { [itemId]: { ...itemData, overlays: {...} } } }
  dataByScenario: {},

  // Add a new data item
  addDataItem: (scenarioId, item) =>
    set(produce((state) => {
      if (!state.dataByScenario[scenarioId]) state.dataByScenario[scenarioId] = {};
      const id = item.id || generateUID();
      // Ensure absences array exists
      if (!item.parseddata) item.parseddata = {};
      if (!Array.isArray(item.parseddata.absences)) item.parseddata.absences = [];
      state.dataByScenario[scenarioId][id] = { ...item, id, overlays: {} };
    })),

  // Helper: Add a new manual entry item of given type ("demand" or "capacity")
  simDataItemAdd: (scenarioId, source, type) => {
    const id = generateUID();
    let newItem;
    let newName = type === 'capacity' ? 'Neuer Mitarbeiter' : 'Neues Kind';

    newItem = {
      id,
      type: type,
      name: newName,
      remark: '',
      startdate: '',
      enddate: '',
      vacation: '',
      absences: [],
      rawdata: {
        source,
        data: {}
      },
      originalData: {
        name: '',
        startdate: '',
        enddate: '',
        vacation: '',
        worktime: '',
        absences: []
      }
    };

    get().addDataItem(scenarioId, newItem);
    return newItem;
  },

  // Update a data item (with overlays)
  updateDataItem: (scenarioId, itemId, updates) =>
    set(produce((state) => {
      if (!state.dataByScenario[scenarioId] || !state.dataByScenario[scenarioId][itemId]) return;
      state.dataByScenario[scenarioId][itemId] = {
        ...state.dataByScenario[scenarioId][itemId],
        ...updates,
        overlays: {
          ...state.dataByScenario[scenarioId][itemId].overlays,
          ...updates.overlays
        }
      };
    })),

  // Update common fields for a data item (name, startdate, enddate)
  updateDataItemFields: (scenarioId, itemId, fields) =>
    set(produce((state) => {
      const item = state.dataByScenario[scenarioId]?.[itemId];
      if (!item) return;
      // Update fields in root and parseddata if present
      Object.entries(fields).forEach(([key, value]) => {
        item[key] = value;
        if (item.parseddata && key in item.parseddata) {
          item.parseddata[key] = value;
        }
      });
    })),

  // Delete a data item
  deleteDataItem: (scenarioId, itemId) =>
    set(produce((state) => {
      if (state.dataByScenario[scenarioId]) {
        delete state.dataByScenario[scenarioId][itemId];
      }
    })),

  // Get all data items for a scenario
  getDataItems: (scenarioId) => {
    const state = get();
    return Object.values(state.dataByScenario[scenarioId] || {});
  },

  // Get a single data item
  getDataItem: (scenarioId, itemId) => {
    const state = get();
    return state.dataByScenario[scenarioId]?.[itemId];
  },

  // Overlay logic for modifications, etc.
  setOverlay: (scenarioId, itemId, overlay) =>
    set(produce((state) => {
      if (!state.dataByScenario[scenarioId] || !state.dataByScenario[scenarioId][itemId]) return;
      state.dataByScenario[scenarioId][itemId].overlays = {
        ...state.dataByScenario[scenarioId][itemId].overlays,
        ...overlay
      };
    })),

  // Get absences for an item (returns [] if not present)
  getItemAbsenceStateList: (scenarioId, itemId) => {
    const state = get();
    const item = state.dataByScenario[scenarioId]?.[itemId];
    return item?.parseddata?.absences || [];
  },
}));

export default useSimDataStore;
