import { test, expect } from '@playwright/test';

test('Debug - Check if Empty Scenario button exists', async ({ page }) => {
  await page.goto('/');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Look for the button
  const button = page.getByRole('button', { name: /Leeres Szenario/i });
  const buttonCount = await button.count();
  
  console.log(`Found ${buttonCount} "Leeres Szenario" buttons`);
  
  if (buttonCount > 0) {
    // Try to click it
    await button.click();
    await page.waitForTimeout(2000);
    
    console.log(`After click, URL is: ${page.url()}`);
  } else {
    // List all buttons
    const buttons = page.getByRole('button');
    const allButtonTexts = await buttons.evaluateAll(els => 
      els.map(el => el.textContent?.trim()).filter(t => t)
    );
    console.log('Available buttons:', allButtonTexts.slice(0, 10));
  }
});
