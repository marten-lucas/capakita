import { buildOverlayAwareData } from './overlayUtils';

function pruneMapByAllowedKeys(record = {}, allowedKeys = new Set()) {
  const next = {};
  let removed = 0;

  Object.entries(record || {}).forEach(([key, value]) => {
    if (allowedKeys.has(String(key))) {
      next[key] = value;
    } else {
      removed += 1;
    }
  });

  return { next, removed };
}

function cloneScenarioOverlay(overlay = {}) {
  const cloned = { ...overlay };
  if (overlay?.dataItems) cloned.dataItems = { ...overlay.dataItems };
  if (overlay?.bookings) cloned.bookings = { ...overlay.bookings };
  if (overlay?.groupassignments) cloned.groupassignments = { ...overlay.groupassignments };
  return cloned;
}

export function buildScenarioCleanupResult(state, scenarioId) {
  if (!scenarioId) {
    return {
      bookingsByScenario: state.simBooking.bookingsByScenario,
      groupsByScenario: state.simGroup.groupsByScenario,
      qualificationAssignmentsByScenario: state.simQualification.qualificationAssignmentsByScenario,
      overlaysByScenario: state.simOverlay.overlaysByScenario,
      financeByScenario: state.simFinance.financeByScenario,
      stats: {
        removedBookingItemBuckets: 0,
        removedGroupItemBuckets: 0,
        removedQualificationItemBuckets: 0,
        removedOverlayBookingBuckets: 0,
        removedOverlayGroupBuckets: 0,
        removedFinanceItemEntries: 0,
      },
    };
  }

  const overlayAware = buildOverlayAwareData(scenarioId, state);
  const validItemIds = new Set(Object.keys(overlayAware.effectiveDataItems || {}).map((id) => String(id)));

  const bookingsByScenario = {
    ...state.simBooking.bookingsByScenario,
    [scenarioId]: {
      ...(state.simBooking.bookingsByScenario?.[scenarioId] || {}),
    },
  };
  const groupsByScenario = {
    ...state.simGroup.groupsByScenario,
    [scenarioId]: {
      ...(state.simGroup.groupsByScenario?.[scenarioId] || {}),
    },
  };
  const qualificationAssignmentsByScenario = {
    ...state.simQualification.qualificationAssignmentsByScenario,
    [scenarioId]: {
      ...(state.simQualification.qualificationAssignmentsByScenario?.[scenarioId] || {}),
    },
  };

  const bookingsPrune = pruneMapByAllowedKeys(bookingsByScenario[scenarioId], validItemIds);
  bookingsByScenario[scenarioId] = bookingsPrune.next;

  const groupsPrune = pruneMapByAllowedKeys(groupsByScenario[scenarioId], validItemIds);
  groupsByScenario[scenarioId] = groupsPrune.next;

  const qualificationPrune = pruneMapByAllowedKeys(qualificationAssignmentsByScenario[scenarioId], validItemIds);
  qualificationAssignmentsByScenario[scenarioId] = qualificationPrune.next;

  const overlaysByScenario = {
    ...state.simOverlay.overlaysByScenario,
  };

  const scenarioOverlay = cloneScenarioOverlay(state.simOverlay.overlaysByScenario?.[scenarioId] || {});

  let removedOverlayBookingBuckets = 0;
  if (scenarioOverlay.bookings) {
    const pruned = pruneMapByAllowedKeys(scenarioOverlay.bookings, validItemIds);
    scenarioOverlay.bookings = pruned.next;
    removedOverlayBookingBuckets = pruned.removed;
    if (Object.keys(scenarioOverlay.bookings).length === 0) {
      delete scenarioOverlay.bookings;
    }
  }

  let removedOverlayGroupBuckets = 0;
  if (scenarioOverlay.groupassignments) {
    const pruned = pruneMapByAllowedKeys(scenarioOverlay.groupassignments, validItemIds);
    scenarioOverlay.groupassignments = pruned.next;
    removedOverlayGroupBuckets = pruned.removed;
    if (Object.keys(scenarioOverlay.groupassignments).length === 0) {
      delete scenarioOverlay.groupassignments;
    }
  }

  if (Object.keys(scenarioOverlay).length > 0) {
    overlaysByScenario[scenarioId] = scenarioOverlay;
  } else {
    delete overlaysByScenario[scenarioId];
  }

  const financeByScenario = {
    ...state.simFinance.financeByScenario,
  };

  let removedFinanceItemEntries = 0;
  const scenarioFinance = state.simFinance.financeByScenario?.[scenarioId];
  if (scenarioFinance) {
    const nextScenarioFinance = {
      ...scenarioFinance,
      itemFinances: {
        ...(scenarioFinance.itemFinances || {}),
      },
    };
    const prunedFinance = pruneMapByAllowedKeys(nextScenarioFinance.itemFinances, validItemIds);
    nextScenarioFinance.itemFinances = prunedFinance.next;
    removedFinanceItemEntries = prunedFinance.removed;
    financeByScenario[scenarioId] = nextScenarioFinance;
  }

  return {
    bookingsByScenario,
    groupsByScenario,
    qualificationAssignmentsByScenario,
    overlaysByScenario,
    financeByScenario,
    stats: {
      removedBookingItemBuckets: bookingsPrune.removed,
      removedGroupItemBuckets: groupsPrune.removed,
      removedQualificationItemBuckets: qualificationPrune.removed,
      removedOverlayBookingBuckets,
      removedOverlayGroupBuckets,
      removedFinanceItemEntries,
    },
  };
}
