import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppSettingsStore = create(
  persist(
    (set) => ({
      // Scenario-related UI state
      selectedItem: null,
      setSelectedItem: (item) => set({ selectedItem: item }),

      lastImportAnonymized: true,
      setLastImportAnonymized: (value) => set({ lastImportAnonymized: value }),

      // Scenario Save Dialog state
      scenarioSaveDialogOpen: false,
      setScenarioSaveDialogOpen: (open) => set({ scenarioSaveDialogOpen: open }),
      scenarioSaveDialogPending: null,
      setScenarioSaveDialogPending: (cb) => set({ scenarioSaveDialogPending: cb }),
    }),
    {
      name: 'app-settings-storage',
      partialize: (state) => ({
        selectedItem: state.selectedItem,
        lastImportAnonymized: state.lastImportAnonymized,
        scenarioSaveDialogOpen: state.scenarioSaveDialogOpen,
        // scenarioSaveDialogPending is not persisted
      })
    }
  )
);

export default useAppSettingsStore;
    