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
  const allBookings = {};
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    if (bookingsByScenario[sid]?.[itemId]) {
      Object.assign(allBookings, bookingsByScenario[sid][itemId]);
    }
    if (overlaysByScenario[sid]?.bookings?.[itemId]) {
      Object.assign(allBookings, overlaysByScenario[sid].bookings[itemId]);
    }
  }
  return allBookings;
}

// Get effective group assignments for a specific item across scenario chain
export function getEffectiveGroupAssignments(scenarioChain, overlaysByScenario, groupsByScenario, itemId) {
  const allAssignments = {};
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    if (groupsByScenario[sid]?.[itemId]) {
      Object.assign(allAssignments, groupsByScenario[sid][itemId]);
    }
    if (overlaysByScenario[sid]?.groupassignments?.[itemId]) {
      Object.assign(allAssignments, overlaysByScenario[sid].groupassignments[itemId]);
    }
  }
  return allAssignments;
}

// Get effective group definitions across scenario chain
export function getEffectiveGroupDefs(scenarioChain, overlaysByScenario, groupDefsByScenario) {
  const allDefs = new Map();
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    if (Array.isArray(groupDefsByScenario[sid])) {
      groupDefsByScenario[sid].forEach(def => {
        allDefs.set(def.id, def);
      });
    }
    if (Array.isArray(overlaysByScenario[sid]?.groupDefs)) {
      overlaysByScenario[sid].groupDefs.forEach(def => {
        allDefs.set(def.id, def);
      });
    }
  }
  return Array.from(allDefs.values());
}

// Get effective qualification assignments for a specific item across scenario chain
export function getEffectiveQualificationAssignments(scenarioChain, overlaysByScenario, qualiAssignmentsByScenario, itemId) {
  const allAssignments = [];
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    const assignmentsObj = qualiAssignmentsByScenario[sid]?.[itemId];
    if (assignmentsObj && Object.values(assignmentsObj).length > 0) {
      allAssignments.push(...Object.values(assignmentsObj));
    }
    const overlayArr = overlaysByScenario[sid]?.qualificationDefs;
    if (Array.isArray(overlayArr)) {
      const found = overlayArr.filter(a => String(a.dataItemId) === String(itemId));
      if (found.length > 0) {
        allAssignments.push(...found);
      }
    }
  }
  const uniqueAssignments = [];
  const seenQualifications = new Set();
  for (let i = allAssignments.length - 1; i >= 0; i--) {
    const assignment = allAssignments[i];
    if (!seenQualifications.has(assignment.qualification)) {
      seenQualifications.add(assignment.qualification);
      uniqueAssignments.unshift(assignment);
    }
  }
  return uniqueAssignments;
}

// Check if any overlay exists for a given item in a scenario (greedy)
export function getItemHasOverlay(scenarioId, itemId, overlaysByScenario) {
  const overlay = overlaysByScenario[scenarioId];
  if (!overlay) return false;
  if (overlay.dataItems && overlay.dataItems[itemId]) return true;
  if (overlay.bookings && overlay.bookings[itemId]) return true;
  if (overlay.groupassignments && overlay.groupassignments[itemId]) return true;
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
  const qualiDefsByScenario = state.simQualification.qualificationDefsByScenario;

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
  
  // Effective Qualification Defs
  const allDefs = new Map();
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    if (Array.isArray(qualiDefsByScenario[sid])) {
      qualiDefsByScenario[sid].forEach(def => {
        allDefs.set(def.key, def);
      });
    }
    if (Array.isArray(overlaysByScenario[sid]?.qualificationDefs)) {
      overlaysByScenario[sid].qualificationDefs.forEach(def => {
        allDefs.set(def.key, def);
      });
    }
  }

  return {
    scenarioId,
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    effectiveQualificationAssignmentsByItem,
    effectiveGroupDefs,
    effectiveQualificationDefs: Array.from(allDefs.values()),
    scenarioChain
  };
}
