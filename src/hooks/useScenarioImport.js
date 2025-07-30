import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { importScenario } from '../store/simScenarioSlice';
import { extractAdebisData } from '../utils/adebis-reader';
import {
  adebis2simData,
  adebis2bookings,
  adebis2GroupDefs,
  adebis2QualiDefs,
  adebis2GroupAssignments,
  adebis2QualiAssignments
} from '../utils/adebis-parser';

// Refactored: only orchestrates, no direct mapping or slice dispatching
export function useScenarioImport() {
  const dispatch = useDispatch();

  const importScenarioHandler = useCallback(
    async ({ file, isAnonymized, importLimit }) => {
      // 1. Extract raw data
      const { rawdata } = await extractAdebisData(file, isAnonymized);

      // 2. Apply limit to kids and filter related entities accordingly
      let kidsRaw = rawdata.kidsRaw;
      let employeesRaw = rawdata.employeesRaw;
      let belegungRaw = rawdata.belegungRaw;
      let groupsRaw = rawdata.groupsRaw;
      let grukiRaw = rawdata.grukiRaw;

      if (typeof importLimit === 'number' && importLimit > 0) {
        kidsRaw = kidsRaw.slice(0, importLimit);
        const allowedKidIds = new Set(kidsRaw.map(k => String(k.KINDNR)));
        belegungRaw = belegungRaw.filter(b => allowedKidIds.has(String(b.KINDNR)));
        grukiRaw = grukiRaw.filter(g => allowedKidIds.has(String(g.KINDNR)));
        const allowedGroupIds = new Set(grukiRaw.map(g => String(g.GRUNR)));
        groupsRaw = groupsRaw.filter(grp => allowedGroupIds.has(String(grp.GRUNR)));
      }

      // 3. Transform raw data using parser functions
      const { simDataList } = adebis2simData(kidsRaw, employeesRaw);
      const { bookings, bookingReference } = adebis2bookings(belegungRaw, employeesRaw);
      const groupDefs = adebis2GroupDefs(groupsRaw);
      const qualiDefs = adebis2QualiDefs(employeesRaw);
      const { groupAssignments, groupAssignmentReference } = adebis2GroupAssignments(grukiRaw);

      // 4. Prepare scenario settings
      const scenarioName = isAnonymized ? 'Importiertes Szenario (anonymisiert)' : 'Importiertes Szenario';
      const scenarioSettings = {
        name: scenarioName,
        remark: '',
        confidence: 50,
        likelihood: 50,
        desirability: 50,
        baseScenarioId: null,
        imported: true,
        importedAnonymized: !!isAnonymized
      };

      // 5. Build import payload and dispatch importer thunk
      await dispatch(importScenario({
        scenarioSettings,
        simDataList,
        bookings,
        bookingReference,
        groupDefs,
        qualiDefs,
        groupAssignments,
        groupAssignmentReference,
        // qualiAssignments will be built in the thunk after mapping
      }));
    },
    [dispatch]
  );

  return { importScenario: importScenarioHandler };
}