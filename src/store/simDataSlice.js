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
        id: key,
        absences: Array.isArray(item.absences)
          ? item.absences.map(a => ({ ...a, payType: a.payType || 'fully_paid' }))
          : [],
      };
    },
    updateDataItem(state, action) {
      const { scenarioId, itemId, updates } = action.payload;
      const id = String(itemId);
      if (!state.dataByScenario[scenarioId] || !state.dataByScenario[scenarioId][id]) return;
      state.dataByScenario[scenarioId][id] = {
        ...state.dataByScenario[scenarioId][id],
        ...updates,
        // Ensure absences have payType if updated
        ...(updates.absences
          ? {
              absences: updates.absences.map(a => ({
                ...a,
                payType: a.payType || 'fully_paid'
              }))
            }
          : {})
      };
    },
    updateDataItemFields(state, action) {
      const { scenarioId, itemId, fields } = action.payload;
      const id = String(itemId); // Always use store key for lookup
      const item = state.dataByScenario[scenarioId]?.[id];
      if (!item) return;
      Object.entries(fields).forEach(([key, value]) => {
        if (key === 'absences' && Array.isArray(value)) {
          item.absences = value.map(a => ({
            ...a,
            payType: a.payType || 'fully_paid'
          }));
        } else {
          item[key] = value;
        }
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
    importDataItems(state, action) {
      const { scenarioId, simDataList } = action.payload;
      if (!state.dataByScenario[scenarioId]) state.dataByScenario[scenarioId] = {};
      simDataList.forEach(item => {
        const key = createId('simdata');
        state.dataByScenario[scenarioId][key] = {
          ...item,
          id: key
        };
      });
    },
    simDataItemAdd(state, action) {
      const { scenarioId, item } = action.payload;
      if (!state.dataByScenario[scenarioId]) state.dataByScenario[scenarioId] = {};
      const id = String(item.id || createId('simdata'));
      state.dataByScenario[scenarioId][id] = {
        type: item.type || '',
        source: item.source || 'manual entry',
        name: item.name || (item.type === 'capacity' ? 'Neuer Mitarbeiter' : item.type === 'demand' ? 'Neues Kind' : 'Neuer Eintrag'),
        remark: item.remark || '',
        startdate: item.startdate || '',
        enddate: item.enddate || '',
        dateofbirth: item.dateofbirth || '',
        groupId: item.groupId || '',
        rawdata: { source: item.source || 'manual entry', ...item.rawdata },
        absences: Array.isArray(item.absences) ? item.absences : [],
        id
      };
    },
    loadDataByScenario(state, action) {
        state.dataByScenario = action.payload || {};
      },
    }
  });


// Thunk for adding a data item and selecting it (overlay-aware)
export const addDataItemAndSelect = ({ scenarioId, item }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  const id = String(item.id || createId('simdata'));
  // Set default name logic
  const defaultName =
    item.name ||
    (item.type === 'capacity'
      ? 'Neuer Mitarbeiter'
      : item.type === 'demand'
      ? 'Neues Kind'
      : 'Neuer Eintrag');
  const overlayItem = {
    ...item,
    id,
    name: defaultName,
    absences: Array.isArray(item.absences) ? item.absences : [],
    source: item.source || 'manual entry',
    rawdata: { source: item.source || 'manual entry', ...item.rawdata }
  };
  if (isBasedScenario) {
    // Overlay: set data item overlay
    dispatch({
      type: 'simOverlay/setDataItemOverlay',
      payload: {
        scenarioId,
        itemId: id,
        overlayData: overlayItem
      }
    });
    dispatch({
      type: 'simScenario/setSelectedItem',
      payload: id
    });
  } else {
    dispatch(simDataItemAdd({ scenarioId, item: overlayItem }));
    dispatch({
      type: 'simScenario/setSelectedItem',
      payload: id
    });
  }
};

// Thunk for updating a data item (overlay-aware)
export const updateDataItemThunk = ({ scenarioId, itemId, updates }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  if (isBasedScenario) {
    // Get current overlay if it exists, else use base item
    const overlay = state.simOverlay.overlaysByScenario?.[scenarioId]?.dataItems?.[itemId];
    const baseScenarioId = scenario.baseScenarioId;
    const baseItem = state.simData.dataByScenario[baseScenarioId]?.[itemId];
    const prev = overlay || baseItem || {};
    const updatedItem = { ...prev, ...updates, id: itemId };
    const isIdenticalToBase = baseItem && JSON.stringify(updatedItem) === JSON.stringify(baseItem);
    if (isIdenticalToBase) {
      // Remove overlay if matches base
      dispatch({
        type: 'simOverlay/removeDataItemOverlay',
        payload: { scenarioId, itemId }
      });
    } else {
      // Set overlay if different from base
      dispatch({
        type: 'simOverlay/setDataItemOverlay',
        payload: {
          scenarioId,
          itemId,
          overlayData: updatedItem
        }
      });
    }
  } else {
    dispatch(updateDataItem({ scenarioId, itemId, updates }));
  }
};

// Thunk: update data item and sync AVR expense startdate
export const updateDataItemAndSyncAvrExpense = ({ scenarioId, itemId, updates }) => (dispatch, getState) => {
  dispatch(updateDataItemThunk({ scenarioId, itemId, updates }));
  if ('startdate' in updates) {
    const state = getState();
    const financials = state.simFinancials.financialsByScenario?.[scenarioId] || {};
    Object.entries(financials).forEach(([dataItemKey, expenses]) => {
      if (dataItemKey === itemId && expenses) {
        Object.values(expenses).forEach(expense => {
          if (expense.type === 'expense-avr') {
            dispatch({
              type: 'simFinancials/updateFinancial',
              payload: {
                scenarioId,
                dataItemId: itemId,
                financialId: expense.id,
                updates: { from: updates.startdate }
              }
            });
          }
        });
      }
    });
  }
};

