import { test, expect } from '@playwright/test';

test('Simple Tooltip Test - App loads and renders', async ({ page }) => {
  await page.goto('/');
  
  // Wait for page to load
  await page.waitForTimeout(1000);
  
  // Check if we can reach the home page
  expect(page.url()).toContain('127.0.0.1:4173');
  
  // The page should have some content
  const body = page.locator('body');
  await expect(body).toBeVisible();
});

test('Analysis stepper exposes the current analysis sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Leeres Szenario/i }).click();
  await page.getByRole('button', { name: 'Analyse', exact: true }).click();

  const navigation = page.getByTestId('analysis-story-navigation');
  await expect(navigation.locator('[data-testid^="story-step-"]')).toHaveCount(7);
  await expect(page.getByTestId('story-step-quality')).toBeVisible();
  await expect(page.getByTestId('story-step-compare')).toBeVisible();
});
