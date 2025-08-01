import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import {
  selectEventsForScenario,
  selectConsolidatedEventsForScenario,
  refreshEventsForScenario,
  refreshAllEvents
} from '../store/eventSlice';

// Memoized empty array for selector fallback
const EMPTY_EVENTS = Object.freeze([]);

// Hook: get scenario events and refresh when relevant data changes
export function useScenarioEvents(scenarioId) {
  const dispatch = useDispatch();
  const simData = useSelector(state => state.simData);
  const simBooking = useSelector(state => state.simBooking);
  const simGroup = useSelector(state => state.simGroup);

  // Refresh events for scenario when relevant data changes
  useEffect(() => {
    if (scenarioId) {
      dispatch(
        refreshEventsForScenario({
          scenarioId,
          simData,
          simBooking,
          simGroup
        })
      );
    }
     
  }, [scenarioId, simData, simBooking, simGroup, dispatch]);

  // Defensive selectors: fallback to memoized empty array if state.events is missing
  const events = useSelector(state =>
    state.events
      ? selectEventsForScenario(state, scenarioId)
      : EMPTY_EVENTS
  );
  const consolidatedEvents = useSelector(state =>
    state.events
      ? selectConsolidatedEventsForScenario(state, scenarioId)
      : EMPTY_EVENTS
  );

  return { events, consolidatedEvents };
}
