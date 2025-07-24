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
    addScenario(state, action) {
      // Assign a unique id if not present
      const now = Date.now();
      const scenario = {
        name: action.payload.name || 'Neues Szenario',
        remark: action.payload.remark ?? '',
        confidence: action.payload.confidence ?? 50,
        likelihood: action.payload.likelihood ?? 50,
        desirability: action.payload.desirability ?? 50,
        baseScenarioId: action.payload.baseScenarioId ?? null,
        id: action.payload.id || now,
        // ...other fields if needed...
      };
      state.scenarios.push(scenario);
      state.selectedScenarioId = scenario.id; // select the new scenario
    },
    updateScenario(state, action) {
      const { scenarioId, updates } = action.payload; // <-- fix: use scenarioId
      const scenario = state.scenarios.find(s => s.id === scenarioId);
      if (scenario) {
        Object.assign(scenario, updates);
      }
    },
    deleteScenario(state, action) {
      const id = action.payload;
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
    // ...other reducers (e.g., for importing scenarios)...
  },
});

// Thunk for importing a scenario and all related data
export const importScenario = ({
  scenarioSettings,
  groupDefs,
  qualiDefs,
  groupAssignments,
  qualiAssignments,
  simDataList,
  bookingsList
}) => async (dispatch) => {
  // Generate unique scenario id
  const scenarioId = Date.now().toString();

  // Add scenario to scenario slice
  dispatch(addScenario({
    ...scenarioSettings,
    id: scenarioId
  }));

  // Import group definitions
  if (groupDefs && groupDefs.length > 0) {
    dispatch({
      type: 'simGroup/importGroupDefs',
      payload: { scenarioId, defs: groupDefs }
    });
  }

  // Import qualification definitions
  if (qualiDefs && qualiDefs.length > 0) {
    dispatch({
      type: 'simQualification/importQualificationDefs',
      payload: { scenarioId, defs: qualiDefs }
    });
  }

  // Import group assignments
  if (groupAssignments && groupAssignments.length > 0) {
    dispatch({
      type: 'simGroup/importGroupAssignments',
      payload: { scenarioId, assignments: groupAssignments }
    });
  }

  // Import qualification assignments
  if (qualiAssignments && qualiAssignments.length > 0) {
    dispatch({
      type: 'simQualification/importQualificationAssignments',
      payload: { scenarioId, assignments: qualiAssignments }
    });
  }

  // Import sim data items
  if (simDataList && simDataList.length > 0) {
    dispatch({
      type: 'simData/importDataItems',
      payload: { scenarioId, simDataList }
    });
  }

  // Import bookings
  if (bookingsList && bookingsList.length > 0) {
    dispatch({
      type: 'simBooking/importBookings',
      payload: { scenarioId, items: bookingsList }
    });
  }

  // Select the new scenario
  dispatch(setSelectedScenarioId(scenarioId));
};

export const {
  setSelectedScenarioId,
  setLastImportAnonymized,
  setSelectedItem,
  setScenarioSaveDialogOpen,
  setScenarioSaveDialogPending,
  // importScenario, // Remove from exports, now a thunk
  addScenario,
  updateScenario,
  deleteScenario,
  // ...other actions...
} = simScenarioSlice.actions;

export default simScenarioSlice.reducer;

