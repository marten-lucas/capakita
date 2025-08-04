import { createSlice } from '@reduxjs/toolkit';

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
      let scenario = {
        name: action.payload.name || 'Neues Szenario',
        remark: action.payload.remark ?? '',
        confidence: action.payload.confidence ?? 50,
        likelihood: action.payload.likelihood ?? 50,
        desirability: action.payload.desirability ?? 50,
        baseScenarioId: action.payload.baseScenarioId ?? null,
        id: action.payload.id ? String(action.payload.id) : now,
        imported: action.payload.imported ?? false,
        importedAnonymized: action.payload.importedAnonymized ?? false,
        ...action.payload
      };

      // Make name unique if requested
      if (action.payload.makeNameUnique) {
        const existingNames = state.scenarios.map(s => s.name);
        let counter = 1;
        let uniqueName = scenario.name;
        while (existingNames.includes(uniqueName)) {
          uniqueName = `${scenario.name} (${counter})`;
          counter++;
        }
        scenario.name = uniqueName;
      }

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
      state.scenarios = (action.payload || []).map(s => ({ ...s }));
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
  bookings,
  bookingReference,
  groupDefs,
  qualiDefs,
  groupAssignments
}) => async (dispatch, getState) => {
  // 1. Generate unique scenario id
  const scenarioId = Date.now().toString();

  // 2. Add scenario to scenario slice
  dispatch(addScenario({
    ...scenarioSettings,
    id: scenarioId
  }));

  // 3. Import sim data items (do NOT attach bookings yet)
  if (simDataList && simDataList.length > 0) {
    dispatch({
      type: 'simData/importDataItems',
      payload: { scenarioId, simDataList }
    });
  }

  // 4. Map external IDs to store keys for demand/capacity items
  const state = getState();
  const dataByScenario = state.simData.dataByScenario[scenarioId];
  const kindKeyMap = {};
  const capacityKeyMap = {};
  Object.entries(dataByScenario).forEach(([storeKey, item]) => {
    if (item.type === 'demand' && item.rawdata && item.rawdata.KINDNR) {
      kindKeyMap[String(item.rawdata.KINDNR)] = storeKey;
    }
    if (item.type === 'capacity' && item.rawdata && item.rawdata.IDNR) {
      capacityKeyMap[String(item.rawdata.IDNR)] = storeKey;
    }
  });

  // 5. Remap groupAssignments using store ids only
  const groupAssignmentsFinal = (groupAssignments || [])
    .map(a => ({
      ...a,
      kindId: kindKeyMap[String(a.rawdata.KINDNR)]
    }))
    .filter(a => !!a.kindId);

  // 6. Import groupDefs and groupAssignments
  if (groupDefs && groupDefs.length > 0) {
    dispatch({
      type: 'simGroup/importGroupDefs',
      payload: { scenarioId, defs: groupDefs }
    });
  }
  if (groupAssignmentsFinal && groupAssignmentsFinal.length > 0) {
    dispatch({
      type: 'simGroup/importGroupAssignments',
      payload: { scenarioId, assignments: groupAssignmentsFinal }
    });
  }

  // 7. Import qualification defs
  if (qualiDefs && qualiDefs.length > 0) {
    dispatch({
      type: 'simQualification/importQualificationDefs',
      payload: { scenarioId, defs: qualiDefs }
    });
  }

  // 8. Build qualification assignments for all imported capacity items
  const qualiAssignmentsFinal = {};
  Object.entries(dataByScenario).forEach(([storeKey, item]) => {
    if (item.type === 'capacity' && item.rawdata && item.rawdata.QUALIFIK) {
      const id = `${item.rawdata.QUALIFIK}-${Date.now()}-${Math.random()}`;
      const qualiAssignment = {
        dataItemId: storeKey,
        qualification: item.rawdata.QUALIFIK,
        id
      };
      if (!qualiAssignmentsFinal[storeKey]) qualiAssignmentsFinal[storeKey] = {};
      qualiAssignmentsFinal[storeKey][id] = qualiAssignment;
    }
  });

  if (Object.keys(qualiAssignmentsFinal).length > 0) {
    dispatch({
      type: 'simQualification/importQualificationAssignments',
      payload: { scenarioId, assignments: Object.values(qualiAssignmentsFinal).flatMap(obj => Object.values(obj)) }
    });
  }

  // 9. Link bookings to correct dataItemId using bookingReference
  const bookingsWithDataItemId = (bookings || []).map(booking => {
    const ref = (bookingReference || []).find(r => r.bookingKey === booking.id);
    if (!ref) return null;
    let dataItemId = null;
    if (ref.adebisId.source === 'kind') {
      dataItemId = kindKeyMap[String(ref.adebisId.id)];
    } else if (ref.adebisId.source === 'anstell') {
      dataItemId = capacityKeyMap[String(ref.adebisId.id)];
    }
    if (!dataItemId) return null;
    return { ...booking, dataItemId };
  }).filter(Boolean);

  if (bookingsWithDataItemId.length > 0) {
    dispatch({
      type: 'simBooking/importBookings',
      payload: { scenarioId, items: bookingsWithDataItemId }
    });
  }

  // 10. Select the new scenario
  dispatch(setSelectedScenarioId(scenarioId));
};

// Thunk: delete a scenario and all related data
export const deleteScenario = (scenarioId) => (dispatch) => {
  dispatch(simScenarioSlice.actions.deleteScenario(scenarioId));
  dispatch({ type: 'simData/deleteAllDataForScenario', payload: { scenarioId } });
  dispatch({ type: 'simOverlay/deleteAllOverlaysForScenario', payload: { scenarioId } });
  dispatch({ type: 'chart/deleteScenarioChart', payload: scenarioId });
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



