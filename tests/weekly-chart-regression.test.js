import { test, expect } from '@playwright/test';

async function seedWeeklyChartRegressionScenario(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: 'weekly-chart-regression',
        name: 'Weekly Chart Regression',
        imported: false,
        importedAnonymized: true,
      },
    });

    const scenarioId = store.getState().simScenario.selectedScenarioId;

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId,
        item: {
          id: 'weekly-chart-regression-child',
          type: 'demand',
          source: 'manual entry',
          name: 'Kind Regression',
          remark: '',
          startdate: '',
          enddate: '',
          dateofbirth: '2021-01-01',
          groupId: '',
          rawdata: { source: 'manual entry' },
          absences: [],
        },
      },
    });

    store.dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId,
        dataItemId: 'weekly-chart-regression-child',
        booking: {
          id: 'weekly-chart-regression-child-booking',
          startdate: '',
          enddate: '',
          times: [
            {
              day: 1,
              day_name: 'Mo',
              segments: [
                { id: 'c-1', booking_start: '07:00', booking_end: '08:00' },
                { id: 'c-2', booking_start: '12:00', booking_end: '13:00' },
                { id: 'c-3', booking_start: '16:00', booking_end: '17:00' },
              ],
            },
          ],
          rawdata: {},
        },
      },
    });

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId,
        item: {
          id: 'weekly-chart-regression-staff',
          type: 'capacity',
          source: 'manual entry',
          name: 'Mitarbeiter Regression',
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
      type: 'simBooking/addBooking',
      payload: {
        scenarioId,
        dataItemId: 'weekly-chart-regression-staff',
        booking: {
          id: 'weekly-chart-regression-staff-booking',
          startdate: '',
          enddate: '',
          times: [
            {
              day: 1,
              day_name: 'Mo',
              segments: [
                { id: 's-1', booking_start: '07:00', booking_end: '07:30', category: 'pedagogical' },
                { id: 's-2', booking_start: '12:00', booking_end: '12:30', category: 'pedagogical' },
                { id: 's-3', booking_start: '16:00', booking_end: '16:30', category: 'pedagogical' },
              ],
            },
          ],
          rawdata: {},
        },
      },
    });
  });
}

test('weekly chart renders the boundary slots without page errors', async ({ page }) => {
  const pageErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await seedWeeklyChartRegressionScenario(page);

  await page.evaluate(() => {
    window.__APP_STORE?.dispatch({
      type: 'ui/setActivePage',
      payload: 'visu',
    });
  });

  await page.waitForTimeout(1500);

  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
  const weeklySection = page.getByRole('heading', { name: 'Regelbetrieb' }).locator('xpath=following-sibling::*[1]');

  const imageCount = await weeklySection.getByRole('img').count();
  expect(imageCount).toBeGreaterThanOrEqual(2);

  await expect(weeklySection.locator('text=8:00')).toHaveCount(10);
  await expect(weeklySection.locator('text=12:00')).toHaveCount(10);
  await expect(weeklySection.locator('text=16:00')).toHaveCount(10);

  expect(pageErrors).toEqual([]);
});