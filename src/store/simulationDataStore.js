import { create } from 'zustand';
import { produce } from 'immer';

const useSimulationDataStore = create((set, get) => ({
  simulationData: [], // Removed localStorage loading
  groupsLookup: {}, // Removed localStorage loading

  setSimulationData: (data) => {
    set({ simulationData: data });
  },
  setGroupsLookup: (lookup) => {
    set({ groupsLookup: lookup });
  },
  clearAllData: () => {
    set({ simulationData: [], groupsLookup: {} });
  },

  // Helper function to add modification to item
  addModification: (itemId, field, previousValue, newValue) => {
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          if (!item.modifications) {
            item.modifications = [];
          }
          // Remove any existing modification for this field
          item.modifications = item.modifications.filter(m => m.field !== field);
          // Add new modification if values are different
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
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          if (!item.modifications) {
            item.modifications = [];
          }
          // Track startdate modification
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
          // Track enddate modification
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
    const item = state.simulationData.find((i) => i.id === itemId);
    if (!item) {
      console.error(`Item with ID ${itemId} not found in simulationData`);
      return null;
    }
    return item.parseddata ? { startdate: item.parseddata.startdate, enddate: item.parseddata.enddate } : null;
  },

  updateItemPausedState: (itemId, enabled, start, end) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          const previousValue = JSON.stringify(item.parseddata.paused || { enabled: false, start: '', end: '' });
          const newValue = JSON.stringify({ enabled, start, end });
          
          item.parseddata.paused = { enabled, start, end };
          
          // Track modification
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
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.paused || { enabled: false, start: '', end: '' };
  },

  updateItemBookings: (itemId, bookings) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          const previousValue = JSON.stringify(item.parseddata.booking);
          
          // Ensure all segments have unique IDs and create deep copies to avoid mutation
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
          
          // Get all current segment IDs
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
          
          // Clean up segment overrides in groups for deleted segments
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
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.booking || [];
  },

  updateItemGroups: (itemId, groups) =>
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
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
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.group || [];
  },

  updateItemName: (itemId, newName) => {
    set(
      produce((state) => {
        if (Array.isArray(state.simulationData)) {
          const item = state.simulationData.find((i) => i.id === itemId);
          if (item) {
            item.name = newName;
          }
        }
      })
    );
  },
  getItemName: (itemId) => {
    const state = get();
    const items = state.simulationData ?? [];
    const item = items.find((i) => i.id === itemId);
    return item && typeof item.name === 'string' ? item.name : '';
  },

  updateItemNote: (itemId, newNote) => {
    set(
      produce((state) => {
        if (Array.isArray(state.simulationData)) {
          const item = state.simulationData.find((i) => i.id === itemId);
          if (item) {
            item.note = newNote;
          }
        }
      })
    );
  },
  getItemNote: (itemId) => {
    const state = get();
    const items = state.simulationData ?? [];
    const item = items.find((i) => i.id === itemId);
    return item && typeof item.note === 'string' ? item.note : '';
  },

  updateItemGeburtsdatum: (itemId, geburtsdatum) => {
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          const previousValue = item.parseddata.geburtsdatum;
          item.parseddata.geburtsdatum = geburtsdatum;
          
          // Track modification
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
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.geburtsdatum || '';
  },

  updateItemQualification: (itemId, qualification) => {
    set(
      produce((state) => {
        const item = state.simulationData.find((i) => i.id === itemId);
        if (item) {
          const previousValue = item.parseddata.qualification;
          item.parseddata.qualification = qualification;
          
          // Track modification
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
    const item = state.simulationData.find((i) => i.id === itemId);
    return item?.parseddata?.qualification || '';
  },

  deleteItem: (itemId) => {
    set(
      produce((state) => {
        state.simulationData = state.simulationData.filter(item => item.id !== itemId);
        // Clear selected item if it was the deleted item
      })
    );
  },
}));

export default useSimulationDataStore;