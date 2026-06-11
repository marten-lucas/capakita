import { createSlice } from '@reduxjs/toolkit';

export const initialUiState = {
  activePage: 'welcome', // 'welcome' | 'data' | 'visu' | 'settings' | 'legal'
  settingsSubPage: 'groups', // 'scenarios' | 'groups' | 'qualifications' | 'events' | 'finance-funding' | 'finance-absence' | 'finance-fees'
  analysisSubPage: 'quality', // 'quality' | 'status' | 'transitions' | 'cohort' | 'compare' | 'options' | 'trends'
  browserAutoSaveEnabled: false,
  dataListFilter: 'all',
  dataCaptureQueueMode: false,
  dataSubmenu: 'capacity',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    setActivePage: (state, action) => {
      state.activePage = action.payload;
    },
    setSettingsSubPage: (state, action) => {
      state.settingsSubPage = action.payload || 'groups';
    },
    setAnalysisSubPage: (state, action) => {
      state.analysisSubPage = action.payload || 'quality';
    },
    setBrowserAutoSaveEnabled: (state, action) => {
      state.browserAutoSaveEnabled = Boolean(action.payload);
    },
    setDataListFilter: (state, action) => {
      state.dataListFilter = action.payload || 'all';
    },
    setDataCaptureQueueMode: (state, action) => {
      state.dataCaptureQueueMode = Boolean(action.payload);
    },
    setDataSubmenu: (state, action) => {
      state.dataSubmenu = action.payload === 'demand' ? 'demand' : 'capacity';
    },
  },
});

export const {
  setActivePage,
  setSettingsSubPage,
  setAnalysisSubPage,
  setBrowserAutoSaveEnabled,
  setDataListFilter,
  setDataCaptureQueueMode,
  setDataSubmenu,
} = uiSlice.actions;
export default uiSlice.reducer;
