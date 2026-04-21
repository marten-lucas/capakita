import { configureStore } from '@reduxjs/toolkit';
import simScenarioReducer from './simScenarioSlice';
import simDataReducer from './simDataSlice';
import simBookingReducer from './simBookingSlice';
import simGroupReducer from './simGroupSlice';
import simQualificationReducer from './simQualificationSlice';
import simOverlayReducer from './simOverlaySlice';
import chartReducer from './chartSlice';
import eventReducer from './eventSlice';
import datesOfInterestReducer from './datesOfInterestSlice';
import uiReducer from './uiSlice';
import { initialUiState } from './uiSlice';
import { extractSaveData } from '../utils/saveLoadUtils';
import { loadBrowserAutoSaveEnabled, loadBrowserAutoSaveState, saveBrowserAutoSaveEnabled, saveBrowserAutoSaveState } from '../utils/browserStorage';

const browserAutoSaveEnabled = loadBrowserAutoSaveEnabled();
const browserAutoSaveState = browserAutoSaveEnabled ? loadBrowserAutoSaveState() : null;

const preloadedState = {
  ui: {
    ...initialUiState,
    browserAutoSaveEnabled,
  },
  ...(browserAutoSaveState || {}),
};

const store = configureStore({
  reducer: {
    ui: uiReducer,
    simScenario: simScenarioReducer,
    simData: simDataReducer,
    simBooking: simBookingReducer,
    simGroup: simGroupReducer,
    simQualification: simQualificationReducer,
    simOverlay: simOverlayReducer,
    chart: chartReducer,
    events: eventReducer,
    datesOfInterest: datesOfInterestReducer,
  },
  preloadedState,
});

store.subscribe(() => {
  const state = store.getState();
  saveBrowserAutoSaveEnabled(state.ui.browserAutoSaveEnabled);

  if (state.ui.browserAutoSaveEnabled) {
    saveBrowserAutoSaveState(extractSaveData(state));
  }
});

export default store;
