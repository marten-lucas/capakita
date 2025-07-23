import { create } from 'zustand';
import { produce } from 'immer';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

const useSimQualificationStore = create((set, get) => ({
  // Structure: { [scenarioId]: [ { ...def } ] }
  qualificationDefsByScenario: {},
  qualificationAssignmentsByScenario: {},

  // Qualification Defs CRUD
  addQualificationDef: (scenarioId, qualiDef) =>
    set(produce((state) => {
      if (!state.qualificationDefsByScenario[scenarioId]) state.qualificationDefsByScenario[scenarioId] = [];
      const key = qualiDef.key || generateUID();
      state.qualificationDefsByScenario[scenarioId].push({ ...qualiDef, key });
    })),

  updateQualificationDef: (scenarioId, qualiKey, updates) =>
    set(produce((state) => {
      const defs = state.qualificationDefsByScenario[scenarioId];
      if (!defs) return;
      const idx = defs.findIndex(q => q.key === qualiKey);
      if (idx !== -1) {
        defs[idx] = { ...defs[idx], ...updates };
      }
    })),

  deleteQualificationDef: (scenarioId, qualiKey) =>
    set(produce((state) => {
      const defs = state.qualificationDefsByScenario[scenarioId];
      if (!defs) return;
      state.qualificationDefsByScenario[scenarioId] = defs.filter(q => q.key !== qualiKey);
    })),

  getQualificationDefs: (scenarioId) => {
    const state = get();
    return state.qualificationDefsByScenario[scenarioId] || [];
  },

  // Qualification Assignments CRUD
  addQualificationAssignment: (scenarioId, assignment) =>
    set(produce((state) => {
      if (!state.qualificationAssignmentsByScenario[scenarioId]) state.qualificationAssignmentsByScenario[scenarioId] = [];
      const id = assignment.id || generateUID();
      state.qualificationAssignmentsByScenario[scenarioId].push({ ...assignment, id });
    })),

  updateQualificationAssignment: (scenarioId, assignmentId, updates) =>
    set(produce((state) => {
      const assignments = state.qualificationAssignmentsByScenario[scenarioId];
      if (!assignments) return;
      const idx = assignments.findIndex(a => a.id === assignmentId);
      if (idx !== -1) {
        assignments[idx] = { ...assignments[idx], ...updates };
      }
    })),

  deleteQualificationAssignment: (scenarioId, assignmentId) =>
    set(produce((state) => {
      const assignments = state.qualificationAssignmentsByScenario[scenarioId];
      if (!assignments) return;
      state.qualificationAssignmentsByScenario[scenarioId] = assignments.filter(a => a.id !== assignmentId);
    })),

  getQualificationAssignments: (scenarioId) => {
    const state = get();
    return state.qualificationAssignmentsByScenario[scenarioId] || [];
  },

  // Provide a getQualifications method for backward compatibility (returns assignments)
  getQualifications: (scenarioId) => {
    const state = get();
    return state.qualificationAssignmentsByScenario[scenarioId] || [];
  },

  getQualificationAssignment: (scenarioId, assignmentId) => {
    const state = get();
    return (state.qualificationAssignmentsByScenario[scenarioId] || []).find(a => a.id === assignmentId);
  },

  // Import multiple qualification definitions for a scenario (overwrite or merge)
  importQualificationDefs: (scenarioId, defs) =>
    set(produce((state) => {
      if (!state.qualificationDefsByScenario[scenarioId]) state.qualificationDefsByScenario[scenarioId] = [];
      defs.forEach(def => {
        const key = def.key || generateUID();
        state.qualificationDefsByScenario[scenarioId].push({ ...def, key });
      });
    })),

  // Import multiple qualification assignments for a scenario (overwrite or merge)
  importQualificationAssignments: (scenarioId, assignments) =>
    set(produce((state) => {
      if (!state.qualificationAssignmentsByScenario[scenarioId]) state.qualificationAssignmentsByScenario[scenarioId] = [];
      assignments.forEach(assignment => {
        const id = assignment.id || generateUID();
        state.qualificationAssignmentsByScenario[scenarioId].push({ ...assignment, id });
      });
    })),
}));

export default useSimQualificationStore;
