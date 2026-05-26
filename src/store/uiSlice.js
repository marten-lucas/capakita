import { createSlice } from '@reduxjs/toolkit';

export const initialUiState = {
  activePage: 'welcome', // 'welcome' | 'data' | 'visu' | 'settings' | 'legal'
  browserAutoSaveEnabled: false,
  dataListFilter: 'all',
  dataCaptureQueueMode: false,
  analysisStoryDeckEnabled: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    setActivePage: (state, action) => {
      state.activePage = action.payload;
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
    setAnalysisStoryDeckEnabled: (state, action) => {
      state.analysisStoryDeckEnabled = Boolean(action.payload);
    },
  },
});

export const {
  setActivePage,
  setBrowserAutoSaveEnabled,
  setDataListFilter,
  setDataCaptureQueueMode,
  setAnalysisStoryDeckEnabled,
} = uiSlice.actions;
export default uiSlice.reducer;
