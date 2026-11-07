import { configureStore } from '@reduxjs/toolkit';
import simScenarioReducer from './simScenarioSlice';
import simDataReducer from './simDataSlice';
import simBookingReducer from './simBookingSlice';
import simGroupReducer from './simGroupSlice';
import simQualificationReducer from './simQualificationSlice';
import simOverlayReducer from './simOverlaySlice';
import simFinanceReducer, { seedDefaultBayKiBiGRules } from './simFinanceSlice';
import chartReducer from './chartSlice';
import eventReducer from './eventSlice';
import datesOfInterestReducer from './datesOfInterestSlice';
import uiReducer from './uiSlice';
import { initialUiState, setBrowserAutoSaveEnabled } from './uiSlice';
import { isSaveAllowed } from './simScenarioSlice';
import { extractSaveData } from '../utils/saveLoadUtils';
import { loadBrowserAutoSaveEnabled, loadBrowserAutoSaveState, saveBrowserAutoSaveEnabled, saveBrowserAutoSaveState } from '../utils/browserStorage';

const isCoolifyBuild = import.meta.env.MODE === 'coolify';

export function createAppStore({ preloadedState: suppliedState, sharedPersistence = null } = {}) {
  const browserAutoSaveEnabled = sharedPersistence ? false : loadBrowserAutoSaveEnabled();
  const browserAutoSaveState = !sharedPersistence && browserAutoSaveEnabled ? loadBrowserAutoSaveState() : null;
  const restoredState = suppliedState || browserAutoSaveState || {};
  const restoredUi = restoredState.ui || {};

  const preloadedState = {
    ...restoredState,
    ui: {
      ...initialUiState,
      ...restoredUi,
      browserAutoSaveEnabled,
    },
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
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          warnAfter: 128,
        },
        immutableCheck: {
          warnAfter: 128,
        },
      }),
  });

  const startupScenarioIds = (store.getState().simScenario?.scenarios || []).map((scenario) => String(scenario.id));
  if (startupScenarioIds.length > 0) {
    store.dispatch(seedDefaultBayKiBiGRules({ scenarioIds: startupScenarioIds }));
  }

  if (sharedPersistence) {
    sharedPersistence.start(store);
    return store;
  }

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

  return store;
}

const store = isCoolifyBuild ? null : createAppStore();
export default store;
