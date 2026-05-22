import { test, expect } from '@playwright/test';

async function seedArchiveScenario(page) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'archive-e2e-scenario';

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: scenarioId,
        name: 'Archive E2E Scenario',
        imported: true,
        importedAnonymized: true,
      },
    });

    store.dispatch({ type: 'chart/ensureScenario', payload: scenarioId });
    store.dispatch({ type: 'chart/setFilterGroups', payload: { scenarioId, groups: ['__NO_GROUP__'] } });
    store.dispatch({ type: 'chart/setFilterQualifications', payload: { scenarioId, qualifications: ['__NO_QUALI__'] } });

    const children = [
      { id: 'archive-child-1', name: 'Kind Archiv Eins' },
      { id: 'archive-child-2', name: 'Kind Archiv Zwei' },
    ];

    children.forEach((child) => {
      store.dispatch({
        type: 'simData/simDataItemAdd',
        payload: {
          scenarioId,
          item: {
            id: child.id,
            type: 'demand',
            source: 'manual entry',
            name: child.name,
            remark: '',
            startdate: '2026-01-01',
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
          dataItemId: child.id,
          booking: {
            id: `${child.id}-booking`,
            startdate: '2026-01-01',
            enddate: '',
            times: [
              {
                day: 1,
                day_name: 'Mo',
                segments: [
                  { id: `${child.id}-seg-1`, booking_start: '08:00', booking_end: '10:00' },
                ],
              },
            ],
            rawdata: {},
          },
        },
      });
    });

    store.dispatch({ type: 'ui/setActivePage', payload: 'data' });
  });

  await page.waitForFunction(() => window.__APP_STORE?.getState?.().ui?.activePage === 'data', { timeout: 5000 });
}

async function readWeeklyDemandMax(page) {
  const value = await page.evaluate(() => {
    const demandChart = window.Highcharts?.charts?.find(
      (candidate) => candidate?.yAxis?.[0]?.axisTitle?.textStr === 'Bedarf (Kinder)'
    );
    if (!demandChart) return null;
    const data = demandChart.series?.[0]?.data || [];
    const values = data.map((point) => Number(point?.y || 0));
    return values.length > 0 ? Math.max(...values) : 0;
  });

  if (value === null) {
    throw new Error('Bedarf-Chart konnte nicht gelesen werden.');
  }

  return value;
}

test('archived items are excluded from analyse but still counted in statistics', async ({ page }) => {
  await seedArchiveScenario(page);

  await page.getByText('Kind Archiv Eins').first().click();
  const archiveCheckbox = page.getByLabel('Archiviert (nur Statistik, nicht Analyse)');
  await expect(archiveCheckbox).toBeVisible();
  await archiveCheckbox.check({ force: true });
  await expect(archiveCheckbox).toBeChecked();

  await page.getByRole('button', { name: 'Analyse' }).click();
  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible({ timeout: 10000 });

  const maxDemand = await readWeeklyDemandMax(page);
  expect(maxDemand).toBe(1);

  await page.getByRole('button', { name: 'Statistik' }).click();
  await expect(page.getByTestId('statistics-latest-kpis')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('statistics-latest-kpis')).toContainText('Kinder: 2');
});

