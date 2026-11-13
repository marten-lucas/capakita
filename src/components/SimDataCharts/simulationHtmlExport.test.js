import { describe, expect, it } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { getFeeBandSimulationPriceKey } from '../../utils/foerderSimulation';
import {
  buildAggregateSimulationSnapshot,
  buildStandaloneSimulationHtml,
  calculateAggregateSimulationResults,
  createInitialStandaloneSimulationState,
} from './simulationHtmlExport';

function createFixture() {
  const months = Array.from({ length: 12 }, () => [{
    groupId: 'private-group-id',
    zeitkatId: '05',
    childCount: 1,
    subsidyEligibleChildCount: 1,
    childId: 'private-child-id',
    bookingTimes: ['07:15-12:30'],
  }]);
  const tariff = { zeitkatId: '05', monthlyAmount: 100, enabled: true };
  const familyProfileData = {
    totalFamilies: 7,
    suppressedFamilyCount: 2,
    minimumFamilyCount: 5,
    profiles: [
      { id: 'family-secret-a', familyCount: 5, familyName: 'Musterfamilie', years: { 2026: months } },
      { id: 'family-secret-b', familyCount: 2, years: { 2026: months } },
    ],
  };
  const annualIncomeRows = [{
    year: 2026,
    totalFunding: 4000,
    annualParentFeeSubsidy: 3000,
    contributions: 3000,
    baselineContributions: 3000,
    totalIncome: 7000,
    additionalFunding: 1000,
    averageDailyBookingHours: 25,
    familyImpacts: [{ id: 'family-secret-row', label: 'Musterfamilie' }],
  }];
  const snapshot = buildAggregateSimulationSnapshot({
    annualIncomeRows,
    familyProfileData,
    groupDefs: [{ id: 'private-group-id', name: 'Reale Gruppenbezeichnung' }],
    groupFeeCatalogs: { 'private-group-id': [tariff] },
    simulationCatalogs: { 'private-group-id': [tariff] },
    effectiveFeeCatalogs: { 'private-group-id': [tariff] },
    effectiveParentFeeSubsidiesByGroup: {
      'private-group-id': { enabled: true, monthlyAmount: 50, endDate: '2026-12-31' },
    },
    referenceDate: '2026-03-15',
  });
  return { snapshot, familyProfileData };
}

