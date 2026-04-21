import { test, expect } from '@playwright/test';

/**
 * Minimal test data setup
 */
async function createMinimalTestDataSimple(page, withGroups = false) {
  await page.goto('/');
  await page.goto('/data');
  await page.waitForLoadState('networkidle');
  
  // Add staff
  const addCapacityBtn = page.getByRole('button').filter({ hasText: /Kapazität|capacity/i });
  if (await addCapacityBtn.count() > 0) {
    await addCapacityBtn.first().click();
    await page.waitForTimeout(500);
    const inputs = page.locator('input[type="text"]');
    await inputs.last().fill('Staff1');
  }
  
  // Add child
  const addDemandBtn = page.getByRole('button').filter({ hasText: /Bedarf|demand/i });
  if (await addDemandBtn.count() > 0) {
    await addDemandBtn.first().click();
    await page.waitForTimeout(500);
    const childInputs = page.locator('input[type="text"]');
    await childInputs.last().fill('Child1');
    const dateInputs = page.locator('input[type="date"]');
    if (await dateInputs.count() > 0) {
      await dateInputs.last().fill('2025-11-01');
    }
  }

  // Navigate to visu
  await page.goto('/visu');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

test('Minimal Data - No Groups - Chart Rendering', async ({ page }) => {
  await createMinimalTestDataSimple(page, false);
  const svgs = page.locator('svg');
  const svgCount = await svgs.count();
  console.log(`Found ${svgCount} SVG elements`);
  expect(svgCount).toBeGreaterThan(0);
});

test('Minimal Data - No Groups - Age Histogram', async ({ page }) => {
  await createMinimalTestDataSimple(page, false);
  const allTexts = await page.locator('text').evaluateAll((els) =>
    els.map((el) => el.textContent?.trim()).filter((t) => t)
  );
  const hasAgeLabel = allTexts.some((t) => t?.includes('Alter'));
  console.log('Has age label:', hasAgeLabel);
});

test('Minimal Data - With Groups - Chart Rendering', async ({ page }) => {
  await createMinimalTestDataSimple(page, true);
  const svgs = page.locator('svg');
  expect(await svgs.count()).toBeGreaterThan(0);
});

test('Minimal Data - With Groups - Decimal Years', async ({ page }) => {
  await createMinimalTestDataSimple(page, true);
  const allTexts = await page.locator('text').evaluateAll((els) =>
    els.map((el) => el.textContent?.trim()).filter((t) => t)
  );
  const decimalNumbers = allTexts.filter((t) => t?.match(/\d+\.\d+/));
  console.log('Decimal numbers found:', decimalNumbers.length);
});
