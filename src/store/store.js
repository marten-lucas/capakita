import { configureStore } from '@reduxjs/toolkit';
import simScenarioReducer from './simScenarioSlice';
import simDataReducer from './simDataSlice';
import simBookingReducer from './simBookingSlice';
import simGroupReducer from './simGroupSlice';
import simQualificationReducer from './simQualificationSlice';
import simOverlayReducer from './simOverlaySlice';
import simFinanceReducer, { seedDefaultBayKiBiGRules } from './simFinanceSlice';
import chartReducer from './chartSlice';
import eventReducer, { eventRefreshFailed, invalidateEvents, refreshAllEvents } from './eventSlice';
import datesOfInterestReducer from './datesOfInterestSlice';
import uiReducer from './uiSlice';
import { initialUiState, setBrowserAutoSaveEnabled } from './uiSlice';
import { isSaveAllowed } from './simScenarioSlice';
import { extractSaveData } from '../utils/saveLoadUtils';
import { loadBrowserAutoSaveEnabled, loadBrowserAutoSaveState, saveBrowserAutoSaveEnabled, saveBrowserAutoSaveState } from '../utils/browserStorage';

const isCoolifyBuild = import.meta.env.MODE === 'coolify';

// Coalesce synchronous imports/edits. The reducer invalidates immediately, so
// consumers never mistake old events for a complete forecast while waiting.
export const createEventRefreshMiddleware = () => {
  let scheduled = false;
  return ({ dispatch, getState }) => (next) => (action) => {
    const result = next(action);
    if (getState().events?._needsRefresh && !getState().events?._refreshBlocked && !scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const state = getState();
        if (!state.events?._needsRefresh || state.events?._refreshBlocked) return;
        try {
          const { simScenario, simOverlay, simData, simBooking, simGroup } = state;
          dispatch(refreshAllEvents({ simScenario, simOverlay, simData, simBooking, simGroup }));
        } catch (error) {
          console.error('Ereignisse konnten nicht aktualisiert werden; die Prognose ist unvollständig.', error);
          dispatch(eventRefreshFailed(error instanceof Error ? error.message : String(error)));
        }
      });
    }
    return result;
  };
};

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
      }).concat(createEventRefreshMiddleware()),
  });

  // Persisted event caches may have been built with older data or logic.
  store.dispatch(invalidateEvents());
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
