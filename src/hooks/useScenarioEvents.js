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
  const needsRefresh = useSelector(state => state.events?._needsRefresh);

  // Refresh events for scenario when relevant data changes OR when refresh is needed
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
  }, [scenarioId, simData, simBooking, simGroup, needsRefresh, dispatch]);

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
