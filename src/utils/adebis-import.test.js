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
import { isRecordActiveOnDate } from './financeUtils';
import JSZip from 'jszip';
import { extractAdebisData } from './adebis-reader';
import { buildFamilyRelations, attachFamilyInfo } from './adebisFamily';
import { adebis2FeeCatalogs } from './adebisFeeCatalog';
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
  'kita-anonym-53181382.zip',
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
    const events = state.events.eventsByScenario[scenarioId] || [];

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
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'group_assignment_start' || event.type === 'booking_start' || event.type === 'presence_start')).toBe(true);

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

  it('imports only current qualification definitions and assignments in historical mode', async () => {
    const today = new Date().toISOString().slice(0, 10);

    for (const zipFileName of testZips) {
      const zipPath = path.resolve(process.cwd(), 'tests/testdata', zipFileName);
      const zipBuffer = await readFile(zipPath);
      const { rawdata } = await extractAdebisData(zipBuffer, false, { mode: 'historical' });

      const { simDataList } = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw, rawdata.belegungRaw);
      const activeCapacityItems = simDataList.filter(
        (item) => item.type === 'capacity' && isRecordActiveOnDate(item, today)
      );
      const expectedQualificationKeys = new Set(
        activeCapacityItems.map((item) => item.rawdata?.QUALIFIK).filter(Boolean)
      );

      const { bookings, bookingReference } = adebis2bookings(rawdata.belegungRaw, rawdata.employeesRaw);
      const groupDefs = adebis2GroupDefs(rawdata.groupsRaw);
      const qualiDefs = adebis2QualiDefs(activeCapacityItems.map((item) => item.rawdata || {}));
      const { groupAssignments } = adebis2GroupAssignments(rawdata.grukiRaw);

      const store = createTestStore();
      await store.dispatch(
        importScenario({
          scenarioSettings: {
            name: 'Qualification Import Regression',
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
      const importedDefs = state.simQualification.qualificationDefsByScenario[scenarioId] || [];
      const importedAssignments = state.simQualification.qualificationAssignmentsByScenario[scenarioId] || {};
      const importedData = state.simData.dataByScenario[scenarioId] || {};

      expect(new Set(importedDefs.map((definition) => definition.key))).toEqual(expectedQualificationKeys);

      Object.entries(importedAssignments).forEach(([itemId, assignmentMap]) => {
        const item = importedData[itemId];
        expect(item?.type).toBe('capacity');
        expect(isRecordActiveOnDate(item, today)).toBe(true);

        Object.values(assignmentMap || {}).forEach((assignment) => {
          expect(expectedQualificationKeys.has(assignment.qualification)).toBe(true);
        });
      });
    }
  }, 30000);

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

  it('extrahiert Familien-/Haushaltsfelder aus kind.xml (RE: NAME/Adresse/Geschwister)', async () => {
    const zipPath = path.resolve(process.cwd(), 'tests/testdata', 'kita-anonym-29247781.zip');
    const zipBuffer = await readFile(zipPath);
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    expect(rawdata.erzberRaw).toEqual([]);
    expect(rawdata.adressenRaw).toEqual([]);

    const kindWithAddress = rawdata.kidsRaw.find((k) => k.STRASSE && k.PLZ);
    expect(kindWithAddress).toBeTruthy();
    expect(kindWithAddress.NAME).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(kindWithAddress, 'GESCHW1VN')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(kindWithAddress, 'ANZGESCHW')).toBe(true);
  });

  it('importiert erzber.xml/adressen.xml, wenn der Export sie enthält', async () => {
    const zip = new JSZip();
    zip.file('kind.xml', [
      '<KINDER><KIND>',
      '<KINDNR>56</KINDNR><NAME>Reuter</NAME><VORNAME>Erkan</VORNAME>',
      '<STRASSE>Tröstgasse 85-57</STRASSE><PLZ>77515</PLZ><WOHNORT>Hofgeismar</WOHNORT>',
      '<STATUS>+</STATUS><AUSTRDAT></AUSTRDAT>',
      '</KIND><KIND>',
      '<KINDNR>82</KINDNR><NAME>Reuter</NAME><VORNAME>Ingrid</VORNAME>',
      '<STRASSE>Tröstgasse 85-57</STRASSE><PLZ>77515</PLZ><WOHNORT>Hofgeismar</WOHNORT>',
      '<STATUS>+</STATUS><AUSTRDAT></AUSTRDAT>',
      '</KIND></KINDER>',
    ].join(''));
    zip.file('erzber.xml', [
      '<ERZBER><ERZBERLINK>',
      '<IDNR>1</IDNR><ADRNR>10</ADRNR><KINDNR>56</KINDNR><ERZBER>.T.</ERZBER>',
      '</ERZBERLINK><ERZBERLINK>',
      '<IDNR>2</IDNR><ADRNR>10</ADRNR><KINDNR>82</KINDNR><ERZBER>.T.</ERZBER>',
      '</ERZBERLINK></ERZBER>',
    ].join(''));
    zip.file('adressen.xml', [
      '<ADRESSEN><ADRESSE>',
      '<ADRNR>10</ADRNR><NAME>Reuter</NAME><VORNAME>Petra</VORNAME><ERZBER>.T.</ERZBER>',
      '</ADRESSE></ADRESSEN>',
    ].join(''));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    expect(rawdata.erzberRaw).toHaveLength(2);
    expect(rawdata.erzberRaw[0].ERZBER).toBe('.T.');
    expect(rawdata.adressenRaw).toHaveLength(1);
    expect(rawdata.adressenRaw[0].NAME).toBe('Reuter');

    const relations = buildFamilyRelations(rawdata);
    expect(relations.source).toBe('erzber');
    expect(relations.kindnrToFamilyId['56']).toBe(relations.kindnrToFamilyId['82']);
    expect(relations.families[0].label).toBe('Familie Reuter');
  });

  it('nutzt den Haushalts-Fallback, wenn erzber.xml fehlt (Standard-Export)', async () => {
    // Reale Exporte: Zuordnung je Kind vorhanden (Familie der Größe 1)
    const zipPath = path.resolve(process.cwd(), 'tests/testdata', 'kita-anonym-29247781.zip');
    const zipBuffer = await readFile(zipPath);
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    const relations = buildFamilyRelations(rawdata);
    expect(relations.source).toBe('haushalt');

    const { simDataList } = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw, rawdata.belegungRaw);
    attachFamilyInfo(simDataList, relations);

    const demandItems = simDataList.filter((item) => item.type === 'demand');
    expect(demandItems.filter((item) => item.familyId).length).toBeGreaterThan(0);

    // Geschwisterpaar über gemeinsamen Haushalt (synthetisch, da Testdaten keine Paare haben)
    const pairZip = new JSZip();
    pairZip.file('kind.xml', [
      '<KINDER><KIND>',
      '<KINDNR>56</KINDNR><NAME>Reuter</NAME><STRASSE>Tröstgasse 85-57</STRASSE><PLZ>77515</PLZ><WOHNORT>Hofgeismar</WOHNORT><STATUS>+</STATUS><AUSTRDAT></AUSTRDAT>',
      '</KIND><KIND>',
      '<KINDNR>82</KINDNR><NAME>Reuter</NAME><STRASSE>Tröstgasse 85-57</STRASSE><PLZ>77515</PLZ><WOHNORT>Hofgeismar</WOHNORT><STATUS>+</STATUS><AUSTRDAT></AUSTRDAT>',
      '</KIND><KIND>',
      '<KINDNR>94</KINDNR><NAME>Berger</NAME><STRASSE>Heinzweg 706</STRASSE><PLZ>15991</PLZ><WOHNORT>Pfaffenhofen</WOHNORT><STATUS>+</STATUS><AUSTRDAT></AUSTRDAT>',
      '</KIND></KINDER>',
    ].join(''));

    const pairBuffer = await pairZip.generateAsync({ type: 'nodebuffer' });
    const pairResult = await extractAdebisData(pairBuffer, false);
    const pairRelations = buildFamilyRelations(pairResult.rawdata);
    expect(pairRelations.source).toBe('haushalt');
    expect(pairRelations.kindnrToFamilyId['56']).toBe(pairRelations.kindnrToFamilyId['82']);
    expect(pairRelations.kindnrToFamilyId['94']).not.toBe(pairRelations.kindnrToFamilyId['56']);
  });

  it('anonymisierte Importe erzeugen keine Schein-Familien (leere Adressfelder)', async () => {
    const zipPath = path.resolve(process.cwd(), 'tests/testdata', 'kita-anonym-29247781.zip');
    const zipBuffer = await readFile(zipPath);
    const { rawdata } = await extractAdebisData(zipBuffer, true);

    const relations = buildFamilyRelations(rawdata);
    expect(relations.families).toEqual([]);
  });

  it('liest erzber.xml mit dem echten Export-Root ERZIEHUNGSBERECHTIGTE (RE: Export-Registry)', async () => {
    // frmxmlbackup schreibt Root-Namen aus der festen Export-Registry;
    // der Record-Tag variiert und wird von Capakita auto-erkannt.
    const zip = new JSZip();
    zip.file('kind.xml', [
      '<KINDER><KIND>',
      '<KINDNR>56</KINDNR><NAME>Reuter</NAME><STATUS>+</STATUS><AUSTRDAT></AUSTRDAT>',
      '</KIND><KIND>',
      '<KINDNR>82</KINDNR><NAME>Reuter</NAME><STATUS>+</STATUS><AUSTRDAT></AUSTRDAT>',
      '</KIND></KINDER>',
    ].join(''));
    zip.file('erzber.xml', [
      '<ERZIEHUNGSBERECHTIGTE><ERZBER>',
      '<IDNR>1</IDNR><ADRNR>10</ADRNR><KINDNR>56</KINDNR><ERZBER>.T.</ERZBER>',
      '</ERZBER><ERZBER>',
      '<IDNR>2</IDNR><ADRNR>10</ADRNR><KINDNR>82</KINDNR><ERZBER>.T.</ERZBER>',
      '</ERZBER></ERZIEHUNGSBERECHTIGTE>',
    ].join(''));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    expect(rawdata.erzberRaw).toHaveLength(2);
    const relations = buildFamilyRelations(rawdata);
    expect(relations.source).toBe('erzber');
    expect(relations.kindnrToFamilyId['56']).toBe(relations.kindnrToFamilyId['82']);
  });

  it('decodiert UTF-8-Exporte (BOM und XML-Deklaration) korrekt', async () => {
    const withBom = `\uFEFF<ADRESSEN><ADRESSE><ADRNR>1</ADRNR><NAME>M\u00FCller</NAME></ADRESSE></ADRESSEN>`;
    const withDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' +
      '<BEITRAGSARTEN><BEITRAGSART><BARTNR>2</BARTNR><BEZ>Gr\u00FCn</BEZ></BEITRAGSART></BEITRAGSARTEN>';

    const zip = new JSZip();
    zip.file('adressen.xml', withBom);
    zip.file('beitrart.xml', withDeclaration);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    expect(rawdata.adressenRaw[0].NAME).toBe('Müller');
    expect(rawdata.beitrartRaw[0].BEZ).toBe('Grün');
  });

  it('liest beitrart.xml/bartbetr.xml für den automatischen Beitragssatz-Import', async () => {
    const zip = new JSZip();
    zip.file('beitrart.xml', [
      '<BEITRAGSARTEN><BEITRAGSART>',
      '<BARTNR>1</BARTNR><BEZ>Elternbeitrag Regelgruppe</BEZ>',
      '</BEITRAGSART></BEITRAGSARTEN>',
    ].join(''));
    zip.file('bartbetr.xml', [
      '<BARTBETRAEGE><BEITRAGSSATZ>',
      '<BARTNR>1</BARTNR><GUELTIGVON>01.01.2026</GUELTIGVON>',
      '<BETRAGZ1>80</BETRAGZ1><BETRAGZ2>90,50</BETRAGZ2><BETRAGZ5>120</BETRAGZ5>',
      '</BEITRAGSSATZ></BARTBETRAEGE>',
    ].join(''));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const { rawdata } = await extractAdebisData(zipBuffer, false);

    expect(rawdata.beitrartRaw).toHaveLength(1);
    expect(rawdata.beitrartRaw[0].BEZ).toBe('Elternbeitrag Regelgruppe');
    expect(rawdata.bartbetrRaw).toHaveLength(1);
    expect(rawdata.bartbetrRaw[0].BETRAGZ2).toBe('90,50');

    const { catalogs } = adebis2FeeCatalogs(rawdata);
    const bands = catalogs.__DEFAULT__;
    expect(bands).toHaveLength(3);
    expect(bands.find((band) => band.maxHours === 3).monthlyAmount).toBe(90.5);
  });
});
