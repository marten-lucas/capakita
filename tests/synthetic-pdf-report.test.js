import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// No imported fixtures or workspace data: every value below is invented for this test.
async function seedSyntheticWorkspace(page, groupCount) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__APP_STORE);
  await page.evaluate((count) => {
    const store = window.__APP_STORE;
    const scenarioId = 'synthetic-pdf-workspace';
    const dispatch = (type, payload) => store.dispatch({ type, payload });
    dispatch('simScenario/addScenario', { id: scenarioId, name: 'Synthetischer PDF-Test', imported: true });
    dispatch('chart/ensureScenario', scenarioId);
    dispatch('chart/setReferenceDate', { scenarioId, date: '2026-01-01' });
    const items = {};
    const catalogs = {};
    for (let group = 1; group <= count; group += 1) {
      const groupId = `synthetic-group-${group}`;
      dispatch('simGroup/addGroupDef', { scenarioId, groupDef: { id: groupId, name: `Testgruppe ${String(group).padStart(2, '0')}`, type: 'Kindergarten' } });
      catalogs[groupId] = Array.from({ length: 6 }, (_, index) => ({
        id: `fee-${group}-${index}`, zeitkatId: String(index + 4).padStart(2, '0'),
        monthlyAmount: 100 + group * 3 + index * 25, validFrom: '2026-01-01',
      }));
      for (let child = 1; child <= 3; child += 1) {
        const id = `synthetic-child-${group}-${child}`;
        items[id] = { id, type: 'demand', name: `Testkind ${group}-${child}`, familyId: `synthetic-family-${group}-${child}`,
          familyLabel: group === 1 && child === 1 ? 'Testfamilie 1-1 mit einem besonders langen synthetischen Familiennamen für Zeilenumbrüche' : `Testfamilie ${group}-${child}`, startdate: '2026-01-01', enddate: '', dateofbirth: '2022-01-01', groupId, absences: [] };
        dispatch('simBooking/addBooking', { scenarioId, dataItemId: id, booking: {
          id: `booking-${id}`, startdate: '2026-01-01', enddate: '',
          buchungsart: { code: '0', label: 'R', name: 'Regelbuchung', gruppe: 'regel', basis: true },
          rawdata: { ZEITKAT: '05', ART: '0' },
          times: ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((day_name, index) => ({ day: index + 1, day_name, segments: [{ booking_start: '07:00', booking_end: '11:00', category: 'pedagogical' }] })),
        } });
      }
    }
    dispatch('simData/loadDataByScenario', { [scenarioId]: items });
    dispatch('simFinance/setGroupFeeCatalogs', { scenarioId, catalogs });
    const annualFundingInputsByYear = Object.fromEntries([2026, 2027, 2028, 2029, 2030].map((year) => [year, { under3Federal: 0, personnelBonus: 0, assistance: 0, languageSpecialists: 0 }]));
    dispatch('simFinance/updateScenarioFinanceSettings', { scenarioId, updates: { reformForecast: { annualFundingInputsByYear } } });
    dispatch('ui/setActivePage', 'visu');
  }, groupCount);
  await page.getByTestId('story-step-options').click();
  await expect(page.getByTestId('annual-income-results')).toBeVisible({ timeout: 30000 });
}

async function saveScenario(page, name) {
  await page.getByTestId('save-simulation-scenario').click();
  await page.getByTestId('simulation-scenario-name').fill(name);
  await page.getByTestId('confirm-save-simulation-scenario').click();
}

