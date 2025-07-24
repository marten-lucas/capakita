import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  scenarios: [],
  selectedScenarioId: null,
  lastImportAnonymized: true,
  selectedItems: {},
  scenarioSaveDialogPending: false, // Add this if needed
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
    setScenarioSaveDialogOpen(state, action) {
      // Implementation for opening the save dialog
    },
    setScenarioSaveDialogPending(state, action) {
      state.scenarioSaveDialogPending = action.payload;
    },
    importScenario(state, action) {
      // Implementation for importing a scenario
      // Example: state.scenarios.push(action.payload);
    },
    addScenario(state, action) {
      // Implementation for adding a scenario
      state.scenarios.push(action.payload);
    },
    updateScenario(state, action) {
      const { id, updates } = action.payload;
      const scenario = state.scenarios.find(s => s.id === id);
      if (scenario) {
        Object.assign(scenario, updates);
      }
    },
    deleteScenario(state, action) {
      const id = action.payload;
      state.scenarios = state.scenarios.filter(s => s.id !== id);
    },
    // ...other reducers (e.g., for importing scenarios)...
  },
});

export const {
  setSelectedScenarioId,
  setLastImportAnonymized,
  setSelectedItem,
  setScenarioSaveDialogOpen,
  setScenarioSaveDialogPending,
  importScenario,
  addScenario,
  updateScenario,
  deleteScenario,
  // ...other actions...
} = simScenarioSlice.actions;

export default simScenarioSlice.reducer;
