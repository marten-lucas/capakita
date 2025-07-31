import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { getItemHasOverlay } from '../utils/overlayUtils';

export function useIsRestorable(scenarioId, itemId) {
  const scenario = useSelector(state => state.simScenario.scenarios.find(s => s.id === scenarioId));
  const overlaysByScenario = useSelector(state => state.simOverlay.overlaysByScenario);
  const dataItem = useSelector(state => state.simData.dataByScenario?.[scenarioId]?.[itemId]);
  const bookings = useSelector(state => state.simBooking.bookingsByScenario?.[scenarioId]?.[itemId]);
  const groupAssignments = useSelector(state => state.simGroup.groupsByScenario?.[scenarioId]?.[itemId]);
  const qualiAssignments = useSelector(state => state.simQualification.qualificationAssignmentsByScenario?.[scenarioId]?.[itemId]);

  // Helper: compare current and original for a given aspect
  const isSameAsOriginal = (current, original) => {
    if (!current || !original) return false;
    const filteredCurrent = {};
    Object.keys(original).forEach(key => {
      if (key in current) filteredCurrent[key] = current[key];
    });
    return JSON.stringify(filteredCurrent) === JSON.stringify(original);
  };

  return useMemo(() => {
    // 1. If item has overlays in this scenario, it's restorable
    if (getItemHasOverlay(scenarioId, itemId, overlaysByScenario)) return true;

    const isBaseScenario = !scenario?.baseScenarioId;

    // 2. If base scenario, no overlays, and no rawdata or originalData, not restorable
    if (
      isBaseScenario &&
      !dataItem?.rawdata &&
      !dataItem?.originalData
    ) {
      return false;
    }

    // 3. If base scenario and imported, compare all aspects with their originalData
    if (isBaseScenario && dataItem?.originalData) {
      // simData
      if (!isSameAsOriginal(dataItem, dataItem.originalData)) return true;
      // bookings
      if (bookings && bookings.originalData && !isSameAsOriginal(bookings, bookings.originalData)) return true;
      // groupAssignments
      if (groupAssignments && groupAssignments.originalData && !isSameAsOriginal(groupAssignments, groupAssignments.originalData)) return true;
      // qualiAssignments
      if (qualiAssignments && qualiAssignments.originalData && !isSameAsOriginal(qualiAssignments, qualiAssignments.originalData)) return true;
      // If all aspects match original, not restorable
      return false;
    }

    // Default: not restorable
    return false;
  }, [
    scenarioId,
    itemId,
    scenario,
    overlaysByScenario,
    dataItem,
    bookings,
    groupAssignments,
    qualiAssignments
  ]);
}