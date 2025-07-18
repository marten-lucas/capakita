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
      setSelectedScenarioId: (id) => set({ selectedScenarioId: id }),
      addScenario: ({ name, remark = '', confidence = 50, likelihood = 50, baseScenarioId = null, simulationData = [] }) =>
        set(produce((state) => {
          const id = Date.now().toString();
          const uid = generateUID();
          // If this is a based scenario, don't store simulationData, only changes
          const scenarioData = baseScenarioId ? [] : simulationData;
          state.scenarios.push({ 
            id, 
            uid, 
            name, 
            remark, 
            confidence, 
            likelihood, 
            baseScenarioId, 
            simulationData: scenarioData,
            dataChanges: baseScenarioId ? {} : undefined // Track changes for based scenarios
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
          state.scenarios = state.scenarios.filter(s => s.id !== id);
          if (state.selectedScenarioId === id) {
            state.selectedScenarioId = state.scenarios.length > 0 ? state.scenarios[0].id : null;
          }
        })),
      setScenarios: (scenarios) => set({ scenarios }),
      getScenarioById: (id) => {
        const state = get();
        return state.scenarios.find(s => s.id === id);
      },
      // --- Simulation Data State and Methods (now per scenario) ---
      // Get effective simulation data (overlay changes on base scenario)
      getEffectiveSimulationData: () => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return [];
        
        // If it's a root scenario, return its data directly
        if (!scenario.baseScenarioId) {
          return scenario.simulationData || [];
        }
        
        // For based scenarios, overlay changes on base scenario data
        return get().computeOverlayData(scenario);
      },

      // Compute overlay data by applying changes to base scenario
      computeOverlayData: (scenario) => {
        const state = get();
        if (!scenario.baseScenarioId) {
          return scenario.simulationData || [];
        }
        
        const baseScenario = state.scenarios.find(s => s.id === scenario.baseScenarioId);
        if (!baseScenario) {
          console.warn(`Base scenario ${scenario.baseScenarioId} not found`);
          return [];
        }
        
        // Get base data (recursively if base scenario is also based)
        const baseData = baseScenario.baseScenarioId 
          ? get().computeOverlayData(baseScenario)
          : (baseScenario.simulationData || []);
        
        // Apply changes from current scenario
        const changes = scenario.dataChanges || {};
        const effectiveData = baseData.map(item => {
          const itemChanges = changes[item.id];
          if (!itemChanges) return item;
          
          // Apply modifications to the item
          const modifiedItem = { ...item };
          if (itemChanges.modifications) {
            modifiedItem.modifications = [...(item.modifications || []), ...itemChanges.modifications];
          }
          if (itemChanges.parseddata) {
            modifiedItem.parseddata = { ...item.parseddata, ...itemChanges.parseddata };
          }
          if (itemChanges.name !== undefined) {
            modifiedItem.name = itemChanges.name;
          }
          if (itemChanges.note !== undefined) {
            modifiedItem.note = itemChanges.note;
          }
          if (itemChanges.deleted) {
            return null; // Mark for deletion
          }
          
          return modifiedItem;
        }).filter(item => item !== null); // Remove deleted items
        
        // Add new items created in this scenario
        Object.values(changes).forEach(change => {
          if (change.isNew && change.item) {
            effectiveData.push(change.item);
          }
        });
        
        return effectiveData;
      },

      // Modified getSimulationData to use effective data
      getSimulationData: () => {
        return get().getEffectiveSimulationData();
      },

      // Track changes instead of directly modifying data for based scenarios
      trackItemChange: (itemId, changeType, changeData) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;
        
        // If it's a root scenario, modify data directly
        if (!scenario.baseScenarioId) {
          return; // Let existing methods handle root scenarios
        }
        
        // For based scenarios, track the change
        set(produce((draft) => {
          const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
          if (!draftScenario.dataChanges) {
            draftScenario.dataChanges = {};
          }
          if (!draftScenario.dataChanges[itemId]) {
            draftScenario.dataChanges[itemId] = {};
          }
          
          Object.assign(draftScenario.dataChanges[itemId], changeData);
        }));
      },

      // Modified setSimulationData for based scenarios
      setSimulationData: (data) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;
        
        // If it's a root scenario, set data directly
        if (!scenario.baseScenarioId) {
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (draftScenario) {
              draftScenario.simulationData = data;
            }
          }));
          return;
        }
        
        // For based scenarios, we don't set bulk data - this should not happen in normal flow
        console.warn('Cannot set bulk simulation data on based scenario');
      },
      clearAllData: () => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - clear data
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (draftScenario) {
              draftScenario.simulationData = [];
            }
          }));
        } else {
          // Based scenario - clear changes (revert to base)
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (draftScenario) {
              draftScenario.dataChanges = {};
            }
          }));
        }
      },
      // All item-related methods now operate on the selected scenario's simulationData
      addModification: (itemId, field, previousValue, newValue) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - modify directly
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            const item = draftScenario.simulationData.find((i) => i.id === itemId);
            if (item) {
              if (!item.modifications) {
                item.modifications = [];
              }
              item.modifications = item.modifications.filter(m => m.field !== field);
              if (previousValue !== newValue) {
                item.modifications.push({
                  field,
                  previousValue,
                  newValue,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'modification', {
            modifications: [{
              field,
              previousValue,
              newValue,
              timestamp: new Date().toISOString()
            }]
          });
        }
      },
      updateItemDates: (itemId, startDate, endDate) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            const item = draftScenario.simulationData.find((i) => i.id === itemId);
            if (item) {
              if (!item.modifications) {
                item.modifications = [];
              }
              if (item.parseddata.startdate !== startDate) {
                item.modifications = item.modifications.filter(m => m.field !== 'startdate');
                if (item.originalParsedData.startdate !== startDate) {
                  item.modifications.push({
                    field: 'startdate',
                    previousValue: item.originalParsedData.startdate,
                    newValue: startDate,
                    timestamp: new Date().toISOString()
                  });
                }
              }
              if (item.parseddata.enddate !== endDate) {
                item.modifications = item.modifications.filter(m => m.field !== 'enddate');
                if (item.originalParsedData.enddate !== endDate) {
                  item.modifications.push({
                    field: 'enddate',
                    previousValue: item.originalParsedData.enddate,
                    newValue: endDate,
                    timestamp: new Date().toISOString()
                  });
                }
              }
              item.parseddata.startdate = startDate;
              item.parseddata.enddate = endDate;
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'dates', {
            parseddata: { startdate: startDate, enddate: endDate }
          });
        }
      },
      getItemDates: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        if (!item) {
          console.error(`Item with ID ${itemId} not found in effective simulation data`);
          return null;
        }
        return item.parseddata ? { startdate: item.parseddata.startdate, enddate: item.parseddata.enddate } : null;
      },
      updateItemPausedState: (itemId, enabled, start, end) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            const item = draftScenario.simulationData.find((i) => i.id === itemId);
            if (item) {
              const previousValue = JSON.stringify(item.parseddata.paused || { enabled: false, start: '', end: '' });
              const newValue = JSON.stringify({ enabled, start, end });
              item.parseddata.paused = { enabled, start, end };
              if (!item.modifications) {
                item.modifications = [];
              }
              item.modifications = item.modifications.filter(m => m.field !== 'paused');
              if (previousValue !== newValue) {
                item.modifications.push({
                  field: 'paused',
                  previousValue,
                  newValue,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'paused', {
            parseddata: { paused: { enabled, start, end } }
          });
        }
      },
      getItemPausedState: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        return item?.parseddata?.paused || { enabled: false, start: '', end: '' };
      },
      updateItemBookings: (itemId, bookings) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            const item = draftScenario.simulationData.find((i) => i.id === itemId);
            if (item) {
              const previousValue = JSON.stringify(item.parseddata.booking);
              const bookingsWithIds = bookings.map((booking, bookingIdx) => ({
                ...booking,
                times: booking.times?.map((timeEntry) => ({
                  ...timeEntry,
                  segments: timeEntry.segments?.map((segment) => ({
                    ...segment,
                    id: segment.id || `${itemId}-${bookingIdx}-${timeEntry.day_name}-${Date.now()}-${Math.random()}`
                  }))
                }))
              }));
              const currentSegmentIds = new Set();
              bookingsWithIds.forEach(booking => {
                booking.times?.forEach(timeEntry => {
                  timeEntry.segments?.forEach(segment => {
                    if (segment.id) {
                      currentSegmentIds.add(segment.id);
                    }
                  });
                });
              });
              if (item.parseddata.group) {
                item.parseddata.group = item.parseddata.group.map(group => {
                  if (group.segmentOverrides) {
                    const cleanedOverrides = {};
                    Object.keys(group.segmentOverrides).forEach(segmentId => {
                      if (currentSegmentIds.has(segmentId)) {
                        cleanedOverrides[segmentId] = group.segmentOverrides[segmentId];
                      }
                    });
                    return { ...group, segmentOverrides: cleanedOverrides };
                  }
                  return group;
                });
              }
              const newValue = JSON.stringify(bookingsWithIds);
              if (!item.modifications) {
                item.modifications = [];
              }
              item.modifications = item.modifications.filter(m => m.field !== 'bookings');
              if (previousValue !== newValue) {
                item.modifications.push({
                  field: 'bookings',
                  previousValue,
                  newValue,
                  timestamp: new Date().toISOString()
                });
              }
              item.parseddata.booking = bookingsWithIds;
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'bookings', {
            parseddata: { booking: bookings }
          });
        }
      },
      getItemBookings: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        return item?.parseddata?.booking || [];
      },
      updateItemGroups: (itemId, groups) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            const item = draftScenario.simulationData.find((i) => i.id === itemId);
            if (item) {
              const previousValue = JSON.stringify(item.parseddata.group);
              const newValue = JSON.stringify(groups);
              if (!item.modifications) {
                item.modifications = [];
              }
              item.modifications = item.modifications.filter(m => m.field !== 'groups');
              if (previousValue !== newValue) {
                item.modifications.push({
                  field: 'groups',
                  previousValue,
                  newValue,
                  timestamp: new Date().toISOString()
                });
              }
              item.parseddata.group = groups;
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'groups', {
            parseddata: { group: groups }
          });
        }
      },
      getItemGroups: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        return item?.parseddata?.group || [];
      },
      updateItemName: (itemId, newName) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            if (Array.isArray(draftScenario.simulationData)) {
              const item = draftScenario.simulationData.find((i) => i.id === itemId);
              if (item) {
                item.name = newName;
              }
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'name', { name: newName });
        }
      },
      getItemName: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        return item && typeof item.name === 'string' ? item.name : '';
      },
      updateItemNote: (itemId, newNote) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            if (Array.isArray(draftScenario.simulationData)) {
              const item = draftScenario.simulationData.find((i) => i.id === itemId);
              if (item) {
                item.note = newNote;
              }
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'note', { note: newNote });
        }
      },
      getItemNote: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        return item && typeof item.note === 'string' ? item.note : '';
      },
      updateItemGeburtsdatum: (itemId, geburtsdatum) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            const item = draftScenario.simulationData.find((i) => i.id === itemId);
            if (item) {
              const previousValue = item.parseddata.geburtsdatum;
              item.parseddata.geburtsdatum = geburtsdatum;
              if (!item.modifications) {
                item.modifications = [];
              }
              item.modifications = item.modifications.filter(m => m.field !== 'geburtsdatum');
              if (previousValue !== geburtsdatum) {
                item.modifications.push({
                  field: 'geburtsdatum',
                  previousValue,
                  newValue: geburtsdatum,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'geburtsdatum', {
            parseddata: { geburtsdatum }
          });
        }
      },
      getItemGeburtsdatum: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        return item?.parseddata?.geburtsdatum || '';
      },
      updateItemQualification: (itemId, qualification) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            const item = draftScenario.simulationData.find((i) => i.id === itemId);
            if (item) {
              const previousValue = item.parseddata.qualification;
              item.parseddata.qualification = qualification;
              if (!item.modifications) {
                item.modifications = [];
              }
              item.modifications = item.modifications.filter(m => m.field !== 'qualification');
              if (previousValue !== qualification) {
                item.modifications.push({
                  field: 'qualification',
                  previousValue,
                  newValue: qualification,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'qualification', {
            parseddata: { qualification }
          });
        }
      },
      getItemQualification: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        return item?.parseddata?.qualification || '';
      },
      deleteItem: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - existing implementation
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!draftScenario) return;
            draftScenario.simulationData = draftScenario.simulationData.filter(item => item.id !== itemId);
          }));
        } else {
          // Based scenario - mark as deleted
          get().trackItemChange(itemId, 'delete', { deleted: true });
        }
      },
      // Method to add new items to based scenarios
      addItemToScenario: (newItem) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;

        if (!scenario.baseScenarioId) {
          // Root scenario - add directly
          set(produce((draft) => {
            const draftScenario = draft.scenarios.find(s => s.id === state.selectedScenarioId);
            if (draftScenario) {
              draftScenario.simulationData.push(newItem);
            }
          }));
        } else {
          // Based scenario - track as new item
          get().trackItemChange(newItem.id, 'add', {
            isNew: true,
            item: newItem
          });
        }
      },
    }),
    {
      name: 'sim-scenario-storage',
      partialize: (state) => ({
        scenarios: state.scenarios,
        selectedScenarioId: state.selectedScenarioId
      })
    }
  )
);

export default useSimScenarioStore;
