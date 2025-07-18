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
    }),
    {
      name: 'app-settings-storage',
      partialize: (state) => ({
        groups: state.groups
      })
    }
  )
);

export default useAppSettingsStore;
