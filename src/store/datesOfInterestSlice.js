import { createSlice } from '@reduxjs/toolkit';
import { buildOverlayAwareData } from '../utils/overlayUtils';

const initialState = {
  // Map of scenarioId -> Array of date strings
  datesByScenario: {}
};

/**
 * Calculates all "Dates of Interest" for a scenario.
 * These are dates where group assignments of children change.
 */
const calculateDatesOfInterest = (scenarioId, state) => {
  const overlayData = buildOverlayAwareData(scenarioId, state);
  const assignmentsByItem = overlayData.effectiveGroupAssignmentsByItem || {};
  
  const dates = new Set();
  
  Object.values(assignmentsByItem).forEach(itemAssignments => {
    Object.values(itemAssignments).forEach(assignment => {
      if (assignment.startdate) dates.add(assignment.startdate);
      if (assignment.enddate) dates.add(assignment.enddate);
    });
  });

  const enabledEvents = (state.events?.eventsByScenario?.[scenarioId] || []).filter(
    (event) => event.enabled !== false && event.effectiveDate
  );
  enabledEvents.forEach((event) => dates.add(event.effectiveDate));
  
  // Sort dates chronologically
  return Array.from(dates).sort();
};

const datesOfInterestSlice = createSlice({
  name: 'datesOfInterest',
  initialState,
  reducers: {
    refreshDates(state, action) {
      const { scenarioId, dates } = action.payload;
      state.datesByScenario[scenarioId] = dates;
    }
  }
});

export const { refreshDates } = datesOfInterestSlice.actions;

// Selector to get dates for a scenario
export const selectDatesOfInterest = (state, scenarioId) => 
  state.datesOfInterest.datesByScenario[scenarioId] || [];

// Thunk to update dates for current scenario
export const updateDatesOfInterest = (scenarioId) => (dispatch, getState) => {
  const dates = calculateDatesOfInterest(scenarioId, getState());
  dispatch(refreshDates({ scenarioId, dates }));
};

export default datesOfInterestSlice.reducer;
