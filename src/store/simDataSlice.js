import { createSlice, createSelector } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';

const initialState = {
  dataByScenario: {},
};

const simDataSlice = createSlice({
  name: 'simData',
  initialState,
  reducers: {
    addDataItem(state, action) {
      const { scenarioId, item } = action.payload;
      if (!state.dataByScenario[scenarioId]) state.dataByScenario[scenarioId] = {};
      const key = createId('simdata');
      state.dataByScenario[scenarioId][key] = {
        ...item,
        overlays: item.overlays || {},
        absences: Array.isArray(item.absences) ? item.absences : [],
        // Remove id attribute
      };
    },
    updateDataItem(state, action) {
      const { scenarioId, itemId, updates } = action.payload;
      const id = String(itemId);
      if (!state.dataByScenario[scenarioId] || !state.dataByScenario[scenarioId][id]) return;
      state.dataByScenario[scenarioId][id] = {
        ...state.dataByScenario[scenarioId][id],
        ...updates,
        overlays: updates.overlays
          ? { ...state.dataByScenario[scenarioId][id].overlays, ...updates.overlays }
          : state.dataByScenario[scenarioId][id].overlays
      };
    },
    updateDataItemFields(state, action) {
      const { scenarioId, itemId, fields } = action.payload;
      const id = String(itemId); // Always use store key for lookup
      const item = state.dataByScenario[scenarioId]?.[id];
      if (!item) return;
      Object.entries(fields).forEach(([key, value]) => {
        item[key] = value;
      });
      // If name is changed, also update id if needed (not strictly necessary now)
      if ('name' in fields) {
        item.name = fields.name;
      }
    },
    deleteDataItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      const id = String(itemId);
      if (state.dataByScenario[scenarioId]) {
        delete state.dataByScenario[scenarioId][id];
      }
      // Dispatch related delete actions
      // Note: In a reducer, you cannot dispatch other actions directly.
      // To handle side effects, you need to use middleware/thunks.
      // Instead, move this logic to a thunk below.
    },
    deleteAllDataForScenario(state, action) {
      const { scenarioId } = action.payload;
      delete state.dataByScenario[scenarioId];
    },
    setOverlay(state, action) {
      const { scenarioId, itemId, overlay } = action.payload;
      const id = String(itemId);
      if (!state.dataByScenario[scenarioId] || !state.dataByScenario[scenarioId][id]) return;
      state.dataByScenario[scenarioId][id].overlays = {
        ...state.dataByScenario[scenarioId][id].overlays,
        ...overlay
      };
    },
    importDataItems(state, action) {
      const { scenarioId, simDataList } = action.payload;
      if (!state.dataByScenario[scenarioId]) state.dataByScenario[scenarioId] = {};
      simDataList.forEach(item => {
        const key = createId('simdata');
        state.dataByScenario[scenarioId][key] = {
          ...item,
          id: key, // Ensure id matches store key
          overlays: item.overlays || {},
          absences: Array.isArray(item.absences) ? item.absences : [],
        };
      });
    },
    simDataItemAdd(state, action) {
      const { scenarioId, item } = action.payload;
      if (!state.dataByScenario[scenarioId]) state.dataByScenario[scenarioId] = {};
      const id = String(item.id || Date.now());
      state.dataByScenario[scenarioId][id] = {
        id,
        type: item.type || '',
        source: item.source || 'manual entry',
        name: item.name || (item.type === 'capacity' ? 'Neuer Mitarbeiter' : item.type === 'demand' ? 'Neues Kind' : 'Neuer Eintrag'),
        remark: item.remark || '',
        startdate: item.startdate || '',
        enddate: item.enddate || '',
        dateofbirth: item.dateofbirth || '',
        groupId: item.groupId || '',
        rawdata: item.rawdata || {},
        absences: Array.isArray(item.absences) ? item.absences : [],
        overlays: item.overlays || {},
        kindId: item.kindId ? String(item.kindId) : undefined // only for simData
      };
      },
    },
  });


// Thunk for adding a data item and selecting it
export const addDataItemAndSelect = ({ scenarioId, item }) => (dispatch) => {
  const id = item.id || Date.now();
  dispatch(simDataItemAdd({ scenarioId, item: { ...item, id } }));
  dispatch({
    type: 'simScenario/setSelectedItem',
    payload: id
  });
};

export const selectDataItemsByScenario = createSelector(
  [
    state => state.simData.dataByScenario,
    (state, scenarioId) => scenarioId
  ],
  (dataByScenario, scenarioId) => {
    if (!scenarioId || !dataByScenario[scenarioId]) {
      return []; // Return a consistent empty array
    }
    return Object.values(dataByScenario[scenarioId]);
  }
);

// Create a consistent empty array reference to avoid creating new arrays
const EMPTY_ARRAY = [];

export const selectDataItemsByScenarioMemoized = (scenarioId) => createSelector(
  [state => state.simData.dataByScenario[scenarioId]],
  (scenarioData) => {
    if (!scenarioData) return EMPTY_ARRAY;
    return Object.values(scenarioData);
  }
);

// Selector: find item by adebisId
export function getItemByAdebisID(state, scenarioId, adebisId) {
  const items = state.simData.dataByScenario[scenarioId];
  if (!items) return null;
  return Object.values(items).find(
    item => item.adebisId && item.adebisId.id === adebisId.id && item.adebisId.source === adebisId.source
  );
}

export const {
  addDataItem,
  updateDataItem,
  updateDataItemFields,
  deleteDataItem,
  deleteAllDataForScenario,
  setOverlay,
  importDataItems,
  simDataItemAdd,
} = simDataSlice.actions;

// Thunk: delete a data item and all related data
export const deleteDataItemThunk = ({ scenarioId, itemId }) => (dispatch) => {
  dispatch(deleteDataItem({ scenarioId, itemId }));
  dispatch({ type: 'simBooking/deleteAllBookingsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simGroup/deleteAllGroupAssignmentsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simFinancials/deleteAllFinancialsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simQualification/deleteAllQualificationAssignmentsForItem', payload: { scenarioId, itemId } }); // <-- add this
};

// Thunk: delete all data items for a scenario and all related data
export const deleteAllDataForScenarioThunk = (scenarioId) => (dispatch, getState) => {
  const state = getState();
  const items = state.simData.dataByScenario[scenarioId];
  if (items) {
    Object.keys(items).forEach(itemId => {
      dispatch(deleteDataItemThunk({ scenarioId, itemId }));
    });
  }
  dispatch(deleteAllDataForScenario({ scenarioId }));
};

export default simDataSlice.reducer;