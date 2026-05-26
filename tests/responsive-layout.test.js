import { test, expect } from '@playwright/test';

async function waitForAppStore(page) {
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });
}

async function expectLayoutScreenshot(page, name) {
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.05,
  });
}

async function expectNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;

    return {
      clientWidth: doc.clientWidth,
      scrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth || 0),
    };
  });

  expect(
    metrics.scrollWidth,
    `${label} should not overflow horizontally (scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth})`
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function seedResponsiveScenario(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await waitForAppStore(page);

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'responsive-layout-scenario';

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: scenarioId,
        name: 'Responsive Szenario',
        imported: true,
        importedAnonymized: true,
        confidence: 75,
        likelihood: 60,
        autoEventSettings: {
          statisticsBinding: {
            appliedAt: '2026-05-18',
            snapshot: {
              kita: { ageYears: 3, bookingDeltaHours: 0 },
              school: { ageYears: 6, bookingDeltaHours: -5 },
            },
          },
        },
      },
    });

    store.dispatch({
      type: 'simScenario/setSelectedScenarioId',
      payload: scenarioId,
    });

    store.dispatch({
      type: 'chart/ensureScenario',
      payload: scenarioId,
    });
    store.dispatch({
      type: 'chart/setFilterGroups',
      payload: { scenarioId, groups: ['__NO_GROUP__'] },
    });
    store.dispatch({
      type: 'chart/setFilterQualifications',
      payload: { scenarioId, qualifications: ['__NO_QUALI__'] },
    });

    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: {
        scenarioId,
        groupDef: {
          id: 'responsive-group-1',
          name: 'Sonnengruppe',
          icon: 'mdi:dog',
          type: 'Regelgruppe',
        },
      },
    });

    const entries = [
      {
        id: 'responsive-child-1',
        type: 'demand',
        name: 'Kind Mobil',
        dateofbirth: '2021-05-10',
        startdate: '2025-01-01',
        segments: [
          { id: 'child-seg-1', booking_start: '07:30', booking_end: '12:30' },
          { id: 'child-seg-2', booking_start: '13:00', booking_end: '15:30' },
        ],
      },
      {
        id: 'responsive-staff-1',
        type: 'capacity',
        name: 'Fachkraft Mobil',
        dateofbirth: '',
        startdate: '2025-01-01',
        segments: [
          { id: 'staff-seg-1', booking_start: '07:00', booking_end: '12:00', category: 'pedagogical' },
          { id: 'staff-seg-2', booking_start: '12:30', booking_end: '16:00', category: 'administrative' },
        ],
      },
    ];

    entries.forEach((entry) => {
      store.dispatch({
        type: 'simData/simDataItemAdd',
        payload: {
          scenarioId,
          item: {
            id: entry.id,
            type: entry.type,
            source: 'adebis export',
            name: entry.name,
            remark: '',
            startdate: entry.startdate,
            enddate: '',
            dateofbirth: entry.dateofbirth,
            groupId: '',
            rawdata: { source: 'responsive-test' },
            absences: [],
          },
        },
      });

      store.dispatch({
        type: 'simBooking/addBooking',
        payload: {
          scenarioId,
          dataItemId: entry.id,
          booking: {
            id: `${entry.id}-booking`,
            startdate: '2025-01-01',
            enddate: '',
            times: [
              {
                day: 1,
                day_name: 'Mo',
                segments: entry.segments,
              },
              {
                day: 2,
                day_name: 'Di',
                segments: entry.segments,
              },
            ],
            rawdata: {},
          },
        },
      });
    });

    store.dispatch({
      type: 'simGroup/addGroup',
      payload: {
        scenarioId,
        dataItemId: 'responsive-child-1',
        group: {
          id: 'responsive-group-assignment-1',
          kindId: 'responsive-child-1',
          groupId: 'responsive-group-1',
          start: '2025-01-01',
          end: '',
        },
      },
    });

    store.dispatch({
      type: 'ui/setActivePage',
      payload: 'data',
    });
  });

  await page.waitForFunction(() => window.__APP_STORE?.getState?.().ui?.activePage === 'data', { timeout: 5000 });
}

async function openMainPage(page, name) {
  const button = page.getByRole('button', { name, exact: true });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await button.click();
}

