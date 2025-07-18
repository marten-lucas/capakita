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
          state.scenarios.push({ id, uid, name, remark, confidence, likelihood, baseScenarioId, simulationData });
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
      getSimulationData: () => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        return scenario?.simulationData || [];
      },
      setSimulationData: (data) => {
        set(produce((state) => {
          const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
          if (scenario) {
            scenario.simulationData = data;
          }
        }));
      },
      clearAllData: () => {
        set(produce((state) => {
          const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
          if (scenario) {
            scenario.simulationData = [];
          }
        }));
      },
      // All item-related methods now operate on the selected scenario's simulationData
      addModification: (itemId, field, previousValue, newValue) => {
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            const item = scenario.simulationData.find((i) => i.id === itemId);
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
          })
        );
      },
      updateItemDates: (itemId, startDate, endDate) =>
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            const item = scenario.simulationData.find((i) => i.id === itemId);
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
          })
        ),
      getItemDates: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return null;
        const item = scenario.simulationData.find((i) => i.id === itemId);
        if (!item) {
          console.error(`Item with ID ${itemId} not found in simulationData`);
          return null;
        }
        return item.parseddata ? { startdate: item.parseddata.startdate, enddate: item.parseddata.enddate } : null;
      },
      updateItemPausedState: (itemId, enabled, start, end) =>
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            const item = scenario.simulationData.find((i) => i.id === itemId);
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
          })
        ),
      getItemPausedState: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return { enabled: false, start: '', end: '' };
        const item = scenario.simulationData.find((i) => i.id === itemId);
        return item?.parseddata?.paused || { enabled: false, start: '', end: '' };
      },
      updateItemBookings: (itemId, bookings) =>
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            const item = scenario.simulationData.find((i) => i.id === itemId);
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
          })
        ),
      getItemBookings: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return [];
        const item = scenario.simulationData.find((i) => i.id === itemId);
        return item?.parseddata?.booking || [];
      },
      updateItemGroups: (itemId, groups) =>
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            const item = scenario.simulationData.find((i) => i.id === itemId);
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
          })
        ),
      getItemGroups: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return [];
        const item = scenario.simulationData.find((i) => i.id === itemId);
        return item?.parseddata?.group || [];
      },
      updateItemName: (itemId, newName) => {
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            if (Array.isArray(scenario.simulationData)) {
              const item = scenario.simulationData.find((i) => i.id === itemId);
              if (item) {
                item.name = newName;
              }
            }
          })
        );
      },
      getItemName: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return '';
        const items = scenario.simulationData ?? [];
        const item = items.find((i) => i.id === itemId);
        return item && typeof item.name === 'string' ? item.name : '';
      },
      updateItemNote: (itemId, newNote) => {
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            if (Array.isArray(scenario.simulationData)) {
              const item = scenario.simulationData.find((i) => i.id === itemId);
              if (item) {
                item.note = newNote;
              }
            }
          })
        );
      },
      getItemNote: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return '';
        const items = scenario.simulationData ?? [];
        const item = items.find((i) => i.id === itemId);
        return item && typeof item.note === 'string' ? item.note : '';
      },
      updateItemGeburtsdatum: (itemId, geburtsdatum) => {
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            const item = scenario.simulationData.find((i) => i.id === itemId);
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
          })
        );
      },
      getItemGeburtsdatum: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return '';
        const item = scenario.simulationData.find((i) => i.id === itemId);
        return item?.parseddata?.geburtsdatum || '';
      },
      updateItemQualification: (itemId, qualification) => {
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            const item = scenario.simulationData.find((i) => i.id === itemId);
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
          })
        );
      },
      getItemQualification: (itemId) => {
        const state = get();
        const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
        if (!scenario) return '';
        const item = scenario.simulationData.find((i) => i.id === itemId);
        return item?.parseddata?.qualification || '';
      },
      deleteItem: (itemId) => {
        set(
          produce((state) => {
            const scenario = state.scenarios.find(s => s.id === state.selectedScenarioId);
            if (!scenario) return;
            scenario.simulationData = scenario.simulationData.filter(item => item.id !== itemId);
          })
        );
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
