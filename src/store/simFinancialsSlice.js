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
      const id = financial.id || Date.now();
      state.financialsByScenario[scenarioId][dataItemId][id] = { ...financial, id, overlays: {} };
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
    deleteAllFinancialsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      if (state.financialsByScenario[scenarioId]) {
        delete state.financialsByScenario[scenarioId][itemId];
      }
    },
    deleteAllFinancialsForScenario(state, action) {
      const { scenarioId } = action.payload;
      delete state.financialsByScenario[scenarioId];
    },
  },
});

export const {
  addFinancial,
  updateFinancial,
  deleteFinancial,
  deleteAllFinancialsForItem,
  deleteAllFinancialsForScenario,
} = simFinancialsSlice.actions;

export default simFinancialsSlice.reducer;