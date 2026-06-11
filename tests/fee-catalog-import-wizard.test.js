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
  await expect(page.getByRole('button', { name: 'Finanzen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finanzen', exact: true }).click();
  await expect(page.getByText('Beitragskataloge pro Gruppe')).toBeVisible();
}

async function openFeeCatalogImportWizard(page) {
  await page.locator('input[type="file"]').nth(1).setInputFiles(importFile);
  await page.getByRole('button', { name: 'Kataloge importieren', exact: true }).nth(1).click();
  const dialog = page.getByRole('dialog', { name: 'Import-Wizard: Beitragskataloge zuordnen' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectWizardSource(page, dialog, groupLabel, sourceLabel) {
  const combo = dialog.getByRole('combobox', { name: groupLabel });
  await combo.click();
  await page.getByRole('option', { name: sourceLabel }).click();
}

test('imports fee catalogs through the wizard even when group IDs differ', async ({ page }) => {
  await seedFeeCatalogScenario(page);
  await openFinanceTab(page);

  const dialog = await openFeeCatalogImportWizard(page);

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

  expect(importedCatalogs['g-kat-krippe'][0].monthlyAmount).toBe(170);
  expect(importedCatalogs['g-kat-kiga'][0].monthlyAmount).toBe(150);
  expect(importedCatalogs['g-kat-schulkind'][0].monthlyAmount).toBe(110);

  await page.getByRole('button', { name: /Krippe/ }).click();
  await expect(page.getByRole('button', { name: '3 - 4 h 170 € im Monat' })).toBeVisible();
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

  await selectWizardSource(page, dialog, 'U3 Blau', 'Krippe (7 Staffeln)');
  await selectWizardSource(page, dialog, 'Kiga Gelb', 'Kindergarten (7 Staffeln)');
  await selectWizardSource(page, dialog, 'Hort Rot', 'Schulkind (3 Staffeln)');

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

  expect(importedCatalogs['g-kat-krippe'][0].monthlyAmount).toBe(170);
  expect(importedCatalogs['g-kat-kiga'][0].monthlyAmount).toBe(150);
  expect(importedCatalogs['g-kat-schulkind'][0].monthlyAmount).toBe(110);

  await page.getByRole('button', { name: /U3 Blau/ }).click();
  await expect(page.getByRole('button', { name: '3 - 4 h 170 € im Monat' })).toBeVisible();
});