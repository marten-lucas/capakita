import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { configureStore } from '@reduxjs/toolkit';

import simScenarioReducer, { importScenario } from '../store/simScenarioSlice';
import simDataReducer from '../store/simDataSlice';
import simBookingReducer from '../store/simBookingSlice';
import simGroupReducer from '../store/simGroupSlice';
import simQualificationReducer from '../store/simQualificationSlice';
import simOverlayReducer from '../store/simOverlaySlice';
import chartReducer from '../store/chartSlice';
import eventReducer from '../store/eventSlice';
import datesOfInterestReducer from '../store/datesOfInterestSlice';
import { extractAdebisData } from './adebis-reader';
import {
  adebis2simData,
  adebis2bookings,
  adebis2GroupDefs,
  adebis2QualiDefs,
  adebis2GroupAssignments,
} from './adebis-parser';

const importZip = path.resolve(process.cwd(), 'tests/testdata/kita-anonym-48338222.zip');

function createTestStore() {
  return configureStore({
    reducer: {
      simScenario: simScenarioReducer,
      simData: simDataReducer,
      simBooking: simBookingReducer,
      simGroup: simGroupReducer,
      simQualification: simQualificationReducer,
      simOverlay: simOverlayReducer,
      chart: chartReducer,
      events: eventReducer,
      datesOfInterest: datesOfInterestReducer,
    },
  });
}

function hasEnteredTimes(itemBookings) {
  return Object.values(itemBookings || {}).some((booking) =>
    Array.isArray(booking?.times) &&
    booking.times.some((day) => Array.isArray(day?.segments) && day.segments.length > 0)
  );
}

function xmlTimesContainRealEntries(value) {
  return /\b\d{1,2}:\d{2}\b/.test(String(value || ''));
}

describe('Adebis import regression', () => {
  it('imports times for every child and employee whose ZEITEN field is not empty', async () => {
    const zipBuffer = await readFile(importZip);
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    const { simDataList } = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw);
    const { bookings, bookingReference } = adebis2bookings(rawdata.belegungRaw, rawdata.employeesRaw);
    const groupDefs = adebis2GroupDefs(rawdata.groupsRaw);
    const qualiDefs = adebis2QualiDefs(rawdata.employeesRaw);
    const { groupAssignments } = adebis2GroupAssignments(rawdata.grukiRaw);

    const store = createTestStore();
    await store.dispatch(
      importScenario({
        scenarioSettings: {
          name: 'Import Regression',
          imported: true,
          importedAnonymized: false,
        },
        simDataList,
        bookings,
        bookingReference,
        groupDefs,
        qualiDefs,
        groupAssignments,
      })
    );

    const state = store.getState();
    const scenarioId = state.simScenario.selectedScenarioId;
    const dataByScenario = state.simData.dataByScenario[scenarioId] || {};
    const bookingsByScenario = state.simBooking.bookingsByScenario[scenarioId] || {};

    const importedChildIds = new Set((rawdata.kidsRaw || []).map((entry) => String(entry.KINDNR)));

    const childIdsWithTimes = new Set(
      (rawdata.belegungRaw || [])
        .filter((entry) => importedChildIds.has(String(entry.KINDNR)))
        .filter((entry) => xmlTimesContainRealEntries(entry.ZEITEN))
        .map((entry) => String(entry.KINDNR))
    );

    const employeeIdsWithTimes = new Set(
      (rawdata.employeesRaw || [])
        .filter((entry) => xmlTimesContainRealEntries(entry.ZEITEN))
        .map((entry) => String(entry.IDNR))
    );

    expect(childIdsWithTimes.size).toBeGreaterThan(0);
    expect(employeeIdsWithTimes.size).toBeGreaterThan(0);

    let checkedChildren = 0;
    let checkedEmployees = 0;

    Object.entries(dataByScenario).forEach(([itemId, item]) => {
      if (item.type === 'demand' && childIdsWithTimes.has(String(item.rawdata?.KINDNR))) {
        checkedChildren += 1;
        expect(hasEnteredTimes(bookingsByScenario[itemId]), `Kind ${item.name} should have imported times`).toBe(true);
      }

      if (item.type === 'capacity' && employeeIdsWithTimes.has(String(item.rawdata?.IDNR))) {
        checkedEmployees += 1;
        expect(hasEnteredTimes(bookingsByScenario[itemId]), `Mitarbeiter ${item.name} should have imported times`).toBe(true);
      }
    });

    expect(checkedChildren).toBe(childIdsWithTimes.size);
    expect(checkedEmployees).toBe(employeeIdsWithTimes.size);
  });
});
