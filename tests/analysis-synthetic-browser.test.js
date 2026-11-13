import { test, expect } from '@playwright/test';

async function seedScenario(page) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__APP_STORE);
  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'analysis-synthetic-browser';
    store.dispatch({ type: 'simScenario/addScenario', payload: { id: scenarioId, name: 'Synthetische Analyse', imported: true } });
    store.dispatch({ type: 'simScenario/setSelectedScenarioId', payload: scenarioId });
    store.dispatch({ type: 'chart/ensureScenario', payload: scenarioId });
    store.dispatch({ type: 'chart/setReferenceDate', payload: { scenarioId, date: '2026-12-15' } });
    store.dispatch({ type: 'simGroup/addGroupDef', payload: { scenarioId, groupDef: { id: 'g', name: 'Testgruppe', type: 'Regelgruppe' } } });
    for (const [id, type, name] of [['child', 'demand', 'Testkind'], ['staff', 'capacity', 'Testkraft']]) {
      store.dispatch({ type: 'simData/simDataItemAdd', payload: { scenarioId, item: { id, type, name, groupId: 'g', startdate: '2025-01-01' } } });
      store.dispatch({ type: 'simBooking/addBooking', payload: { scenarioId, dataItemId: id, booking: {
        id: `booking-${id}`, startdate: '2025-01-01', times: [{ day: 1, day_name: 'Mo', segments: [{ id: `segment-${id}`, booking_start: '08:00', booking_end: '09:00', category: 'pedagogical' }] }],
      } } });
    }
    store.dispatch({ type: 'ui/setActivePage', payload: 'visu' });
  });
}

async function expectNoDocumentOverflow(page) {
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['smartphone', { width: 390, height: 844 }]]) {
  test(`synthetic analysis: coverage, resilience and trends on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedScenario(page);
    await page.getByTestId('story-step-status').click();
    await expect(page.getByTestId('coverage-model-basis')).toContainText('keine Rechtsvorgabe oder Rechtsprüfung');
    await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible();
    await expect(page.locator('.analysis-stage-content .highcharts-container').first()).toBeVisible();
    await expectNoDocumentOverflow(page);

    await page.getByTestId('story-step-transitions').click();
    await page.getByTestId('analysis-filter-toggle').click();
    await page.getByLabel('Läufe', { exact: true }).fill('100');
    await page.getByLabel('Simulationswochen').fill('4');
    await page.getByLabel('Basis-Ausfallwahrscheinlichkeit pro Person und Betriebstag (%)').fill('0');
    await page.getByLabel('Mindest-Fachkräftequote (%)').fill('0');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('analysis-stage-recommendations')).toContainText('100 Läufe', { timeout: 30000 });
    await expect(page.getByTestId('analysis-resilience-basis')).toContainText('keine Prognose oder Rechtsprüfung');
    await expect(page.getByTestId('analysis-stage-recommendations').locator('.analysis-stage-recommendation-box').filter({ hasText: 'Schließungsrate' })).toContainText('0%');
    await expectNoDocumentOverflow(page);

    await page.getByTestId('story-step-trends').click();
    await expect(page.getByTestId('trend-filter-scope')).toContainText('Qualifikationen nur für Mitarbeiter');
    await expect(page.getByTestId('trend-history-chart').locator('svg').first()).toBeVisible();
    await page.getByRole('button', { name: 'Nächstes Trend-Diagramm' }).click();
    await page.getByTestId('analysis-filter-toggle').click();
    await expect(page.getByRole('combobox', { name: 'Gruppen' })).toBeEnabled();
    await expect(page.getByRole('combobox', { name: 'Qualifikationen' })).toBeDisabled();
    await expectNoDocumentOverflow(page);
  });
}

test('synthetic analysis: privacy mode replaces staff names in the schedule', async ({ page }) => {
  await seedScenario(page);
  await page.getByTestId('story-step-quality').click();
  await page.getByRole('button', { name: 'Nachstes Diagramm' }).click();
  const stage = page.getByTestId('analysis-stage-content');
  await expect(stage.locator('.highcharts-yaxis-labels')).toContainText('Testkraft');
  await page.getByRole('button', { name: 'Persönliche Daten verstecken' }).click();
  await expect(stage.locator('.highcharts-yaxis-labels')).toContainText('Mitarbeiter 1');
  await expect(stage).not.toContainText('Testkraft');
  const chartOptions = await stage.locator('.highcharts-container').evaluate((container) => {
    const chart = window.Highcharts.charts.find((entry) => entry && entry.renderTo.contains(container));
    return JSON.stringify(chart.userOptions);
  });
  expect(chartOptions).not.toContain('Testkraft');
});

test('synthetic analysis: trend navigation is available on smartphone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedScenario(page);
  const navigation = page.getByRole('region', { name: 'Analysebereiche' });
  await expect(navigation.locator('[data-testid^="story-step-"]')).toHaveCount(7);
  const dimensions = await navigation.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  await navigation.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => navigation.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  for (const step of ['quality', 'status', 'transitions', 'cohort', 'compare', 'options']) {
    const button = page.getByTestId(`story-step-${step}`);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
    await expect.poll(() => page.evaluate(() => window.__APP_STORE.getState().ui.analysisSubPage)).toBe(step);
  }
  await page.keyboard.press('Tab');
  const trend = page.getByRole('button', { name: /07 Trend-Radar/ });
  await expect(trend).toBeVisible();
  await expect(trend).toBeFocused();
  const navigationBounds = await navigation.boundingBox();
  const trendBounds = await trend.boundingBox();
  expect(trendBounds.x).toBeGreaterThanOrEqual(navigationBounds.x - 1);
  expect(trendBounds.x + trendBounds.width).toBeLessThanOrEqual(navigationBounds.x + navigationBounds.width + 1);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__APP_STORE.getState().ui.analysisSubPage)).toBe('trends');
  await expect(page.getByTestId('trend-history-chart').locator('svg').first()).toBeVisible();
  await expectNoDocumentOverflow(page);
});
