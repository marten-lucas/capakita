import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  financialsByScenario: {},
};

const simFinancialsSlice = createSlice({
  name: 'simFinancials',
  initialState,
  reducers: {
    addFinancial(state, action) {
      const { scenarioId, dataItemId, financial } = action.payload;
      if (!state.financialsByScenario[scenarioId]) state.financialsByScenario[scenarioId] = {};
      if (!state.financialsByScenario[scenarioId][dataItemId]) state.financialsByScenario[scenarioId][dataItemId] = {};
      const id = financial.id;
      state.financialsByScenario[scenarioId][dataItemId][id] = { ...financial, overlays: {} };
    },
    updateFinancial(state, action) {
      const { scenarioId, dataItemId, financialId, updates } = action.payload;
      if (!state.financialsByScenario[scenarioId]?.[dataItemId]?.[financialId]) return;
      state.financialsByScenario[scenarioId][dataItemId][financialId] = {
        ...state.financialsByScenario[scenarioId][dataItemId][financialId],
        ...updates,
        overlays: {
          ...state.financialsByScenario[scenarioId][dataItemId][financialId].overlays,
          ...updates.overlays
        }
      };
    },
    deleteFinancial(state, action) {
      const { scenarioId, dataItemId, financialId } = action.payload;
      if (state.financialsByScenario[scenarioId]?.[dataItemId]) {
        delete state.financialsByScenario[scenarioId][dataItemId][financialId];
      }
    },
    // ...existing code...
  },
});

export const {
  addFinancial,
  updateFinancial,
  deleteFinancial,
  // ...other actions...
} = simFinancialsSlice.actions;

export default simFinancialsSlice.reducer;