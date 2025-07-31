import { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setDataItemOverlay, removeDataItemOverlay } from '../store/simOverlaySlice';
import { getScenarioChain } from '../utils/overlayUtils'; // <-- import here

// Helper: overlay-aware lookup for object (e.g. dataItems, bookings, groupassignments)
function overlayObjectChainLookup({ overlaysByScenario, dataByScenario, scenarioChain, key, subkey }) {
  for (const scenario of scenarioChain) {
    const sid = scenario.id;
    // overlaysByScenario: { [sid]: { dataItems: { [key]: ... }, ... } }
    if (overlaysByScenario[sid]?.[key]?.[subkey]) return overlaysByScenario[sid][key][subkey];
    if (dataByScenario[sid]?.[subkey]) return dataByScenario[sid][subkey];
  }
  return null;
}

export function useOverlayData() {
  const dispatch = useDispatch();

  // Get all necessary data from store
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const overlaysByScenario = useSelector(state => state.simOverlay.overlaysByScenario);
  const dataByScenario = useSelector(state => state.simData.dataByScenario);
  const bookingsByScenario = useSelector(state => state.simBooking.bookingsByScenario);
  const groupDefsByScenario = useSelector(state => state.simGroup.groupDefsByScenario);
  const groupsByScenario = useSelector(state => state.simGroup.groupsByScenario);
  const qualiDefsByScenario = useSelector(state => state.simQualification.qualificationDefsByScenario);
  const qualiAssignmentsByScenario = useSelector(state => state.simQualification.qualificationAssignmentsByScenario);

  const selectedScenario = useMemo(() =>
    scenarios.find(s => s.id === selectedScenarioId),
    [scenarios, selectedScenarioId]
  );

  // Build scenario chain from current to root
  const scenarioChain = useMemo(() => getScenarioChain(scenarios, selectedScenarioId), [scenarios, selectedScenarioId]);
  const baseScenario = scenarioChain.length > 1 ? scenarioChain[1] : null;
  const isBasedScenario = !!selectedScenario?.baseScenarioId;

  // Data Items
  const getEffectiveDataItem = useCallback((itemId) => {
    if (!itemId) return null;
    return overlayObjectChainLookup({
      overlaysByScenario,
      dataByScenario,
      scenarioChain,
      key: 'dataItems',
      subkey: itemId
    });
  }, [overlaysByScenario, dataByScenario, scenarioChain]);

  const getEffectiveDataItems = useCallback(() => {
    // Collect all keys from overlays and data, merge overlays over base
    const allKeys = new Set();
    for (const scenario of scenarioChain.slice().reverse()) {
      const sid = scenario.id;
      if (overlaysByScenario[sid]?.dataItems) Object.keys(overlaysByScenario[sid].dataItems).forEach(k => allKeys.add(k));
      if (dataByScenario[sid]) Object.keys(dataByScenario[sid]).forEach(k => allKeys.add(k));
    }
    const result = {};
    allKeys.forEach(itemId => {
      result[itemId] = getEffectiveDataItem(itemId);
    });
    return result;
  }, [scenarioChain, overlaysByScenario, dataByScenario, getEffectiveDataItem]);

  // Bookings
  const getEffectiveBookings = useCallback((itemId) => {
    // Returns { [bookingId]: booking } for the itemId, overlay-aware, stacked
    for (const scenario of scenarioChain) {
      const sid = scenario.id;
      if (overlaysByScenario[sid]?.bookings?.[itemId]) return overlaysByScenario[sid].bookings[itemId];
      if (bookingsByScenario[sid]?.[itemId]) return bookingsByScenario[sid][itemId];
    }
    return {};
  }, [scenarioChain, overlaysByScenario, bookingsByScenario]);

  // Group Definitions
  const getEffectiveGroupDefs = useCallback(() => {
    // Returns merged groupDefs array, overlays take precedence, stacked
    for (const scenario of scenarioChain) {
      const sid = scenario.id;
      if (Array.isArray(overlaysByScenario[sid]?.groupDefs) && overlaysByScenario[sid].groupDefs.length > 0)
        return overlaysByScenario[sid].groupDefs;
      if (Array.isArray(groupDefsByScenario[sid]) && groupDefsByScenario[sid].length > 0)
        return groupDefsByScenario[sid];
    }
    return [];
  }, [scenarioChain, overlaysByScenario, groupDefsByScenario]);

  // Group Assignments
  const getEffectiveGroupAssignments = useCallback((itemId) => {
    // Returns { [groupId]: groupAssignment } for the itemId, overlay-aware, stacked
    for (const scenario of scenarioChain) {
      const sid = scenario.id;
      if (overlaysByScenario[sid]?.groupassignments?.[itemId]) return overlaysByScenario[sid].groupassignments[itemId];
      if (groupsByScenario[sid]?.[itemId]) return groupsByScenario[sid][itemId];
    }
    return {};
  }, [scenarioChain, overlaysByScenario, groupsByScenario]);

  // Qualification Definitions
  const getEffectiveQualificationDefs = useCallback(() => {
    // Collect all qualification definitions and merge them by key
    const allDefs = new Map();
    
    // Start from base scenario (reverse order) and apply overlays
    for (const scenario of scenarioChain.slice().reverse()) {
      const sid = scenario.id;
      // Add base definitions first
      if (Array.isArray(qualiDefsByScenario[sid])) {
        qualiDefsByScenario[sid].forEach(def => {
          allDefs.set(def.key, def);
        });
      }
      // Apply overlays on top
      if (Array.isArray(overlaysByScenario[sid]?.qualificationDefs)) {
        overlaysByScenario[sid].qualificationDefs.forEach(def => {
          allDefs.set(def.key, def);
        });
      }
    }
    
    return Array.from(allDefs.values());
  }, [scenarioChain, overlaysByScenario, qualiDefsByScenario]);

  // Qualification Assignments
  const getEffectiveQualificationAssignments = useCallback((itemId) => {
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
  }, [scenarioChain, overlaysByScenario, qualiAssignmentsByScenario]);

  // Overlay helpers (unchanged)
  const updateDataItem = useCallback((itemId, updates) => {
    if (!selectedScenarioId || !selectedScenario) return;
    if (selectedScenario.baseScenarioId) {
      // This is a based scenario - create/update overlay
      const baseData = getEffectiveDataItem(itemId);
      if (!baseData) return;
      const newData = { ...baseData, ...updates };
      // Check if the new data is identical to base data
      const isIdenticalToBase = JSON.stringify(newData) === JSON.stringify(baseData);
      if (isIdenticalToBase) {
        dispatch(removeDataItemOverlay({ scenarioId: selectedScenarioId, itemId }));
      } else {
        dispatch(setDataItemOverlay({
          scenarioId: selectedScenarioId,
          itemId,
          overlayData: newData
        }));
      }
    } else {
      dispatch({
        type: 'simData/updateDataItemFields',
        payload: { scenarioId: selectedScenarioId, itemId, fields: updates }
      });
    }
  }, [selectedScenarioId, selectedScenario, dispatch, getEffectiveDataItem]);

  const hasOverlay = useCallback((itemId) => {
    if (!selectedScenarioId || !selectedScenario?.baseScenarioId) return false;
    return !!overlaysByScenario[selectedScenarioId]?.dataItems?.[itemId];
  }, [selectedScenarioId, selectedScenario, overlaysByScenario]);

  const revertToBase = useCallback((itemId) => {
    if (!selectedScenarioId || !selectedScenario?.baseScenarioId) return;
    dispatch(removeDataItemOverlay({ scenarioId: selectedScenarioId, itemId }));
  }, [selectedScenarioId, selectedScenario, dispatch]);

  // Expose all helpers
  return {
    selectedScenario,
    baseScenario,
    isBasedScenario,
    scenarioChain,
    getEffectiveDataItem,
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupDefs,
    getEffectiveGroupAssignments,
    getEffectiveQualificationDefs,
    getEffectiveQualificationAssignments,
    updateDataItem,
    hasOverlay,
    revertToBase,
  };
}