export const selectDataItemsByScenario = createSelector(
  [
    (state, scenarioId) => state.simData.dataByScenario[scenarioId]
  ],
  (dataForScenario) => {
    if (!dataForScenario) {
      return []; // Return a consistent empty array
    }
    return Object.values(dataForScenario); // Transform: extract values from object
  }
);

// Create a consistent empty array reference to avoid creating new arrays
const EMPTY_ARRAY = [];

// Memoized selector for data items by scenario
export const selectDataItemsByScenarioMemoized = createSelector(
  [
    state => state.simScenario.selectedScenarioId,
    state => state.simData.dataByScenario
  ],
  (selectedScenarioId, dataByScenario) => {
    if (!selectedScenarioId || !dataByScenario[selectedScenarioId]) return EMPTY_ARRAY;
    return Object.values(dataByScenario[selectedScenarioId]); // Transform: extract values
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
  importDataItems,
  simDataItemAdd,
  loadDataByScenario,
} = simDataSlice.actions;

// Thunk: delete a data item and all related data (overlay-aware)
export const deleteDataItemThunk = ({ scenarioId, itemId }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  const overlay = state.simOverlay.overlaysByScenario?.[scenarioId]?.dataItems?.[itemId];
  if (isBasedScenario && overlay) {
    dispatch({
      type: 'simOverlay/removeDataItemOverlay',
      payload: { scenarioId, itemId }
    });
  } else {
    dispatch(deleteDataItem({ scenarioId, itemId }));
  }
  dispatch({ type: 'simBooking/deleteAllBookingsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simGroup/deleteAllGroupAssignmentsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simFinancials/deleteAllFinancialsForItem', payload: { scenarioId, itemId } });
  dispatch({ type: 'simQualification/deleteAllQualificationAssignmentsForItem', payload: { scenarioId, itemId } });
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

// Thunk: restore a data item and all related data to original state (removes overlays and resets to originalData)
export const restoreDataItemThunk = ({ scenarioId, itemId }) => (dispatch, getState) => {
  const state = getState();

  // 1. Remove overlays for this item (if any)
  dispatch({ type: 'simOverlay/removeDataItemOverlay', payload: { scenarioId, itemId } });
  dispatch({ type: 'simOverlay/removeBookingOverlay', payload: { scenarioId, itemId } });
  dispatch({ type: 'simOverlay/removeGroupAssignmentOverlay', payload: { scenarioId, itemId } });
  dispatch({ type: 'simOverlay/removeQualificationDefOverlay', payload: { scenarioId } });

  // 2. Restore simData to originalData if present
  const dataItem = state.simData.dataByScenario?.[scenarioId]?.[itemId];
  if (dataItem?.originalData) {
    dispatch({
      type: 'simData/updateDataItem',
      payload: {
        scenarioId,
        itemId,
        updates: { ...dataItem.originalData, id: itemId }
      }
    });
  }

  // 3. Restore bookings to originalData if present, remove others
  const bookings = state.simBooking.bookingsByScenario?.[scenarioId]?.[itemId] || {};
  Object.entries(bookings).forEach(([bookingId, booking]) => {
    if (booking.originalData) {
      dispatch({
        type: 'simBooking/updateBooking',
        payload: {
          scenarioId,
          dataItemId: itemId,
          bookingId,
          updates: { ...booking.originalData, id: bookingId }
        }
      });
    } else {
      // Remove manually added bookings
      dispatch({
        type: 'simBooking/deleteBooking',
        payload: { scenarioId, dataItemId: itemId, bookingId }
      });
    }
  });

  // 4. Restore group assignments to originalData if present, remove others
  const groupAssignments = state.simGroup.groupsByScenario?.[scenarioId]?.[itemId] || {};
  Object.entries(groupAssignments).forEach(([groupId, groupAssignment]) => {
    if (groupAssignment.originalData) {
      dispatch({
        type: 'simGroup/updateGroup',
        payload: {
          scenarioId,
          dataItemId: itemId,
          groupId,
          updates: { ...groupAssignment.originalData, id: groupId }
        }
      });
    } else {
      // Remove manually added group assignments
      dispatch({
        type: 'simGroup/deleteGroup',
        payload: { scenarioId, dataItemId: itemId, groupId }
      });
    }
  });

  // 5. Restore qualification assignments to originalData if present, remove others
  const qualiAssignments = state.simQualification.qualificationAssignmentsByScenario?.[scenarioId]?.[itemId] || {};
  Object.entries(qualiAssignments).forEach(([assignmentId, assignment]) => {
    if (assignment.originalData) {
      dispatch({
        type: 'simQualification/updateQualificationAssignment',
        payload: {
          scenarioId,
          dataItemId: itemId,
          assignmentId,
          updates: { ...assignment.originalData, id: assignmentId }
        }
      });
    } else {
      // Remove manually added qualification assignments
      dispatch({
        type: 'simQualification/deleteQualificationAssignment',
        payload: { scenarioId, dataItemId: itemId, assignmentId }
      });
    }
  });
};

export default simDataSlice.reducer;