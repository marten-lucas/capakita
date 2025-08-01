import { createSlice } from '@reduxjs/toolkit';
import { calculateChartDataWeekly } from '../utils/chartUtilsWeekly';
import { calculateChartDataMidterm, generateMidtermCategories } from '../utils/chartUtilsMidterm';
import { buildOverlayAwareData } from '../utils/overlayUtils';

// Helper for initial chart state per scenario
function getInitialChartState() {
  return {
    referenceDate: new Date().toISOString().slice(0, 10),
    timedimension: 'month',
    chartToggles: ['weekly', 'midterm'],
    filter: {
      Groups: [],
      Qualifications: [],
    },
    chartData: {
      weekly: {
        categories: [],
        demand: [],
        maxdemand: "",
        capacity: [],
        maxcapacity: "",
        care_ratio: [],
        max_care_ratio: "",
        expert_ratio: [],
        maxexpert_ratio: "100"
      },
      midterm: {
        categories: [],
      }
    }
  };
}

const initialState = {
};

const chartSlice = createSlice({
  name: 'chart',
  initialState,
  reducers: {
    // Ensure scenario state exists
    ensureScenario(state, action) {
      const scenarioId = action.payload;
      if (!state[scenarioId]) {
        state[scenarioId] = getInitialChartState();
      }
    },
    setReferenceDate(state, action) {
      const { scenarioId, date } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].referenceDate = date;
    },
    setTimedimension(state, action) {
      const { scenarioId, timedimension } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].timedimension = timedimension;
    },
    setChartToggles(state, action) {
      const { scenarioId, toggles } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].chartToggles = toggles;
    },
    setFilterGroups(state, action) {
      const { scenarioId, groups } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].filter.Groups = groups;
    },
    setFilterQualifications(state, action) {
      const { scenarioId, qualifications } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].filter.Qualifications = qualifications;
    },
    setChartData(state, action) {
      const { scenarioId, chartType, data } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].chartData[chartType] = data;
    },
    // Optionally, add a reset for a scenario
    resetScenarioChart(state, action) {
      const scenarioId = action.payload;
      state[scenarioId] = getInitialChartState();
    },
    // Add cleanup reducer for deleted scenarios
    deleteScenarioChart(state, action) {
      const scenarioId = action.payload;
      delete state[scenarioId];
    }
  },
  extraReducers: (builder) => {
    // Listen to scenario deletion from other slices
    builder.addCase('simScenario/deleteScenario', (state, action) => {
      const scenarioId = String(action.payload);
      delete state[scenarioId];
    });
  }
});


// Thunk to update weekly chart data for a scenario
export const updateWeeklyChartData = (scenarioId) => (dispatch, getState) => {
  const state = getState();
  const chartState = state.chart[scenarioId] || {};
  const referenceDate = chartState.referenceDate || '';
  const selectedGroups = [...(chartState.filter?.Groups || [])];
  const selectedQualifications = [...(chartState.filter?.Qualifications || [])];

  // Use utility to build overlay-aware data
  const {
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    effectiveQualificationAssignmentsByItem,
    effectiveGroupDefs,
    effectiveQualificationDefs
  } = buildOverlayAwareData(scenarioId, state);

  // Wrap by scenarioId for chartUtils compatibility
  const bookingsByScenarioWrapped = { [scenarioId]: effectiveBookingsByItem };
  const groupsByScenarioWrapped = { [scenarioId]: effectiveGroupAssignmentsByItem };
  const qualificationAssignmentsByScenarioWrapped = { [scenarioId]: effectiveQualificationAssignmentsByItem };
  const dataByScenarioWrapped = { [scenarioId]: effectiveDataItems };

  // Pass overlay-aware data to chart utils
  let chartData;
  try {
    chartData = calculateChartDataWeekly(
      referenceDate,
      selectedGroups,
      selectedQualifications,
      {
        bookingsByScenario: bookingsByScenarioWrapped,
        dataByScenario: dataByScenarioWrapped,
        groupDefs: effectiveGroupDefs,
        qualificationDefs: effectiveQualificationDefs,
        groupsByScenario: groupsByScenarioWrapped,
        qualificationAssignmentsByScenario: qualificationAssignmentsByScenarioWrapped,
        overlaysByScenario: {},
        scenarioId
      }
    );
   
  } catch {
    chartData = {};
  }

  // Ensure all arrays are deeply cloned and completely mutable
  const clonedData = {
    categories: chartData?.categories ? [...chartData.categories] : [],
    demand: chartData?.demand ? chartData.demand.map(val => typeof val === 'number' ? val : 0) : [],
    maxdemand: chartData?.maxdemand || "",
    capacity: chartData?.capacity ? chartData.capacity.map(val => typeof val === 'number' ? val : 0) : [],
    maxcapacity: chartData?.maxcapacity || "",
    care_ratio: chartData?.care_ratio ? chartData.care_ratio.map(val => typeof val === 'number' ? val : 0) : [],
    max_care_ratio: chartData?.max_care_ratio || "",
    expert_ratio: chartData?.expert_ratio ? chartData.expert_ratio.map(val => typeof val === 'number' ? val : 0) : [],
    maxexpert_ratio: chartData?.maxexpert_ratio || "100"
  };

  dispatch(setChartData({
    scenarioId,
    chartType: 'weekly',
    data: clonedData
  }));
};

