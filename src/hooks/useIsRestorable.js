import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { getItemHasOverlay } from '../utils/overlayUtils';
import { isSameAsImported } from '../utils/compareUtils';

export function useIsRestorable(scenarioId, itemId) {
  const scenario = useSelector(state => state.simScenario.scenarios.find(s => s.id === scenarioId));
  const overlaysByScenario = useSelector(state => state.simOverlay.overlaysByScenario);
  const dataItem = useSelector(state => state.simData.dataByScenario?.[scenarioId]?.[itemId]);
  const bookings = useSelector(state => state.simBooking.bookingsByScenario?.[scenarioId]);
  const groupAssignments = useSelector(state => state.simGroup.groupsByScenario?.[scenarioId]);
  const qualiAssignments = useSelector(state => state.simQualification.qualificationAssignmentsByScenario?.[scenarioId]);

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
      if (!isSameAsImported(dataItem, dataItem.originalData)) return true;
      // bookings
      if (bookings?.[itemId] && bookings[itemId].originalData && !isSameAsImported(bookings[itemId], bookings[itemId].originalData)) return true;
      // groupAssignments
      if (groupAssignments?.[itemId] && groupAssignments[itemId].originalData && !isSameAsImported(groupAssignments[itemId], groupAssignments[itemId].originalData)) return true;
      // qualiAssignments
      if (qualiAssignments?.[itemId] && qualiAssignments[itemId].originalData && !isSameAsImported(qualiAssignments[itemId], qualiAssignments[itemId].originalData)) return true;
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