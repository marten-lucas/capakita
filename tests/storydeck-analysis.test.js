import { test, expect } from '@playwright/test';

test('Story deck statistics view renders and navigates steps', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    if (!store) return;

    const sid = 'storydeck-e2e-scenario';
    store.dispatch({ type: 'simScenario/addScenario', payload: { id: sid, name: 'Storydeck E2E', imported: true } });
    store.dispatch({ type: 'simScenario/setSelectedScenarioId', payload: sid });
    store.dispatch({ type: 'ui/setAnalysisStoryDeckEnabled', payload: true });
    store.dispatch({ type: 'ui/setActivePage', payload: 'statistics' });

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId: sid,
        item: {
          id: 'd1',
          name: 'Kind 1',
          type: 'demand',
          dateofbirth: '2022-05-01',
          startdate: '2024-01-01',
        },
      },
    });

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId: sid,
        item: {
          id: 'c1',
          name: 'Mitarbeiter 1',
          type: 'capacity',
          startdate: '2024-01-01',
        },
      },
    });

    store.dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId: sid,
        dataItemId: 'd1',
        booking: {
          id: 'b1',
          startdate: '2024-01-01',
          times: [
            { day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '12:00', mode: 'all' }] },
          ],
        },
      },
    });

    store.dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId: sid,
        dataItemId: 'c1',
        booking: {
          id: 'b2',
          startdate: '2024-01-01',
          times: [
            { day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '14:00', mode: 'pedagogical' }] },
          ],
        },
      },
    });
  });

  await expect(page.getByTestId('statistics-storydeck-view')).toBeVisible();
  await expect(page.getByText('Analyse-Story')).toBeVisible();

  await page.getByRole('button', { name: 'Naechster Schritt' }).click();
  await expect(page.locator('.storydeck-stage').getByText('2. Bestand')).toBeVisible();

  await page.getByTestId('storydeck-thumb-summary').click();
  await expect(page.locator('.storydeck-stage').getByText('7. Kernaussagen')).toBeVisible();
});
