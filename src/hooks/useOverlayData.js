import { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setDataItemOverlay, removeDataItemOverlay } from '../store/simOverlaySlice';

export function useOverlayData() {
  const dispatch = useDispatch();
  
  // Get all necessary data from store
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const overlaysByScenario = useSelector(state => state.simOverlay.overlaysByScenario);
  const dataByScenario = useSelector(state => state.simData.dataByScenario);

  const selectedScenario = useMemo(() => 
    scenarios.find(s => s.id === selectedScenarioId), 
    [scenarios, selectedScenarioId]
  );

  // Get the base scenario if this is a based scenario
  const baseScenario = useMemo(() => {
    if (!selectedScenario?.baseScenarioId) return null;
    return scenarios.find(s => s.id === selectedScenario.baseScenarioId);
  }, [scenarios, selectedScenario]);

  // Function to get effective data for a data item
  const getEffectiveDataItem = useCallback((itemId) => {
    if (!selectedScenarioId) return null;
    
    // If this is a based scenario, check for overlay first, then fall back to base
    if (selectedScenario?.baseScenarioId) {
      const overlay = overlaysByScenario[selectedScenarioId]?.dataItems?.[itemId];
      if (overlay) {
        return overlay;
      }
      // Fall back to base scenario data
      const baseData = dataByScenario[selectedScenario.baseScenarioId]?.[itemId];
      return baseData || null;
    }
    
    // Regular scenario - just return direct data
    return dataByScenario[selectedScenarioId]?.[itemId] || null;
  }, [selectedScenarioId, selectedScenario, overlaysByScenario, dataByScenario]);

  // Function to get all effective data items for a scenario
  const getEffectiveDataItems = useCallback(() => {
    if (!selectedScenarioId) return {};
    
    if (selectedScenario?.baseScenarioId) {
      // Start with base scenario data
      const baseData = dataByScenario[selectedScenario.baseScenarioId] || {};
      const overlayData = overlaysByScenario[selectedScenarioId]?.dataItems || {};
      
      // Merge base data with overlays
      return { ...baseData, ...overlayData };
    }
    
    // Regular scenario
    return dataByScenario[selectedScenarioId] || {};
  }, [selectedScenarioId, selectedScenario, overlaysByScenario, dataByScenario]);

  // Function to update a data item (creates overlay if needed)
  const updateDataItem = useCallback((itemId, updates) => {
    if (!selectedScenarioId || !selectedScenario) return;

    if (selectedScenario.baseScenarioId) {
      // This is a based scenario - create/update overlay
      const baseData = dataByScenario[selectedScenario.baseScenarioId]?.[itemId];
      if (!baseData) return; // Item doesn't exist in base scenario
      
      const currentOverlay = overlaysByScenario[selectedScenarioId]?.dataItems?.[itemId];
      const currentData = currentOverlay || baseData;
      const newData = { ...currentData, ...updates };
      
      // Check if the new data is identical to base data
      const isIdenticalToBase = JSON.stringify(newData) === JSON.stringify(baseData);
      
      if (isIdenticalToBase) {
        // Remove overlay if data matches base
        dispatch(removeDataItemOverlay({ scenarioId: selectedScenarioId, itemId }));
      } else {
        // Create/update overlay
        dispatch(setDataItemOverlay({ 
          scenarioId: selectedScenarioId, 
          itemId, 
          overlayData: newData 
        }));
      }
    } else {
      // Regular scenario - update directly in simData
      dispatch({
        type: 'simData/updateDataItemFields',
        payload: { scenarioId: selectedScenarioId, itemId, fields: updates }
      });
    }
  }, [selectedScenarioId, selectedScenario, overlaysByScenario, dataByScenario, dispatch]);

  // Function to check if an item has an overlay
  const hasOverlay = useCallback((itemId) => {
    if (!selectedScenarioId || !selectedScenario?.baseScenarioId) return false;
    return !!overlaysByScenario[selectedScenarioId]?.dataItems?.[itemId];
  }, [selectedScenarioId, selectedScenario, overlaysByScenario]);

  // Function to remove an overlay and revert to base
  const revertToBase = useCallback((itemId) => {
    if (!selectedScenarioId || !selectedScenario?.baseScenarioId) return;
    dispatch(removeDataItemOverlay({ scenarioId: selectedScenarioId, itemId }));
  }, [selectedScenarioId, selectedScenario, dispatch]);

  // Function to check if a qualification assignment has an overlay
  const hasQualificationOverlay = useCallback((itemId) => {
    if (!selectedScenarioId || !selectedScenario?.baseScenarioId) return false;
    return !!overlaysByScenario[selectedScenarioId]?.qualificationDefs?.find(
      (assignment) => assignment.dataItemId === itemId
    );
  }, [selectedScenarioId, selectedScenario, overlaysByScenario]);

  return {
    selectedScenario,
    baseScenario,
    isBasedScenario: !!selectedScenario?.baseScenarioId,
    getEffectiveDataItem,
    getEffectiveDataItems,
    updateDataItem,
    hasOverlay,
    revertToBase,
    hasQualificationOverlay,
  };
}
