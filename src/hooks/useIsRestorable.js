import { useSelector } from 'react-redux';
import { useMemo } from 'react';

export function useIsRestorable(scenarioId, itemId) {
  const overlays = useSelector(state => state.simOverlay.overlaysByScenario?.[scenarioId]) || {};
  const dataItem = useSelector(state => state.simData.dataByScenario?.[scenarioId]?.[itemId]);
  const bookingsByScenario = useSelector(state => state.simBooking.bookingsByScenario);
  const groupsByScenario = useSelector(state => state.simGroup.groupsByScenario);
  const qualiAssignmentsByScenario = useSelector(state => state.simQualification.qualificationAssignmentsByScenario);

  /**
   * Compares two objects to check if they are identical.
   * @param {Object} currentObj - The current object.
   * @param {Object} originalObj - The original object.
   * @returns {boolean} True if the objects are identical, false otherwise.
   */
  const areObjectsSame = (currentObj, originalObj) => {
    if (!currentObj || !originalObj) return false;
    return JSON.stringify(currentObj) === JSON.stringify(originalObj);
  };

  /**
   * Iterates through a collection and compares each item's `originalData` with its current data.
   * @param {Object} currentCollection - The current collection of items.
   * @param {Object} originalCollection - The original collection of items.
   * @returns {boolean} True if any item in the collection has changed, false otherwise.
   */
  const hasCollectionChanged = (currentCollection, originalCollection) => {
    if (!currentCollection || !originalCollection) return false;

    for (const key of Object.keys(currentCollection)) {
      const currentItem = currentCollection[key];
      const originalItem = originalCollection[key]?.originalData;
      if (!areObjectsSame(currentItem, originalItem)) {
        return true;
      }
    }
    return false;
  };

  return useMemo(() => {
    if (!dataItem || !dataItem.originalData) return false;

    // Check if simData has changed
    if (!areObjectsSame(dataItem, dataItem.originalData)) return true;

    // Check if bookings have changed
    const currentBookings = bookingsByScenario?.[scenarioId]?.[itemId] || {};
    const originalBookings = overlays.bookings?.[itemId] || {};
    if (hasCollectionChanged(currentBookings, originalBookings)) return true;

    // Check if group assignments have changed
    const currentGroupAssignments = groupsByScenario?.[scenarioId]?.[itemId] || {};
    const originalGroupAssignments = overlays.groupassignments?.[itemId] || {};
    if (hasCollectionChanged(currentGroupAssignments, originalGroupAssignments)) return true;

    // Check if qualification assignments have changed
    const currentQualiAssignments = qualiAssignmentsByScenario?.[scenarioId]?.[itemId] || {};
    const originalQualiAssignments = overlays.qualificationDefs?.find(a => String(a.dataItemId) === String(itemId)) || {};
    if (hasCollectionChanged(currentQualiAssignments, originalQualiAssignments)) return true;

    // If no changes are detected, return false (not restorable)
    return false;
  }, [dataItem, scenarioId, itemId, bookingsByScenario, groupsByScenario, qualiAssignmentsByScenario, overlays]);
}