import store from '../store/store';

/**
 * Returns all group assignments for a dataItem that are active at RefDate.
 * Overlay-aware: accepts optional state and scenarioId for overlays/testing.
 * @param {Object} dataItem - The data item (child)
 * @param {string} RefDate - ISO date string (YYYY-MM-DD)
 * @param {Object} [state] - Optional Redux state (for overlays/testing)
 * @param {string} [scenarioId] - Optional scenarioId (for overlays/testing)
 * @returns {Array} GroupAssignment objects
 */
export function getGroupAssignements(dataItem, RefDate, state, scenarioId) {
  if (!dataItem || !dataItem.id) return [];
  state = state || store.getState();
  scenarioId = scenarioId || state.simScenario.selectedScenarioId;

  // Overlay-aware: overlaysByScenario
  const overlays = state.simOverlay?.overlaysByScenario?.[scenarioId]?.groupassignments?.[dataItem.id];
  const baseAssignments = state.simGroup.groupsByScenario?.[scenarioId]?.[dataItem.id] || {};
  // Overlays take precedence
  const allAssignments = overlays
    ? { ...baseAssignments, ...overlays }
    : baseAssignments;

  return Object.values(allAssignments).filter(a => {
    const startOk = !a.start || a.start <= RefDate;
    const endOk = !a.end || a.end >= RefDate;
    return startOk && endOk;
  });
}

/**
 * Checks if the dataItem is assigned to a school group at RefDate.
 * Overlay-aware: accepts optional state and scenarioId for overlays/testing.
 * @param {Object} dataItem - The data item (child)
 * @param {string} RefDate - ISO date string (YYYY-MM-DD)
 * @param {Object} [state] - Optional Redux state (for overlays/testing)
 * @param {string} [scenarioId] - Optional scenarioId (for overlays/testing)
 * @returns {boolean}
 */
export function isInSchoolGroupAssignments(dataItem, RefDate, state, scenarioId) {
  if (!dataItem || !dataItem.id) return false;
  state = state || store.getState();
  scenarioId = scenarioId || state.simScenario.selectedScenarioId;

  // Overlay-aware: overlaysByScenario for groupDefs
  const overlays = state.simOverlay?.overlaysByScenario?.[scenarioId]?.groupDefs;
  const baseGroupDefs = state.simGroup.groupDefsByScenario?.[scenarioId] || [];
  // Overlays take precedence (merge by id)
  let groupDefs = baseGroupDefs;
  if (Array.isArray(overlays)) {
    const overlayMap = new Map(overlays.map(def => [String(def.id), def]));
    groupDefs = baseGroupDefs.map(def => overlayMap.get(String(def.id)) || def);
    // Add overlay-only groupDefs
    overlays.forEach(def => {
      if (!baseGroupDefs.find(g => String(g.id) === String(def.id))) groupDefs.push(def);
    });
  }

  const assignments = getGroupAssignements(dataItem, RefDate, state, scenarioId);
  return assignments.some(a => {
    const groupDef = groupDefs.find(g => String(g.id) === String(a.groupId));
    return groupDef && groupDef.IsSchool;
  });
}
