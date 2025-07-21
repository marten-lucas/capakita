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
      selectedItem: null,
      lastImportAnonymized: true,
      
      setSelectedScenarioId: (id) => set({ selectedScenarioId: id }),
      setSelectedItem: (item) => set({ selectedItem: item }),
      setLastImportAnonymized: (value) => set({ lastImportAnonymized: value }),

      // Get original value for a field (handles both root and based scenarios)
      getOriginalValue: (itemId, field) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return undefined;

        // For root scenarios, get from originalParsedData
        if (!scenario.baseScenarioId) {
          const item = scenario.simulationData?.find(i => i.id === itemId);
          if (!item) return undefined;
          
          // Handle nested field paths like "booking-0-startdate"
          if (field.includes('-')) {
            const parts = field.split('-');
            if (parts[0] === 'booking' && parts.length >= 3) {
              const bookingIndex = parseInt(parts[1]);
              const bookingField = parts[2];
              const originalBookings = item.originalParsedData?.booking;
              if (Array.isArray(originalBookings) && originalBookings[bookingIndex]) {
                return originalBookings[bookingIndex][bookingField];
              }
            }
            if (parts[0] === 'group' && parts.length >= 2) {
              const groupIndex = parseInt(parts[1]);
              const originalGroups = item.originalParsedData?.group;
              if (Array.isArray(originalGroups) && originalGroups[groupIndex]) {
                if (parts.length === 2) return originalGroups[groupIndex];
                const groupField = parts[2];
                return originalGroups[groupIndex][groupField];
              }
            }
          }
          
          // Handle simple fields
          switch (field) {
            case 'startdate':
            case 'enddate':
            case 'geburtsdatum':
            case 'qualification':
              return item.originalParsedData?.[field];
            case 'bookings':
              return item.originalParsedData?.booking;
            case 'groups':
              return item.originalParsedData?.group;
            default:
              return item.originalParsedData?.[field];
          }
        }

        // For based scenarios, get from base scenario data
        const baseScenario = state.scenarios.find(s => s.id === scenario.baseScenarioId);
        if (!baseScenario) return undefined;

        const baseData = baseScenario.baseScenarioId 
          ? get().computeOverlayData(baseScenario)
          : (baseScenario.simulationData || []);
        
        const baseItem = baseData.find(i => i.id === itemId);
        if (!baseItem) return undefined;

        // Handle nested field paths
        if (field.includes('-')) {
          const parts = field.split('-');
          if (parts[0] === 'booking' && parts.length >= 3) {
            const bookingIndex = parseInt(parts[1]);
            const bookingField = parts[2];
            const baseBookings = baseItem.parseddata?.booking;
            if (Array.isArray(baseBookings) && baseBookings[bookingIndex]) {
              return baseBookings[bookingIndex][bookingField];
            }
          }
          if (parts[0] === 'group' && parts.length >= 2) {
            const groupIndex = parseInt(parts[1]);
            const baseGroups = baseItem.parseddata?.group;
            if (Array.isArray(baseGroups) && baseGroups[groupIndex]) {
              if (parts.length === 2) return baseGroups[groupIndex];
              const groupField = parts[2];
              return baseGroups[groupIndex][groupField];
            }
          }
        }

        // Handle simple fields
        switch (field) {
          case 'startdate':
          case 'enddate':
          case 'geburtsdatum':
          case 'qualification':
            return baseItem.parseddata?.[field];
          case 'bookings':
            return baseItem.parseddata?.booking;
          case 'groups':
            return baseItem.parseddata?.group;
          default:
            return baseItem.parseddata?.[field];
        }
      },

      // Check if field is modified (pure function, no state updates)
      isFieldModified: (itemId, field, currentValue, originalValue) => {
        const computedOriginalValue = originalValue !== undefined 
          ? originalValue 
          : get().getOriginalValue(itemId, field);
        return JSON.stringify(currentValue) !== JSON.stringify(computedOriginalValue);
      },

      addScenario: ({
        name,
        remark = '',
        confidence = 50,
        likelihood = 50,
        desirability = 50,
        baseScenarioId = null,
        simulationData = [],
        imported = false,
        importedAnonymized = false,
        organisation = undefined // allow explicit organisation
      }) =>
        set(produce((state) => {
          const id = Date.now().toString();
          const uid = generateUID();
          const scenarioData = baseScenarioId ? [] : simulationData;
          // Ensure organisation property is always present
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
            simulationData: scenarioData,
            dataChanges: baseScenarioId ? {} : undefined,
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
          
          // Collect all descendant scenario IDs for deletion
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
          
          // Update selectedScenarioId if needed
          if (idsToDelete.includes(state.selectedScenarioId)) {
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
      updateItemAbsenceState: (itemId, enabled, start, end) => {
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
              const previousValue = JSON.stringify(item.parseddata.absence || { enabled: false, start: '', end: '' });
              const newValue = JSON.stringify({ enabled, start, end });
              item.parseddata.absence = { enabled, start, end };
              if (!item.modifications) {
                item.modifications = [];
              }
              item.modifications = item.modifications.filter(m => m.field !== 'absence');
              if (previousValue !== newValue) {
                item.modifications.push({
                  field: 'absence',
                  previousValue,
                  newValue,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }));
        } else {
          // Based scenario - track change
          get().trackItemChange(itemId, 'absence', {
            parseddata: { absence: { enabled, start, end } }
          });
        }
      },
      getItemAbsenceState: (itemId) => {
        const effectiveData = get().getEffectiveSimulationData();
        const item = effectiveData.find((i) => i.id === itemId);
        return item?.parseddata?.absence || { enabled: false, start: '', end: '' };
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
      // Utility: Check if saving is allowed (all imports anonymized or no imports)
      isSaveAllowed: () => {
        const scenarios = get().scenarios;
        if (!scenarios || scenarios.length === 0) return true;
        const imported = scenarios.filter(s => s.imported);
        if (imported.length === 0) return true;
        return imported.every(s => s.importedAnonymized);
      },
      importScenario: () => {
        // ...existing import logic...

        // REMOVE: Extract unique group names from simulationData and update AppSettingsStore
        // REMOVE: const groupNamesSet = new Set();
        // REMOVE: scenario.simulationData.forEach(item => { ... });
        // REMOVE: const addGroup = useAppSettingsStore.getState().addGroup;
        // REMOVE: groupNamesSet.forEach(groupName => { addGroup(groupName); });

        // ...rest of import logic (add scenario to store)...
      },
      // --- Organisation State per Scenario ---
      // Get groupdefs for selected scenario
      getGroupDefs: () => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        return scenario?.organisation?.groupdefs || [];
      },
      // Get qualidefs for selected scenario
      getQualiDefs: () => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        return scenario?.organisation?.qualidefs || [];
      },
      // Add group to selected scenario
      addGroupDef: (group) => set(produce((state) => {
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;
        if (!scenario.organisation) scenario.organisation = {};
        if (!scenario.organisation.groupdefs) scenario.organisation.groupdefs = [];
        // Prevent duplicate by id
        if (!scenario.organisation.groupdefs.some(g => g.id === group.id)) {
          scenario.organisation.groupdefs.push(group);
        }
      })),
      // Update group in selected scenario
      updateGroupDef: (id, updates) => set(produce((state) => {
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario?.organisation?.groupdefs) return;
        const idx = scenario.organisation.groupdefs.findIndex(g => g.id === id);
        if (idx !== -1) {
          scenario.organisation.groupdefs[idx] = { ...scenario.organisation.groupdefs[idx], ...updates };
        }
      })),
      // Delete group from selected scenario
      deleteGroupDef: (id) => set(produce((state) => {
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario?.organisation?.groupdefs) return;
        scenario.organisation.groupdefs = scenario.organisation.groupdefs.filter(g => g.id !== id);
      })),
      // Set all groups for selected scenario
      setGroupDefs: (groups) => set(produce((state) => {
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;
        if (!scenario.organisation) scenario.organisation = {};
        scenario.organisation.groupdefs = groups;
      })),
      // Add qualification to selected scenario
      addQualiDef: (quali) => set(produce((state) => {
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;
        if (!scenario.organisation) scenario.organisation = {};
        if (!scenario.organisation.qualidefs) scenario.organisation.qualidefs = [];
        // Prevent duplicate by key
        if (!scenario.organisation.qualidefs.some(q => q.key === quali.key)) {
          scenario.organisation.qualidefs.push(quali);
        }
      })),
      // Update qualification in selected scenario
      updateQualiDef: (key, updates) => set(produce((state) => {
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario?.organisation?.qualidefs) return;
        const idx = scenario.organisation.qualidefs.findIndex(q => q.key === key);
        if (idx !== -1) {
          scenario.organisation.qualidefs[idx] = { ...scenario.organisation.qualidefs[idx], ...updates };
        }
      })),
      // Delete qualification from selected scenario
      deleteQualiDef: (key) => set(produce((state) => {
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario?.organisation?.qualidefs) return;
        scenario.organisation.qualidefs = scenario.organisation.qualidefs.filter(q => q.key !== key);
      })),
      // Set all qualifications for selected scenario
      setQualiDefs: (qualis) => set(produce((state) => {
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return;
        if (!scenario.organisation) scenario.organisation = {};
        scenario.organisation.qualidefs = qualis;
      })),
    }),
    {
      name: 'sim-scenario-storage',
      partialize: (state) => ({
        scenarios: state.scenarios,
        selectedScenarioId: state.selectedScenarioId,
        selectedItem: state.selectedItem,
        lastImportAnonymized: state.lastImportAnonymized
      })
    }
  )
);

export default useSimScenarioStore;

