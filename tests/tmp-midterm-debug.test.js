import { describe, it } from 'vitest';
import fs from 'fs';
import CryptoJS from 'crypto-js';
import { selectMidtermChartData } from '../src/store/chartSelectors.js';

describe('debug midterm payload', () => {
  it('prints aug/sep capacity', () => {
    const txt = fs.readFileSync('tests/testdata/2026-05-22T18-48-58-Importiertes_Szenario.capakita', 'utf8');
    const dec = CryptoJS.AES.decrypt(txt, 'Assys2323!').toString(CryptoJS.enc.Utf8);
    const payload = JSON.parse(dec);
    const scenarioId = payload.selectedScenarioId || Object.keys(payload.dataByScenario || {})[0];

    const state = {
      simScenario: {
        selectedScenarioId: scenarioId,
        scenarios: payload.scenarios || [{ id: scenarioId, name: 'Debug', baseScenarioId: null }],
      },
      chart: {
        [scenarioId]: {
          referenceDate: '2026-08-15',
          timedimension: 'month',
          filter: {
            Groups: [],
            Qualifications: [],
          },
        },
      },
      simOverlay: { overlaysByScenario: {} },
      simData: { dataByScenario: payload.dataByScenario || {} },
      simBooking: { bookingsByScenario: payload.bookingsByScenario || {} },
      simGroup: {
        groupDefsByScenario: payload.groupDefsByScenario || {},
        groupsByScenario: payload.groupsByScenario || {},
      },
      simQualification: {
        qualificationAssignmentsByScenario: payload.qualificationAssignmentsByScenario || {},
        qualificationDefsByScenario: payload.qualificationDefsByScenario || {},
      },
      events: { eventsByScenario: payload.eventsByScenario || {} },
      simFinance: { financeByScenario: payload.financeByScenario || {} },
    };

    const result = selectMidtermChartData(state);
    const idxAug = (result.categories || []).indexOf('2026-08');
    const idxSep = (result.categories || []).indexOf('2026-09');

    console.log('categories sample', (result.categories || []).slice(0, 8), '... last', (result.categories || []).slice(-4));
    console.log('idxAug/idxSep', idxAug, idxSep);
    if (idxAug >= 0) {
      console.log('cap_aug', result.capacity_pedagogical[idxAug], 'cap_total_aug', result.capacity[idxAug]);
    }
    if (idxSep >= 0) {
      console.log('cap_sep', result.capacity_pedagogical[idxSep], 'cap_total_sep', result.capacity[idxSep]);
    }
  });
});
