import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  scenarios: [],
  selectedScenarioId: null,
  lastImportAnonymized: true,
  selectedItems: {},
};

const simScenarioSlice = createSlice({
  name: 'simScenario',
  initialState,
  reducers: {
    setSelectedScenarioId(state, action) {
      state.selectedScenarioId = action.payload;
    },
    setLastImportAnonymized(state, action) {
      state.lastImportAnonymized = action.payload;
    },
    setSelectedItem(state, action) {
      const scenarioId = state.selectedScenarioId;
      if (!scenarioId) return;
      state.selectedItems[scenarioId] = action.payload;
    },
    // ...other reducers (addScenario, updateScenario, deleteScenario, etc.)...
  },
});

export const {
  setSelectedScenarioId,
  setLastImportAnonymized,
  setSelectedItem,
  // ...other actions...
} = simScenarioSlice.actions;

export default simScenarioSlice.reducer;