async function downloadPdf(page, name, includeFamilies = false) {
  await page.getByTestId('export-simulation-pdf').click();
  const dialog = page.getByRole('dialog', { name: 'Datenschutz prüfen – PDF-Export' });
  if (includeFamilies) await dialog.getByTestId('pdf-include-families').check();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByTestId('confirm-export-simulation-pdf').click();
  const download = await downloadPromise;
  const destination = process.env.SYNTHETIC_PDF_DIR
    ? path.resolve(process.env.SYNTHETIC_PDF_DIR, `${name}.pdf`)
    : test.info().outputPath(`${name}.pdf`);
  await download.saveAs(destination);
  expect((await readFile(destination)).subarray(0, 4).toString()).toBe('%PDF');
  const text = execFileSync('pdftotext', ['-layout', destination, '-'], { encoding: 'utf8' });
  const bbox = execFileSync('pdftotext', ['-bbox', destination, '-'], { encoding: 'utf8' });
  const pages = [...bbox.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)];
  expect(pages.length).toBeGreaterThan(0);
  for (const [, width, height, content] of pages) {
    for (const word of content.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g)) {
      expect(Number(word[1])).toBeGreaterThanOrEqual(0);
      expect(Number(word[2])).toBeGreaterThanOrEqual(0);
      expect(Number(word[3])).toBeLessThanOrEqual(Number(width));
      expect(Number(word[4])).toBeLessThanOrEqual(Number(height));
    }
  }
  return text;
}

test('synthetic PDF: standard report without family data', async ({ page }) => {
  await seedSyntheticWorkspace(page, 1);
  const standard = await downloadPdf(page, 'standard');
  expect(standard).toContain('Beitragsänderungssimulation');
  expect(standard).toContain('Testgruppe 01');
  expect(standard).toContain('Jahresergebnisse');
  expect(standard).toContain('Familienliste aus Datenschutzgründen nicht enthalten');
  expect(standard).not.toContain('Testfamilie');
  expect(standard.indexOf('Jahresergebnisse')).toBeLessThan(standard.indexOf('Tarife: Testgruppe 01'));
});

test('synthetic PDF: many groups, comparison and multipage family table', async ({ page }) => {
  await seedSyntheticWorkspace(page, 8);
  await saveScenario(page, 'Testvariante A');
  const settings = page.getByTestId('simulation-settings-panel').getByRole('button', { name: /Simulation von Beitragsänderungen/ });
  if (await settings.getAttribute('aria-expanded') !== 'true') await settings.click();
  const price = page.getByTestId('simulation-tariff-slide-synthetic-group-1').getByLabel('Betrag ZEITKAT 05', { exact: true });
  await price.fill('175');
  await price.blur();
  await saveScenario(page, 'Testvariante B');
  await page.getByTestId('comparison-scenario-a').click();
  await page.getByRole('option', { name: 'Testvariante A' }).click();
  await page.getByTestId('comparison-scenario-b').click();
  await page.getByRole('option', { name: 'Testvariante B' }).click();
  const many = await downloadPdf(page, 'viele-gruppen-vergleich', true);
  expect(many).toContain('Testgruppe 08');
  expect(many).toContain('Vergleich gespeicherter Szenarien');
  expect(many).toContain('Testvariante A');
  expect(many).toContain('Testvariante B');
  expect(many).toContain('Zusatzförderung');
  expect(many).toContain('Testfamilie');
  expect(many).toContain('B minus A');
  expect(many).toContain('+1.692,00');
  expect(many.indexOf('Vergleich gespeicherter Szenarien')).toBeLessThan(many.indexOf('Tarife: Testgruppe 01'));
  const pages = many.split('\f');
  expect(pages.length).toBeGreaterThan(3);
  for (let group = 1; group <= 8; group += 1) {
    const label = `Testgruppe ${String(group).padStart(2, '0')}`;
    const chartPage = pages.find((content) => content.includes(`Tarife: ${label}`));
    expect(chartPage).toBeTruthy();
    expect(chartPage).toContain(`Elternbeitragszuschuss: ${label}`);
  }
  const comparisonPages = pages.filter((content) => content.includes('B minus A'));
  expect(comparisonPages.length).toBeGreaterThan(1);
  for (const content of comparisonPages) expect(content).toContain('Jahreswert');
  const familyPages = pages.filter((content) => content.includes('Testfamilie'));
  expect(familyPages.length).toBeGreaterThan(1);
  for (const content of familyPages) {
    expect(content).toContain('Beitrag alt');
    expect(content).toContain('Vorjahr/Jahr');
  }
});
