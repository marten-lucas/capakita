import { createSlice } from '@reduxjs/toolkit';

export const initialUiState = {
  activePage: 'welcome', // 'welcome' | 'data' | 'visu' | 'settings' | 'legal'
  browserAutoSaveEnabled: false,
  dataListFilter: 'all',
  dataCaptureQueueMode: false,
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
  },
});

export const {
  setActivePage,
  setBrowserAutoSaveEnabled,
  setDataListFilter,
  setDataCaptureQueueMode,
} = uiSlice.actions;
export default uiSlice.reducer;
