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
  // Collect all bookings from scenario chain and merge overlays
  const allBookings = {};
  
  // Start from base scenario (reverse order) and apply overlays
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    // Add base bookings first
    if (bookingsByScenario[sid]?.[itemId]) {
      Object.assign(allBookings, bookingsByScenario[sid][itemId]);
    }
    // Apply overlays on top
    if (overlaysByScenario[sid]?.bookings?.[itemId]) {
      Object.assign(allBookings, overlaysByScenario[sid].bookings[itemId]);
    }
  }
  
  return allBookings;
}

// Get effective group assignments for a specific item across scenario chain
export function getEffectiveGroupAssignments(scenarioChain, overlaysByScenario, groupsByScenario, itemId) {
  // Collect all group assignments from scenario chain and merge overlays
  const allAssignments = {};
  
  // Start from base scenario (reverse order) and apply overlays
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    // Add base assignments first
    if (groupsByScenario[sid]?.[itemId]) {
      Object.assign(allAssignments, groupsByScenario[sid][itemId]);
    }
    // Apply overlays on top
    if (overlaysByScenario[sid]?.groupassignments?.[itemId]) {
      Object.assign(allAssignments, overlaysByScenario[sid].groupassignments[itemId]);
    }
  }
  
  return allAssignments;
}

// Get effective group definitions across scenario chain
export function getEffectiveGroupDefs(scenarioChain, overlaysByScenario, groupDefsByScenario) {
  // Collect all group definitions and merge them by id
  const allDefs = new Map();
  
  // Start from base scenario (reverse order) and apply overlays
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    // Add base definitions first
    if (Array.isArray(groupDefsByScenario[sid])) {
      groupDefsByScenario[sid].forEach(def => {
        allDefs.set(def.id, def);
      });
    }
    // Apply overlays on top
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
  // Collect all qualification assignments and merge them
  const allAssignments = [];
  
  // Start from base scenario (reverse order) and collect assignments
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    // Add base assignments first
    const assignmentsObj = qualiAssignmentsByScenario[sid]?.[itemId];
    if (assignmentsObj && Object.values(assignmentsObj).length > 0) {
      allAssignments.push(...Object.values(assignmentsObj));
    }
    // Add overlay assignments on top
    const overlayArr = overlaysByScenario[sid]?.qualificationDefs;
    if (Array.isArray(overlayArr)) {
      const found = overlayArr.filter(a => String(a.dataItemId) === String(itemId));
      if (found.length > 0) {
        allAssignments.push(...found);
      }
    }
  }
  
  // Remove duplicates by qualification key, keeping the last one (highest priority)
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

// Get effective financial definitions across scenario chain
export function getEffectiveFinancialDefs(scenarioChain, overlaysByScenario, financialDefsByScenario) {
  // Collect all financial definitions and merge them by id
  const allDefs = new Map();
  
  // Start from base scenario (reverse order) and apply overlays
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    // Add base definitions first
    if (Array.isArray(financialDefsByScenario[sid])) {
      financialDefsByScenario[sid].forEach(def => {
        allDefs.set(def.id, def);
      });
    }
    // Apply overlays on top
    if (overlaysByScenario[sid]?.financialDefs) {
      Object.values(overlaysByScenario[sid].financialDefs).forEach(def => {
        allDefs.set(def.id, def);
      });
    }
  }
  
  return Array.from(allDefs.values());
}

// Get effective financials for a specific item across scenario chain
export function getEffectiveFinancials(scenarioChain, overlaysByScenario, financialsByScenario, itemId) {
  // Collect all financials from scenario chain and merge overlays
  const allFinancials = {};
  
  // Start from base scenario (reverse order) and apply overlays
  for (const scenario of scenarioChain.slice().reverse()) {
    const sid = scenario.id;
    // Add base financials first
    if (financialsByScenario[sid]?.[itemId]) {
      Object.assign(allFinancials, financialsByScenario[sid][itemId]);
    }
    // Apply overlays on top
    if (overlaysByScenario[sid]?.financials?.[itemId]) {
      Object.assign(allFinancials, overlaysByScenario[sid].financials[itemId]);
    }
  }
  
  return allFinancials;
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
  const qualiDefsByScenario = state.simQualification.qualificationDefsByScenario;
  const financialDefsByScenario = state.simFinancials.financialDefsByScenario;
  const financialsByScenario = state.simFinancials.financialsByScenario;

  const scenarioChain = getScenarioChain(scenarios, scenarioId);

  const effectiveDataItems = getEffectiveDataItems(scenarioChain, overlaysByScenario, dataByScenario);
  const effectiveBookingsByItem = {};
  const effectiveGroupAssignmentsByItem = {};
  const effectiveQualificationAssignmentsByItem = {};
  const effectiveFinancialsByItem = {};

  Object.keys(effectiveDataItems).forEach(itemId => {
    effectiveBookingsByItem[itemId] = getEffectiveBookings(scenarioChain, overlaysByScenario, bookingsByScenario, itemId);
    effectiveGroupAssignmentsByItem[itemId] = getEffectiveGroupAssignments(scenarioChain, overlaysByScenario, groupsByScenario, itemId);
    effectiveQualificationAssignmentsByItem[itemId] = getEffectiveQualificationAssignments(scenarioChain, overlaysByScenario, qualiAssignmentsByScenario, itemId);
    effectiveFinancialsByItem[itemId] = getEffectiveFinancials(scenarioChain, overlaysByScenario, financialsByScenario, itemId);
  });

  const effectiveGroupDefs = getEffectiveGroupDefs(scenarioChain, overlaysByScenario, groupDefsByScenario);
  const effectiveFinancialDefs = getEffectiveFinancialDefs(scenarioChain, overlaysByScenario, financialDefsByScenario);

  // Add effectiveQualificationDefs (merged by key, overlays take precedence)
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
  const effectiveQualificationDefs = Array.from(allDefs.values());

  return {
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    effectiveQualificationAssignmentsByItem,
    effectiveGroupDefs,
    effectiveQualificationDefs,
    effectiveFinancialDefs,
    effectiveFinancialsByItem,
    scenarioChain
  };
}

// Helper: collect all descendant scenario IDs (including self) to prevent circular dependencies
export function getDescendantScenarioIds(scenarioId, scenarios) {
  const descendants = new Set([scenarioId]); // Include self
  
  function collectChildren(parentId) {
    scenarios.forEach(scenario => {
      if (scenario.baseScenarioId === parentId && !descendants.has(scenario.id)) {
        descendants.add(scenario.id);
        collectChildren(scenario.id); // Recursively collect children
      }
    });
  }
  
  collectChildren(scenarioId);
  return Array.from(descendants);
}

