import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { importScenario } from '../store/simScenarioSlice';
import { extractAdebisData } from '../utils/adebis-import';
import {
  adebis2simData,
  adebis2bookings,
  adebis2GroupDefs,
  adebis2QualiDefs,
  adebis2GroupAssignments,
  adebis2QualiAssignments
} from '../utils/adebis-parser';

// Minimal scenario import hook using the new adebis-import
export function useScenarioImport() {
  const dispatch = useDispatch();

  const importScenarioHandler = useCallback(
    async ({ file, isAnonymized }) => {
      // Extract rawdata from Adebis ZIP
      const { rawdata } = await extractAdebisData(file, isAnonymized);

      // Use parser functions to convert rawdata
      const { simDataList, employeeIdMap } = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw);
      const bookingsList = adebis2bookings(rawdata.belegungRaw).map(b => ({
        ...b,
        id: String(b.id)
      }));
      const groupDefs = adebis2GroupDefs(rawdata.groupsRaw);
      const qualiDefs = adebis2QualiDefs(rawdata.employeesRaw);
      const groupAssignments = adebis2GroupAssignments(rawdata.grukiRaw);
      const qualiAssignments = adebis2QualiAssignments(rawdata.employeesRaw);

      // Scenario settings
      const scenarioName = isAnonymized ? 'Importiertes Szenario (anonymisiert)' : 'Importiertes Szenario';
      const scenarioSettings = {
        name: scenarioName,
        remark: '',
        confidence: 50,
        likelihood: 50,
        baseScenarioId: null,
        imported: true,
        importedAnonymized: !!isAnonymized
      };

      // Dispatch the importScenario thunk/action
      await dispatch(importScenario({
        scenarioSettings,
        groupDefs,
        qualiDefs,
        groupAssignments,
        qualiAssignments,
        simDataList,
        bookingsList
      }));
    },
    [dispatch]
  );

  return { importScenario: importScenarioHandler };
}