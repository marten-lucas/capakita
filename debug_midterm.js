import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    console.log(err.stack);
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    console.log('Could not connect to localhost:3000. Is the app running?');
    process.exit(1);
  }

  // Seed data (simplified from test file)
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE);
  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'chart-data-validation';
    store.dispatch({ type: 'simScenario/addScenario', payload: { id: scenarioId, name: 'Chart Test Scenario', imported: false, importedAnonymized: true } });
    store.dispatch({ type: 'chart/ensureScenario', payload: scenarioId });
    store.dispatch({ type: 'chart/setFilterGroups', payload: { scenarioId, groups: ['__NO_GROUP__'] } });
    store.dispatch({ type: 'chart/setFilterQualifications', payload: { scenarioId, qualifications: ['__NO_QUALI__'] } });
    store.dispatch({ type: 'ui/setActivePage', payload: 'visu' });
  });

  // Wait for the error boundary to trigger or for the page to load
  await page.waitForTimeout(5000);

  await browser.close();
})();