async function openActionsMenu(page) {
  const actionsButton = page.getByLabel('Aktionen');
  await actionsButton.scrollIntoViewIfNeeded();
  await expect(actionsButton).toBeVisible();
  await actionsButton.click();
}

async function closeDialogByTitle(page, title) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toBeHidden();
}

test('welcome and legal pages stay usable across viewports', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('button', { name: /Daten importieren/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Szenario laden/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Leeres Szenario/i })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'welcome view');
  await expectLayoutScreenshot(page, 'responsive-welcome-view.png');

  const legalButton = page.getByRole('button', { name: /Impressum & Datenschutz/i });
  await legalButton.scrollIntoViewIfNeeded();
  await legalButton.click();

  await expect(page.getByRole('heading', { name: /Impressum & Datenschutz/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Zurück/i })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'legal view');
  await expectLayoutScreenshot(page, 'responsive-legal-view.png');
});

test('all main app pages remain usable without horizontal overflow', async ({ page }) => {
  await seedResponsiveScenario(page);

  await expect(page.getByRole('button', { name: 'Daten', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyse', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Optionen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ereignisse', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Statistik', exact: true })).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Kind Mobil' })).toBeVisible();
  await expect(page.getByLabel('Hinzufügen')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'data view');
  await expectLayoutScreenshot(page, 'responsive-data-view.png');

  await openMainPage(page, 'Analyse');
  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
  await expect(page.getByText('Filter', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'analysis view');
  await expectLayoutScreenshot(page, 'responsive-analysis-view.png');

  await openMainPage(page, 'Optionen');
  await expect(page.getByRole('button', { name: /Neue Gruppe/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sonnengruppe' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'settings view');
  await expectLayoutScreenshot(page, 'responsive-settings-view.png');

  await openMainPage(page, 'Ereignisse');
  await expect(page.getByText('Ereignisse', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Kind Mobil beginnt Anwesenheit/i)).toBeVisible();
  await expectNoHorizontalOverflow(page, 'events view');
  await expectLayoutScreenshot(page, 'responsive-events-view.png');

  await openMainPage(page, 'Analyse');
  await expect(page.getByTestId('analysis-storyflow-view')).toBeVisible();
});

test('modals and finance forms stay usable across viewports', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Daten importieren/i }).click();
  await expect(page.getByRole('dialog', { name: 'Datenimport-Wizard' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'data import modal');
  await expectLayoutScreenshot(page, 'responsive-data-import-modal.png');
  await closeDialogByTitle(page, 'Datenimport-Wizard');

  await seedResponsiveScenario(page);

  await openActionsMenu(page);
  await page.getByRole('menuitem', { name: 'Szenario speichern' }).click();
  await expect(page.getByRole('dialog', { name: 'Szenarien speichern' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'save dialog');
  await expectLayoutScreenshot(page, 'responsive-save-dialog.png');
  await closeDialogByTitle(page, 'Szenarien speichern');

  await openActionsMenu(page);
  await page.getByRole('menuitem', { name: 'Szenario laden' }).click();
  await expect(page.getByRole('dialog', { name: 'Szenario laden' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'load dialog');
  await expectLayoutScreenshot(page, 'responsive-load-dialog.png');
  await closeDialogByTitle(page, 'Szenario laden');

  await page.getByText('Fachkraft Mobil').first().click();
  const simDataFinanceTab = page.getByRole('tab', { name: 'Finanzen' });
  await simDataFinanceTab.scrollIntoViewIfNeeded();
  await simDataFinanceTab.evaluate((node) => node.click());
  await expect(simDataFinanceTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Personalkosten zum Stichtag')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'sim data finance tab');
  await expectLayoutScreenshot(page, 'responsive-simdata-finance-tab.png');

  await openMainPage(page, 'Optionen');
  const settingsFinanceTab = page.getByRole('tab', { name: 'Finanzen' });
  await settingsFinanceTab.scrollIntoViewIfNeeded();
  await settingsFinanceTab.evaluate((node) => node.click());
  await expect(settingsFinanceTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('BayKiBiG-Rahmen')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'settings finance tab');
  await expectLayoutScreenshot(page, 'responsive-settings-finance-tab.png');
});