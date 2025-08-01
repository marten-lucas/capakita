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
      if (!dataItemId) return; // Ensure dataItemId is set
      if (!state.financialsByScenario[scenarioId]) state.financialsByScenario[scenarioId] = {};
      const itemId = String(dataItemId);
      if (!state.financialsByScenario[scenarioId][itemId]) state.financialsByScenario[scenarioId][itemId] = {};
      const key = String(financial.id || createId('financial'));
      state.financialsByScenario[scenarioId][itemId][key] = { ...financial, id: key,  };
    },
    updateFinancial(state, action) {
      const { scenarioId, dataItemId, financialId, updates } = action.payload;
      const itemId = String(dataItemId);
      const id = String(financialId);
      if (!state.financialsByScenario[scenarioId]) state.financialsByScenario[scenarioId] = {};
      if (!state.financialsByScenario[scenarioId][itemId]) state.financialsByScenario[scenarioId][itemId] = {};
      if (!state.financialsByScenario[scenarioId][itemId][id]) {
        state.financialsByScenario[scenarioId][itemId][id] = { id,  };
      }
      state.financialsByScenario[scenarioId][itemId][id] = {
        ...state.financialsByScenario[scenarioId][itemId][id],
        ...updates
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
    loadFinancialsByScenario(state, action) {
      state.financialsByScenario = action.payload || {};
    },
  },
});

// Overlay-aware thunks
export const addFinancialThunk = ({ scenarioId, dataItemId, financial }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  const financialId = String(financial.id || createId('financial'));
  if (isBasedScenario) {
    dispatch({
      type: 'simOverlay/setFinancialOverlay',
      payload: {
        scenarioId,
        itemId: dataItemId,
        financialId,
        overlayData: { ...financial, id: financialId }
      }
    });
  } else {
    dispatch(addFinancial({ scenarioId, dataItemId, financial: { ...financial, id: financialId } }));
  }
};

export const updateFinancialThunk = ({ scenarioId, dataItemId, financialId, updates }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  if (isBasedScenario) {
    // Get current overlay or base financial
    const overlay = state.simOverlay.overlaysByScenario?.[scenarioId]?.financials?.[dataItemId]?.[financialId];
    const baseScenarioId = scenario.baseScenarioId;
    const baseFinancial = state.simFinancials.financialsByScenario?.[baseScenarioId]?.[dataItemId]?.[financialId];
    const prev = overlay || baseFinancial || {};
    const updated = { ...prev, ...updates, id: financialId };
    const isIdenticalToBase = baseFinancial && JSON.stringify(updated) === JSON.stringify(baseFinancial);
    if (isIdenticalToBase) {
      dispatch({
        type: 'simOverlay/removeFinancialOverlay',
        payload: { scenarioId, itemId: dataItemId, financialId }
      });
    } else {
      dispatch({
        type: 'simOverlay/setFinancialOverlay',
        payload: {
          scenarioId,
          itemId: dataItemId,
          financialId,
          overlayData: updated
        }
      });
    }
  } else {
    dispatch(updateFinancial({ scenarioId, dataItemId, financialId, updates }));
  }
};

export const deleteFinancialThunk = ({ scenarioId, dataItemId, financialId }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  const overlay = state.simOverlay.overlaysByScenario?.[scenarioId]?.financials?.[dataItemId]?.[financialId];
  if (isBasedScenario && overlay) {
    dispatch({
      type: 'simOverlay/removeFinancialOverlay',
      payload: { scenarioId, itemId: dataItemId, financialId }
    });
  } else {
    dispatch(deleteFinancial({ scenarioId, dataItemId, financialId }));
  }
};

export const {
  addFinancial,
  updateFinancial,
  deleteFinancial,
  deleteAllFinancialsForItem,
  deleteAllFinancialsForScenario,
  loadFinancialsByScenario,
} = simFinancialsSlice.actions;

export default simFinancialsSlice.reducer;