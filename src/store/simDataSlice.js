import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  dataByScenario: {},
};

const simDataSlice = createSlice({
  name: 'simData',
  initialState,
  reducers: {
    addDataItem(state, action) {
      const { scenarioId, item } = action.payload;
      if (!state.dataByScenario[scenarioId]) state.dataByScenario[scenarioId] = {};
      const id = item.id;
      if (!Array.isArray(item.absences)) item.absences = [];
      state.dataByScenario[scenarioId][id] = { ...item, overlays: {} };
    },
    updateDataItem(state, action) {
      const { scenarioId, itemId, updates } = action.payload;
      if (!state.dataByScenario[scenarioId] || !state.dataByScenario[scenarioId][itemId]) return;
      state.dataByScenario[scenarioId][itemId] = {
        ...state.dataByScenario[scenarioId][itemId],
        ...updates,
        overlays: {
          ...state.dataByScenario[scenarioId][itemId].overlays,
          ...updates.overlays
        }
      };
    },
    updateDataItemFields(state, action) {
      const { scenarioId, itemId, fields } = action.payload;
      const item = state.dataByScenario[scenarioId]?.[itemId];
      if (!item) return;
      Object.entries(fields).forEach(([key, value]) => {
        item[key] = value;
      });
    },
    deleteDataItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      if (state.dataByScenario[scenarioId]) {
        delete state.dataByScenario[scenarioId][itemId];
      }
    },
    setOverlay(state, action) {
      const { scenarioId, itemId, overlay } = action.payload;
      if (!state.dataByScenario[scenarioId] || !state.dataByScenario[scenarioId][itemId]) return;
      state.dataByScenario[scenarioId][itemId].overlays = {
        ...state.dataByScenario[scenarioId][itemId].overlays,
        ...overlay
      };
    },
    importDataItems(state, action) {
      const { scenarioId, simDataList } = action.payload;
      if (!state.dataByScenario[scenarioId]) state.dataByScenario[scenarioId] = {};
      simDataList.forEach(item => {
        const id = item.id;
        if (!Array.isArray(item.absences)) item.absences = [];
        state.dataByScenario[scenarioId][id] = { ...item, overlays: {} };
      });
    },
    // ...existing code...
  },
});

export const {
  addDataItem,
  updateDataItem,
  updateDataItemFields,
  deleteDataItem,
  setOverlay,
  importDataItems,
  // ...other actions...
} = simDataSlice.actions;

export default simDataSlice.reducer;