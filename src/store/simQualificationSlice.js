import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  qualificationDefsByScenario: {},
  qualificationAssignmentsByScenario: {},
};

const simQualificationSlice = createSlice({
  name: 'simQualification',
  initialState,
  reducers: {
    importQualificationDefs(state, action) {
      const { scenarioId, defs } = action.payload;
      state.qualificationDefsByScenario[scenarioId] = defs;
    },
    importQualificationAssignments(state, action) {
      const { scenarioId, assignments } = action.payload;
      state.qualificationAssignmentsByScenario[scenarioId] = assignments;
    },
    deleteAllQualificationAssignmentsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      const assignments = state.qualificationAssignmentsByScenario[scenarioId];
      if (!assignments) return;
      state.qualificationAssignmentsByScenario[scenarioId] = assignments.filter(a => String(a.dataItemId) !== String(itemId));
    },
    deleteAllQualificationAssignmentsForScenario(state, action) {
      const { scenarioId } = action.payload;
      delete state.qualificationAssignmentsByScenario[scenarioId];
      delete state.qualificationDefsByScenario[scenarioId];
    },
    addQualificationDef(state, action) {
      const { scenarioId, qualiDef } = action.payload;
      if (!state.qualificationDefsByScenario[scenarioId]) state.qualificationDefsByScenario[scenarioId] = [];
      state.qualificationDefsByScenario[scenarioId].push(qualiDef);
    },
    updateQualificationDef(state, action) {
      const { scenarioId, qualiKey, updates } = action.payload;
      const defs = state.qualificationDefsByScenario[scenarioId];
      if (!defs) return;
      const idx = defs.findIndex(q => q.key === qualiKey);
      if (idx !== -1) {
        defs[idx] = { ...defs[idx], ...updates };
      }
    },
    deleteQualificationDef(state, action) {
      const { scenarioId, qualiKey } = action.payload;
      const defs = state.qualificationDefsByScenario[scenarioId];
      if (!defs) return;
      state.qualificationDefsByScenario[scenarioId] = defs.filter(q => q.key !== qualiKey);
    },
  },
});

export const {
  importQualificationDefs,
  importQualificationAssignments,
  deleteAllQualificationAssignmentsForItem,
  deleteAllQualificationAssignmentsForScenario,
  addQualificationDef,
  updateQualificationDef,
  deleteQualificationDef,
} = simQualificationSlice.actions;

export default simQualificationSlice.reducer;