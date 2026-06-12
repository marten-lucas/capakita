import { test, expect } from '@playwright/test';

test('analyse story flow renders and navigates steps', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    if (!store) return;

    const sid = 'storydeck-e2e-scenario';
    store.dispatch({ type: 'simScenario/addScenario', payload: { id: sid, name: 'Storydeck E2E', imported: true } });
    store.dispatch({ type: 'simScenario/setSelectedScenarioId', payload: sid });
    store.dispatch({ type: 'ui/setActivePage', payload: 'visu' });

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

  await expect(page.getByTestId('analysis-clean-sheet')).toBeVisible();

  const storyCarousel = page.locator('.analysis-album-flow-carousel');
  await storyCarousel.getByRole('button', { name: 'Next slide' }).click();
  await expect(page.getByText('Slide 2 of 7').first()).toBeVisible();

  await storyCarousel.getByRole('button', { name: 'Next slide' }).click();
  await storyCarousel.getByRole('button', { name: 'Next slide' }).click();
  await storyCarousel.getByRole('button', { name: 'Next slide' }).click();
  await expect(page.getByText('Slide 5 of 7').first()).toBeVisible();
});

test('ausblick sankey renders with test data and month picker is available', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    if (!store) return;

    const sid = 'storydeck-sankey-regression';
    store.dispatch({ type: 'simScenario/addScenario', payload: { id: sid, name: 'Sankey Regression', imported: true } });
    store.dispatch({ type: 'simScenario/setSelectedScenarioId', payload: sid });
    store.dispatch({ type: 'chart/ensureScenario', payload: sid });
    store.dispatch({ type: 'chart/setReferenceDate', payload: { scenarioId: sid, date: '2026-02-01' } });

    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: { scenarioId: sid, groupDef: { id: 'g-regel', name: 'Regelgruppe', type: 'Regelgruppe' } },
    });
    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: { scenarioId: sid, groupDef: { id: 'g-vorschule', name: 'Vorschule', type: 'Regelgruppe' } },
    });

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId: sid,
        item: {
          id: 'child-sankey-1',
          name: 'Kind Sankey',
          type: 'demand',
          dateofbirth: '2021-05-10',
          startdate: '2025-01-01',
          groupId: 'g-regel',
        },
      },
    });

    store.dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId: sid,
        dataItemId: 'child-sankey-1',
        booking: {
          id: 'child-sankey-booking-1',
          startdate: '2025-01-01',
          times: [
            {
              day: 1,
              day_name: 'Mo',
              segments: [{ id: 'child-sankey-seg-1', booking_start: '08:00', booking_end: '14:00' }],
            },
          ],
        },
      },
    });

    store.dispatch({
      type: 'simGroup/addGroup',
      payload: {
        scenarioId: sid,
        dataItemId: 'child-sankey-1',
        group: {
          id: 'child-sankey-ga-1',
          kindId: 'child-sankey-1',
          groupId: 'g-regel',
          start: '2025-01-01',
          end: '2026-08-31',
        },
      },
    });

    store.dispatch({
      type: 'simGroup/addGroup',
      payload: {
        scenarioId: sid,
        dataItemId: 'child-sankey-1',
        group: {
          id: 'child-sankey-ga-2',
          kindId: 'child-sankey-1',
          groupId: 'g-vorschule',
          start: '2026-09-01',
          end: '',
        },
      },
    });

    const state = store.getState();
    store.dispatch({
      type: 'events/refreshAllEvents',
      payload: {
        simScenario: state.simScenario,
        simData: state.simData,
        simBooking: state.simBooking,
        simGroup: state.simGroup,
      },
    });

    store.dispatch({ type: 'ui/setActivePage', payload: 'visu' });
    store.dispatch({ type: 'ui/setAnalysisSubPage', payload: 'compare' });
  });

  await expect(page.getByTestId('analysis-clean-sheet')).toBeVisible();
  await expect(page.locator('.analysis-stage-content')).toBeVisible();

  await page.locator('.analysis-stage-content .analysis-coverage-carousel-nav').last().click();

  await expect(page.getByText('Keine gruppenbezogenen Ubergange')).toHaveCount(0);
  await expect(page.locator('.highcharts-sankey-series .highcharts-link').first()).toBeVisible();
  await expect(page.getByTestId('forecast-sankey-monthpicker')).toBeVisible();
});
