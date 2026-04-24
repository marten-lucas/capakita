import { configureStore } from '@reduxjs/toolkit';
import simScenarioReducer from './simScenarioSlice';
import simDataReducer from './simDataSlice';
import simBookingReducer from './simBookingSlice';
import simGroupReducer from './simGroupSlice';
import simQualificationReducer from './simQualificationSlice';
import simOverlayReducer from './simOverlaySlice';
import simFinanceReducer from './simFinanceSlice';
import chartReducer from './chartSlice';
import eventReducer from './eventSlice';
import datesOfInterestReducer from './datesOfInterestSlice';
import uiReducer from './uiSlice';
import { initialUiState, setBrowserAutoSaveEnabled } from './uiSlice';
import { isSaveAllowed } from './simScenarioSlice';
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
    simFinance: simFinanceReducer,
    chart: chartReducer,
    events: eventReducer,
    datesOfInterest: datesOfInterestReducer,
  },
  preloadedState,
});

if (store.getState().ui.browserAutoSaveEnabled && !isSaveAllowed(store.getState())) {
  store.dispatch(setBrowserAutoSaveEnabled(false));
}

store.subscribe(() => {
  const state = store.getState();

  if (state.ui.browserAutoSaveEnabled && !isSaveAllowed(state)) {
    store.dispatch(setBrowserAutoSaveEnabled(false));
    return;
  }

  saveBrowserAutoSaveEnabled(state.ui.browserAutoSaveEnabled);

  if (state.ui.browserAutoSaveEnabled) {
    saveBrowserAutoSaveState(extractSaveData(state));
  }
});

export default store;
