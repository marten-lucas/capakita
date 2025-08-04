import { createSlice } from '@reduxjs/toolkit';

// Create stable empty references
const EMPTY_DEFS = [];
const EMPTY_ASSIGNMENTS = {};

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
      state.qualificationDefsByScenario[scenarioId] = defs.map(def => ({ ...def }));
    },
    importQualificationAssignments(state, action) {
      const { scenarioId, assignments } = action.payload;
      // Replace all assignments for this scenario
      if (!state.qualificationAssignmentsByScenario[scenarioId]) {
        state.qualificationAssignmentsByScenario[scenarioId] = {};
      }
      
      // Clear existing assignments for this scenario
      state.qualificationAssignmentsByScenario[scenarioId] = {};
      
      assignments.forEach(assignment => {
        const dataItemId = String(assignment.dataItemId);
        if (!state.qualificationAssignmentsByScenario[scenarioId][dataItemId]) {
          state.qualificationAssignmentsByScenario[scenarioId][dataItemId] = {};
        }
        const id = assignment.id ? String(assignment.id) : `${assignment.qualification}-${Date.now()}-${Math.random()}`;
        state.qualificationAssignmentsByScenario[scenarioId][dataItemId][id] = { 
          ...assignment, 
          id,
          dataItemId: dataItemId 
        };
      });
    },
    addQualificationAssignment(state, action) {
      const { scenarioId, dataItemId, assignment } = action.payload;
      if (!state.qualificationAssignmentsByScenario[scenarioId]) {
        state.qualificationAssignmentsByScenario[scenarioId] = {};
      }
      const itemId = String(dataItemId);
      if (!state.qualificationAssignmentsByScenario[scenarioId][itemId]) {
        state.qualificationAssignmentsByScenario[scenarioId][itemId] = {};
      }

      // Prevent duplicate qualifications
      const existingAssignment = Object.values(
        state.qualificationAssignmentsByScenario[scenarioId][itemId]
      ).find((a) => a.qualification === assignment.qualification);

      if (existingAssignment) {
        return; // Do nothing if the qualification already exists
      }

      const id = assignment.id
        ? String(assignment.id)
        : `${assignment.qualification}-${Date.now()}-${Math.random()}`;
      state.qualificationAssignmentsByScenario[scenarioId][itemId][id] = {
        ...assignment,
        id,
        dataItemId: itemId,
      };
    },
    updateQualificationAssignment(state, action) {
      const { scenarioId, dataItemId, assignmentId, updates } = action.payload;
      const itemId = String(dataItemId);
      const id = String(assignmentId);

      if (!state.qualificationAssignmentsByScenario[scenarioId]) return;
      if (!state.qualificationAssignmentsByScenario[scenarioId][itemId]) return;

      const existingAssignment = state.qualificationAssignmentsByScenario[scenarioId][itemId][id];
      if (existingAssignment) {
        state.qualificationAssignmentsByScenario[scenarioId][itemId][id] = {
          ...existingAssignment,
          ...updates,
        };
      }
    },
    deleteQualificationAssignment(state, action) {
      const { scenarioId, dataItemId, assignmentId } = action.payload;
      const itemId = String(dataItemId);
      const id = String(assignmentId);
      if (state.qualificationAssignmentsByScenario[scenarioId]?.[itemId]) {
        delete state.qualificationAssignmentsByScenario[scenarioId][itemId][id];
      }
    },
    deleteAllQualificationAssignmentsForItem(state, action) {
      const { scenarioId, itemId } = action.payload;
      const id = String(itemId);
      if (state.qualificationAssignmentsByScenario[scenarioId]) {
        delete state.qualificationAssignmentsByScenario[scenarioId][id];
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
      state.qualificationDefsByScenario[scenarioId].push({
        ...qualiDef,
        IsExpert: qualiDef.IsExpert !== false
      });
    },
    updateQualificationDef(state, action) {
      const { scenarioId, qualiKey, updates } = action.payload;
      const defs = state.qualificationDefsByScenario[scenarioId];
      if (!defs) return;
      const idx = defs.findIndex(q => q.key === qualiKey);
      if (idx !== -1) {
        defs[idx] = { 
          ...defs[idx], 
          ...updates, 
          IsExpert: updates.IsExpert !== false // default true
        };
      }
    },
    deleteQualificationDef(state, action) {
      const { scenarioId, qualiKey } = action.payload;
      const defs = state.qualificationDefsByScenario[scenarioId];
      if (!defs) return;
      state.qualificationDefsByScenario[scenarioId] = defs.filter(q => q.key !== qualiKey);
    },
    loadQualificationDefsByScenario(state, action) {
      state.qualificationDefsByScenario = action.payload || {};
    },
    loadQualificationAssignmentsByScenario(state, action) {
      state.qualificationAssignmentsByScenario = action.payload || {};
    },
  },
});

export const {
  importQualificationDefs,
  importQualificationAssignments,
  addQualificationAssignment,
  updateQualificationAssignment,
  deleteQualificationAssignment,
  deleteAllQualificationAssignmentsForItem,
  deleteAllQualificationAssignmentsForScenario,
  addQualificationDef,
  updateQualificationDef,
  deleteQualificationDef,
  loadQualificationDefsByScenario,
  loadQualificationAssignmentsByScenario,
} = simQualificationSlice.actions;

export default simQualificationSlice.reducer;