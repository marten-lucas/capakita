import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  qualificationDefsByScenario: {},
  qualificationAssignmentsByScenario: {},
};

const simQualificationSlice = createSlice({
  name: 'simQualification',
  initialState,
  reducers: {
    addQualificationDef(state, action) {
      const { scenarioId, qualiDef } = action.payload;
      if (!state.qualificationDefsByScenario[scenarioId]) state.qualificationDefsByScenario[scenarioId] = [];
      const key = qualiDef.key || Date.now();
      state.qualificationDefsByScenario[scenarioId].push({ ...qualiDef, key });
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
    addQualificationAssignment(state, action) {
      const { scenarioId, assignment } = action.payload;
      if (!state.qualificationAssignmentsByScenario[scenarioId]) state.qualificationAssignmentsByScenario[scenarioId] = [];
      const id = assignment.id || Date.now();
      state.qualificationAssignmentsByScenario[scenarioId].push({ ...assignment, id });
    },
    updateQualificationAssignment(state, action) {
      const { scenarioId, assignmentId, updates } = action.payload;
      const assignments = state.qualificationAssignmentsByScenario[scenarioId];
      if (!assignments) return;
      const idx = assignments.findIndex(a => a.id === assignmentId);
      if (idx !== -1) {
        assignments[idx] = { ...assignments[idx], ...updates };
      }
    },
    deleteQualificationAssignment(state, action) {
      const { scenarioId, assignmentId } = action.payload;
      const assignments = state.qualificationAssignmentsByScenario[scenarioId];
      if (!assignments) return;
      state.qualificationAssignmentsByScenario[scenarioId] = assignments.filter(a => a.id !== assignmentId);
    },
    importQualificationDefs(state, action) {
      const { scenarioId, defs } = action.payload;
      if (!state.qualificationDefsByScenario[scenarioId]) state.qualificationDefsByScenario[scenarioId] = [];
      defs.forEach(def => {
        const key = def.key || Date.now();
        state.qualificationDefsByScenario[scenarioId].push({ ...def, key });
      });
    },
    importQualificationAssignments(state, action) {
      const { scenarioId, assignments } = action.payload;
      if (!state.qualificationAssignmentsByScenario[scenarioId]) state.qualificationAssignmentsByScenario[scenarioId] = [];
      assignments.forEach(assignment => {
        const id = assignment.id || Date.now();
        state.qualificationAssignmentsByScenario[scenarioId].push({ ...assignment, id });
      });
    },
  },
});

export const {
  addQualificationDef,
  updateQualificationDef,
  deleteQualificationDef,
  addQualificationAssignment,
  updateQualificationAssignment,
  deleteQualificationAssignment,
  importQualificationDefs,
  importQualificationAssignments,
} = simQualificationSlice.actions;

export default simQualificationSlice.reducer;