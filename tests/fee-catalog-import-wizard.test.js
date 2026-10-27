import { test, expect } from '@playwright/test';
import path from 'path';

const importFile = path.resolve(process.cwd(), 'tests/testdata/gramschatz-fees-2025.json');

async function waitForAppStore(page) {
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });
}

async function seedFeeCatalogScenario(page, options = {}) {
  const scenarioId = options.scenarioId || 'fee-catalog-import-e2e';
  const groupNames = options.groupNames || {
    krippe: 'Krippe',
    kindergarten: 'Kindergarten',
    schulkind: 'Schulkind',
  };

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await waitForAppStore(page);

  await page.evaluate(({ scenarioId, groupNames }) => {
    const store = window.__APP_STORE;

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: scenarioId,
        name: 'Beitragskatalog E2E',
        imported: true,
        importedAnonymized: true,
      },
    });

    store.dispatch({
      type: 'simScenario/setSelectedScenarioId',
      payload: scenarioId,
    });

    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: {
        scenarioId,
        groupDef: {
          id: 'g-kat-krippe',
          name: groupNames.krippe,
          icon: 'openmoji:baby',
          type: 'Krippe',
        },
      },
    });

    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: {
        scenarioId,
        groupDef: {
          id: 'g-kat-kiga',
          name: groupNames.kindergarten,
          icon: 'openmoji:child',
          type: 'Kindergarten',
        },
      },
    });

    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: {
        scenarioId,
        groupDef: {
          id: 'g-kat-schulkind',
          name: groupNames.schulkind,
          icon: 'openmoji:school',
          type: 'Schulkind',
        },
      },
    });

    store.dispatch({
      type: 'ui/setActivePage',
      payload: 'data',
    });
  }, { scenarioId, groupNames });
}

async function openFinanceTab(page) {
  await page.getByRole('button', { name: 'Optionen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Beiträge', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Beiträge', exact: true }).click();
  await expect(page.getByText('Beitragskataloge pro Gruppe')).toBeVisible();
}

async function openFeeGroup(page, groupName) {
  const control = page.getByRole('button', { name: new RegExp(groupName) });
  if (await control.getAttribute('aria-expanded') !== 'true') await control.click();
  return page.getByRole('region', { name: new RegExp(groupName) });
}

async function openFeeCatalogImportWizard(page) {
  await page.locator('input[type="file"]').setInputFiles(importFile);
  await page.getByRole('button', { name: 'Kataloge importieren', exact: true }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Import-Wizard: Beitragskataloge zuordnen' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectWizardSource(page, dialog, groupLabel, sourceLabel) {
  const combo = dialog.getByRole('combobox', { name: groupLabel });
  await combo.click();
  await page.getByRole('option', { name: sourceLabel }).click();
}

test('imports Gramschatz fee structures as ZEITKAT categories', async ({ page }) => {
  await seedFeeCatalogScenario(page);
  await openFinanceTab(page);

  const dialog = await openFeeCatalogImportWizard(page);
  await selectWizardSource(page, dialog, 'Krippe', 'Beiträge für Kinder unter 3 Jahren (7 Staffeln)');
  await selectWizardSource(page, dialog, 'Kindergarten', 'Beiträge für Kinder über 3 Jahren (vor Schuleintritt) (7 Staffeln)');

  await expect(dialog.getByRole('button', { name: 'Import anwenden' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Import anwenden' }).click();
  await expect(dialog).toBeHidden();

  const importedCatalogs = await page.evaluate(() => {
    const state = window.__APP_STORE.getState();
    const scenarioId = 'fee-catalog-import-e2e';
    return state.simFinance.financeByScenario?.[scenarioId]?.groupFeeCatalogs || {};
  });

  expect(importedCatalogs['g-kat-krippe']).toBeTruthy();
  expect(importedCatalogs['g-kat-kiga']).toBeTruthy();
  expect(importedCatalogs['g-kat-schulkind']).toBeTruthy();

  expect(importedCatalogs['g-kat-krippe'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 170 });
  expect(importedCatalogs['g-kat-kiga'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 150 });
  expect(importedCatalogs['g-kat-schulkind'][0]).toMatchObject({ zeitkatId: '01', monthlyAmount: 110 });
  expect(importedCatalogs['g-kat-krippe'].every((entry) => !Object.hasOwn(entry, 'maxHours'))).toBe(true);

  const krippePanel = await openFeeGroup(page, 'Krippe');
  await expect(krippePanel.getByTestId('fee-staircase-zeitkat')).toBeVisible();
  await expect(krippePanel.getByLabel('Betrag ZEITKAT 04')).toHaveValue('170 EUR');
});

test('supports manual wizard mapping when group names do not match', async ({ page }) => {
  await seedFeeCatalogScenario(page, {
    scenarioId: 'fee-catalog-import-e2e-manual',
    groupNames: {
      krippe: 'U3 Blau',
      kindergarten: 'Kiga Gelb',
      schulkind: 'Hort Rot',
    },
  });
  await openFinanceTab(page);

  const dialog = await openFeeCatalogImportWizard(page);
  await expect(dialog.getByText('Nicht automatisch zugeordnete Quellen')).toBeVisible();

  await selectWizardSource(page, dialog, 'U3 Blau', 'Beiträge für Kinder unter 3 Jahren (7 Staffeln)');
  await selectWizardSource(page, dialog, 'Kiga Gelb', 'Beiträge für Kinder über 3 Jahren (vor Schuleintritt) (7 Staffeln)');
  await selectWizardSource(page, dialog, 'Hort Rot', 'Beiträge für die Mittagsbetreuung / Ferienbetreuung der Schulkinder (3 Staffeln)');

  await expect(dialog.getByRole('button', { name: 'Import anwenden' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Import anwenden' }).click();
  await expect(dialog).toBeHidden();

  const importedCatalogs = await page.evaluate(() => {
    const state = window.__APP_STORE.getState();
    const scenarioId = 'fee-catalog-import-e2e-manual';
    return state.simFinance.financeByScenario?.[scenarioId]?.groupFeeCatalogs || {};
  });

  expect(importedCatalogs['g-kat-krippe']).toBeTruthy();
  expect(importedCatalogs['g-kat-kiga']).toBeTruthy();
  expect(importedCatalogs['g-kat-schulkind']).toBeTruthy();

  expect(importedCatalogs['g-kat-krippe'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 170 });
  expect(importedCatalogs['g-kat-kiga'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 150 });
  expect(importedCatalogs['g-kat-schulkind'][0]).toMatchObject({ zeitkatId: '01', monthlyAmount: 110 });
  expect(importedCatalogs['g-kat-krippe'].every((entry) => !Object.hasOwn(entry, 'maxHours'))).toBe(true);

  const u3Panel = await openFeeGroup(page, 'U3 Blau');
  await expect(u3Panel.getByTestId('fee-staircase-zeitkat')).toBeVisible();
  await expect(u3Panel.getByLabel('Betrag ZEITKAT 04')).toHaveValue('170 EUR');
});