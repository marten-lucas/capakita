import { test, expect } from '@playwright/test';

async function seedScenarioWithGroup(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    if (!store) return;

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: 'group-icon-picker-test',
        name: 'Icon Picker Test',
        imported: false,
        importedAnonymized: true,
      },
    });

    const scenarioId = store.getState().simScenario.selectedScenarioId;
    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: {
        scenarioId,
        groupDef: {
          id: 'group-icon-picker-test-group',
          name: 'Testgruppe',
          icon: 'mdi:dog',
          type: 'Regelgruppe',
        },
      },
    });
  });
}

test('group icon picker opens without runtime errors', async ({ page }, testInfo) => {
  const runtimeErrors = [];

  page.on('pageerror', (error) => {
    runtimeErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(message.text());
    }
  });

  await seedScenarioWithGroup(page);

  await page.getByRole('button', { name: 'Optionen' }).click();
  await page.getByRole('heading', { name: 'Testgruppe' }).waitFor({ state: 'visible' });

  const picker = page.getByTestId('group-icon-picker');
  await expect(picker).toBeVisible();

  await picker.getByTestId('group-icon-picker-trigger').click();

  await expect(page.getByTestId('group-icon-picker-popover')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tiere' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Menschen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Natur' })).toBeVisible();
  expect(await page.getByRole('button', { name: /Hund|Dog/i }).count()).toBeGreaterThan(0);

  const screenshotPath = `test-results/group-icon-picker-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  try {
    testInfo.attach('screenshot', { path: screenshotPath, contentType: 'image/png' });
  } catch {
    // ignore attachment failures in nonstandard runners
  }

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([]);
});