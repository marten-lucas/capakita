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
      setSelectedItem: (itemId) =>
        set(produce((state) => {
          const scenarioId = state.selectedScenarioId;
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
        organisation = undefined,
        makeNameUnique = true
      }) =>
        set(produce((state) => {
          let finalName = name;
          if (makeNameUnique) {
            const existingNames = state.scenarios.map(s => s.name);
            if (existingNames.includes(finalName)) {
              let counter = 2;
              let candidate;
              do {
                candidate = `${name} (${counter})`;
                counter++;
              } while (existingNames.includes(candidate));
              finalName = candidate;
            }
          }
          const id = Date.now().toString();
          const uid = generateUID();
          const org = organisation || { groupdefs: [], qualidefs: [] };
          state.scenarios.push({
            id,
            uid,
            name: finalName,
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

      importScenario: async ({
        scenarioSettings,
        groupDefs = [],
        qualiDefs = [],
        groupAssignments = [],
        qualiAssignments = [],
        simDataList = [],
        bookingsList = []
      }) => {
        // Add scenario (with groupDefs and qualiDefs in organisation)
        const organisation = {
          groupdefs: groupDefs,
          qualidefs: qualiDefs
        };
        const scenarioObj = { ...scenarioSettings, organisation };
        get().addScenario(scenarioObj);

        // Get the new scenario id
        const scenarios = get().scenarios;
        const lastScenario = scenarios[scenarios.length - 1];
        if (!lastScenario) return;
        const scenarioId = lastScenario.id;

        // Import to other stores
        // Import groupDefs
        const useSimGroupStore = (await import('./simGroupStore')).default;
        useSimGroupStore.getState().importGroupDefs(scenarioId, groupDefs);

        // Import groupAssignments
        useSimGroupStore.getState().importGroupAssignments(scenarioId, groupAssignments);

        // Import qualiDefs
        const useSimQualificationStore = (await import('./simQualificationStore')).default;
        useSimQualificationStore.getState().importQualificationDefs(scenarioId, qualiDefs);

        // Import qualiAssignments
        useSimQualificationStore.getState().importQualificationAssignments(scenarioId, qualiAssignments);

        // Import simDataList
        const useSimDataStore = (await import('./simDataStore')).default;
        useSimDataStore.getState().importDataItems(scenarioId, simDataList);

        // Import bookingsList
        const useSimBookingStore = (await import('./simBookingStore')).default;
        useSimBookingStore.getState().importBookings(scenarioId, bookingsList);

        // Optionally select the new scenario
        set({ selectedScenarioId: scenarioId });
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
