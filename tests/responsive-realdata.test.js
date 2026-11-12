import path from 'path';
import { test, expect } from '@playwright/test';
import { TESTSETS } from './e2e.config.js';

const dataset = TESTSETS[0];

async function settlePage(page, delay = 600) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(delay);
}

async function expectLayoutScreenshot(page, name, options = {}) {
  await settlePage(page, 900);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: options.fullPage ?? true,
    maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.02,
    timeout: 15000,
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

async function importAdebisDataset(page) {
  const importZip = path.resolve(process.cwd(), dataset.zip);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Daten importieren/i }).click();

  const importDialog = page.getByRole('dialog', { name: 'Datenimport-Wizard' });
  await expect(importDialog).toBeVisible();
  await importDialog.locator('input[type="file"]').setInputFiles(importZip);
  await importDialog.getByRole('button', { name: /Datei analysieren/i }).click();
  await importDialog.getByRole('button', { name: /Weiter zur Vorschau/i }).click();
  await importDialog.getByRole('button', { name: /Import ausführen/i }).click();

  await expect(page.getByLabel('Hinzufügen')).toBeVisible({ timeout: 30000 });
}

async function openMainPage(page, name) {
  const button = page.locator('button.app-nav-item').filter({ hasText: name }).first();
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await button.evaluate((node) => node.click());
  await settlePage(page);
}

test(`imported dataset ${dataset.name} stays responsive across main pages`, async ({ page }) => {
  await importAdebisDataset(page);

  await expectNoHorizontalOverflow(page, 'realdata data view');
  await expectLayoutScreenshot(page, 'responsive-realdata-data-view.png');

  await openMainPage(page, 'Analyse');
  await expect(page.getByTestId('analysis-clean-sheet')).toBeVisible();
  await expect(page.getByTestId('analysis-story-navigation').locator('[data-testid^="story-step-"]')).toHaveCount(7);
  await expectNoHorizontalOverflow(page, 'realdata analysis view');
  await expectLayoutScreenshot(page, 'responsive-realdata-analysis-view.png');

  await openMainPage(page, 'Optionen');
  await expectNoHorizontalOverflow(page, 'realdata settings view');
  await expectLayoutScreenshot(page, 'responsive-realdata-settings-view.png');

  if ((page.viewportSize()?.width || 0) > 768) {
    await expect(page.getByRole('button', { name: 'Gruppen', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Förderung', exact: true }).click();
    await settlePage(page);
    await expect(page.getByText('BayKiBiG-Rahmen')).toBeVisible();
    await expectNoHorizontalOverflow(page, 'realdata settings finance tab');
    await expectLayoutScreenshot(page, 'responsive-realdata-settings-finance-tab.png');
  } else {
    await expect(page.getByRole('heading', { name: 'Fuchsgruppe' })).toBeVisible();
  }

  await openMainPage(page, 'Ereignisse');
  await expect(page.getByText('Ereignisse', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, 'realdata events view');
  await expectLayoutScreenshot(page, 'responsive-realdata-events-view.png', { fullPage: false });

  await openMainPage(page, 'Analyse');
  await expect(page.getByTestId('analysis-clean-sheet')).toBeVisible();
  await expect(page.getByTestId('analysis-story-navigation').locator('[data-testid^="story-step-"]')).toHaveCount(7);
});