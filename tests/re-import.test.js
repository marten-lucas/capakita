import { test, expect } from '@playwright/test';
import path from 'path';

const importZip = path.resolve(process.cwd(), 'tests/testdata/kita-anonym-48338222.zip');
const exportPassword = 'Aa!234567';

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

test('Test 1 - Daten anlegen und Visualisierung prüfen', async ({ page }) => {
  await createManualDataset(page);
  await page.getByRole('link', { name: /Analyse/i }).click();

  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Langzeit' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alters-Histogramm' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Buchungsverteilung' })).toBeVisible();
});

test('Test 2 - Adebis Daten importieren und Visualisierung prüfen', async ({ page }) => {
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

test('Test 3 - Export Import Roundtrip', async ({ page }, testInfo) => {
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

test('Test 4 - Automatisches Ereignis deaktivieren', async ({ page }) => {
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

test('Test 5 - Analyse Filter funktionieren', async ({ page }) => {
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
