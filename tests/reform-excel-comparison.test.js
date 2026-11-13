import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('synthetischer Excel-Jahresvergleich und zwei fixierte Tarifszenarien', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__APP_STORE));
  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'synthetic-excel-comparison';
    const dispatch = (type, payload) => store.dispatch({ type, payload });
    dispatch('simScenario/addScenario', { id: scenarioId, name: 'Synthetischer Excel-Abgleich', imported: true });
    dispatch('chart/ensureScenario', scenarioId);
    dispatch('chart/setReferenceDate', { scenarioId, date: '2026-01-01' });
    dispatch('simGroup/addGroupDef', { scenarioId, groupDef: { id: 'g1', name: 'Testgruppe', type: 'Kindergarten' } });
    const items = {};
    for (let index = 1; index <= 2; index += 1) {
      const id = `synthetic-child-${index}`;
      items[id] = { id, type: 'demand', name: `Testkind ${index}`, familyId: `synthetic-family-${index}`,
        startdate: '2026-01-01', enddate: '', dateofbirth: '2022-01-01', groupId: 'g1', absences: [] };
      dispatch('simBooking/addBooking', { scenarioId, dataItemId: id, booking: {
        id: `booking-${id}`, startdate: '2026-01-01', enddate: '',
        buchungsart: { code: '0', label: 'R', name: 'Regelbuchung', gruppe: 'regel', basis: true },
        rawdata: { ZEITKAT: '05', ART: '0' },
        times: ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((day_name, day) => ({ day: day + 1, day_name,
          segments: [{ booking_start: '07:00', booking_end: '11:00', category: 'pedagogical' }] })),
      } });
    }
    dispatch('simData/loadDataByScenario', { [scenarioId]: items });
    const base = 1563.88;
    for (const [year, ratio] of [[2026, 1], [2027, 1.1], [2028, 1.1 * 1.05], [2029, 1.1 * 1.05 * 1.02]]) {
      dispatch('simFinance/updateBayKiBiGRule', { scenarioId, ruleId: `adebis-baykibig-${year}`, updates: { baseValue: base * ratio } });
    }
    const fee2026 = { id: 'fee-2026', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-12-31' };
    const fee2027 = { id: 'fee-2027', zeitkatId: '05', monthlyAmount: 100, validFrom: '2027-01-01' };
    dispatch('simFinance/setGroupFeeCatalogs', { scenarioId, catalogs: { g1: [fee2026, fee2027] } });
    dispatch('simFinance/updateGroupParentFeeSubsidy', { scenarioId, groupId: 'g1', updates: { enabled: true, monthlyAmount: 50, endDate: '2026-12-31' } });
    const actualFunding = { bookingTime: 1000, qualityBonus: 268.01, preparatoryCourses: 100, under3Additional: 20,
      under3Federal: 10, parentFeeSubsidy: 1200, assistance: 10, personnelBonus: 20, languageSpecialists: 30 };
    const annualFundingInputsByYear = { 2026: { under3Federal: 10, assistance: 10, personnelBonus: 20, languageSpecialists: 30 } };
    dispatch('simFinance/updateScenarioFinanceSettings', { scenarioId, updates: { reformForecast: { approvedPlaces: 51, teamGrantEligible: true, actualFunding, annualFundingInputsByYear } } });
    const data = { temporaryPrices: {}, selectedGroupIds: [], fixedBaseYearEnabled: true, fixedBaseYear: 2026, stockMode: 'legacy', potentialMonthlyBudget: 50 };
    const simulationScenarios = [
      { id: 'a', name: 'Reduziert', data: { ...data, temporaryCatalogEntries: { g1: [fee2026, { ...fee2027, monthlyAmount: 50 }] } } },
      { id: 'b', name: 'Eltern zahlen', data: { ...data, temporaryCatalogEntries: { g1: [fee2026, fee2027] } } },
    ];
    dispatch('simFinance/updateFundingSimulationSettings', { scenarioId, updates: { fixedBaseYearEnabled: true, fixedBaseYear: 2026, simulationScenarios, selectedSimulationScenarioId: 'a' } });
    dispatch('ui/setActivePage', 'visu');
  });
  await page.getByTestId('story-step-options').click();
  const comparison = page.getByTestId('workbook-annual-comparison');
  await expect(comparison).toBeVisible({ timeout: 30000 });
  // Synthetic inputs were recalculated with LibreOffice using the supplied workbook's formulas.
  await expect(page.getByTestId('workbook-comparison-2026').getByRole('cell').nth(1)).toHaveText('2.658,01 €');
  for (const [year, reduced, reducedDelta, additional, additionalDelta] of [
    [2027, '27.070,89 €', '+24.412,88 €', '28.270,89 €', '+25.612,88 €'],
    [2028, '37.365,23 €', '+10.294,34 €', '38.565,23 €', '+10.294,34 €'],
    [2029, '37.396,15 €', '+30,92 €', '38.596,15 €', '+30,92 €'],
  ]) {
    const cells = page.getByTestId(`workbook-comparison-${year}`).getByRole('cell');
    await expect(cells.nth(1)).toHaveText(reduced);
    await expect(cells.nth(2)).toHaveText(reducedDelta);
    await expect(cells.nth(3)).toHaveText(additional);
    await expect(cells.nth(4)).toHaveText(additionalDelta);
  }
  await page.getByTestId('comparison-scenario-a').click();
  await page.getByRole('option', { name: 'Reduziert' }).click();
  await page.getByTestId('comparison-scenario-b').click();
  await page.getByRole('option', { name: 'Eltern zahlen' }).click();
  const income2026 = page.getByTestId('saved-scenario-comparison-2026').getByRole('row').nth(3).getByRole('cell');
  const income2027 = page.getByTestId('saved-scenario-comparison-2027').getByRole('row').nth(3).getByRole('cell');
  await expect(income2026.nth(2)).toHaveText('3.858,01 €');
  await expect(income2026.nth(3)).toHaveText('3.858,01 €');
  await expect(income2027.nth(2)).toHaveText('28.270,89 €');
  await expect(income2027.nth(3)).toHaveText('29.470,89 €');
  await expect(income2027.nth(4)).toHaveText('+1.200,00 €');
  const downloadPdf = async (name) => {
    await page.getByTestId('export-simulation-pdf').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('confirm-export-simulation-pdf').click();
    const download = await downloadPromise;
    const destination = test.info().outputPath(name);
    await download.saveAs(destination);
    return execFileSync('pdftotext', ['-layout', destination, '-'], { encoding: 'utf8' });
  };
  const pdf = await downloadPdf('excel-comparison.pdf');
  const sectionPage = pdf.split('\f').find((content) => content.includes('Indikativer Jahresvergleich nach Excel-Vorlage'));
  expect(sectionPage).toBeTruthy();
  expect(sectionPage).toContain('keine kindbezogene Finanzrechnung');
  expect(sectionPage).toContain('nicht der ausgewählten A/B-Szenarien');
  expect(sectionPage).toContain('keine rechtliche Bestätigung');
  expect(sectionPage).toMatch(/2027\s+27\.070,89\s*€\s+\+24\.412,88\s*€\s+28\.270,89\s*€\s+\+25\.612,88\s*€/);
  expect(sectionPage).toMatch(/2029\s+37\.396,15\s*€\s+\+30,92\s*€\s+38\.596,15\s*€\s+\+30,92\s*€/);
  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'synthetic-excel-comparison';
    const reformForecast = store.getState().simFinance.financeByScenario[scenarioId].settings.reformForecast;
    store.dispatch({ type: 'simFinance/updateScenarioFinanceSettings', payload: { scenarioId,
      updates: { reformForecast: { ...reformForecast, actualFunding: { ...reformForecast.actualFunding, parentFeeSubsidy: null } } } } });
  });
  await expect(page.getByTestId('workbook-comparison-2027').getByRole('cell').nth(1)).toHaveText('Nicht verfügbar');
  await expect(page.getByTestId('workbook-comparison-2027').getByRole('cell').nth(3)).toHaveText('Nicht verfügbar');
  const incompletePdf = await downloadPdf('excel-comparison-incomplete.pdf');
  const incompleteSection = incompletePdf.split('\f').find((content) => content.includes('Indikativer Jahresvergleich nach Excel-Vorlage'));
  expect(incompleteSection).toMatch(/2027\s+Nicht verfügbar\s+Nicht verfügbar\s+Nicht verfügbar\s+Nicht verfügbar/);
});
