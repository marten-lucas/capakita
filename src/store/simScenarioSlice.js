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
}) => async (dispatch, getState) => {
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

  // Attach originalParsedData to simData items
  let bookingsByKindId = {};
  if (bookingsList && bookingsList.length > 0) {
    bookingsList.forEach(b => {
      const kindId = String(b.kindId);
      if (!bookingsByKindId[kindId]) bookingsByKindId[kindId] = [];
      bookingsByKindId[kindId].push(b);
    });
  }

  let groupAssignmentsByKindId = {};
  if (groupAssignments && groupAssignments.length > 0) {
    groupAssignments.forEach(g => {
      const kindId = String(g.kindId);
      if (!groupAssignmentsByKindId[kindId]) groupAssignmentsByKindId[kindId] = [];
      groupAssignmentsByKindId[kindId].push(g);
    });
  }

  // Prepare simDataList with originalParsedData
  const simDataListWithOriginal = (simDataList || []).map(item => {
    const kindId = String(item.id);
    return {
      ...item,
      originalParsedData: {
        booking: bookingsByKindId[kindId] || [],
        group: groupAssignmentsByKindId[kindId] || [],
        // Add more fields if needed
      }
    };
  });

  // Import sim data items (do NOT attach bookings)
  if (simDataListWithOriginal && simDataListWithOriginal.length > 0) {
    dispatch({
      type: 'simData/importDataItems',
      payload: { scenarioId, simDataList: simDataListWithOriginal }
    });
  }

  // Import bookings into simBooking
  if (bookingsList && bookingsList.length > 0) {
    // Ensure booking.id and booking.kindId are strings and match simData item ids
    const normalizedBookings = bookingsList.map(b => ({
      ...b,
      id: String(b.id),
      kindId: String(b.kindId)
    }));
    dispatch({
      type: 'simBooking/importBookings',
      payload: { scenarioId, items: normalizedBookings }
    });
  }

  // Select the new scenario
  dispatch(setSelectedScenarioId(scenarioId));
};

// Thunk: delete a simData item and all related data
export const deleteSimDataItemAndRelated = ({ scenarioId, itemId }) => (dispatch) => {
  dispatch({ type: 'simData/deleteDataItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simBooking/deleteAllBookingsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simGroup/deleteAllGroupAssignmentsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simFinancials/deleteAllFinancialsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simQualification/deleteAllQualificationAssignmentsForItem', payload: { scenarioId, itemId } });
};

// Thunk: delete a scenario and all related data
export const deleteScenarioAndRelated = (scenarioId) => (dispatch, getState) => {
  dispatch(deleteScenario(scenarioId));
  dispatch({ type: 'simData/deleteAllDataForScenario', payload: { scenarioId } });
  dispatch({ type: 'simBooking/deleteAllBookingsForScenario', payload: { scenarioId } });
  dispatch({ type: 'simGroup/deleteAllGroupAssignmentsForScenario', payload: { scenarioId } });
  dispatch({ type: 'simFinancials/deleteAllFinancialsForScenario', payload: { scenarioId } });
  dispatch({ type: 'simQualification/deleteAllQualificationAssignmentsForScenario', payload: { scenarioId } });
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

