import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { importScenario } from '../store/simScenarioSlice';
import { extractAdebisData } from '../utils/adebis-reader';
import {
  adebis2simData,
  adebis2bookings,
  adebis2GroupDefs,
  adebis2QualiDefs,
  adebis2GroupAssignments
} from '../utils/adebis-parser';

export function useScenarioImport() {
  const dispatch = useDispatch();

  const importScenarioHandler = useCallback(
    async ({ file, isAnonymized, importLimit }) => {
      const { rawdata } = await extractAdebisData(file, isAnonymized);

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

      const { simDataList } = adebis2simData(kidsRaw, employeesRaw);
      const { bookings, bookingReference } = adebis2bookings(belegungRaw, employeesRaw);
      const groupDefs = adebis2GroupDefs(groupsRaw);
      const qualiDefs = adebis2QualiDefs(employeesRaw);
      const { groupAssignments, groupAssignmentReference } = adebis2GroupAssignments(grukiRaw);

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

      await dispatch(importScenario({
        scenarioSettings,
        simDataList,
        bookings,
        bookingReference,
        groupDefs,
        qualiDefs,
        groupAssignments,
        groupAssignmentReference
      }));
    },
    [dispatch]
  );

  return { importScenario: importScenarioHandler };
}