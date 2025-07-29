import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import CryptoJS from 'crypto-js';
import { validatePassword } from '../utils/saveLoadUtils';
import { setScenarios, setSelectedScenarioId, setSelectedItem } from '../store/simScenarioSlice';
import { setStichtag, setSelectedGroups, setSelectedQualifications, setWeeklySelectedScenarioId, setMidtermSelectedScenarioId, setMidtermTimeDimension, setMidtermSelectedGroups, setMidtermSelectedQualifications, setChartToggles } from '../store/chartSlice';

export function useSaveLoad() {
  const dispatch = useDispatch();
  // Only select the slices needed for saveData
  const simScenario = useSelector(state => state.simScenario);
  const simData = useSelector(state => state.simData);
  const simBooking = useSelector(state => state.simBooking);
  const simGroup = useSelector(state => state.simGroup);
  const simQualification = useSelector(state => state.simQualification);
  const simFinancials = useSelector(state => state.simFinancials);
  const chart = useSelector(state => state.chart);

  const saveData = useCallback(async (password) => {
    try {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return {
          success: false,
          error: passwordError
        };
      }

      const saveData = {
        scenarios: simScenario.scenarios,
        selectedScenarioId: simScenario.selectedScenarioId,
        dataByScenario: simData.dataByScenario,
        bookingsByScenario: simBooking.bookingsByScenario,
        groupsByScenario: simGroup.groupsByScenario,
        groupDefsByScenario: simGroup.groupDefsByScenario,
        qualificationDefsByScenario: simQualification.qualificationDefsByScenario,
        qualificationAssignmentsByScenario: simQualification.qualificationAssignmentsByScenario,
        financialsByScenario: simFinancials.financialsByScenario,
        chartStore: {
          stichtag: chart.stichtag,
          selectedGroups: chart.selectedGroups,
          selectedQualifications: chart.selectedQualifications,
          weeklySelectedScenarioId: chart.weeklySelectedScenarioId,
          midtermSelectedScenarioId: chart.midtermSelectedScenarioId,
          midtermTimeDimension: chart.midtermTimeDimension,
          midtermSelectedGroups: chart.midtermSelectedGroups,
          midtermSelectedQualifications: chart.midtermSelectedQualifications,
          chartToggles: chart.chartToggles,
        }
      };

      const json = JSON.stringify(saveData);
      const ciphertext = CryptoJS.AES.encrypt(json, password).toString();
      
      // Filename template: {datetime}-{scenarioname}.cap.capakita
      const scenarioName = simScenario.scenarios.find(s => s.id === simScenario.selectedScenarioId)?.name || 'Unbenannt';
      const now = new Date();
      const datetime = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // e.g. 2024-06-13T12-34-56-789
      const safeName = scenarioName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${datetime}-${safeName}.capakita`;

      const blob = new Blob([ciphertext], { type: 'text/plain' });
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
    simFinancials,
    chart
  ]);

  const loadData = useCallback(async (file, password) => {
    try {
      const text = await file.text();
      
      try {
        const bytes = CryptoJS.AES.decrypt(text, password);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedText) {
          return {
            success: false,
            error: 'Falsches Passwort oder beschädigte Datei.'
          };
        }

        const data = JSON.parse(decryptedText);
        
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
        if (data.qualificationDefsByScenario) {
          dispatch({ type: 'simQualification/loadQualificationDefsByScenario', payload: data.qualificationDefsByScenario });
        }
        if (data.qualificationAssignmentsByScenario) {
          dispatch({ type: 'simQualification/loadQualificationAssignmentsByScenario', payload: data.qualificationAssignmentsByScenario });
        }
        if (data.financialsByScenario) {
          dispatch({ type: 'simFinancials/loadFinancialsByScenario', payload: data.financialsByScenario });
        }

        // Load chart store
        if (data.chartStore) {
          if (data.chartStore.stichtag) dispatch(setStichtag(data.chartStore.stichtag));
          if (data.chartStore.selectedGroups) dispatch(setSelectedGroups(data.chartStore.selectedGroups));
          if (data.chartStore.selectedQualifications) dispatch(setSelectedQualifications(data.chartStore.selectedQualifications));
          if (data.chartStore.weeklySelectedScenarioId) dispatch(setWeeklySelectedScenarioId(data.chartStore.weeklySelectedScenarioId));
          if (data.chartStore.midtermSelectedScenarioId) dispatch(setMidtermSelectedScenarioId(data.chartStore.midtermSelectedScenarioId));
          if (data.chartStore.midtermTimeDimension) dispatch(setMidtermTimeDimension(data.chartStore.midtermTimeDimension));
          if (data.chartStore.midtermSelectedGroups) dispatch(setMidtermSelectedGroups(data.chartStore.midtermSelectedGroups));
          if (data.chartStore.midtermSelectedQualifications) dispatch(setMidtermSelectedQualifications(data.chartStore.midtermSelectedQualifications));
          if (data.chartStore.chartToggles) dispatch(setChartToggles(data.chartStore.chartToggles));
        }

        // Load selected items
        if (data.selectedItems) {
          Object.entries(data.selectedItems).forEach(([, itemId]) => {
            dispatch(setSelectedItem(itemId));
          });
        } else {
          dispatch(setSelectedItem(null));
        }

        return { success: true };
      } catch {
        return {
          success: false,
          error: 'Falsches Passwort oder beschädigte Datei.'
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