import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  qualificationDefsByScenario: {},
  qualificationAssignmentsByScenario: {}, // { [scenarioId]: { [dataItemId]: { [assignmentId]: assignmentObj } } }
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
      if (!state.qualificationAssignmentsByScenario[scenarioId]) state.qualificationAssignmentsByScenario[scenarioId] = {};
      assignments.forEach(assignment => {
        const dataItemId = assignment.dataItemId;
        if (!state.qualificationAssignmentsByScenario[scenarioId][dataItemId]) state.qualificationAssignmentsByScenario[scenarioId][dataItemId] = {};
        const id = assignment.id ? String(assignment.id) : `${assignment.qualification}-${Date.now()}`;
        state.qualificationAssignmentsByScenario[scenarioId][dataItemId][id] = { ...assignment, id };
      });
    },
    deleteAllQualificationAssignmentsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      if (state.qualificationAssignmentsByScenario[scenarioId]) {
        delete state.qualificationAssignmentsByScenario[scenarioId][String(itemId)];
      }
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