import { test, expect } from '@playwright/test';

async function seedDataList(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => Boolean(window.__APP_STORE), { timeout: 10_000 });
  await page.evaluate(() => {
    const store = window.__APP_STORE;
    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: 'data-panel-e2e',
        name: 'Datenlisten-Test',
        imported: false,
        importedAnonymized: true,
      },
    });
    store.dispatch({
      type: 'simData/loadDataByScenario',
      payload: {
        'data-panel-e2e': {
          'staff-1': { id: 'staff-1', type: 'capacity', name: 'Alex Fachkraft', source: 'manual entry', startdate: '2026-01-01', absences: [] },
          'staff-2': { id: 'staff-2', type: 'capacity', name: '', source: 'manual entry', startdate: '2026-01-01', absences: [] },
          'staff-3': { id: 'staff-3', type: 'capacity', name: 'Mira Ergänzungskraft', source: 'manual entry', startdate: '2026-01-01', absences: [] },
          'staff-archived': { id: 'staff-archived', type: 'capacity', name: 'Archivierte Person', source: 'manual entry', archived: true, startdate: '2026-01-01', absences: [] },
        },
      },
    });
    store.dispatch({
      type: 'simQualification/loadQualificationDefsByScenario',
      payload: {
        'data-panel-e2e': [{ key: 'E', name: 'Erzieher/in', initial: 'E', IsExpert: true }],
      },
    });
    store.dispatch({ type: 'ui/setActivePage', payload: 'data' });
    store.dispatch({ type: 'ui/setDataSubmenu', payload: 'capacity' });
    store.dispatch({ type: 'ui/setDataListFilter', payload: 'all' });
  });
  await expect(page.getByTestId('list-detail-list-panel')).toBeVisible();
  await expect(page.getByTestId('data-list-item-staff-1')).toBeVisible();
}

test('data list is left of detail and cleanup controls are in the right toolbar', async ({ page }) => {
  await seedDataList(page);

  const listPanel = page.getByTestId('list-detail-list-panel');
  const detailPanel = page.getByTestId('list-detail-detail-panel');
  const toolbarPanel = page.getByTestId('list-detail-toolbar-panel');
  const listBox = await listPanel.boundingBox();
  const detailBox = await detailPanel.boundingBox();
  const toolbarBox = await toolbarPanel.boundingBox();
  expect(listBox.x).toBeLessThan(detailBox.x);
  expect(detailBox.x).toBeLessThan(toolbarBox.x);
  await expect(toolbarPanel.getByTestId('data-capture-toolbar')).toBeVisible();

  await page.getByRole('button', { name: 'Datenliste ausblenden' }).click();
  await expect(page.getByTestId('list-detail-list-collapsed')).toBeVisible();
  await page.getByRole('button', { name: 'Datenliste einblenden' }).click();
  await expect(listPanel).toBeVisible();

  // Incomplete filters and archive visibility
  await page.getByRole('button', { name: 'Filter öffnen' }).click();
  await page.getByRole('menuitem', { name: 'Ohne Name' }).click();
  await expect(page.getByTestId('data-list-item-staff-2')).toBeVisible();
  await expect(page.getByTestId('data-list-item-staff-1')).toHaveCount(0);
  await page.getByRole('button', { name: 'Filter öffnen' }).click();
  await page.getByRole('menuitem', { name: 'Alle', exact: true }).click();

  await page.getByLabel('Archivierte anzeigen').check();
  await expect(page.getByTestId('data-list-item-staff-archived')).toBeVisible();
  await page.getByLabel('Archivierte anzeigen').uncheck();
  await expect(page.getByTestId('data-list-item-staff-archived')).toHaveCount(0);

  // Queue mode switches to incomplete records, the next button selects one.
  await toolbarPanel.getByRole('button', { name: 'Erfassungs-Queue' }).click();
  await expect(page.getByText(/Queue aktiv/)).toBeVisible();
  await expect(page.getByTestId('data-list-item-staff-2')).toBeVisible();
  await toolbarPanel.getByRole('button', { name: 'Nächster unvollständig' }).click();
  const selectedIds = await page.evaluate(() => window.__APP_STORE.getState().simScenario.selectedItems['data-panel-e2e']);
  expect(selectedIds).toHaveLength(1);
  const selectedItem = await page.evaluate((id) => window.__APP_STORE.getState().simData.dataByScenario['data-panel-e2e'][id], selectedIds[0]);
  expect(selectedItem).toBeTruthy();
  expect(selectedItem.archived).not.toBe(true);
});

