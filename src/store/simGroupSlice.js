import { createSlice } from '@reduxjs/toolkit';

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
      const id = group.id || Date.now();
      state.groupsByScenario[scenarioId][id] = { ...group, id, overlays: {} };
    },
    updateGroup(state, action) {
      const { scenarioId, groupId, updates } = action.payload;
      if (!state.groupsByScenario[scenarioId] || !state.groupsByScenario[scenarioId][groupId]) return;
      state.groupsByScenario[scenarioId][groupId] = {
        ...state.groupsByScenario[scenarioId][groupId],
        ...updates,
        overlays: {
          ...state.groupsByScenario[scenarioId][groupId].overlays,
          ...updates.overlays
        }
      };
    },
    deleteGroup(state, action) {
      const { scenarioId, groupId } = action.payload;
      if (state.groupsByScenario[scenarioId]) {
        delete state.groupsByScenario[scenarioId][groupId];
      }
    },
    addGroupDef(state, action) {
      const { scenarioId, groupDef } = action.payload;
      if (!state.groupDefsByScenario[scenarioId]) state.groupDefsByScenario[scenarioId] = [];
      const defWithId = { ...groupDef, id: groupDef.id || Date.now().toString() };
      state.groupDefsByScenario[scenarioId].push(defWithId);
    },
    updateGroupDef(state, action) {
      const { scenarioId, groupId, updates } = action.payload;
      const defs = state.groupDefsByScenario[scenarioId];
      if (!defs) return;
      const idx = defs.findIndex(g => g.id === groupId);
      if (idx !== -1) {
        defs[idx] = { ...defs[idx], ...updates };
      }
    },
    deleteGroupDef(state, action) {
      const { scenarioId, groupId } = action.payload;
      const defs = state.groupDefsByScenario[scenarioId];
      if (!defs) return;
      state.groupDefsByScenario[scenarioId] = defs.filter(g => g.id !== groupId);
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
        const id = assignment.id || Date.now();
        state.groupsByScenario[scenarioId][id] = { ...assignment, id, overlays: {} };
      });
    },
    deleteAllGroupAssignmentsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      if (state.groupsByScenario[scenarioId]) {
        Object.keys(state.groupsByScenario[scenarioId]).forEach(groupId => {
          const group = state.groupsByScenario[scenarioId][groupId];
          if (group.kindId === itemId) {
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