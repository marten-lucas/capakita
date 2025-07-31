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
    // 1. If item has overlays in this scenario, it's restorable
    if (getItemHasOverlay(scenarioId, itemId, overlaysByScenario)) {
      return true;
    }

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
      if (!isSameAsImported(dataItem, dataItem.originalData)) {
        return true;
      }

      // bookings
      if (bookings) {
        for (const [, booking] of Object.entries(bookings)) {
          if (booking.originalData && !isSameAsImported(booking, booking.originalData)) {
            return true;
          }
        }
      }

      // groupAssignments
      if (groupAssignments) {
        for (const [, groupAssignment] of Object.entries(groupAssignments)) {
          if (groupAssignment.originalData && !isSameAsImported(groupAssignment, groupAssignment.originalData)) {
            return true;
          }
        }
      }

      // qualiAssignments
      if (qualiAssignments) {
        for (const [, assignment] of Object.entries(qualiAssignments)) {
          if (assignment.originalData && !isSameAsImported(assignment, assignment.originalData)) {
            return true;
          }
        }
      }

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