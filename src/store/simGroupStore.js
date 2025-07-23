import { create } from 'zustand';
import { produce } from 'immer';
import { devtools } from 'zustand/middleware';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

const useSimGroupStore = create(
  devtools(
    (set, get) => ({
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

      // Groupdefs CRUD (global group definitions, not assignments)
      groupDefsByScenario: {},

      addGroupDef: (scenarioId, groupDef) =>
        set(produce((state) => {
          if (!state.groupDefsByScenario[scenarioId]) state.groupDefsByScenario[scenarioId] = [];
          const id = groupDef.id || generateUID();
          state.groupDefsByScenario[scenarioId].push({ ...groupDef, id });
        })),

      updateGroupDef: (scenarioId, groupId, updates) =>
        set(produce((state) => {
          const defs = state.groupDefsByScenario[scenarioId];
          if (!defs) return;
          const idx = defs.findIndex(g => g.id === groupId);
          if (idx !== -1) {
            defs[idx] = { ...defs[idx], ...updates };
          }
        })),

      deleteGroupDef: (scenarioId, groupId) =>
        set(produce((state) => {
          const defs = state.groupDefsByScenario[scenarioId];
          if (!defs) return;
          state.groupDefsByScenario[scenarioId] = defs.filter(g => g.id !== groupId);
        })),

      getGroupDefs: (scenarioId) => {
        const state = get();
        return state.groupDefsByScenario[scenarioId] || [];
      },

      // Import multiple group definitions for a scenario (overwrite or merge)
      importGroupDefs: (scenarioId, defs) =>
        set(produce((state) => {
          if (!state.groupDefsByScenario[scenarioId]) state.groupDefsByScenario[scenarioId] = [];
          defs.forEach(def => {
            const id = def.id || generateUID();
            state.groupDefsByScenario[scenarioId].push({ ...def, id });
          });
        })),

      // Import multiple group assignments for a scenario (overwrite or merge)
      importGroupAssignments: (scenarioId, assignments) =>
        set(produce((state) => {
          if (!state.groupsByScenario[scenarioId]) state.groupsByScenario[scenarioId] = {};
          assignments.forEach(assignment => {
            const id = assignment.id || generateUID();
            state.groupsByScenario[scenarioId][id] = { ...assignment, id, overlays: {} };
          });
        })),
    }),
    { name: 'sim-group-devtools' }
  )
);

export default useSimGroupStore;
