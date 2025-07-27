import { createSlice } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';

const initialState = {
  groupsByScenario: {}, // { [scenarioId]: { [kindId]: { [groupId]: groupAssignment } } }
  groupDefsByScenario: {},
};

const simGroupSlice = createSlice({
  name: 'simGroup',
  initialState,
  reducers: {
    addGroup(state, action) {
      const { scenarioId, group } = action.payload;
      if (!state.groupsByScenario[scenarioId]) state.groupsByScenario[scenarioId] = {};
      if (!state.groupsByScenario[scenarioId][group.kindId]) state.groupsByScenario[scenarioId][group.kindId] = {};
      const key = createId('group');
      state.groupsByScenario[scenarioId][group.kindId][key] = { ...group, id: key, overlays: {} };
    },
    updateGroup(state, action) {
      const { scenarioId, groupId, updates } = action.payload;
      // Find the group by scenarioId and groupId
      const scenarioGroups = state.groupsByScenario[scenarioId];
      if (!scenarioGroups) return;
      for (const kindId in scenarioGroups) {
        if (scenarioGroups[kindId][groupId]) {
          scenarioGroups[kindId][groupId] = {
            ...scenarioGroups[kindId][groupId],
            ...updates,
            overlays: updates.overlays
              ? { ...scenarioGroups[kindId][groupId].overlays, ...updates.overlays }
              : scenarioGroups[kindId][groupId].overlays
          };
          break;
        }
      }
    },
    deleteGroup(state, action) {
      const { scenarioId, groupId } = action.payload;
      const scenarioGroups = state.groupsByScenario[scenarioId];
      if (!scenarioGroups) return;
      for (const kindId in scenarioGroups) {
        if (scenarioGroups[kindId][groupId]) {
          delete scenarioGroups[kindId][groupId];
          break;
        }
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
        const kindId = assignment.kindId;
        if (!state.groupsByScenario[scenarioId][kindId]) state.groupsByScenario[scenarioId][kindId] = {};
        const id = assignment.id ? String(assignment.id) : createId('group');
        state.groupsByScenario[scenarioId][kindId][id] = { ...assignment, id, overlays: {} };
      });
    },
    deleteAllGroupAssignmentsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      if (state.groupsByScenario[scenarioId]) {
        delete state.groupsByScenario[scenarioId][String(itemId)];
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