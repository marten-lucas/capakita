import { createSlice } from '@reduxjs/toolkit';
import { getItemByAdebisID } from './simDataSlice';

const initialState = {
  scenarios: [],
  selectedScenarioId: null,
  selectedItems: {},
  saveDialogOpen: false,
  loadDialogOpen: false,
};

const simScenarioSlice = createSlice({
  name: 'simScenario',
  initialState,
  reducers: {
    setSelectedScenarioId(state, action) {
      state.selectedScenarioId = String(action.payload);
    },
    setSelectedItem(state, action) {
      const scenarioId = state.selectedScenarioId;
      if (!scenarioId) return;
      state.selectedItems[scenarioId] = action.payload;
    },
    addScenario(state, action) {
      // Assign a unique id if not present
      const now = Date.now().toString();
      // Use all properties from payload, fallback to defaults if missing
      const scenario = {
        name: action.payload.name || 'Neues Szenario',
        remark: action.payload.remark ?? '',
        confidence: action.payload.confidence ?? 50,
        likelihood: action.payload.likelihood ?? 50,
        desirability: action.payload.desirability ?? 50,
        baseScenarioId: action.payload.baseScenarioId ?? null,
        id: action.payload.id ? String(action.payload.id) : now,
        imported: action.payload.imported ?? false, // ensure default for manual add
        importedAnonymized: action.payload.importedAnonymized ?? false, // ensure default for manual add
        ...action.payload // <-- merge all other properties from payload
      };
      state.scenarios.push(scenario);
      state.selectedScenarioId = scenario.id; 
    },
    updateScenario(state, action) {
      const { scenarioId, updates } = action.payload; // <-- fix: use scenarioId
      const id = String(scenarioId);
      const scenario = state.scenarios.find(s => String(s.id) === id);
      if (scenario) {
        Object.assign(scenario, updates);
      }
    },
    deleteScenario(state, action) {
      const id = String(action.payload);
      // Collect all descendant scenario ids recursively
      const collectDescendants = (parentId) => {
        let ids = [parentId];
        state.scenarios.forEach(s => {
          if (s.baseScenarioId === parentId) {
            ids = ids.concat(collectDescendants(s.id));
          }
        });
        return ids;
      };
      const idsToDelete = collectDescendants(id);
      state.scenarios = state.scenarios.filter(s => !idsToDelete.includes(s.id));
      // Optionally, clear selectedScenarioId if it was deleted
      if (idsToDelete.includes(state.selectedScenarioId)) {
        state.selectedScenarioId = state.scenarios.length > 0 ? state.scenarios[0].id : null;
      }
    },
    setSaveDialogOpen(state, action) {
      state.saveDialogOpen = action.payload;
    },
    setLoadDialogOpen(state, action) {
      state.loadDialogOpen = action.payload;
    },
    setScenarios(state, action) {
      state.scenarios = action.payload;
    },
  },
});

// Selector: isSaveAllowed = false if any scenario is imported and not anonymized
export const isSaveAllowed = (state) => {
  // False if any scenario is imported and not anonymized
  return !state.simScenario.scenarios.some(
    s => s.imported === true && s.importedAnonymized === false
  );
};

// Thunk for importing a scenario and all related data
export const importScenario = ({
  scenarioSettings,
  simDataList,
  bookingsList
}) => async (dispatch, getState) => {
  // Generate unique scenario id
  const scenarioId = Date.now().toString();

  // Add scenario to scenario slice
  dispatch(addScenario({
    ...scenarioSettings,
    id: scenarioId
  }));

  // Import sim data items (do NOT attach bookings)
  if (simDataList && simDataList.length > 0) {
    dispatch({
      type: 'simData/importDataItems',
      payload: { scenarioId, simDataList }
    });
  }

  // Import bookings into simBooking
  if (bookingsList && bookingsList.length > 0) {
    // Link bookings to correct dataItem using adebisId
    const state = getState();
    const normalizedBookings = bookingsList.map(b => {
      // Find the correct dataItem by adebisId
      const dataItem = getItemByAdebisID(state, scenarioId, { id: b.kindAdebisId, source: "kind" });
      return {
        ...b,
        dataItemId: dataItem ? Object.keys(state.simData.dataByScenario[scenarioId]).find(
          key => state.simData.dataByScenario[scenarioId][key] === dataItem
        ) : undefined
      };
    }).filter(b => b.dataItemId);
    dispatch({
      type: 'simBooking/importBookings',
      payload: { scenarioId, items: normalizedBookings }
    });
  }

  // Select the new scenario
  dispatch(setSelectedScenarioId(scenarioId));
};

// Thunk: delete a scenario and all related data
export const deleteScenario = (scenarioId) => (dispatch) => {
  dispatch(simScenarioSlice.actions.deleteScenario(scenarioId));
  dispatch({ type: 'simData/deleteAllDataForScenario', payload: { scenarioId } });
};

export const {
  setSelectedScenarioId,
  setSelectedItem,
  addScenario,
  updateScenario,
  deleteScenario: deleteScenarioReducer,
  setScenarios,
  setSaveDialogOpen,
  setLoadDialogOpen,
} = simScenarioSlice.actions;

export default simScenarioSlice.reducer;



