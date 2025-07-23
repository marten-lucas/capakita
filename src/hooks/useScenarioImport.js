import { useCallback } from 'react';
import useSimScenarioStore from '../store/simScenarioStore';
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
  const importScenarioToStore = useSimScenarioStore(state => state.importScenario);

  const importScenario = useCallback(
    async ({ file, isAnonymized }) => {
      // Extract rawdata from Adebis ZIP
      const { rawdata } = await extractAdebisData(file, isAnonymized);

      // Use parser functions to convert rawdata
      const simDataList = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw);
      const bookingsList = adebis2bookings(rawdata.belegungRaw);
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

      // Use the new importScenario function
      await importScenarioToStore({
        scenarioSettings,
        groupDefs,
        qualiDefs,
        groupAssignments,
        qualiAssignments,
        simDataList,
        bookingsList
      });
    },
    [importScenarioToStore]
  );

  return { importScenario };
}
