import { test, expect } from '@playwright/test';
import path from 'path';
import {
  TEST_LEVEL,
  getTestsetsForLevel,
  shouldRunBasicTests,
  shouldRunFullTests,
  parseTestLevel,
  getTestLevelDescription,
} from './e2e.config.js';

const exportPassword = 'Aa!234567';

// Log test level at start
console.log(`\n📊 E2E Tests running at level: ${getTestLevelDescription()}\n`);

async function createManualDataset(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Leeres Szenario/i }).click();
  await expect(page).toHaveURL(/\/data/);

  await page.getByRole('link', { name: /Optionen/i }).click();
  await expect(page).toHaveURL(/\/settings/);

  await page.getByRole('tab', { name: 'Szenarien' }).click();
  await page.getByLabel('Name').first().fill('E2E Szenario');
  await page.getByLabel('Bemerkung').fill('Manuell angelegte Testdaten');

  await page.getByRole('tab', { name: 'Gruppen' }).click();
  await page.getByRole('button', { name: 'Neue Gruppe' }).click();
  await page.getByLabel('Name').last().fill('Sonnengruppe');

  await page.getByRole('tab', { name: 'Qualifikationen' }).click();
  await page.getByRole('button', { name: 'Neue Qualifikation' }).click();
  await page.getByLabel('Kurzname').fill('ERZ');
  await page.getByLabel('Anzeigename').fill('Erzieher');

  await page.getByRole('link', { name: /Daten/i }).click();

  await page.getByLabel('Hinzufügen').click();
  await page.getByRole('menuitem', { name: 'Bedarf' }).click();
  await page.getByLabel(/^Name$/).last().fill('Lina');
  await page.getByLabel(/^Vorname$/).last().fill('Kind');
  await page.getByRole('tab', { name: 'Zeiten' }).click();
  await page.getByRole('button', { name: 'Buchungszeitraum hinzufügen' }).click();
  await page.getByRole('switch', { name: 'Montag' }).check({ force: true });
  await page.getByRole('tab', { name: 'Gruppen' }).click();
  await page.getByRole('button', { name: 'Gruppe zuweisen' }).click();
  await page.getByRole('combobox', { name: 'Zugeordnete Gruppe' }).click();
  await page.getByRole('option', { name: 'Sonnengruppe' }).click();

  await page.getByLabel('Hinzufügen').click();
  await page.getByRole('menuitem', { name: 'Kapazität' }).click();
  await page.getByLabel(/^Name$/).last().fill('Mara');
  await page.getByLabel(/^Vorname$/).last().fill('Team');
  await page.getByLabel('ERZ').check({ force: true });
  await page.getByRole('tab', { name: 'Zeiten' }).click();
  await page.getByRole('button', { name: 'Buchungszeitraum hinzufügen' }).click();
  await page.getByRole('switch', { name: 'Montag' }).check({ force: true });
  await page.getByRole('tab', { name: 'Gruppen' }).click();
  await page.getByRole('button', { name: 'Gruppe zuweisen' }).click();
  await page.getByRole('combobox', { name: 'Zugeordnete Gruppe' }).click();
  await page.getByRole('option', { name: 'Sonnengruppe' }).click();
}

// ==========================================
// BASIC TESTS (always run)
// ==========================================

test.describe('BASIC: Manual Data & Visualization', () => {
  test('Manual data entry + visualization', async ({ page }) => {
    await createManualDataset(page);
    await page.getByRole('link', { name: /Analyse/i }).click();

    await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Langzeit' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alters-Histogramm' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Buchungsverteilung' })).toBeVisible();
  });
});

