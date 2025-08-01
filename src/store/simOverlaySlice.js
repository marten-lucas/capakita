import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Structure: { [scenarioId]: { dataItems: { [itemId]: overlayData }, groupDefs: [...], qualificationDefs: [...], etc. } }
  overlaysByScenario: {},
};

const simOverlaySlice = createSlice({
  name: 'simOverlay',
  initialState,
  reducers: {
    setDataItemOverlay(state, action) {
      const { scenarioId, itemId, overlayData } = action.payload;
      if (!state.overlaysByScenario[scenarioId]) {
        state.overlaysByScenario[scenarioId] = { dataItems: {} };
      }
      if (!state.overlaysByScenario[scenarioId].dataItems) {
        state.overlaysByScenario[scenarioId].dataItems = {};
      }
      state.overlaysByScenario[scenarioId].dataItems[itemId] = overlayData;
    },
    removeDataItemOverlay(state, action) {
      const { scenarioId, itemId } = action.payload;
      if (state.overlaysByScenario[scenarioId]?.dataItems) {
        delete state.overlaysByScenario[scenarioId].dataItems[itemId];
        // Clean up empty overlay structure
        if (Object.keys(state.overlaysByScenario[scenarioId].dataItems).length === 0) {
          delete state.overlaysByScenario[scenarioId].dataItems;
          if (Object.keys(state.overlaysByScenario[scenarioId]).length === 0) {
            delete state.overlaysByScenario[scenarioId];
          }
        }
      }
    },
    setBookingOverlay(state, action) {
      const { scenarioId, itemId, bookingId, overlayData } = action.payload;
      if (!state.overlaysByScenario[scenarioId]) {
        state.overlaysByScenario[scenarioId] = { bookings: {} };
      }
      if (!state.overlaysByScenario[scenarioId].bookings) {
        state.overlaysByScenario[scenarioId].bookings = {};
      }
      if (!state.overlaysByScenario[scenarioId].bookings[itemId]) {
        state.overlaysByScenario[scenarioId].bookings[itemId] = {};
      }
      state.overlaysByScenario[scenarioId].bookings[itemId][bookingId] = overlayData;
    },
    removeBookingOverlay(state, action) {
      const { scenarioId, itemId, bookingId } = action.payload;
      if (state.overlaysByScenario[scenarioId]?.bookings?.[itemId]) {
        delete state.overlaysByScenario[scenarioId].bookings[itemId][bookingId];
        // Clean up empty structures
        if (Object.keys(state.overlaysByScenario[scenarioId].bookings[itemId]).length === 0) {
          delete state.overlaysByScenario[scenarioId].bookings[itemId];
          if (Object.keys(state.overlaysByScenario[scenarioId].bookings).length === 0) {
            delete state.overlaysByScenario[scenarioId].bookings;
            if (Object.keys(state.overlaysByScenario[scenarioId]).length === 0) {
              delete state.overlaysByScenario[scenarioId];
            }
          }
        }
      }
    },
    setGroupDefOverlay(state, action) {
      const { scenarioId, overlayData } = action.payload;
      if (!state.overlaysByScenario[scenarioId]) {
        state.overlaysByScenario[scenarioId] = {};
      }
      state.overlaysByScenario[scenarioId].groupDefs = overlayData;
    },
    removeGroupDefOverlay(state, action) {
      const { scenarioId } = action.payload;
      if (state.overlaysByScenario[scenarioId]) {
        delete state.overlaysByScenario[scenarioId].groupDefs;
        if (Object.keys(state.overlaysByScenario[scenarioId]).length === 0) {
          delete state.overlaysByScenario[scenarioId];
        }
      }
    },
    setQualificationDefOverlay(state, action) {
      const { scenarioId, overlayData } = action.payload;
      if (!state.overlaysByScenario[scenarioId]) {
        state.overlaysByScenario[scenarioId] = {};
      }
      if (!state.overlaysByScenario[scenarioId].qualificationDefs) {
        state.overlaysByScenario[scenarioId].qualificationDefs = [];
      }

      // Merge or replace the overlay data
      state.overlaysByScenario[scenarioId].qualificationDefs = overlayData;
    },
    removeQualificationDefOverlay(state, action) {
      const { scenarioId } = action.payload;
      if (state.overlaysByScenario[scenarioId]) {
        delete state.overlaysByScenario[scenarioId].qualificationDefs;
        if (Object.keys(state.overlaysByScenario[scenarioId]).length === 0) {
          delete state.overlaysByScenario[scenarioId];
        }
      }
    },
    deleteAllOverlaysForScenario(state, action) {
      const { scenarioId } = action.payload;
      delete state.overlaysByScenario[scenarioId];
    },
    loadOverlaysByScenario(state, action) {
      state.overlaysByScenario = action.payload || {};
    },
    setGroupAssignmentOverlay(state, action) {
      const { scenarioId, itemId, groupId, overlayData } = action.payload;
      if (!state.overlaysByScenario[scenarioId]) {
        state.overlaysByScenario[scenarioId] = {};
      }
      if (!state.overlaysByScenario[scenarioId].groupassignments) {
        state.overlaysByScenario[scenarioId].groupassignments = {};
      }
      if (!state.overlaysByScenario[scenarioId].groupassignments[itemId]) {
        state.overlaysByScenario[scenarioId].groupassignments[itemId] = {};
      }
      state.overlaysByScenario[scenarioId].groupassignments[itemId][groupId] = overlayData;
    },
    removeGroupAssignmentOverlay(state, action) {
      const { scenarioId, itemId, groupId } = action.payload;
      if (
        state.overlaysByScenario[scenarioId]?.groupassignments?.[itemId]?.[groupId]
      ) {
        delete state.overlaysByScenario[scenarioId].groupassignments[itemId][groupId];
        // Clean up empty structures
        if (
          Object.keys(state.overlaysByScenario[scenarioId].groupassignments[itemId]).length === 0
        ) {
          delete state.overlaysByScenario[scenarioId].groupassignments[itemId];
          if (
            Object.keys(state.overlaysByScenario[scenarioId].groupassignments).length === 0
          ) {
            delete state.overlaysByScenario[scenarioId].groupassignments;
            if (Object.keys(state.overlaysByScenario[scenarioId]).length === 0) {
              delete state.overlaysByScenario[scenarioId];
            }
          }
        }
      }
    },
    setFinancialOverlay(state, action) {
      const { scenarioId, itemId, financialId, overlayData } = action.payload;
      if (!state.overlaysByScenario[scenarioId]) {
        state.overlaysByScenario[scenarioId] = {};
      }
      if (!state.overlaysByScenario[scenarioId].financials) {
        state.overlaysByScenario[scenarioId].financials = {};
      }
      if (!state.overlaysByScenario[scenarioId].financials[itemId]) {
        state.overlaysByScenario[scenarioId].financials[itemId] = {};
      }
      state.overlaysByScenario[scenarioId].financials[itemId][financialId] = overlayData;
    },
    removeFinancialOverlay(state, action) {
      const { scenarioId, itemId, financialId } = action.payload;
      if (state.overlaysByScenario[scenarioId]?.financials?.[itemId]) {
        delete state.overlaysByScenario[scenarioId].financials[itemId][financialId];
        if (Object.keys(state.overlaysByScenario[scenarioId].financials[itemId]).length === 0) {
          delete state.overlaysByScenario[scenarioId].financials[itemId];
          if (Object.keys(state.overlaysByScenario[scenarioId].financials).length === 0) {
            delete state.overlaysByScenario[scenarioId].financials;
            if (Object.keys(state.overlaysByScenario[scenarioId]).length === 0) {
              delete state.overlaysByScenario[scenarioId];
            }
          }
        }
      }
    },
  },
});

export const {
  setDataItemOverlay,
  removeDataItemOverlay,
  setBookingOverlay,
  removeBookingOverlay,
  setGroupDefOverlay,
  removeGroupDefOverlay,
  setQualificationDefOverlay,
  removeQualificationDefOverlay,
  deleteAllOverlaysForScenario,
  loadOverlaysByScenario,
  setGroupAssignmentOverlay,
  removeGroupAssignmentOverlay,
  setFinancialOverlay,
  removeFinancialOverlay,
} = simOverlaySlice.actions;

export default simOverlaySlice.reducer;