describe('standalone simulation HTML export', () => {
  it('übernimmt und bearbeitet Preisänderungen nur für die angezeigte Tarifversion', () => {
    const fees = [
      { id: '2026', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-12-31' },
      { id: '2027', zeitkatId: '05', monthlyAmount: 200, validFrom: '2027-01-01' },
    ];
    const months = Array.from({ length: 12 }, () => [{ groupId: 'g', zeitkatId: '05', childCount: 1 }]);
    const snapshot = buildAggregateSimulationSnapshot({
      annualIncomeRows: [{ year: 2026, contributions: 9000 }, { year: 2027, contributions: 12000 }],
      familyProfileData: { totalFamilies: 5, profiles: [{ familyCount: 5, years: { 2026: months, 2027: months } }] },
      groupDefs: [{ id: 'g' }], groupFeeCatalogs: { g: fees }, simulationCatalogs: { g: fees },
      temporaryPrices: { g: { [getFeeBandSimulationPriceKey(fees[0])]: 150 } }, referenceDate: '2026-03-15',
    });
    expect(snapshot.groups[0].simulationTariffs.map((entry) => entry.monthlyAmount)).toEqual([150, 200]);
    const state = createInitialStandaloneSimulationState(snapshot);
    state.rateOverrides.g1['05'] = 175;
    const result = calculateAggregateSimulationResults(snapshot, state);
    expect(result.annualResults.map((year) => year.parentFees)).toEqual([10500, 12000]);
  });

  it('exports only neutral, thresholded aggregates and no personal identifiers', () => {
    const { snapshot } = createFixture();
    const serialized = JSON.stringify(snapshot);
    expect(snapshot.groups[0].label).toBe('Gruppe 1');
    expect(snapshot.familyProfiles).toHaveLength(1);
    expect(snapshot.familyProfiles[0].familyCount).toBe(5);
    expect(snapshot.privacy.suppressedFamilyCount).toBe(2);
    expect(serialized).not.toMatch(/private-group-id|private-child-id|family-secret|Musterfamilie|Gruppenbezeichnung|bookingTimes|childId/);
  });

  it('creates a self-contained offline HTML file with interactive controls', () => {
    const { snapshot } = createFixture();
    const html = buildStandaloneSimulationHtml(snapshot);
    expect(html).toContain('<title>CapaKita – interaktive Beitragssimulation</title>');
    expect(html).toContain('@media');
    expect(html).toContain('id="tariff-controls"');
    expect(html).toContain('id="family-histogram"');
    expect(html).toContain('download-updated');
    expect(html).not.toMatch(/<(?:script|link)[^>]+(?:src|href)=["']https?:/i);
    expect(html).not.toMatch(/@import\s+url\s*\(/i);
    expect(html).not.toMatch(/fetch\s*\(/i);
    expect(html).not.toMatch(/family-secret|private-child-id|Musterfamilie/);
  });

  it('runs the inline script and updates the displayed results from file-style HTML', () => {
    const { snapshot } = createFixture();
    const jsdomErrors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (error) => jsdomErrors.push(error));
    const dom = new JSDOM(buildStandaloneSimulationHtml(snapshot), {
      runScripts: 'dangerously',
      virtualConsole,
    });
    const { document, Event } = dom.window;

    expect(jsdomErrors).toEqual([]);
    expect(document.querySelector('#annual-results tbody').textContent).toContain('3.000');
    const amount = document.querySelector('input[aria-label^="Gruppe 1 ZEITKAT 05"]');
    amount.value = '120';
    amount.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.querySelector('#annual-results tbody').textContent).toContain('4.200');
    expect(document.querySelector('#affected-count').textContent).toContain('5 betroffene Familien');
    expect(document.querySelector('.histogram-statistics').textContent).toContain('Durchschnitt:');
    expect(document.querySelector('.histogram-statistics').textContent).toContain('Median:');
    expect(document.querySelector('.histogram-marker-average')).toBeTruthy();
    expect(document.querySelector('.histogram-marker-median')).toBeTruthy();
    dom.window.close();
  });

  it('recalculates annual totals and histogram counts after a tariff edit', () => {
    const { snapshot } = createFixture();
    const state = createInitialStandaloneSimulationState(snapshot);
    const initial = calculateAggregateSimulationResults(snapshot, state);
    expect(initial.annualResults[0].parentFees).toBe(3000);

    state.rateOverrides.g1['05'] = 120;
    const updated = calculateAggregateSimulationResults(snapshot, state);
    expect(updated.annualResults[0].parentFees).toBe(4200);
    expect(updated.histogram.affectedFamiliesByYear['2026']).toBe(5);
    expect(updated.histogram.bins.find((bin) => bin.label === '1–49 €').counts['2026']).toBe(5);
    expect(updated.histogram.statisticsByYear['2026']).toEqual({ average: 20, median: 20, affectedFamilies: 5 });
  });

  it('applies the subsidy end date by month and updates the family histogram', () => {
    const { snapshot } = createFixture();
    const state = createInitialStandaloneSimulationState(snapshot);
    state.subsidies.g1.endDate = '2026-06-30';
    const result = calculateAggregateSimulationResults(snapshot, state);

    expect(result.annualResults[0].parentFees).toBe(4500);
    expect(result.annualResults[0].parentFeeSubsidy).toBe(1500);
    expect(result.histogram.bins.find((bin) => bin.label === '1–49 €').counts['2026']).toBe(5);
  });
});
