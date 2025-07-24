import { createSlice } from '@reduxjs/toolkit';
import { generateTimeSegments } from '../utils/chartUtils';

const initialState = {
  stichtag: new Date().toISOString().slice(0, 10),
  selectedGroups: [],
  selectedQualifications: [],
  categories: generateTimeSegments(),
  availableGroups: [],
  availableQualifications: [],
  midtermTimeDimension: 'Wochen',
  midtermSelectedGroups: [],
  midtermSelectedQualifications: [],
  weeklySelectedScenarioId: null,
  midtermSelectedScenarioId: null,
  chartToggles: ['weekly', 'midterm'],
};

const chartSlice = createSlice({
  name: 'chart',
  initialState,
  reducers: {
    setStichtag(state, action) {
      state.stichtag = action.payload;
    },
    setSelectedGroups(state, action) {
      state.selectedGroups = action.payload;
    },
    setSelectedQualifications(state, action) {
      state.selectedQualifications = action.payload;
    },
    setWeeklySelectedScenarioId(state, action) {
      state.weeklySelectedScenarioId = action.payload;
    },
    setMidtermSelectedScenarioId(state, action) {
      state.midtermSelectedScenarioId = action.payload;
    },
    setMidtermTimeDimension(state, action) {
      state.midtermTimeDimension = action.payload;
    },
    setMidtermSelectedGroups(state, action) {
      state.midtermSelectedGroups = action.payload;
    },
    setMidtermSelectedQualifications(state, action) {
      state.midtermSelectedQualifications = action.payload;
    },
    updateAvailableGroups(state, action) {
      const groupsCopy = [...action.payload];
      const currentGroupsString = JSON.stringify(groupsCopy.sort());
      const availableGroupsString = JSON.stringify([...state.availableGroups].sort());
      if (currentGroupsString !== availableGroupsString) {
        state.availableGroups = groupsCopy;
        state.selectedGroups = groupsCopy;
      }
    },
    updateAvailableQualifications(state, action) {
      const qualificationsCopy = [...action.payload];
      const currentQualificationsString = JSON.stringify(qualificationsCopy.sort());
      const availableQualificationsString = JSON.stringify([...state.availableQualifications].sort());
      if (currentQualificationsString !== availableQualificationsString) {
        state.availableQualifications = qualificationsCopy;
        state.selectedQualifications = qualificationsCopy;
      }
    },
    setChartToggles(state, action) {
      state.chartToggles = action.payload;
    },
  },
});

export const {
  setStichtag,
  setSelectedGroups,
  setSelectedQualifications,
  setWeeklySelectedScenarioId,
  setMidtermSelectedScenarioId,
  setMidtermTimeDimension,
  setMidtermSelectedGroups,
  setMidtermSelectedQualifications,
  updateAvailableGroups,
  updateAvailableQualifications,
  setChartToggles,
} = chartSlice.actions;

export default chartSlice.reducer;