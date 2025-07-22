import { create } from 'zustand';
import { produce } from 'immer';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

const useSimGroupStore = create((set, get) => ({
  // { [scenarioId]: { [groupId]: { ...groupData, overlays: {...} } } }
  groupsByScenario: {},

  addGroup: (scenarioId, group) =>
    set(produce((state) => {
      if (!state.groupsByScenario[scenarioId]) state.groupsByScenario[scenarioId] = {};
      const id = group.id || generateUID();
      state.groupsByScenario[scenarioId][id] = { ...group, id, overlays: {} };
    })),

  updateGroup: (scenarioId, groupId, updates) =>
    set(produce((state) => {
      if (!state.groupsByScenario[scenarioId] || !state.groupsByScenario[scenarioId][groupId]) return;
      state.groupsByScenario[scenarioId][groupId] = {
        ...state.groupsByScenario[scenarioId][groupId],
        ...updates,
        overlays: {
          ...state.groupsByScenario[scenarioId][groupId].overlays,
          ...updates.overlays
        }
      };
    })),

  deleteGroup: (scenarioId, groupId) =>
    set(produce((state) => {
      if (state.groupsByScenario[scenarioId]) {
        delete state.groupsByScenario[scenarioId][groupId];
      }
    })),

  getGroups: (scenarioId) => {
    const state = get();
    return Object.values(state.groupsByScenario[scenarioId] || {});
  },

  getGroup: (scenarioId, groupId) => {
    const state = get();
    return state.groupsByScenario[scenarioId]?.[groupId];
  },
}));

export default useSimGroupStore;
