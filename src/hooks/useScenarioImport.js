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
import { getItemByAdebisID } from '../store/simDataSlice';

// Minimal scenario import hook using the new adebis-import
export function useScenarioImport() {
  const dispatch = useDispatch();

  const importScenarioHandler = useCallback(
    async ({ file, isAnonymized, importLimit }) => {
      const { rawdata } = await extractAdebisData(file, isAnonymized);

      // Apply limit only to kids, and filter related entities accordingly
      let kidsRaw = rawdata.kidsRaw;
      let employeesRaw = rawdata.employeesRaw;
      let belegungRaw = rawdata.belegungRaw;
      let groupsRaw = rawdata.groupsRaw;
      let grukiRaw = rawdata.grukiRaw;

      if (typeof importLimit === 'number' && importLimit > 0) {
        kidsRaw = kidsRaw.slice(0, importLimit);
        const allowedKidIds = new Set(kidsRaw.map(k => String(k.KINDNR)));

        // Only include bookings for allowed kids
        belegungRaw = belegungRaw.filter(b => allowedKidIds.has(String(b.KINDNR)));
        // Only include group assignments for allowed kids
        grukiRaw = grukiRaw.filter(g => allowedKidIds.has(String(g.KINDNR)));
        // Only include employees if you want to limit them as well (optional)
        // employeesRaw = employeesRaw.slice(0, importLimit);
        // Only include groups that are referenced by allowed kids/group assignments
        const allowedGroupIds = new Set(grukiRaw.map(g => String(g.GRUNR)));
        groupsRaw = groupsRaw.filter(grp => allowedGroupIds.has(String(grp.GRUNR)));
      }

      const { simDataList } = adebis2simData(kidsRaw, employeesRaw);
      const { bookings, bookingReference } = adebis2bookings(belegungRaw, employeesRaw);
      const groupDefs = adebis2GroupDefs(groupsRaw);
      const qualiDefs = adebis2QualiDefs(employeesRaw);
      const groupAssignments = adebis2GroupAssignments(grukiRaw);
      const qualiAssignments = adebis2QualiAssignments(employeesRaw);

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
      await dispatch(async (dispatch, getState) => {
        // Add scenario and simData first
        await dispatch(importScenario({
          scenarioSettings,
          groupDefs,
          qualiDefs,
          groupAssignments,
          qualiAssignments,
          simDataList,
          bookingsList: [] // We'll handle bookings below
        }));

        // Import qualification defs and assignments
        const state = getState();
        const scenarioId = state.simScenario.selectedScenarioId;
        dispatch({
          type: 'simQualification/importQualificationDefs',
          payload: { scenarioId, defs: qualiDefs }
        });
        dispatch({
          type: 'simQualification/importQualificationAssignments',
          payload: { scenarioId, assignments: qualiAssignments }
        });

        // Now link bookings to correct dataItemId using bookingReference
        const bookingsWithDataItemId = bookings.map(booking => {
          const ref = bookingReference.find(r => r.bookingKey === booking.id);
          if (!ref) return null;
          const dataItem = getItemByAdebisID(state, scenarioId, ref.adebisId);
          if (!dataItem) return null;
          const dataByScenario = state.simData.dataByScenario[scenarioId];
          const dataItemId = Object.keys(dataByScenario).find(
            key => dataByScenario[key] === dataItem
          );
          if (!dataItemId) return null;
          return { ...booking, dataItemId };
        }).filter(Boolean);

        if (bookingsWithDataItemId.length > 0) {
          dispatch({
            type: 'simBooking/importBookings',
            payload: { scenarioId, items: bookingsWithDataItemId }
          });
        }
      });
    },
    [dispatch]
  );

  return { importScenario: importScenarioHandler };
}