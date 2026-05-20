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

  const importDialog = page.getByRole('dialog', { name: 'Daten importieren' });
  await expect(importDialog).toBeVisible();
  await importDialog.locator('input[type="file"]').setInputFiles(importZip);
  await importDialog.getByRole('button', { name: /^Importieren$/ }).click();

  await expect(page.getByLabel('Hinzufügen')).toBeVisible({ timeout: 30000 });
}

async function openMainPage(page, name) {
  const button = page.getByRole('button', { name, exact: true });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await button.click();
  await settlePage(page);
}

test(`imported dataset ${dataset.name} stays responsive across main pages`, async ({ page }) => {
  await importAdebisDataset(page);

  await expectNoHorizontalOverflow(page, 'realdata data view');
  await expectLayoutScreenshot(page, 'responsive-realdata-data-view.png');

  await openMainPage(page, 'Analyse');
  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'realdata analysis view');
  await expectLayoutScreenshot(page, 'responsive-realdata-analysis-view.png');

  await openMainPage(page, 'Optionen');
  await expect(page.getByRole('tab', { name: 'Gruppen' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'realdata settings view');
  await expectLayoutScreenshot(page, 'responsive-realdata-settings-view.png');

  const financeTab = page.getByRole('tab', { name: 'Finanzen' });
  await financeTab.scrollIntoViewIfNeeded();
  await financeTab.evaluate((node) => node.click());
  await expect(financeTab).toHaveAttribute('aria-selected', 'true');
  await settlePage(page);
  await expect(page.getByText('BayKiBiG-Rahmen')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'realdata settings finance tab');
  await expectLayoutScreenshot(page, 'responsive-realdata-settings-finance-tab.png');

  await openMainPage(page, 'Ereignisse');
  await expect(page.getByText('Ereignisse', { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, 'realdata events view');
  await expectLayoutScreenshot(page, 'responsive-realdata-events-view.png', { fullPage: false });

  await openMainPage(page, 'Statistik');
  await expect(page.getByTestId('statistics-view')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'realdata statistics view');
  await expectLayoutScreenshot(page, 'responsive-realdata-statistics-view.png', { fullPage: false });
});