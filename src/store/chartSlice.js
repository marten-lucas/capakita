import { createSlice } from '@reduxjs/toolkit';
import { generateTimeSegments } from '../utils/chartUtils';

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
        categories: generateTimeSegments(),
      },
      midterm: {
        categories: [],
      }
    }
  };
}

const initialState = {
  // scenarioId: chartState
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
    }
  },
});

export const {
  ensureScenario,
  setReferenceDate,
  setTimedimension,
  setChartToggles,
  setFilterGroups,
  setFilterQualifications,
  setChartData,
  resetScenarioChart,
} = chartSlice.actions;

export default chartSlice.reducer;