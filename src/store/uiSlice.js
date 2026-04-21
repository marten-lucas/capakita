import { createSlice } from '@reduxjs/toolkit';

export const initialUiState = {
  activePage: 'welcome', // 'welcome' | 'data' | 'visu' | 'settings' | 'legal'
  browserAutoSaveEnabled: false,
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
  },
});

export const { setActivePage, setBrowserAutoSaveEnabled } = uiSlice.actions;
export default uiSlice.reducer;
