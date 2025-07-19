import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';

const useAppSettingsStore = create(
  persist(
    (set, get) => ({
      // Groups management
      groups: [], // Array of { id, name, icon }
      
      // Actions for groups
      addGroup: (group) => set(produce((state) => {
        // Generate ID if not provided
        const newGroup = {
          ...group,
          id: group.id || Date.now().toString(),
          icon: group.icon || '👥'
        };
        state.groups.push(newGroup);
      })),
      
      updateGroup: (id, updates) => set(produce((state) => {
        const index = state.groups.findIndex(g => g.id === id);
        if (index !== -1) {
          state.groups[index] = { ...state.groups[index], ...updates };
          // Ensure icon is always set
          if (!state.groups[index].icon) {
            state.groups[index].icon = '👥';
          }
        }
      })),
      
      deleteGroup: (id) => set(produce((state) => {
        state.groups = state.groups.filter(g => g.id !== id);
      })),
      
      setGroups: (groups) => set({ groups }),
      
      getGroupById: (id) => {
        const state = get();
        return state.groups.find(g => String(g.id) === String(id));
      },
      
      getGroupsLookup: () => {
        const state = get();
        const lookup = {};
        state.groups.forEach(group => {
          lookup[group.id] = group.name;
        });
        return lookup;
      },
      
      // Enhanced function to get group with icon
      getGroupsWithIcons: () => {
        const state = get();
        const lookup = {};
        state.groups.forEach(group => {
          lookup[group.id] = {
            name: group.name,
            icon: group.icon
          };
        });
        return lookup;
      },
      
      // Import groups from Adebis XML data
      importGroupsFromAdebis: (groupsFromXml) => set(produce((state) => {
        // Merge with existing groups, Adebis takes precedence
        
        Object.entries(groupsFromXml).forEach(([id, name]) => {
          const groupIndex = state.groups.findIndex(g => g.id === id);
          if (groupIndex !== -1) {
            // Update existing group name but keep custom icon
            state.groups[groupIndex].name = name;
          } else {
            // Add new group with appropriate icon based on name
            let icon = '👥'; // Default icon
            
            // Assign icons based on group name patterns
            const lowerName = name.toLowerCase();
            if (lowerName.includes('fuchs')) icon = '🦊';
            else if (lowerName.includes('bär') || lowerName.includes('baer')) icon = '🐻';
            else if (lowerName.includes('hase') || lowerName.includes('kaninchen')) icon = '🐰';
            else if (lowerName.includes('frosch')) icon = '🐸';
            else if (lowerName.includes('schmetterling')) icon = '🦋';
            else if (lowerName.includes('marienkäfer') || lowerName.includes('käfer')) icon = '🐞';
            else if (lowerName.includes('biene')) icon = '🐝';
            else if (lowerName.includes('schule') || lowerName.includes('schulkind')) icon = '🎒';
            else if (lowerName.includes('stern')) icon = '⭐';
            else if (lowerName.includes('sonne')) icon = '☀️';
            else if (lowerName.includes('mond')) icon = '🌙';
            else if (lowerName.includes('regenbogen')) icon = '🌈';
            else if (lowerName.includes('blume')) icon = '🌸';
            else if (lowerName.includes('baum')) icon = '🌳';
            
            state.groups.push({
              id,
              name,
              icon
            });
          }
        });
      })),
      
      // Clear all groups
      clearGroups: () => set({ groups: [] }),
      
      // Qualifications management
      qualifications: [], // Array of { key, name }

      addQualification: (qualification) => set(produce((state) => {
        // Prevent duplicates by key
        if (!state.qualifications.some(q => q.key === qualification.key)) {
          state.qualifications.push({ key: qualification.key, name: qualification.name });
        }
      })),

      updateQualification: (key, updates) => set(produce((state) => {
        const idx = state.qualifications.findIndex(q => q.key === key);
        if (idx !== -1) {
          state.qualifications[idx] = { ...state.qualifications[idx], ...updates };
        }
      })),

      deleteQualification: (key) => set(produce((state) => {
        state.qualifications = state.qualifications.filter(q => q.key !== key);
      })),

      setQualifications: (qualifications) => set({ qualifications }),

      getQualificationByKey: (key) => {
        const state = get();
        return state.qualifications.find(q => q.key === key);
      },

      // Import qualifications from employees (array of employee items)
      importQualificationsFromEmployees: (employees) => set(produce((state) => {
        const found = {};
        employees.forEach(emp => {
          const key = emp.parseddata?.qualification || '';
          if (key && !found[key]) {
            found[key] = true;
            // Try to keep display name if already present
            const existing = state.qualifications.find(q => q.key === key);
            state.qualifications.push({
              key,
              name: existing?.name || key
            });
          }
        });
        // Remove duplicates
        state.qualifications = state.qualifications.filter(
          (q, idx, arr) => arr.findIndex(qq => qq.key === q.key) === idx
        );
      })),
      
      // Clear all qualifications
      clearQualifications: () => set({ qualifications: [] }),

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
        groups: state.groups,
        qualifications: state.qualifications,
        selectedItem: state.selectedItem,
        lastImportAnonymized: state.lastImportAnonymized,
        scenarioSaveDialogOpen: state.scenarioSaveDialogOpen,
        // scenarioSaveDialogPending is not persisted
      })
    }
  )
);

export default useAppSettingsStore;
