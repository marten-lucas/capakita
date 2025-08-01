import { createSlice } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';

const initialState = {
  financialsByScenario: {},
  financialDefsByScenario: {}, // <-- NEU: financialDef Verwaltung
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
    // NEU: Reducer für financialDef
    addFinancialDef(state, action) {
      const { scenarioId, financialDef } = action.payload;
      if (!state.financialDefsByScenario[scenarioId]) state.financialDefsByScenario[scenarioId] = [];
      state.financialDefsByScenario[scenarioId].push({ ...financialDef, id: financialDef.id || createId('financialDef') });
    },
    updateFinancialDef(state, action) {
      const { scenarioId, financialDefId, updates } = action.payload;
      const defs = state.financialDefsByScenario[scenarioId] || [];
      const idx = defs.findIndex(def => def.id === financialDefId);
      if (idx !== -1) {
        defs[idx] = { ...defs[idx], ...updates };
      }
    },
    deleteFinancialDef(state, action) {
      const { scenarioId, financialDefId } = action.payload;
      if (state.financialDefsByScenario[scenarioId]) {
        state.financialDefsByScenario[scenarioId] = state.financialDefsByScenario[scenarioId].filter(def => def.id !== financialDefId);
      }
    },
    loadFinancialDefsByScenario(state, action) {
      state.financialDefsByScenario = action.payload || {};
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

// NEU: Overlay-aware thunks für financialDef
export const addFinancialDefThunk = ({ scenarioId, financialDef }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  const financialDefId = String(financialDef.id || createId('financialDef'));
  if (isBasedScenario) {
    dispatch({
      type: 'simOverlay/setFinancialDefOverlay',
      payload: {
        scenarioId,
        financialDefId,
        overlayData: { ...financialDef, id: financialDefId }
      }
    });
  } else {
    dispatch(addFinancialDef({ scenarioId, financialDef: { ...financialDef, id: financialDefId } }));
  }
};

export const updateFinancialDefThunk = ({ scenarioId, financialDefId, updates }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  if (isBasedScenario) {
    // Get current overlay or base financialDef
    const overlay = state.simOverlay.overlaysByScenario?.[scenarioId]?.financialDefs?.[financialDefId];
    const baseScenarioId = scenario.baseScenarioId;
    const baseDefs = state.simFinancials.financialDefsByScenario?.[baseScenarioId] || [];
    const baseDef = baseDefs.find(def => def.id === financialDefId);
    const prev = overlay || baseDef || {};
    const updated = { ...prev, ...updates, id: financialDefId };
    const isIdenticalToBase = baseDef && JSON.stringify(updated) === JSON.stringify(baseDef);
    if (isIdenticalToBase) {
      dispatch({
        type: 'simOverlay/removeFinancialDefOverlay',
        payload: { scenarioId, financialDefId }
      });
    } else {
      dispatch({
        type: 'simOverlay/setFinancialDefOverlay',
        payload: {
          scenarioId,
          financialDefId,
          overlayData: updated
        }
      });
    }
  } else {
    dispatch(updateFinancialDef({ scenarioId, financialDefId, updates }));
  }
};

export const deleteFinancialDefThunk = ({ scenarioId, financialDefId }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  const overlay = state.simOverlay.overlaysByScenario?.[scenarioId]?.financialDefs?.[financialDefId];
  if (isBasedScenario && overlay) {
    dispatch({
      type: 'simOverlay/removeFinancialDefOverlay',
      payload: { scenarioId, financialDefId }
    });
  } else {
    dispatch(deleteFinancialDef({ scenarioId, financialDefId }));
  }
};

export const {
  addFinancial,
  updateFinancial,
  deleteFinancial,
  deleteAllFinancialsForItem,
  deleteAllFinancialsForScenario,
  loadFinancialsByScenario,
  // NEU:
  addFinancialDef,
  updateFinancialDef,
  deleteFinancialDef,
  loadFinancialDefsByScenario,
} = simFinancialsSlice.actions;

export default simFinancialsSlice.reducer;