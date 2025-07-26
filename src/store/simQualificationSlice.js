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
      state.qualificationDefsByScenario[scenarioId].push({ ...qualiDef });
    },
    updateQualificationDef(state, action) {
      const { scenarioId, qualiKey, updates } = action.payload;
      const key = String(qualiKey);
      const defs = state.qualificationDefsByScenario[scenarioId];
      if (!defs) return;
      const idx = defs.findIndex(q => String(q.key) === key);
      if (idx !== -1) {
        defs[idx] = { ...defs[idx], ...updates };
      }
    },
    deleteQualificationDef(state, action) {
      const { scenarioId, qualiKey } = action.payload;
      const key = String(qualiKey);
      const defs = state.qualificationDefsByScenario[scenarioId];
      if (!defs) return;
      state.qualificationDefsByScenario[scenarioId] = defs.filter(q => String(q.key) !== key);
    },
    addQualificationAssignment(state, action) {
      const { scenarioId, assignment } = action.payload;
      if (!state.qualificationAssignmentsByScenario[scenarioId]) state.qualificationAssignmentsByScenario[scenarioId] = [];
      state.qualificationAssignmentsByScenario[scenarioId].push({ ...assignment });
    },
    updateQualificationAssignment(state, action) {
      const { scenarioId, assignmentId, updates } = action.payload;
      const id = String(assignmentId);
      const assignments = state.qualificationAssignmentsByScenario[scenarioId];
      if (!assignments) return;
      const idx = assignments.findIndex(a => String(a.id) === id);
      if (idx !== -1) {
        assignments[idx] = { ...assignments[idx], ...updates };
      }
    },
    deleteQualificationAssignment(state, action) {
      const { scenarioId, assignmentId } = action.payload;
      const id = String(assignmentId);
      const assignments = state.qualificationAssignmentsByScenario[scenarioId];
      if (!assignments) return;
      state.qualificationAssignmentsByScenario[scenarioId] = assignments.filter(a => String(a.id) !== id);
    },
    importQualificationDefs(state, action) {
      const { scenarioId, defs } = action.payload;
      if (!state.qualificationDefsByScenario[scenarioId]) state.qualificationDefsByScenario[scenarioId] = [];
      defs.forEach(def => {
        state.qualificationDefsByScenario[scenarioId].push({ ...def });
      });
    },
    importQualificationAssignments(state, action) {
      const { scenarioId, assignments } = action.payload;
      if (!state.qualificationAssignmentsByScenario[scenarioId]) state.qualificationAssignmentsByScenario[scenarioId] = [];
      assignments.forEach(assignment => {
        state.qualificationAssignmentsByScenario[scenarioId].push({ ...assignment });
      });
    },
    deleteAllQualificationAssignmentsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      const id = String(itemId);
      if (state.qualificationAssignmentsByScenario[scenarioId]) {
        state.qualificationAssignmentsByScenario[scenarioId] = state.qualificationAssignmentsByScenario[scenarioId].filter(
          a => String(a.dataItemId) !== id
        );
      }
    },
    deleteAllQualificationAssignmentsForScenario(state, action) {
      const { scenarioId } = action.payload;
      delete state.qualificationAssignmentsByScenario[scenarioId];
      delete state.qualificationDefsByScenario[scenarioId];
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