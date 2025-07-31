import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { getItemHasOverlay } from '../utils/overlayUtils';
import { isSameAsImported } from '../utils/compareUtils';

export function useIsRestorable(scenarioId, itemId) {
  const scenario = useSelector(state => state.simScenario.scenarios.find(s => s.id === scenarioId));
  const overlaysByScenario = useSelector(state => state.simOverlay.overlaysByScenario);
  const dataItem = useSelector(state => state.simData.dataByScenario?.[scenarioId]?.[itemId]);
  const bookings = useSelector(state => state.simBooking.bookingsByScenario?.[scenarioId]?.[itemId]);
  const groupAssignments = useSelector(state => state.simGroup.groupsByScenario?.[scenarioId]?.[itemId]);
  const qualiAssignments = useSelector(state => state.simQualification.qualificationAssignmentsByScenario?.[scenarioId]?.[itemId]);

  return useMemo(() => {
    console.log('[useIsRestorable] Checking overlays for', { scenarioId, itemId });
    // 1. If item has overlays in this scenario, it's restorable
    if (getItemHasOverlay(scenarioId, itemId, overlaysByScenario)) {
      console.log('[useIsRestorable] Overlay detected for', { scenarioId, itemId });
      return true;
    }

    const isBaseScenario = !scenario?.baseScenarioId;

    console.log('[useIsRestorable] Checking base scenario and rawdata/originalData for', { scenarioId, itemId, isBaseScenario, dataItem });
    // 2. If base scenario, no overlays, and no rawdata or originalData, not restorable
    if (
      isBaseScenario &&
      !dataItem?.rawdata &&
      !dataItem?.originalData
    ) {
      console.log('[useIsRestorable] No rawdata/originalData for', { scenarioId, itemId });
      return false;
    }

    console.log('[useIsRestorable] Checking imported aspects for', { scenarioId, itemId, isBaseScenario, dataItem });
    // 3. If base scenario and imported, compare all aspects with their originalData
    if (isBaseScenario && dataItem?.originalData) {
      // simData
      console.log('[useIsRestorable] Comparing simData', { current: dataItem, original: dataItem.originalData });
      if (!isSameAsImported(dataItem, dataItem.originalData)) {
        console.log('[useIsRestorable] simData differs for', { scenarioId, itemId, current: dataItem, original: dataItem.originalData });
        return true;
      }

      // bookings
      if (bookings) {
        for (const [bookingId, booking] of Object.entries(bookings)) {
          if (booking.originalData && !isSameAsImported(booking, booking.originalData)) {
            console.log('[useIsRestorable] bookings differ for', { scenarioId, itemId, bookingId, current: booking, original: booking.originalData });
            return true;
          }
        }
      }

      // groupAssignments
      if (groupAssignments) {
        for (const [groupId, groupAssignment] of Object.entries(groupAssignments)) {
          if (groupAssignment.originalData && !isSameAsImported(groupAssignment, groupAssignment.originalData)) {
            console.log('[useIsRestorable] groupAssignments differ for', { scenarioId, itemId, groupId, current: groupAssignment, original: groupAssignment.originalData });
            return true;
          }
        }
      }

      // qualiAssignments
      if (qualiAssignments) {
        for (const [assignmentId, assignment] of Object.entries(qualiAssignments)) {
          if (assignment.originalData && !isSameAsImported(assignment, assignment.originalData)) {
            console.log('[useIsRestorable] qualiAssignments differ for', { scenarioId, itemId, assignmentId, current: assignment, original: assignment.originalData });
            return true;
          }
        }
      }

      // If all aspects match original, not restorable
      console.log('[useIsRestorable] All aspects match original for', { scenarioId, itemId });
      return false;
    }

    // Default: not restorable
    console.log('[useIsRestorable] Default not restorable for', { scenarioId, itemId });
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