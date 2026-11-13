import path from 'path';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const datasetZip = path.resolve(process.cwd(), 'tests/testdata/kita-anonym-72229327.zip');

test('Beitragssimulation erweitert die Analyse und scrollt im gesamten Inhaltsbereich', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Daten importieren/i }).click();

  const importDialog = page.getByRole('dialog', { name: 'Datenimport-Wizard' });
  await expect(importDialog).toBeVisible();
  await importDialog.locator('input[type="file"]').setInputFiles(datasetZip);
  await importDialog.getByRole('button', { name: /Datei analysieren/i }).click();
  await importDialog.getByRole('button', { name: /Weiter zur Vorschau/i }).click();
  await importDialog.getByRole('button', { name: /Import ausführen/i }).click();

  await expect(page.getByLabel('Hinzufügen')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Analyse', exact: true }).click();
  await expect(page.getByTestId('story-step-quality')).toBeVisible();
  await page.getByTestId('story-step-options').click();
  await expect(page.getByTestId('analysis-stage-content')).toHaveClass(/analysis-stage-content--options/);
  await expect(page.getByTestId('simulation-results-panel')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('annual-income-results')).toBeVisible();
  await expect(page.getByTestId('simulation-scenario-select')).toBeVisible();

  await page.getByTestId('export-simulation-pdf').click();
  const pdfDialog = page.getByRole('dialog', { name: 'Datenschutz prüfen – PDF-Export' });
  await expect(pdfDialog).toBeVisible();
  await expect(pdfDialog.getByRole('button', { name: 'PDF-Dialog schließen' })).toBeVisible();
  await expect(pdfDialog.getByRole('switch', { name: 'Familienliste mit individuellen Beiträgen aufnehmen' })).not.toBeChecked();
  const downloadPromise = page.waitForEvent('download');
  await pdfDialog.getByRole('button', { name: 'PDF herunterladen' }).click();
  const download = await downloadPromise;
  await expect(pdfDialog).toBeHidden();
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  expect((await readFile(pdfPath)).subarray(0, 4).toString('ascii')).toBe('%PDF');

  const layout = await page.evaluate(() => {
    const analysisRoot = document.querySelector('.analysis-view-root');
    const stage = document.querySelector('.analysis-stage-shell');
    const content = document.querySelector('[data-testid="analysis-stage-content"]');
    const settings = document.querySelector('[data-testid="simulation-settings-panel"]');
    const results = document.querySelector('[data-testid="simulation-results-panel"]');
    const annualTable = document.querySelector('[data-testid="annual-income-results"]');
    const rect = (element) => {
      const { top, bottom, width, height } = element.getBoundingClientRect();
      return { top, bottom, width, height };
    };
    return {
      analysisRootOverflowY: getComputedStyle(analysisRoot).overflowY,
      analysisRootScrollHeight: analysisRoot.scrollHeight,
      analysisRootClientHeight: analysisRoot.clientHeight,
      resultsOverflowY: getComputedStyle(results).overflowY,
      resultsScrollHeight: results.scrollHeight,
      resultsClientHeight: results.clientHeight,
      stage: rect(stage),
      content: rect(content),
      settings: rect(settings),
      results: rect(results),
      annualTable: rect(annualTable),
      annualTableViewportWidth: annualTable.parentElement.clientWidth,
      annualTableViewportScrollWidth: annualTable.parentElement.scrollWidth,
    };
  });

  expect(layout.analysisRootOverflowY).toBe('auto');
  expect(layout.analysisRootScrollHeight).toBeGreaterThan(layout.analysisRootClientHeight);
  expect(layout.resultsOverflowY).toBe('visible');
  expect(layout.resultsScrollHeight).toBeLessThanOrEqual(layout.resultsClientHeight + 1);
  expect(layout.results.height, JSON.stringify(layout)).toBeGreaterThan(150);
  expect(layout.results.width).toBeGreaterThan(layout.content.width * 0.95);
  expect(layout.results.top).toBeGreaterThanOrEqual(layout.settings.bottom - 1);
  expect(layout.results.bottom).toBeLessThanOrEqual(layout.content.bottom + 1);
  expect(layout.results.bottom).toBeGreaterThanOrEqual(layout.stage.bottom - 80);
  expect(layout.annualTable.width).toBeLessThanOrEqual(layout.annualTableViewportWidth + 1);
  expect(layout.annualTableViewportScrollWidth).toBeLessThanOrEqual(layout.annualTableViewportWidth + 1);
});
