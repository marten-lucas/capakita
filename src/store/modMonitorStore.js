import { create } from 'zustand';
import { produce } from 'immer';

const useModMonitorStore = create((set) => ({
  modifications: {}, // Track modifications by item ID and field

  setFieldModification: (itemId, field, modified) =>
    set(
      produce((state) => {
        if (!state.modifications[itemId]) {
          state.modifications[itemId] = {};
        }
        if (modified) {
          state.modifications[itemId][field] = true;
        } else {
          delete state.modifications[itemId][field];
          if (Object.keys(state.modifications[itemId]).length === 0) {
            delete state.modifications[itemId];
          }
        }
      })
    ),

  resetFieldModification: (itemId, field) =>
    set(
      produce((state) => {
        if (state.modifications[itemId]) {
          delete state.modifications[itemId][field];
          if (Object.keys(state.modifications[itemId]).length === 0) {
            delete state.modifications[itemId];
          }
        }
      })
    ),

  isFieldModified: (itemId, field) => {
    const state = useModMonitorStore.getState();
    return !!state.modifications[itemId]?.[field];
  },
}));

export default useModMonitorStore;

