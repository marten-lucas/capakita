import { createSlice } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';

const initialState = {
  groupsByScenario: {}, // { [scenarioId]: { [dataItemId]: { [assignmentId]: groupAssignment } } }
  groupDefsByScenario: {},
};

const simGroupSlice = createSlice({
  name: 'simGroup',
  initialState,
  reducers: {
    addGroup(state, action) {
      const { scenarioId, dataItemId, group } = action.payload;
      if (!state.groupsByScenario[scenarioId]) state.groupsByScenario[scenarioId] = {};
      const itemId = String(dataItemId);
      if (!state.groupsByScenario[scenarioId][itemId]) state.groupsByScenario[scenarioId][itemId] = {};
      const key = createId('group');
      state.groupsByScenario[scenarioId][itemId][key] = { ...group, id: key };
    },
    updateGroup(state, action) {
      const { scenarioId, dataItemId, groupId, updates } = action.payload;
      const itemId = String(dataItemId);
      const id = String(groupId);
      if (!state.groupsByScenario[scenarioId]) state.groupsByScenario[scenarioId] = {};
      if (!state.groupsByScenario[scenarioId][itemId]) state.groupsByScenario[scenarioId][itemId] = {};
      if (!state.groupsByScenario[scenarioId][itemId][id]) {
        state.groupsByScenario[scenarioId][itemId][id] = {
          id,
        };
      }
      state.groupsByScenario[scenarioId][itemId][id] = {
        ...state.groupsByScenario[scenarioId][itemId][id],
        ...updates
      };
    },
    deleteGroup(state, action) {
      const { scenarioId, dataItemId, groupId } = action.payload;
      const itemId = String(dataItemId);
      const id = String(groupId);
      if (state.groupsByScenario[scenarioId]?.[itemId]) {
        delete state.groupsByScenario[scenarioId][itemId][id];
      }
    },
    addGroupDef(state, action) {
      const { scenarioId, groupDef } = action.payload;
      if (!state.groupDefsByScenario[scenarioId]) state.groupDefsByScenario[scenarioId] = [];
      const defWithKey = { ...groupDef };
      state.groupDefsByScenario[scenarioId].push(defWithKey);
    },
    updateGroupDef(state, action) {
      const { scenarioId, groupId, updates } = action.payload;
      const id = String(groupId);
      const defs = state.groupDefsByScenario[scenarioId];
      if (!defs) return;
      const idx = defs.findIndex(g => String(g.id) === id);
      if (idx !== -1) {
        defs[idx] = { ...defs[idx], ...updates };
      }
    },
    deleteGroupDef(state, action) {
      const { scenarioId, groupId } = action.payload;
      const id = String(groupId);
      const defs = state.groupDefsByScenario[scenarioId];
      if (!defs) return;
      state.groupDefsByScenario[scenarioId] = defs.filter(g => String(g.id) !== id);
    },
    importGroupDefs(state, action) {
      const { scenarioId, defs } = action.payload;
      if (!state.groupDefsByScenario[scenarioId]) state.groupDefsByScenario[scenarioId] = [];
      defs.forEach(def => {
        state.groupDefsByScenario[scenarioId].push({ ...def });
      });
    },
    importGroupAssignments(state, action) {
      const { scenarioId, assignments } = action.payload;
      if (!state.groupsByScenario[scenarioId]) state.groupsByScenario[scenarioId] = {};
      assignments.forEach(assignment => {
        const dataItemId = String(assignment.kindId);
        if (!state.groupsByScenario[scenarioId][dataItemId]) state.groupsByScenario[scenarioId][dataItemId] = {};
        const id = assignment.id ? String(assignment.id) : createId('group');
        state.groupsByScenario[scenarioId][dataItemId][id] = { ...assignment, id,  };
      });
    },
    deleteAllGroupAssignmentsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      const id = String(itemId);
      if (state.groupsByScenario[scenarioId]) {
        delete state.groupsByScenario[scenarioId][id];
      }
    },
    deleteAllGroupAssignmentsForScenario(state, action) {
      const { scenarioId } = action.payload;
      delete state.groupsByScenario[scenarioId];
      delete state.groupDefsByScenario[scenarioId];
    },
    loadGroupsByScenario(state, action) {
      state.groupsByScenario = action.payload || {};
    },
    loadGroupDefsByScenario(state, action) {
      state.groupDefsByScenario = action.payload || {};
    },
  },
});

// Thunk for deleting a group assignment, overlay-aware
export const deleteGroupThunk = ({ scenarioId, dataItemId, groupId }) => (dispatch, getState) => {
  const state = getState();
  const scenario = state.simScenario.scenarios.find(s => s.id === scenarioId);
  const isBasedScenario = !!scenario?.baseScenarioId;
  const overlay = state.simOverlay.overlaysByScenario?.[scenarioId]?.groupassignments?.[dataItemId]?.[groupId];
  if (isBasedScenario && overlay) {
    dispatch({
      type: 'simOverlay/removeGroupAssignmentOverlay',
      payload: { scenarioId, itemId: dataItemId, groupId }
    });
  } else {
    dispatch(simGroupSlice.actions.deleteGroup({ scenarioId, dataItemId, groupId }));
  }
};

export const {
  addGroup,
  updateGroup,
  deleteGroup,
  addGroupDef,
  updateGroupDef,
  deleteGroupDef,
  importGroupDefs,
  importGroupAssignments,
  deleteAllGroupAssignmentsForItem,
  deleteAllGroupAssignmentsForScenario,
  loadGroupsByScenario,
  loadGroupDefsByScenario,
} = simGroupSlice.actions;

export default simGroupSlice.reducer;