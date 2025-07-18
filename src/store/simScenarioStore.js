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
      // scenarios: [{ id, uid, name, remark, confidence, likelihood, baseScenarioId }]
      scenarios: [],
      addScenario: ({ name, remark = '', confidence = 50, likelihood = 50, baseScenarioId = null }) =>
        set(produce((state) => {
          const id = Date.now().toString();
          const uid = generateUID();
          state.scenarios.push({ id, uid, name, remark, confidence, likelihood, baseScenarioId });
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
          state.scenarios = state.scenarios.filter(s => s.id !== id);
        })),
      setScenarios: (scenarios) => set({ scenarios }),
      getScenarioById: (id) => {
        const state = get();
        return state.scenarios.find(s => s.id === id);
      }
    }),
    {
      name: 'sim-scenario-storage',
      partialize: (state) => ({
        scenarios: state.scenarios
      })
    }
  )
);

export default useSimScenarioStore;