// Thunk to update midterm chart data for a scenario
export const updateMidTermChartData = (scenarioId) => (dispatch, getState) => {
  const state = getState();
  const chartState = state.chart[scenarioId] || {};
  const referenceDate = chartState.referenceDate || '';
  const timedimension = chartState.timedimension || 'month';
  const selectedGroups = [...(chartState.filter?.Groups || [])];
  const selectedQualifications = [...(chartState.filter?.Qualifications || [])];

  // Use utility to build overlay-aware data
  const {
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    effectiveQualificationAssignmentsByItem,
    effectiveGroupDefs,
    effectiveQualificationDefs
  } = buildOverlayAwareData(scenarioId, state);

  // Get events for scenario
  const events = state.events?.eventsByScenario?.[scenarioId] || [];
  // Generate categories for midterm chart
  const categories = generateMidtermCategories(timedimension, events);

  // Wrap by scenarioId for chartUtils compatibility
  const bookingsByScenarioWrapped = { [scenarioId]: effectiveBookingsByItem };
  const groupsByScenarioWrapped = { [scenarioId]: effectiveGroupAssignmentsByItem };
  const qualificationAssignmentsByScenarioWrapped = { [scenarioId]: effectiveQualificationAssignmentsByItem };
  const dataByScenarioWrapped = { [scenarioId]: effectiveDataItems };

  // Pass overlay-aware data to chart utils
  let chartData;
  try {
    chartData = calculateChartDataMidterm(
      categories,
      referenceDate,
      selectedGroups,
      selectedQualifications,
      {
        bookingsByScenario: bookingsByScenarioWrapped,
        dataByScenario: dataByScenarioWrapped,
        groupDefs: effectiveGroupDefs,
        qualificationDefs: effectiveQualificationDefs,
        groupsByScenario: groupsByScenarioWrapped,
        qualificationAssignmentsByScenario: qualificationAssignmentsByScenarioWrapped,
        overlaysByScenario: {},
        scenarioId,
        timedimension
      }
    );
  } catch {
    chartData = {};
  }

  // Ensure all arrays are deeply cloned and completely mutable
  const clonedData = {
    categories: chartData?.categories ? [...chartData.categories] : [],
    demand: chartData?.demand ? chartData.demand.map(val => typeof val === 'number' ? val : 0) : [],
    maxdemand: chartData?.maxdemand || "",
    capacity: chartData?.capacity ? chartData.capacity.map(val => typeof val === 'number' ? val : 0) : [],
    maxcapacity: chartData?.maxcapacity || "",
    care_ratio: chartData?.care_ratio ? chartData.care_ratio.map(val => typeof val === 'number' ? val : 0) : [],
    max_care_ratio: chartData?.max_care_ratio || "",
    expert_ratio: chartData?.expert_ratio ? chartData.expert_ratio.map(val => typeof val === 'number' ? val : 0) : [],
    maxexpert_ratio: chartData?.maxexpert_ratio || "100"
  };

  dispatch(setChartData({
    scenarioId,
    chartType: 'midterm',
    data: clonedData
  }));
};

export const {
  ensureScenario,
  setReferenceDate,
  setTimedimension,
  setChartToggles,
  setFilterGroups,
  setFilterQualifications,
  setChartData,
  resetScenarioChart,
  deleteScenarioChart,
} = chartSlice.actions;

export default chartSlice.reducer;