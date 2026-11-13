import { test, expect } from '@playwright/test';

test('analysis stepper renders and navigates all analysis sections', async ({ page }) => {
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

  const storyNavigation = page.getByTestId('analysis-story-navigation');
  await expect(storyNavigation.locator('[data-testid^="story-step-"]')).toHaveCount(7);

  for (const stepId of ['quality', 'status', 'transitions', 'cohort', 'compare', 'options', 'trends']) {
    await page.getByTestId(`story-step-${stepId}`).click();
    await expect.poll(() => page.evaluate(() => window.__APP_STORE.getState().ui.analysisSubPage)).toBe(stepId);
    await expect(page.getByTestId('analysis-stage-content')).toBeVisible();
  }
});

test('Ausblick Sankey respects explicit assignments and inclusive known exits', async ({ page }) => {
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
      payload: { scenarioId: sid, groupDef: { id: 'g-krippe', name: 'Bärchengruppe', type: 'Krippe' } },
    });
    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: { scenarioId: sid, groupDef: { id: 'g-regel', name: 'Regelgruppe', type: 'Regelgruppe' } },
    });
    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: { scenarioId: sid, groupDef: { id: 'g-vorschule', name: 'Vorschule', type: 'Regelgruppe' } },
    });
    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: { scenarioId: sid, groupDef: { id: 'g-schulkind', name: 'Schulkindgruppe', type: 'Schulkindgruppe', fillUp: true, maxFacilityCount: 3, maxSchoolGrade: '4' } },
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
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId: sid,
        item: {
          id: 'child-sankey-krippe',
          name: 'Kind aus Krippe',
          type: 'demand',
          dateofbirth: '2024-05-10',
          startdate: '2025-01-01',
          groupId: 'g-krippe',
        },
      },
    });

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId: sid,
        item: {
          id: 'child-sankey-past-school',
          name: 'Kind schon im Schulalter',
          type: 'demand',
          dateofbirth: '2019-05-10',
          startdate: '2023-01-01',
          enddate: '2027-08-31',
          groupId: 'g-regel',
        },
      },
    });

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId: sid,
        item: {
          id: 'child-sankey-overflow',
          name: 'Kind aus Datenreihenfolge',
          type: 'demand',
          dateofbirth: '2021-06-10',
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

    store.dispatch({
      type: 'simGroup/addGroup',
      payload: {
        scenarioId: sid,
        dataItemId: 'child-sankey-krippe',
        group: {
          id: 'child-sankey-krippe-assignment',
          kindId: 'child-sankey-krippe',
          groupId: 'g-krippe',
          start: '2025-01-01',
          end: '',
        },
      },
    });

    store.dispatch({
      type: 'simGroup/addGroup',
      payload: {
        scenarioId: sid,
        dataItemId: 'child-sankey-past-school',
        group: {
          id: 'child-sankey-past-school-assignment',
          kindId: 'child-sankey-past-school',
          groupId: 'g-regel',
          start: '2023-09-01',
          end: '',
        },
      },
    });

    store.dispatch({
      type: 'simGroup/addGroup',
      payload: {
        scenarioId: sid,
        dataItemId: 'child-sankey-overflow',
        group: {
          id: 'child-sankey-overflow-assignment',
          kindId: 'child-sankey-overflow',
          groupId: 'g-regel',
          start: '2025-01-01',
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
  await expect(page.getByText('Ausblick (Sankey)', { exact: true })).toBeVisible();

  await expect(page.getByText('Keine gruppenbezogenen Ubergange')).toHaveCount(0);
  const sankeyLinks = page.locator('.highcharts-sankey-series .highcharts-link');
  await expect(sankeyLinks.first()).toBeVisible();
  await expect(page.getByTestId('forecast-sankey-export-menu')).toBeVisible();
  const renderedTransitions = await page.getByTestId('forecast-sankey-chart').getAttribute('data-transition-pairs');
  expect(renderedTransitions).toContain('Regelgruppe: 3 Kinder -> Austritt: 1 Kinder');
  expect(renderedTransitions).toContain('Krippe: 1 Kinder -> Krippe: 1 Kinder');
  expect(renderedTransitions).not.toContain('Schulkindbetreuung');
  expect(renderedTransitions).not.toContain('Geschätzter Zulauf');


  const nextSlide = page.locator('.analysis-stage-content .analysis-coverage-carousel-nav').last();
  await nextSlide.click();
  await nextSlide.click();
  await nextSlide.click();
  await expect(page.getByTestId('forecast-demography-monthpicker')).toBeVisible();
});

test('Ausblick: Gruppenfilter leeren aktiviert den geschätzten Zulauf dauerhaft', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__APP_STORE);
  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const sid = 'forecast-inflow-filter-e2e';
    store.dispatch({ type: 'simScenario/addScenario', payload: { id: sid, name: 'Zulauf E2E', imported: true } });
    store.dispatch({ type: 'simScenario/setSelectedScenarioId', payload: sid });
    store.dispatch({ type: 'simGroup/addGroupDef', payload: { scenarioId: sid, groupDef: { id: 'g1', name: 'Füchse', type: 'Krippe' } } });
    store.dispatch({ type: 'simData/simDataItemAdd', payload: { scenarioId: sid, item: { id: 'child', type: 'demand', name: 'Kind', startdate: '2024-01-01', groupId: 'g1' } } });
    store.dispatch({ type: 'simData/simDataItemAdd', payload: { scenarioId: sid, item: { id: 'future', type: 'demand', name: 'Bekannte Aufnahme', startdate: '2028-01-01', groupId: 'g1' } } });
    store.dispatch({ type: 'chart/setReferenceDate', payload: { scenarioId: sid, date: '2026-01-01' } });
    store.dispatch({ type: 'chart/setFilterGroups', payload: { scenarioId: sid, groups: ['g1'] } });
    store.dispatch({ type: 'ui/setActivePage', payload: 'visu' });
    store.dispatch({ type: 'ui/setAnalysisSubPage', payload: 'compare' });
  });

  const status = page.getByTestId('forecast-group-filter-status');
  const basis = page.getByTestId('forecast-inflow-basis');
  await expect(status).toContainText('Gruppenfilter aktiv');
  await page.getByRole('switch', { name: 'Zulauf im Stufenverlauf simulieren' }).check();
  await expect(basis).toContainText('Bei aktivem Gruppenfilter wird kein Zulauf simuliert');
  await page.getByRole('button', { name: 'Gruppenfilter leeren' }).click();
  await expect(status).toContainText('Alle Gruppen (kein Filter)');
  await expect(basis).toContainText('Zulaufschätzung eingeschaltet');
  await expect(page.getByTestId('forecast-sankey-chart')).toHaveAttribute('data-transition-pairs', /Bekannte Aufnahme/);
  await expect(page.getByTestId('forecast-sankey-chart')).not.toHaveAttribute('data-transition-pairs', /Geschätzter Zulauf/);
  await expect.poll(() => page.evaluate(() => window.__APP_STORE.getState().chart['forecast-inflow-filter-e2e'].filter.Groups)).toEqual([]);

  await page.getByTestId('analysis-filter-toggle').click();
  const groups = page.getByRole('combobox', { name: 'Gruppen' });
  await expect(groups).toHaveAttribute('placeholder', 'Alle Gruppen (kein Filter)');
  await groups.click();
  await page.getByRole('option', { name: 'Füchse' }).click();
  await expect(status).toContainText('Gruppenfilter aktiv');
  await groups.press('Backspace');
  await expect.poll(() => page.evaluate(() => window.__APP_STORE.getState().chart['forecast-inflow-filter-e2e'].filter.Groups)).toEqual([]);
  await expect(basis).toContainText('Zulaufschätzung eingeschaltet');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByText('Kontextfilter', { exact: true })).not.toBeVisible();
  await page.getByTestId('story-step-status').click();
  await page.getByTestId('story-step-compare').click();
  await expect(page.getByTestId('forecast-group-filter-status')).toContainText('Alle Gruppen (kein Filter)');
  await expect(page.getByTestId('forecast-sankey-chart')).toHaveAttribute('data-transition-pairs', /Bekannte Aufnahme/);
  await expect(page.getByTestId('forecast-sankey-chart')).not.toHaveAttribute('data-transition-pairs', /Geschätzter Zulauf/);
});
