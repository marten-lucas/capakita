import { createSlice } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';

const initialState = {
  groupsByScenario: {},
  groupDefsByScenario: {},
};

const simGroupSlice = createSlice({
  name: 'simGroup',
  initialState,
  reducers: {
    addGroup(state, action) {
      const { scenarioId, group } = action.payload;
      if (!state.groupsByScenario[scenarioId]) state.groupsByScenario[scenarioId] = {};
      const key = createId('group');
      state.groupsByScenario[scenarioId][key] = { ...group, overlays: {} };
    },
    updateGroup(state, action) {
      const { scenarioId, groupId, updates } = action.payload;
      const id = String(groupId);
      if (!state.groupsByScenario[scenarioId] || !state.groupsByScenario[scenarioId][id]) return;
      state.groupsByScenario[scenarioId][id] = {
        ...state.groupsByScenario[scenarioId][id],
        ...updates,
        overlays: updates.overlays
          ? { ...state.groupsByScenario[scenarioId][id].overlays, ...updates.overlays }
          : state.groupsByScenario[scenarioId][id].overlays
      };
    },
    deleteGroup(state, action) {
      const { scenarioId, groupId } = action.payload;
      const id = String(groupId);
      if (state.groupsByScenario[scenarioId]) {
        delete state.groupsByScenario[scenarioId][id];
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
        const id = assignment.id ? String(assignment.id) : Date.now().toString();
        state.groupsByScenario[scenarioId][id] = { ...assignment, id, overlays: {} };
      });
    },
    deleteAllGroupAssignmentsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      const id = String(itemId);
      if (state.groupsByScenario[scenarioId]) {
        Object.keys(state.groupsByScenario[scenarioId]).forEach(groupId => {
          const group = state.groupsByScenario[scenarioId][groupId];
          if (String(group.kindId) === id) {
            delete state.groupsByScenario[scenarioId][groupId];
          }
        });
      }
    },
    deleteAllGroupAssignmentsForScenario(state, action) {
      const { scenarioId } = action.payload;
      delete state.groupsByScenario[scenarioId];
      delete state.groupDefsByScenario[scenarioId];
    },
  },
});

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
} = simGroupSlice.actions;

export default simGroupSlice.reducer;