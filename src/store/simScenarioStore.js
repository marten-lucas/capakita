import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';

// Helper to generate a random UID
function generateUID() {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

const useSimScenarioStore = create(
  persist(
    (set, get) => ({
      scenarios: [],
      selectedScenarioId: null,
      lastImportAnonymized: true,
      selectedItems: {}, // { [scenarioId]: selectedItemId }

      setSelectedScenarioId: (id) => set({ selectedScenarioId: id }),
      setLastImportAnonymized: (value) => set({ lastImportAnonymized: value }),
      setSelectedItem: (scenarioId, itemId) =>
        set(produce((state) => {
          if (!scenarioId) return;
          state.selectedItems[scenarioId] = itemId;
        })),
      getSelectedItem: (scenarioId) => {
        const state = get();
        return scenarioId ? state.selectedItems[scenarioId] : undefined;
      },

      addScenario: ({
        name,
        remark = '',
        confidence = 50,
        likelihood = 50,
        desirability = 50,
        baseScenarioId = null,
        imported = false,
        importedAnonymized = false,
        organisation = undefined
      }) =>
        set(produce((state) => {
          const id = Date.now().toString();
          const uid = generateUID();
          const org = organisation || { groupdefs: [], qualidefs: [] };
          state.scenarios.push({
            id,
            uid,
            name,
            remark,
            confidence,
            likelihood,
            desirability,
            baseScenarioId,
            imported,
            importedAnonymized,
            organisation: org
          });
          state.selectedScenarioId = id;
        })),

      updateScenario: (id, updates) =>
        set(produce((state) => {
          const idx = state.scenarios.findIndex(s => s.id === id);
          if (idx !== -1) {
            state.scenarios[idx] = { ...state.scenarios[idx], ...updates };
          }
        })),

      deleteScenario: (id) =>
        set(produce((state) => {
          const scenarioToDelete = state.scenarios.find(s => s.id === id);
          if (!scenarioToDelete) return;
          const collectDescendants = (parentId) => {
            const descendants = state.scenarios.filter(s => s.baseScenarioId === parentId);
            let allDescendants = descendants.map(d => d.id);
            descendants.forEach(descendant => {
              allDescendants = allDescendants.concat(collectDescendants(descendant.id));
            });
            return allDescendants;
          };
          const idsToDelete = [id, ...collectDescendants(id)];
          state.scenarios = state.scenarios.filter(s => !idsToDelete.includes(s.id));
          if (idsToDelete.includes(state.selectedScenarioId)) {
            state.selectedScenarioId = state.scenarios.length > 0 ? state.scenarios[0].id : null;
          }
        })),

      setScenarios: (scenarios) => set({ scenarios }),

      getScenarioById: (id) => {
        const state = get();
        return state.scenarios.find(s => s.id === id);
      },

      isSaveAllowed: () => {
        const scenarios = get().scenarios;
        if (!scenarios || scenarios.length === 0) return true;
        const imported = scenarios.filter(s => s.imported);
        if (imported.length === 0) return true;
        return imported.every(s => s.importedAnonymized);
      },
    }),
    {
      name: 'sim-scenario-storage',
      partialize: (state) => ({
        scenarios: state.scenarios,
        selectedScenarioId: state.selectedScenarioId,
        lastImportAnonymized: state.lastImportAnonymized,
        selectedItems: state.selectedItems
      })
    }
  )
);

export default useSimScenarioStore;
