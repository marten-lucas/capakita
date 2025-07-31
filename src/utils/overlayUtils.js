// Helper: get scenario chain from current to root
export function getScenarioChain(scenarios, scenarioId) {
  const chain = [];
  let currentId = scenarioId;
  while (currentId) {
    const scenario = scenarios.find(s => s.id === currentId);
    if (!scenario) break;
    chain.push(scenario);
    currentId = scenario.baseScenarioId;
  }
  return chain;
}

// Get effective data items across scenario chain with overlay support
export function getEffectiveDataItems(scenarioChain, overlaysByScenario, dataByScenario) {
  const allKeys = new Set();
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    if (overlaysByScenario[sid]?.dataItems) Object.keys(overlaysByScenario[sid].dataItems).forEach(k => allKeys.add(k));
    if (dataByScenario[sid]) Object.keys(dataByScenario[sid]).forEach(k => allKeys.add(k));
  }
  const result = {};
  allKeys.forEach(itemId => {
    for (const scenario of scenarioChain) {
      const sid = scenario.id;
      if (overlaysByScenario[sid]?.dataItems?.[itemId]) {
        result[itemId] = overlaysByScenario[sid].dataItems[itemId];
        return;
      }
      if (dataByScenario[sid]?.[itemId]) {
        result[itemId] = dataByScenario[sid][itemId];
        return;
      }
    }
  });
  return result;
}

// Get effective bookings for a specific item across scenario chain
export function getEffectiveBookings(scenarioChain, overlaysByScenario, bookingsByScenario, itemId) {
  for (const scenario of scenarioChain) {
    const sid = scenario.id;
    if (overlaysByScenario[sid]?.bookings?.[itemId]) return overlaysByScenario[sid].bookings[itemId];
    if (bookingsByScenario[sid]?.[itemId]) return bookingsByScenario[sid][itemId];
  }
  return {};
}

// Get effective group assignments for a specific item across scenario chain
export function getEffectiveGroupAssignments(scenarioChain, overlaysByScenario, groupsByScenario, itemId) {
  for (const scenario of scenarioChain) {
    const sid = scenario.id;
    if (overlaysByScenario[sid]?.groupassignments?.[itemId]) return overlaysByScenario[sid].groupassignments[itemId];
    if (groupsByScenario[sid]?.[itemId]) return groupsByScenario[sid][itemId];
  }
  return {};
}

// Get effective group definitions across scenario chain
export function getEffectiveGroupDefs(scenarioChain, overlaysByScenario, groupDefsByScenario) {
  for (const scenario of scenarioChain) {
    const sid = scenario.id;
    if (Array.isArray(overlaysByScenario[sid]?.groupDefs) && overlaysByScenario[sid].groupDefs.length > 0)
      return overlaysByScenario[sid].groupDefs;
    if (Array.isArray(groupDefsByScenario[sid]) && groupDefsByScenario[sid].length > 0)
      return groupDefsByScenario[sid];
  }
  return [];
}

// Get effective qualification assignments for a specific item across scenario chain
export function getEffectiveQualificationAssignments(scenarioChain, overlaysByScenario, qualiAssignmentsByScenario, itemId) {
  for (const scenario of scenarioChain) {
    const sid = scenario.id;
    const overlayArr = overlaysByScenario[sid]?.qualificationDefs;
    if (Array.isArray(overlayArr)) {
      const found = overlayArr.filter(a => String(a.dataItemId) === String(itemId));
      if (found.length > 0) return found;
    }
    const assignmentsObj = qualiAssignmentsByScenario[sid]?.[itemId];
    if (assignmentsObj && Object.values(assignmentsObj).length > 0) {
      return Object.values(assignmentsObj);
    }
  }
  return [];
}

// Check if any overlay exists for a given item in a scenario (greedy)
export function getItemHasOverlay(scenarioId, itemId, overlaysByScenario) {
  const overlay = overlaysByScenario[scenarioId];
  if (!overlay) return false;
  // Check dataItems overlay
  if (overlay.dataItems && overlay.dataItems[itemId]) return true;
  // Check bookings overlay
  if (overlay.bookings && overlay.bookings[itemId]) return true;
  // Check groupassignments overlay
  if (overlay.groupassignments && overlay.groupassignments[itemId]) return true;
  // Check qualificationDefs overlay (array of assignments)
  if (Array.isArray(overlay.qualificationDefs)) {
    if (overlay.qualificationDefs.some(a => String(a.dataItemId) === String(itemId))) return true;
  }
  return false;
}

// Build complete overlay-aware data structure for chart calculations
export function buildOverlayAwareData(scenarioId, state) {
  const scenarios = state.simScenario.scenarios;
  const overlaysByScenario = state.simOverlay.overlaysByScenario;
  const dataByScenario = state.simData.dataByScenario;
  const bookingsByScenario = state.simBooking.bookingsByScenario;
  const groupDefsByScenario = state.simGroup.groupDefsByScenario;
  const groupsByScenario = state.simGroup.groupsByScenario;
  const qualiAssignmentsByScenario = state.simQualification.qualificationAssignmentsByScenario;

  const scenarioChain = getScenarioChain(scenarios, scenarioId);

  const effectiveDataItems = getEffectiveDataItems(scenarioChain, overlaysByScenario, dataByScenario);
  const effectiveBookingsByItem = {};
  const effectiveGroupAssignmentsByItem = {};
  const effectiveQualificationAssignmentsByItem = {};

  Object.keys(effectiveDataItems).forEach(itemId => {
    effectiveBookingsByItem[itemId] = getEffectiveBookings(scenarioChain, overlaysByScenario, bookingsByScenario, itemId);
    effectiveGroupAssignmentsByItem[itemId] = getEffectiveGroupAssignments(scenarioChain, overlaysByScenario, groupsByScenario, itemId);
    effectiveQualificationAssignmentsByItem[itemId] = getEffectiveQualificationAssignments(scenarioChain, overlaysByScenario, qualiAssignmentsByScenario, itemId);
  });

  const effectiveGroupDefs = getEffectiveGroupDefs(scenarioChain, overlaysByScenario, groupDefsByScenario);

  return {
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    effectiveQualificationAssignmentsByItem,
    effectiveGroupDefs,
    scenarioChain
  };
}
