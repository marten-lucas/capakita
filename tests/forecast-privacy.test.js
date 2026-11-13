import { test, expect } from '@playwright/test';

test('forecast event tooltip escapes names and never shows them in privacy mode', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__APP_STORE);
  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'forecast-privacy-e2e';
    store.dispatch({ type: 'simScenario/addScenario', payload: { id: scenarioId, name: 'Forecast privacy', imported: true } });
    store.dispatch({ type: 'simScenario/setSelectedScenarioId', payload: scenarioId });
    store.dispatch({ type: 'chart/ensureScenario', payload: scenarioId });
    store.dispatch({ type: 'chart/setReferenceDate', payload: { scenarioId, date: '2026-01-01' } });
    store.dispatch({ type: 'simGroup/addGroupDef', payload: { scenarioId, groupDef: { id: 'g', name: 'Krippe', type: 'Krippe' } } });
    store.dispatch({ type: 'simData/simDataItemAdd', payload: { scenarioId, item: {
      id: 'child', name: '<img src=x onerror=alert(1)>', type: 'demand', startdate: '2027-01-01', groupId: 'g',
    } } });
    store.dispatch({ type: 'ui/setPrivacyMode', payload: false });
    store.dispatch({ type: 'ui/setActivePage', payload: 'visu' });
  });
  await page.getByTestId('story-step-compare').click();
  const carousel = page.locator('.analysis-coverage-carousel-wrap');
  await carousel.getByRole('button', { name: 'Nächstes Diagramm' }).click();
  const timeline = page.getByTestId('forecast-event-timeline');
  const marker = timeline.locator('.highcharts-point').first();
  await expect(marker).toBeVisible();
  await marker.hover();
  let tooltip = timeline.locator('.highcharts-tooltip').filter({ hasText: 'Events' }).last();
  await expect(tooltip).toContainText('<img src=x onerror=alert(1)>');
  await expect(tooltip.locator('img')).toHaveCount(0);

  await page.evaluate(() => window.__APP_STORE.dispatch({ type: 'ui/setPrivacyMode', payload: true }));
  await expect(timeline).toHaveAttribute('data-privacy', 'on');
  await page.mouse.move(0, 0);
  await timeline.locator('.highcharts-point').first().hover();
  tooltip = timeline.locator('.highcharts-tooltip').filter({ hasText: 'Events' }).last();
  await expect(tooltip).toContainText('Kind');
  await expect(tooltip).not.toContainText('<img');
  await expect(tooltip.locator('img')).toHaveCount(0);

  await page.evaluate(() => window.__APP_STORE.dispatch({ type: 'ui/setPrivacyMode', payload: false }));
  await expect(timeline).toHaveAttribute('data-privacy', 'off');
  await page.mouse.move(0, 0);
  await timeline.locator('.highcharts-point').first().hover();
  tooltip = timeline.locator('.highcharts-tooltip').filter({ hasText: 'Events' }).last();
  await expect(tooltip).toContainText('<img src=x onerror=alert(1)>');
  await expect(tooltip.locator('img')).toHaveCount(0);
});
