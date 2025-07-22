import { create } from 'zustand';
import { produce } from 'immer';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

const useSimFinancialsStore = create((set, get) => ({
  // { [scenarioId]: { [dataItemId]: { [financialId]: { ...financialData, overlays: {...} } } } }
  financialsByScenario: {},

  addFinancial: (scenarioId, dataItemId, financial) =>
    set(produce((state) => {
      if (!state.financialsByScenario[scenarioId]) state.financialsByScenario[scenarioId] = {};
      if (!state.financialsByScenario[scenarioId][dataItemId]) state.financialsByScenario[scenarioId][dataItemId] = {};
      const id = financial.id || generateUID();
      state.financialsByScenario[scenarioId][dataItemId][id] = { ...financial, id, overlays: {} };
    })),

  updateFinancial: (scenarioId, dataItemId, financialId, updates) =>
    set(produce((state) => {
      if (!state.financialsByScenario[scenarioId]?.[dataItemId]?.[financialId]) return;
      state.financialsByScenario[scenarioId][dataItemId][financialId] = {
        ...state.financialsByScenario[scenarioId][dataItemId][financialId],
        ...updates,
        overlays: {
          ...state.financialsByScenario[scenarioId][dataItemId][financialId].overlays,
          ...updates.overlays
        }
      };
    })),

  deleteFinancial: (scenarioId, dataItemId, financialId) =>
    set(produce((state) => {
      if (state.financialsByScenario[scenarioId]?.[dataItemId]) {
        delete state.financialsByScenario[scenarioId][dataItemId][financialId];
      }
    })),

  getFinancials: (scenarioId, dataItemId) => {
    const state = get();
    return Object.values(state.financialsByScenario[scenarioId]?.[dataItemId] || {});
  },

  getFinancial: (scenarioId, dataItemId, financialId) => {
    const state = get();
    return state.financialsByScenario[scenarioId]?.[dataItemId]?.[financialId];
  },
}));

export default useSimFinancialsStore;
