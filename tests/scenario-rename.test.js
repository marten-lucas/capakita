import { test, expect } from '@playwright/test';

async function seedScenarios(page, scenarios) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => Boolean(window.__APP_STORE), { timeout: 10_000 });
  await page.evaluate((items) => {
    const store = window.__APP_STORE;
    items.forEach((scenario) => store.dispatch({ type: 'simScenario/addScenario', payload: scenario }));
    const dataByScenario = Object.fromEntries(items.map((scenario) => [String(scenario.id), {
      [`staff-${scenario.id}`]: {
        id: `staff-${scenario.id}`,
        type: 'capacity',
        name: 'Test-Mitarbeiter',
        source: 'manual entry',
        startdate: '2026-01-01',
        absences: [],
      },
    }]));
    store.dispatch({ type: 'simData/loadDataByScenario', payload: dataByScenario });
    store.dispatch({ type: 'ui/setDataSubmenu', payload: 'capacity' });
    store.dispatch({ type: 'ui/setActivePage', payload: 'data' });
  }, scenarios);
}

test('scenario picker edit icon renames selected scenario', async ({ page }) => {
  await seedScenarios(page, [
    { id: 'rename-e2e', name: 'Vorheriger Name', imported: false, importedAnonymized: true },
  ]);

  await page.getByRole('button', { name: 'Szenario umbenennen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Szenario umbenennen' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Szenarioname').fill('Neuer Szenarioname');
  await dialog.getByTestId('scenario-rename-save').click();
  await expect(dialog).toHaveCount(0);

  const scenarioName = await page.evaluate(() => (
    window.__APP_STORE.getState().simScenario.scenarios.find((item) => item.id === 'rename-e2e')?.name
  ));
  expect(scenarioName).toBe('Neuer Szenarioname');
});

test('scenario rename rejects blank and duplicate names', async ({ page }) => {
  await seedScenarios(page, [
    { id: 'rename-duplicate', name: 'Ziel-Szenario', imported: false, importedAnonymized: true },
    { id: 'rename-current', name: 'Aktuelles Szenario', imported: false, importedAnonymized: true },
  ]);

  await page.getByRole('button', { name: 'Szenario umbenennen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Szenario umbenennen' });
  const input = dialog.getByLabel('Szenarioname');

  await input.fill('   ');
  await dialog.getByTestId('scenario-rename-save').click();
  await expect(dialog.getByText('Bitte einen Szenarionamen eingeben.')).toBeVisible();

  await input.fill('ziel-szenario');
  await dialog.getByTestId('scenario-rename-save').click();
  await expect(dialog.getByText('Dieser Szenarioname wird bereits verwendet.')).toBeVisible();
  await expect(dialog).toBeVisible();
});
