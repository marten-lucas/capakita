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
  Zeiten2Booking,
} from './adebis-parser';

const testZips = [
  'kita-anonym-29247781.zip',
  'kita-anonym-48338222.zip',
  'kita-anonym-55055120.zip',
  'kita-anonym-71814654.zip',
  'kita-anonym-72229327.zip',
];

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
  it('supports snapshot and historical import modes', async () => {
    let foundHistoricalDelta = false;

    for (const zipFileName of testZips) {
      const zipPath = path.resolve(process.cwd(), 'tests/testdata', zipFileName);
      const zipBuffer = await readFile(zipPath);

      const snapshotResult = await extractAdebisData(zipBuffer, false, { mode: 'snapshot' });
      const historicalResult = await extractAdebisData(zipBuffer, false, { mode: 'historical' });

      expect(snapshotResult.importMeta?.mode).toBe('snapshot');
      expect(historicalResult.importMeta?.mode).toBe('historical');

      const snapshotRaw = snapshotResult.rawdata;
      const historicalRaw = historicalResult.rawdata;

      expect(historicalRaw.kidsRaw.length).toBeGreaterThanOrEqual(snapshotRaw.kidsRaw.length);
      expect(historicalRaw.employeesRaw.length).toBeGreaterThanOrEqual(snapshotRaw.employeesRaw.length);
      expect(historicalRaw.grukiRaw.length).toBeGreaterThanOrEqual(snapshotRaw.grukiRaw.length);
      expect(historicalRaw.belegungRaw.length).toBeGreaterThanOrEqual(snapshotRaw.belegungRaw.length);

      if (
        historicalRaw.kidsRaw.length > snapshotRaw.kidsRaw.length ||
        historicalRaw.employeesRaw.length > snapshotRaw.employeesRaw.length ||
        historicalRaw.grukiRaw.length > snapshotRaw.grukiRaw.length ||
        historicalRaw.belegungRaw.length > snapshotRaw.belegungRaw.length
      ) {
        foundHistoricalDelta = true;
      }
    }

    expect(foundHistoricalDelta).toBe(true);
  }, 30000);

  it('imports times for first testset (regression)', async () => {
    const zipPath = path.resolve(process.cwd(), 'tests/testdata', testZips[0]);
    const zipBuffer = await readFile(zipPath);
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    const { simDataList } = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw, rawdata.belegungRaw);
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

  /**
   * Comprehensive regression test for all 5 testsets.
   * Validates that only children from kind.xml with real booking times are imported,
   * plus employees with real booking times.
   */
  it('imports times for all testsets - with detailed validation', async () => {
    const results = [];

    for (const zipFileName of testZips) {
      const zipPath = path.resolve(process.cwd(), 'tests/testdata', zipFileName);
      const zipBuffer = await readFile(zipPath);
      const { rawdata } = await extractAdebisData(zipBuffer, false);

      const importedChildIds = new Set((rawdata.kidsRaw || []).map((entry) => String(entry.KINDNR)));

      // FIRST: Count what SHOULD be parsed from raw data
      const belegungWithRealTimes = (rawdata.belegungRaw || [])
        .filter((b) => importedChildIds.has(String(b.KINDNR)))
        .filter(b => xmlTimesContainRealEntries(b.ZEITEN));
      const employeesWithRealTimes = (rawdata.employeesRaw || []).filter(e => xmlTimesContainRealEntries(e.ZEITEN));

      // Try to parse these times to see which ones fail
      const unparsableZeiten = [];
      belegungWithRealTimes.forEach((b) => {
        const parsed = Zeiten2Booking(b.ZEITEN, 'test-id');
        if (!Array.isArray(parsed) || parsed.length === 0) {
          unparsableZeiten.push({
            kindnr: b.KINDNR,
            idnr: b.IDNR,
            zeiten: b.ZEITEN,
            source: 'belegung'
          });
        }
      });

      employeesWithRealTimes.forEach((e) => {
        const parsed = Zeiten2Booking(e.ZEITEN, 'test-id');
        if (!Array.isArray(parsed) || parsed.length === 0) {
          unparsableZeiten.push({
            idnr: e.IDNR,
            zeiten: e.ZEITEN,
            source: 'anstell'
          });
        }
      });

      const { simDataList } = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw, rawdata.belegungRaw);
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

      // Build lookup maps
      const belegungWithTimes = [];
      (rawdata.belegungRaw || []).forEach((entry) => {
        if (importedChildIds.has(String(entry.KINDNR)) && xmlTimesContainRealEntries(entry.ZEITEN)) {
          belegungWithTimes.push({
            kindnr: String(entry.KINDNR),
            zeiten: entry.ZEITEN,
          });
        }
      });

      const employeesByIdNr = {};
      const employeesWithTimes = [];
      (rawdata.employeesRaw || []).forEach((entry) => {
        employeesByIdNr[String(entry.IDNR)] = entry;
        if (xmlTimesContainRealEntries(entry.ZEITEN)) {
          employeesWithTimes.push({
            idnr: String(entry.IDNR),
            zeiten: entry.ZEITEN,
          });
        }
      });

      // Expected: only imported children from kind.xml with actual time strings
      const childIdsWithTimes = new Set(belegungWithTimes.map(b => b.kindnr));
      const employeeIdsWithTimes = new Set(employeesWithTimes.map(e => e.idnr));

      const failed = [];
      let checkedChildren = 0;
      let checkedEmployees = 0;

      Object.entries(dataByScenario).forEach(([itemId, item]) => {
        if (item.type === 'demand' && childIdsWithTimes.has(String(item.rawdata?.KINDNR))) {
          checkedChildren += 1;
          if (!hasEnteredTimes(bookingsByScenario[itemId])) {
            const zeitenEntry = belegungWithTimes.find(b => b.kindnr === String(item.rawdata?.KINDNR));
            failed.push({
              type: 'Kind',
              id: item.rawdata?.KINDNR,
              name: item.name,
              zeitenString: zeitenEntry?.zeiten || 'unknown',
            });
          }
        }

        if (item.type === 'capacity' && employeeIdsWithTimes.has(String(item.rawdata?.IDNR))) {
          checkedEmployees += 1;
          if (!hasEnteredTimes(bookingsByScenario[itemId])) {
            const zeitenEntry = employeesWithTimes.find(e => e.idnr === String(item.rawdata?.IDNR));
            failed.push({
              type: 'Mitarbeiter',
              id: item.rawdata?.IDNR,
              name: item.name,
              zeitenString: zeitenEntry?.zeiten || 'unknown',
            });
          }
        }
      });

      results.push({
        testset: zipFileName,
        expectedBelegungWithTimes: belegungWithTimes.length,
        expectedEmployeesWithTimes: employeesWithTimes.length,
        expectedChildren: childIdsWithTimes.size,
        expectedEmployees: employeeIdsWithTimes.size,
        unparsable: unparsableZeiten.length,
        checkedChildren,
        checkedEmployees,
        failed,
      });

      if (unparsableZeiten.length > 0 || failed.length > 0) {
        console.log(`\n❌ TESTSET: ${zipFileName}`);
        console.log(`   BELEGUNG-Einträge mit Zeitstrings: ${belegungWithTimes.length}`);
        console.log(`   Mitarbeiter mit Zeitstrings: ${employeesWithTimes.length}`);
        console.log(`   Nicht parsbar: ${unparsableZeiten.length}`);
        console.log(`   Kinder mit echten Zeiteinträgen: ${childIdsWithTimes.size} (importiert: ${checkedChildren})`);
        console.log(`   Mitarbeiter mit echten Zeiteinträgen: ${employeeIdsWithTimes.size} (importiert: ${checkedEmployees})\n`);
        
        if (unparsableZeiten.length > 0) {
          console.log(`   NICHT PARSBARE ZEITEN-STRINGS:\n`);
          unparsableZeiten.forEach((z) => {
            console.log(`   ${z.source === 'belegung' ? 'Kind' : 'Mitarbeiter'} ID ${z.kindnr || z.idnr}: "${z.zeiten}"`);
          });
        }
        
        if (failed.length > 0) {
          console.log(`\n   FEHLGESCHLAGENE IMPORTE:\n`);
          failed.forEach((f) => {
            console.log(`   ${f.type}: ID ${f.id} (${f.name})`);
            console.log(`     Raw ZEITEN: "${f.zeitenString}"`);
          });
        }
      } else {
        console.log(`✅ TESTSET: ${zipFileName} - Alle ${childIdsWithTimes.size + employeeIdsWithTimes.size} Items korrekt importiert`);
      }
    }

    // Validate results
    const totalFailed = results.reduce((sum, r) => sum + r.failed.length, 0);
    const totalUnparsable = results.reduce((sum, r) => sum + r.unparsable, 0);
    const totalExpectedBelegung = results.reduce((sum, r) => sum + r.expectedBelegungWithTimes, 0);
    const totalExpected = results.reduce((sum, r) => sum + r.expectedChildren + r.expectedEmployees, 0);
    const totalChecked = results.reduce((sum, r) => sum + r.checkedChildren + r.checkedEmployees, 0);

    console.log(`\n📊 GESAMTERGEBNIS:`);
    console.log(`   Gesamte BELEGUNG-Einträge mit Zeitstrings: ${totalExpectedBelegung}`);
    console.log(`   Items (dedupliziert) mit echten Zeiteinträgen: ${totalExpected}`);
    console.log(`   Tatsächlich importierte Items: ${totalChecked}`);
    console.log(`   Nicht parsbare Zeiten-Strings: ${totalUnparsable}`);
    console.log(`   Fehlgeschlagene Importe: ${totalFailed}`);

    // Assertions
    if (totalUnparsable > 0 || totalFailed > 0) {
      console.log(`\n⚠️  PROBLEM ERKANNT: ${totalUnparsable} nicht-parsbare Zeiten und ${totalFailed} fehlgeschlagene Importe`);
    }
    expect(totalChecked).toBe(totalExpected, 'Not all valid items with times were imported');
    expect(totalFailed).toBe(0);
  });

  it('maps ADEBIS group names to supported icons', () => {
    const groupDefs = adebis2GroupDefs([
      { GRUNR: '1', BEZ: 'Fuchsgruppe' },
      { GRUNR: '2', BEZ: 'Bärchengruppe' },
      { GRUNR: '3', BEZ: 'Schulkinder-Fuchsgruppe' },
      { GRUNR: '4', BEZ: 'Schulgruppe' },
    ]);

    expect(groupDefs[0].icon).toBe('openmoji:fox');
    expect(groupDefs[1].icon).toBe('openmoji:bear');
    expect(groupDefs[2].icon).toBe('openmoji:fox');
    expect(groupDefs[3].icon).toBe('material-symbols:school');
    expect(groupDefs[0].type).toBe('Regelgruppe');
    expect(groupDefs[2].type).toBe('Schulkindgruppe');
    expect(groupDefs[3].type).toBe('Schulkindgruppe');
  });

  /**
   * Documentative test: validates that orphaned bookings (children with bookings but missing in kind.xml)
   * are ignored and do not create synthetic child entries.
   * 
   * Background: Some testsets contain BELEGUNG entries for children that don't exist in kind.xml.
   * Those entries must not be imported as children because validity/status is decided in kind.xml.
   */
  it('robustness: ignores orphaned bookings without synthetic children', async () => {
    const zipPath = path.resolve(process.cwd(), 'tests/testdata', 'kita-anonym-72229327.zip');
    const zipBuffer = await readFile(zipPath);
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    const { simDataList } = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw, rawdata.belegungRaw);
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

    const importedKidIds = new Set(
      Object.values(dataByScenario)
        .filter((item) => item.type === 'demand')
        .map((item) => String(item.rawdata?.KINDNR))
    );
    const validKidIds = new Set((rawdata.kidsRaw || []).map((entry) => String(entry.KINDNR)));
    const orphanedKidIds = (rawdata.belegungRaw || [])
      .filter((entry) => xmlTimesContainRealEntries(entry.ZEITEN))
      .map((entry) => String(entry.KINDNR))
      .filter((kindId) => !validKidIds.has(kindId));

    expect(orphanedKidIds.length).toBeGreaterThan(0);
    orphanedKidIds.forEach((kindId) => {
      expect(importedKidIds.has(kindId), `Orphaned kind ${kindId} must not be imported`).toBe(false);
      expect(simDataList.some((item) => String(item.rawdata?.KINDNR) === kindId), `Orphaned kind ${kindId} must not exist in simDataList`).toBe(false);
      expect(Object.entries(dataByScenario).some(([, item]) => item.type === 'demand' && String(item.rawdata?.KINDNR) === kindId), `Orphaned kind ${kindId} must not exist in dataByScenario`).toBe(false);
    });
  });
});
