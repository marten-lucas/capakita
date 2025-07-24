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
      const id = group.id;
      state.groupsByScenario[scenarioId][id] = { ...group, overlays: {} };
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
      state.groupDefsByScenario[scenarioId].push({ ...groupDef });
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
        const id = assignment.id;
        state.groupsByScenario[scenarioId][id] = { ...assignment, overlays: {} };
      });
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
} = simGroupSlice.actions;

export default simGroupSlice.reducer;