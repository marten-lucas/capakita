import { test, expect } from '@playwright/test';

async function waitForAppStore(page) {
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });
}

async function seedEventsHierarchyScenario(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await waitForAppStore(page);

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'events-hierarchy-scenario';
    const eventDate = '2026-06-01';

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: scenarioId,
        name: 'Events Hierarchy Scenario',
        imported: true,
        importedAnonymized: true,
      },
    });

    store.dispatch({ type: 'simScenario/setSelectedScenarioId', payload: scenarioId });

    const items = [
      {
        id: 'child-1',
        type: 'demand',
        name: 'Kind Alpha',
      },
      {
        id: 'staff-1',
        type: 'capacity',
        name: 'Mitarbeiter Beta',
      },
    ];

    items.forEach((item) => {
      store.dispatch({
        type: 'simData/simDataItemAdd',
        payload: {
          scenarioId,
          item: {
            id: item.id,
            type: item.type,
            name: item.name,
            startdate: eventDate,
            enddate: '',
            dateofbirth: '',
            absences: [
              {
                id: `${item.id}-absence`,
                start: eventDate,
                end: '',
              },
            ],
            rawdata: {},
          },
        },
      });

      store.dispatch({
        type: 'simBooking/addBooking',
        payload: {
          scenarioId,
          dataItemId: item.id,
          booking: {
            id: `${item.id}-booking`,
            startdate: eventDate,
            enddate: '',
            times: [
              {
                day: 1,
                day_name: 'Mo',
                segments: [
                  {
                    id: `${item.id}-seg-1`,
                    booking_start: '08:00',
                    booking_end: '12:00',
                    category: item.type === 'capacity' ? 'pedagogical' : undefined,
                  },
                ],
              },
            ],
          },
        },
      });

      store.dispatch({
        type: 'simGroup/addGroup',
        payload: {
          scenarioId,
          dataItemId: item.id,
          group: {
            id: `${item.id}-ga-1`,
            kindId: item.id,
            groupId: 'g1',
            name: item.name,
            start: eventDate,
            end: '',
          },
        },
      });
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

    store.dispatch({ type: 'ui/setActivePage', payload: 'data' });
  });

  await page.waitForFunction(
    () => window.__APP_STORE?.getState?.().simScenario?.selectedScenarioId === 'events-hierarchy-scenario',
    { timeout: 5000 }
  );
}

test('Events hierarchy keeps only the highest priority event per person and date', async ({ page }) => {
  await seedEventsHierarchyScenario(page);

  await page.getByRole('button', { name: 'Ereignisse', exact: true }).click();
  await expect(page.getByText('Ereignisse', { exact: true }).first()).toBeVisible();

  await expect(page.getByText('Kind Alpha', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Mitarbeiter Beta', { exact: true }).first()).toBeVisible();

  await expect(page.getByText(/beginnt Anwesenheit/)).toHaveCount(2);
  await expect(page.getByText(/Abwesenheit beginnt/)).toHaveCount(0);
  await expect(page.getByText(/Gruppenzuweisung beginnt/)).toHaveCount(0);
  await expect(page.getByText(/Buchung beginnt/)).toHaveCount(0);

  await expect(page.getByText('1 Ereignisse')).toHaveCount(2);
});
