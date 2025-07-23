import { create } from 'zustand';
import { produce } from 'immer';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

const useSimQualificationStore = create((set, get) => ({
  // { [scenarioId]: { [qualificationId]: { ...qualificationData, overlays: {...} } } }
  qualificationsByScenario: {},

  addQualification: (scenarioId, qualification) =>
    set(produce((state) => {
      if (!state.qualificationsByScenario[scenarioId]) state.qualificationsByScenario[scenarioId] = {};
      const id = qualification.id || generateUID();
      state.qualificationsByScenario[scenarioId][id] = { ...qualification, id, overlays: {} };
    })),

  updateQualification: (scenarioId, qualificationId, updates) =>
    set(produce((state) => {
      if (!state.qualificationsByScenario[scenarioId]?.[qualificationId]) return;
      state.qualificationsByScenario[scenarioId][qualificationId] = {
        ...state.qualificationsByScenario[scenarioId][qualificationId],
        ...updates,
        overlays: {
          ...state.qualificationsByScenario[scenarioId][qualificationId].overlays,
          ...updates.overlays
        }
      };
    })),

  deleteQualification: (scenarioId, qualificationId) =>
    set(produce((state) => {
      if (state.qualificationsByScenario[scenarioId]) {
        delete state.qualificationsByScenario[scenarioId][qualificationId];
      }
    })),

  getQualifications: (scenarioId) => {
    const state = get();
    return Object.values(state.qualificationsByScenario[scenarioId] || {});
  },

  getQualification: (scenarioId, qualificationId) => {
    const state = get();
    return state.qualificationsByScenario[scenarioId]?.[qualificationId];
  },

  // Qualification Defs CRUD (global qualification definitions, not assignments)
  qualificationDefsByScenario: {},

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
}));

export default useSimQualificationStore;
