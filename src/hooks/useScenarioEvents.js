import { useSelector, useDispatch, useStore } from 'react-redux';
import { useEffect, useMemo } from 'react';
import {
  selectEventsForScenario,
  selectConsolidatedEventsForScenario,
  refreshAllEvents,
  eventRefreshFailed
} from '../store/eventSlice';

// Hook: get scenario events and refresh when relevant data changes
export function useScenarioEvents(scenarioId) {
  const dispatch = useDispatch();
  const store = useStore();
  const needsRefresh = useSelector(state => state.events?._needsRefresh);
  const hasEvents = useSelector(state => Array.isArray(state.events?.eventsByScenario?.[scenarioId]));
  const status = useSelector(state => state.events?.statusByScenario?.[scenarioId]?.state);

  // Also supports stores without the app's refresh middleware (e.g. isolated views).
  useEffect(() => {
    if (!scenarioId || status === 'error' || (hasEvents && (status || !needsRefresh))) return;
    const { simData, simBooking, simGroup, simScenario, simOverlay, events: eventState } = store.getState();
    const currentStatus = eventState?.statusByScenario?.[scenarioId]?.state;
    if (eventState?._refreshBlocked || currentStatus === 'error' ||
      (Array.isArray(eventState?.eventsByScenario?.[scenarioId]) && (currentStatus || !eventState?._needsRefresh))) return;
    if (!simScenario?.scenarios?.some(scenario => scenario.id === scenarioId)) return;
    try {
      dispatch(refreshAllEvents({ simData, simBooking, simGroup, simScenario, simOverlay }));
    } catch (error) {
      console.error('Ereignisse konnten nicht aktualisiert werden; die Prognose ist unvollständig.', error);
      dispatch(eventRefreshFailed(error instanceof Error ? error.message : String(error)));
    }
  }, [scenarioId, needsRefresh, hasEvents, status, dispatch, store]);

  // Memoize fallback values to prevent unnecessary re-renders
  const emptyEvents = useMemo(() => [], []);
  const emptyConsolidatedEvents = useMemo(() => [], []);

  // Use selectors with proper memoization
  const events = useSelector(state => 
    state.events ? selectEventsForScenario(state, scenarioId) : emptyEvents
  );
  const consolidatedEvents = useSelector(state => 
    state.events ? selectConsolidatedEventsForScenario(state, scenarioId) : emptyConsolidatedEvents
  );

  return { events, consolidatedEvents };
}