test.describe('BASIC: Export/Import Roundtrip', () => {
  test('Export and reload scenario', async ({ page }, testInfo) => {
    await createManualDataset(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByLabel('Aktionen').click();
    await page.getByRole('menuitem', { name: 'Szenario speichern' }).click();
    const saveDialog = page.getByRole('dialog');
    await saveDialog.getByLabel(/^Passwort$/).fill(exportPassword);
    await saveDialog.getByLabel(/^Passwort bestätigen$/).fill(exportPassword);
    await saveDialog.getByRole('button', { name: 'Speichern' }).click();

    const download = await downloadPromise;
    const savedFile = testInfo.outputPath('roundtrip.capakita');
    await download.saveAs(savedFile);

    await page.goto('/');
    await page.getByRole('button', { name: /Szenario laden/i }).click();
    const loadDialog = page.getByRole('dialog');
    await loadDialog.locator('input[type="file"]').setInputFiles(savedFile);
    await loadDialog.getByLabel(/^Passwort$/).fill(exportPassword);
    await loadDialog.getByRole('button', { name: /^Laden$/ }).click();

    await expect(page).toHaveURL(/\/data/);
    await expect(page.locator('text=Lina').first()).toBeVisible();
    await expect(page.locator('text=Mara').first()).toBeVisible();

    await page.getByRole('link', { name: /Analyse/i }).click();
    await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alters-Histogramm' })).toBeVisible();
  });
});

// ==========================================
// PARAMETRIZED: Import Tests (basic-all or full modes)
// ==========================================

const testsets = getTestsetsForLevel();

test.describe('IMPORT: Adebis Data & Visualization', () => {
  for (const dataset of testsets) {
    test(`with ${dataset.name} (${dataset.kids} kids, ${dataset.staff} staff)`, async ({ page }) => {
      const importZip = path.resolve(process.cwd(), dataset.zip);
      
      await page.goto('/');
      await page.getByRole('button', { name: /Daten importieren/i }).click();
      const importDialog = page.getByRole('dialog');
      await importDialog.locator('input[type="file"]').setInputFiles(importZip);
      await importDialog.getByRole('button', { name: /^Importieren$/ }).click();

      await expect(page).toHaveURL(/\/data/);
      await expect(page.locator('.mantine-Avatar-root').first()).toBeVisible();

      await page.getByRole('link', { name: /Analyse/i }).click();
      await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Alters-Histogramm' })).toBeVisible();
    });
  }
});

// ==========================================
// FULL TESTS (only in full modes)
// ==========================================

if (shouldRunFullTests()) {
  test.describe('FULL: Event Management', () => {
    for (const dataset of testsets) {
      test(`toggle events with ${dataset.name}`, async ({ page }) => {
        const importZip = path.resolve(process.cwd(), dataset.zip);
        
        await page.goto('/');
        await page.getByRole('button', { name: /Daten importieren/i }).click();
        const importDialog = page.getByRole('dialog');
        await importDialog.locator('input[type="file"]').setInputFiles(importZip);
        await importDialog.getByRole('button', { name: /^Importieren$/ }).click();

        await page.getByRole('link', { name: /Optionen/i }).click();
        await page.getByRole('tab', { name: 'Ereignisse' }).click();

        await expect(page.getByText('Automatisch generiert').first()).toBeVisible();

        const eventSwitch = page.getByRole('switch', { name: /Ereignis/i }).first();
        await expect(eventSwitch).toBeChecked();
        await eventSwitch.uncheck({ force: true });
        await expect(eventSwitch).not.toBeChecked();
      });
    }
  });

  test.describe('FULL: Analysis Filters', () => {
    for (const dataset of testsets) {
      test(`filter charts with ${dataset.name}`, async ({ page }) => {
        const importZip = path.resolve(process.cwd(), dataset.zip);
        
        await page.goto('/');
        await page.getByRole('button', { name: /Daten importieren/i }).click();
        const importDialog = page.getByRole('dialog');
        await importDialog.locator('input[type="file"]').setInputFiles(importZip);
        await importDialog.getByRole('button', { name: /^Importieren$/ }).click();

        await page.getByRole('link', { name: /Analyse/i }).click();

        await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Langzeit' })).toBeVisible();

        await page.getByRole('checkbox', { name: 'Langzeit' }).uncheck({ force: true });
        await expect(page.getByRole('heading', { name: 'Langzeit' })).toHaveCount(0);

        await page.getByRole('checkbox', { name: 'Langzeit' }).check({ force: true });
        await expect(page.getByRole('heading', { name: 'Langzeit' })).toBeVisible();

        await page.getByRole('combobox', { name: 'Zeitdimension' }).click();
        await page.getByRole('option', { name: 'Quartal' }).click();
        await expect(page.getByRole('combobox', { name: 'Zeitdimension' })).toHaveValue('Quartal');

        await expect(page.getByRole('combobox', { name: 'Gruppen' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Qualifikationen' })).toBeVisible();
      });
    }
  });
}
