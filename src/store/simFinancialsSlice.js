import { createSlice } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';

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
      const itemId = String(dataItemId);
      if (!state.financialsByScenario[scenarioId][itemId]) state.financialsByScenario[scenarioId][itemId] = {};
      const key = createId('financial');
      state.financialsByScenario[scenarioId][itemId][key] = { ...financial, overlays: {} };
    },
    updateFinancial(state, action) {
      const { scenarioId, dataItemId, financialId, updates } = action.payload;
      const itemId = String(dataItemId);
      const id = String(financialId);
      if (!state.financialsByScenario[scenarioId]?.[itemId]?.[id]) return;
      state.financialsByScenario[scenarioId][itemId][id] = {
        ...state.financialsByScenario[scenarioId][itemId][id],
        ...updates,
        overlays: updates.overlays
          ? { ...state.financialsByScenario[scenarioId][itemId][id].overlays, ...updates.overlays }
          : state.financialsByScenario[scenarioId][itemId][id].overlays
      };
    },
    deleteFinancial(state, action) {
      const { scenarioId, dataItemId, financialId } = action.payload;
      const itemId = String(dataItemId);
      const id = String(financialId);
      if (state.financialsByScenario[scenarioId]?.[itemId]) {
        delete state.financialsByScenario[scenarioId][itemId][id];
      }
    },
    deleteAllFinancialsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      const id = String(itemId);
      if (state.financialsByScenario[scenarioId]) {
        delete state.financialsByScenario[scenarioId][id];
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