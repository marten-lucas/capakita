import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useMemo } from 'react';
import {
  selectEventsForScenario,
  selectConsolidatedEventsForScenario,
  refreshEventsForScenario
} from '../store/eventSlice';

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

  // Memoize fallback values to prevent unnecessary re-renders
  const emptyEvents = useMemo(() => [], []);
  const emptyConsolidatedEvents = useMemo(() => [], []);

  // Use selectors only if events state is initialized
  const events = useSelector(state => 
    state.events ? selectEventsForScenario(state, scenarioId) : emptyEvents
  );
  const consolidatedEvents = useSelector(state => 
    state.events ? selectConsolidatedEventsForScenario(state, scenarioId) : emptyConsolidatedEvents
  );

  return { events, consolidatedEvents };
}
