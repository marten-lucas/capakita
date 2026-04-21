import { test, expect } from '@playwright/test';

async function seedScenarioWithCapacityBooking(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    if (!store) return;

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: 'booking-overlap-validation-test',
        name: 'Overlap Validation Test',
        imported: false,
        importedAnonymized: true,
      },
    });

    const scenarioId = store.getState().simScenario.selectedScenarioId;
    const itemId = 'overlap-capacity-item';

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId,
        item: {
          id: itemId,
          type: 'capacity',
          source: 'manual entry',
          name: 'Mitarbeiter Overlap',
          remark: '',
          startdate: '',
          enddate: '',
          dateofbirth: '',
          groupId: '',
          rawdata: { source: 'manual entry' },
          absences: [],
        },
      },
    });

    store.dispatch({
      type: 'simScenario/setSelectedItem',
      payload: itemId,
    });

    store.dispatch({
      type: 'ui/setActivePage',
      payload: 'data',
    });

    store.dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId,
        dataItemId: itemId,
        booking: {
          id: 'booking-overlap-validation',
          startdate: '',
          enddate: '',
          times: [
            {
              day: 1,
              day_name: 'Mo',
              segments: [
                {
                  id: 'segment-1',
                  booking_start: '08:00',
                  booking_end: '10:00',
                  category: 'pedagogical',
                },
              ],
            },
          ],
          rawdata: {},
        },
      },
    });
  });
}

test('booking editor rejects overlapping times on the same day', async ({ page }) => {
  const runtimeErrors = [];

  page.on('pageerror', (error) => {
    runtimeErrors.push(error.message);
  });

  await seedScenarioWithCapacityBooking(page);

  await page.waitForFunction(() => window.__APP_STORE?.getState?.().ui?.activePage === 'data', { timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Optionen' })).toBeVisible();

  await page.getByRole('tab', { name: 'Zeiten' }).click();
  await page.locator('.mantine-Accordion-control').first().click();

  await expect(page.getByText('Montag')).toBeVisible();
  await expect(page.getByText('Wochenübersicht')).toBeVisible();

  await page.getByRole('button', { name: 'Details' }).first().click();
  await expect(page.getByRole('button', { name: 'Pädagogisch' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Administrativ' })).toBeVisible();

  await page.getByRole('button', { name: 'Segment hinzufügen' }).first().click();

  await page.getByRole('button', { name: 'Details' }).nth(1).click();

  const startInputs = page.getByLabel('Start');
  const endInputs = page.getByLabel('Ende');

  await startInputs.last().fill('09:00');
  await endInputs.last().fill('11:00');
  await endInputs.last().blur();

  await expect(page.locator('.mantine-Notification-title', { hasText: 'Zeit überschneidet sich' }).first()).toBeVisible();
  await expect(page.locator('.mantine-Notification-description', { hasText: 'Am Tag Mo dürfen sich Zeiten nicht überlappen.' }).first()).toBeVisible();
  await expect(page.getByText('zählt nicht in Kapazität')).not.toBeVisible();

  expect(runtimeErrors).toEqual([]);
});