test('data list selection supports bulk archive and restoring an archived record', async ({ page }) => {
  await seedDataList(page);

  await page.getByTestId('data-list-item-staff-1').getByRole('checkbox').check();
  await page.getByTestId('data-list-item-staff-2').getByRole('checkbox').check();
  await expect(page.getByText('2 ausgewählt')).toBeVisible();
  await page.getByTestId('list-detail-list-panel').getByRole('button', { name: 'Archivieren', exact: true }).click();
  const archived = await page.evaluate(() => {
    const data = window.__APP_STORE.getState().simData.dataByScenario['data-panel-e2e'];
    return [data['staff-1'].archived, data['staff-2'].archived];
  });
  expect(archived).toEqual([true, true]);

  await page.getByLabel('Archivierte anzeigen').check();
  await page.getByTestId('data-list-item-staff-1').getByRole('checkbox').check();
  await page.getByTestId('list-detail-list-panel').getByRole('button', { name: 'Aus Archiv', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (
    window.__APP_STORE.getState().simData.dataByScenario['data-panel-e2e']['staff-1'].archived
  ))).toBe(false);
});

test('single-record archive/restore and bulk delete actions work', async ({ page }) => {
  await seedDataList(page);

  await page.getByTestId('data-list-item-staff-1').click();
  await page.getByRole('button', { name: 'Eintrag archivieren' }).click();
  await expect.poll(() => page.evaluate(() => (
    window.__APP_STORE.getState().simData.dataByScenario['data-panel-e2e']['staff-1'].archived
  ))).toBe(true);

  await page.getByLabel('Archivierte anzeigen').check();
  await page.getByTestId('data-list-item-staff-1').click();
  await page.getByRole('button', { name: 'Aus Archiv holen' }).click();
  await expect.poll(() => page.evaluate(() => (
    window.__APP_STORE.getState().simData.dataByScenario['data-panel-e2e']['staff-1'].archived
  ))).toBe(false);
  await page.getByRole('button', { name: 'Aufheben' }).click();

  await page.getByTestId('data-list-item-staff-1').getByRole('checkbox').check();
  await page.getByTestId('data-list-item-staff-3').getByRole('checkbox').check();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const data = window.__APP_STORE.getState().simData.dataByScenario['data-panel-e2e'];
    return [Boolean(data['staff-1']), Boolean(data['staff-3'])];
  })).toEqual([false, false]);
});

test('bulk-edit panel applies selected validity fields to selected staff', async ({ page }) => {
  await seedDataList(page);

  await page.getByTestId('data-list-item-staff-1').getByRole('checkbox').check();
  await page.getByTestId('data-list-item-staff-3').getByRole('checkbox').check();
  const detail = page.getByTestId('list-detail-detail-panel');
  await expect(detail.getByText('Mehrfachbearbeitung')).toBeVisible();
  await expect(detail.getByText('Gültigkeit', { exact: true })).toBeVisible();
  await expect(detail.getByText('Qualifikation', { exact: true })).toBeVisible();
  await expect(detail.getByText('Kosten', { exact: true })).toBeVisible();

  await detail.getByRole('checkbox').first().check();
  await detail.getByPlaceholder('YYYY-MM-DD').first().fill('2026-09-01');
  await detail.getByRole('button', { name: 'Auf Auswahl anwenden' }).click();

  const validFromValues = await page.evaluate(() => {
    const data = window.__APP_STORE.getState().simData.dataByScenario['data-panel-e2e'];
    return [data['staff-1'].validFrom, data['staff-3'].validFrom];
  });
  expect(validFromValues).toEqual(['2026-09-01', '2026-09-01']);

  // The team assistant writes qualification assignments for the same selection.
  await detail.getByText('Qualifikation', { exact: true }).click();
  await detail.getByRole('checkbox').check();
  await detail.getByLabel('E', { exact: true }).check();
  await detail.getByRole('button', { name: 'Auf Auswahl anwenden' }).click();
  const qualifications = await page.evaluate(() => {
    const assignments = window.__APP_STORE.getState().simQualification.qualificationAssignmentsByScenario['data-panel-e2e'];
    return ['staff-1', 'staff-3'].map((id) => Object.values(assignments[id] || {})[0]?.qualification);
  });
  expect(qualifications).toEqual(['E', 'E']);

  // The cost assistant also writes personnel cost-history records.
  await detail.getByText('Kosten', { exact: true }).click();
  await detail.getByRole('checkbox').first().check();
  await detail.getByRole('textbox').first().fill('50000');
  await detail.getByRole('button', { name: 'Auf Auswahl anwenden' }).click();
  const salaries = await page.evaluate(() => {
    const finances = window.__APP_STORE.getState().simFinance.financeByScenario['data-panel-e2e'].itemFinances;
    return ['staff-1', 'staff-3'].map((id) => finances[id]?.personnelCostHistory?.[0]?.annualGrossSalary);
  });
  expect(salaries).toEqual([50000, 50000]);
});
