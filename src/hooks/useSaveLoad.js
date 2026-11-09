import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { anonymizeSaveData, decodeCapakitaExport, encodeCapakitaExport, validatePassword } from '../utils/saveLoadUtils';
import { setScenarios, setSelectedScenarioId, setSelectedItems } from '../store/simScenarioSlice';


export function useSaveLoad() {
  const dispatch = useDispatch();
  // Only select the slices needed for saveData
  const simScenario = useSelector(state => state.simScenario);
  const simData = useSelector(state => state.simData);
  const simBooking = useSelector(state => state.simBooking);
  const simGroup = useSelector(state => state.simGroup);
  const simQualification = useSelector(state => state.simQualification);
  const simFinance = useSelector(state => state.simFinance);
  const chart = useSelector(state => state.chart);

  const saveData = useCallback(async (password, { anonymize = false } = {}) => {
    try {
      const passwordError = password
        ? validatePassword(password)
        : anonymize ? null : validatePassword(password);
      if (passwordError) {
        return {
          success: false,
          error: passwordError
        };
      }

      const workspaceData = {
        scenarios: simScenario.scenarios,
        selectedScenarioId: simScenario.selectedScenarioId,
        dataByScenario: simData.dataByScenario,
        bookingsByScenario: simBooking.bookingsByScenario,
        groupsByScenario: simGroup.groupsByScenario,
        groupDefsByScenario: simGroup.groupDefsByScenario,
        financeByScenario: simFinance.financeByScenario,
        qualificationDefsByScenario: simQualification.qualificationDefsByScenario,
        qualificationAssignmentsByScenario: simQualification.qualificationAssignmentsByScenario,
        chartStore: chart,
        selectedItems: simScenario.selectedItems,
      };

      const exportData = anonymize ? anonymizeSaveData(workspaceData) : workspaceData;
      const fileContent = encodeCapakitaExport(exportData, { password, anonymized: anonymize });
      
      // Filename template: {datetime}-{scenarioname}.cap.capakita
      const scenarioName = exportData.scenarios.find((scenario) => scenario.id === exportData.selectedScenarioId)?.name || 'Unbenannt';
      const now = new Date();
      const datetime = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // e.g. 2024-06-13T12-34-56-789
      const safeName = scenarioName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${datetime}-${safeName}.capakita`;

      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Fehler beim Speichern der Daten.'
      };
    }
  }, [
    simScenario,
    simData,
    simBooking,
    simGroup,
    simQualification,
    simFinance,
    chart
  ]);

  const loadData = useCallback(async (file, password) => {
    try {
      const text = await file.text();
      
      try {
        const data = decodeCapakitaExport(text, password);
        
        // Clear existing state and load new data
        dispatch(setScenarios(data.scenarios || []));
        dispatch(setSelectedScenarioId(data.selectedScenarioId || null));

        // Load all slice data
        if (data.dataByScenario) {
          dispatch({ type: 'simData/loadDataByScenario', payload: data.dataByScenario });
        }
        if (data.bookingsByScenario) {
          dispatch({ type: 'simBooking/loadBookingsByScenario', payload: data.bookingsByScenario });
        }
        if (data.groupsByScenario) {
          dispatch({ type: 'simGroup/loadGroupsByScenario', payload: data.groupsByScenario });
        }
        if (data.groupDefsByScenario) {
          dispatch({ type: 'simGroup/loadGroupDefsByScenario', payload: data.groupDefsByScenario });
        }
        if (data.financeByScenario) {
          dispatch({ type: 'simFinance/loadFinanceByScenario', payload: data.financeByScenario });
        }
        if (data.qualificationDefsByScenario) {
          dispatch({ type: 'simQualification/loadQualificationDefsByScenario', payload: data.qualificationDefsByScenario });
        }
        if (data.qualificationAssignmentsByScenario) {
          dispatch({ type: 'simQualification/loadQualificationAssignmentsByScenario', payload: data.qualificationAssignmentsByScenario });
        }

        if (data.chartStore) {
          dispatch({ type: 'chart/loadChartState', payload: data.chartStore });
        }

        dispatch(setSelectedItems(data.selectedItems?.[data.selectedScenarioId] || []));

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Falsches Passwort oder beschädigte Datei.'
        };
      }
    } catch {
      return {
        success: false,
        error: 'Fehler beim Laden der Datei.'
      };
    }
  }, [dispatch]);

  return { saveData, loadData };
}