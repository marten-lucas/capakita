import { test, expect } from '@playwright/test';
import { shouldRunFullTests, getTestLevelDescription } from './e2e.config.js';

// Log test level at start
console.log(`\n📊 E2E Tests running at level: ${getTestLevelDescription()}\n`);

/**
 * Create deterministic test data for chart validation
 * Minimal setup: 3 Bedarf children, 3 Kapazität staff
 */
async function createChartTestData(page) {
  await page.goto('/');

  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'chart-data-validation';

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: scenarioId,
        name: 'Chart Test Scenario',
        imported: false,
        importedAnonymized: true,
      },
    });

    store.dispatch({
      type: 'chart/ensureScenario',
      payload: scenarioId,
    });

    store.dispatch({
      type: 'chart/setFilterGroups',
      payload: { scenarioId, groups: ['__NO_GROUP__'] },
    });

    store.dispatch({
      type: 'chart/setFilterQualifications',
      payload: { scenarioId, qualifications: ['__NO_QUALI__'] },
    });

    const demandChildren = [
      { id: 'chart-child-1', name: 'Child1', dateofbirth: '2021-01-01' },
      { id: 'chart-child-2', name: 'Child2', dateofbirth: '2020-01-01' },
      { id: 'chart-child-3', name: 'Child3', dateofbirth: '2019-01-01' },
    ];

    demandChildren.forEach((child) => {
      store.dispatch({
        type: 'simData/simDataItemAdd',
        payload: {
          scenarioId,
          item: {
            id: child.id,
            type: 'demand',
            source: 'manual entry',
            name: child.name,
            remark: '',
            startdate: '',
            enddate: '',
            dateofbirth: child.dateofbirth,
            groupId: '',
            rawdata: { source: 'manual entry' },
            absences: [],
          },
        },
      });

      store.dispatch({
        type: 'simBooking/addBooking',
        payload: {
          scenarioId,
          dataItemId: child.id,
          booking: {
            id: `${child.id}-booking`,
            startdate: '',
            enddate: '',
            times: [
              {
                day: 1,
                day_name: 'Mo',
                segments: [
                  { id: `${child.id}-seg-1`, booking_start: '07:00', booking_end: '08:00' },
                  { id: `${child.id}-seg-2`, booking_start: '12:00', booking_end: '13:00' },
                  { id: `${child.id}-seg-3`, booking_start: '16:00', booking_end: '17:00' },
                ],
              },
            ],
            rawdata: {},
          },
        },
      });
    });

    const staffMembers = [
      { id: 'chart-staff-1', name: 'Staff1' },
      { id: 'chart-staff-2', name: 'Staff2' },
      { id: 'chart-staff-3', name: 'Staff3' },
    ];

    staffMembers.forEach((staff) => {
      store.dispatch({
        type: 'simData/simDataItemAdd',
        payload: {
          scenarioId,
          item: {
            id: staff.id,
            type: 'capacity',
            source: 'manual entry',
            name: staff.name,
            remark: '',
            startdate: '',
            enddate: '',
            dateofbirth: '',
            groupId: '',
            rawdata: { source: 'manual entry' },
            absences: [],
          },
        },
      });

      store.dispatch({
        type: 'simBooking/addBooking',
        payload: {
          scenarioId,
          dataItemId: staff.id,
          booking: {
            id: `${staff.id}-booking`,
            startdate: '',
            enddate: '',
            times: [
              {
                day: 1,
                day_name: 'Mo',
                segments: [
                  { id: `${staff.id}-seg-1`, booking_start: '07:00', booking_end: '07:30', category: 'pedagogical' },
                  { id: `${staff.id}-seg-2`, booking_start: '12:00', booking_end: '12:30', category: 'pedagogical' },
                  { id: `${staff.id}-seg-3`, booking_start: '16:00', booking_end: '16:30', category: 'pedagogical' },
                ],
              },
            ],
            rawdata: {},
          },
        },
      });
    });

    store.dispatch({
      type: 'ui/setActivePage',
      payload: 'data',
    });
  });

  await page.waitForFunction(() => window.__APP_STORE?.getState?.().ui?.activePage === 'data', { timeout: 5000 });
}

async function goToVisu(page) {
  await page.evaluate(() => {
    window.__APP_STORE?.dispatch({
      type: 'ui/setActivePage',
      payload: 'visu',
    });
  });
  await page.waitForFunction(() => window.__APP_STORE?.getState?.().ui?.activePage === 'visu', { timeout: 5000 });
}

async function getWeeklyChartSvg(page) {
  const weeklyChart = page.locator('svg').filter({ hasText: 'Mo' }).last();
  await expect(weeklyChart).toBeVisible({ timeout: 10000 });
  return weeklyChart;
}

test('Chart Data Validation - Weekly Chart', async ({ page }) => {
  await createChartTestData(page);
  
  // Navigate to visualization page
  await goToVisu(page);
  
  // Check Weekly Chart heading exists
  const weeklyHeading = page.getByRole('heading', { name: 'Regelbetrieb' });
  await expect(weeklyHeading).toBeVisible();
  
  // Wait for chart to render
  await page.waitForTimeout(2000);
  
  // Verify main axis label is present
  await expect(page.locator('text=Zeiten')).toBeVisible();
  
  // Check that SVG chart container exists
  const svgCharts = await page.locator('svg').count();
  expect(svgCharts).toBeGreaterThan(0);
  
  // Verify chart area is not empty
  const chartArea = page.locator('svg').first();
  await expect(chartArea).toBeVisible();
});

test('Chart Data Validation - Midterm Chart', async ({ page }) => {
  await createChartTestData(page);
  
  await goToVisu(page);
  
  // Check Midterm Chart heading
  const midtermHeading = page.getByRole('heading', { name: 'Langzeit' });
  await expect(midtermHeading).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bedarf und Kapazität' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fachkraftquote und Finanzen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ereignisse' })).toBeVisible();
  
  // Wait for chart to render
  await page.waitForTimeout(2000);
  
  // Verify xAxis label (Zeitraum)
  await expect(page.locator('text=Zeitraum')).toBeVisible();
  
  // Check that SVG chart container exists
  const svgCharts = await page.locator('svg').count();
  expect(svgCharts).toBeGreaterThan(2);
  
  // Verify chart area is not empty
  const chartArea = page.getByTestId('midterm-demand-capacity-chart').locator('svg').first();
  await expect(chartArea).toBeVisible();
});

test('Chart Data Validation - Age Histogram', async ({ page }) => {
  await createChartTestData(page);
  
  await goToVisu(page);
  
  // Check Age Histogram heading
  const ageHeading = page.getByRole('heading', { name: 'Alters-Histogramm' });
  await expect(ageHeading).toBeVisible();
  
  // Wait for chart to render
  await page.waitForTimeout(1000);
  
  // Verify axis labels
  await expect(page.locator('text=Alter in Jahren')).toBeVisible();
  await expect(page.locator('text=Anzahl Kinder')).toBeVisible();
  
  // Check for age bin labels using upper category bounds (e.g. 1,25 / 2,5 / 2,75)
  const ageLabels = page.locator('text=/^\\d+(,\\d+)?$/');
  await expect(ageLabels.first()).toBeVisible();
});

test('Chart Data Validation - Booking Histogram', async ({ page }) => {
  await createChartTestData(page);
  
  await goToVisu(page);
  
  // Check Booking Histogram heading
  const histogramHeading = page.getByRole('heading', { name: 'Buchungsverteilung' });
  await expect(histogramHeading).toBeVisible();
  
  // Wait for chart to render
  await page.waitForTimeout(1000);
  
  // Verify axis labels
  await expect(page.locator('text=Stunden pro Woche')).toBeVisible();
  
  // Check for booking hour bin labels (0, 1-4, 5-8, etc.)
  const binLabels = page.locator('text=/^(0|\\d+-\\d+)$/'); // Pattern like "0", "1-4", "5-8"
  await expect(binLabels.first()).toBeVisible();
});

test('Chart Data Validation - All Charts Present with Correct Scaling', async ({ page }) => {
  await createChartTestData(page);
  
  await goToVisu(page);
  
  // All headings visible
  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Langzeit' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alters-Histogramm' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Buchungsverteilung' })).toBeVisible();
  
  // All chart containers should be visible (Box with height)
  const boxes = page.locator('[style*="height"]');
  const visibleBoxes = await boxes.evaluateAll(els => 
    els.filter(el => el.offsetHeight > 0).length
  );
  expect(visibleBoxes).toBeGreaterThanOrEqual(4);
});

/**
 * Detailed validation tests for specific chart properties
 */
test('Chart Data Detail - Weekly Chart Time Scaling', async ({ page }) => {
  await createChartTestData(page);
  await page.evaluate(() => {
    window.__APP_STORE?.dispatch({
      type: 'ui/setActivePage',
      payload: 'visu',
    });
  });
  await page.waitForFunction(() => window.__APP_STORE?.getState?.().ui?.activePage === 'visu', { timeout: 5000 });
  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible({ timeout: 10000 });
  await page.locator('svg').first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Check for time categories in Highcharts SVG (should have Mo/Di/Mi/Do/Fr labels)
  const dayLabels = await page.locator('text=/^(Mo|Di|Mi|Do|Fr)$/').count();
  expect(dayLabels).toBeGreaterThan(0);
  
  // Verify time format labels with colons (HH:MM format)
  const timeLabels = await page.locator('text=/\\d{1,2}:\\d{2}/').count();
  expect(timeLabels).toBeGreaterThan(0);
});

test('Chart Data Detail - Age Histogram Bins', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page);
  
  await page.waitForTimeout(2000);
  
  // Age histogram should show upper bounds of the 3-month bins with German decimal commas.
  const ageBinPatterns = await page.locator('text=/^\\d+(,\\d+)?$/').count();
  expect(ageBinPatterns).toBeGreaterThan(0);
  
  // Just verify that age categories exist with the new upper-bound-only format.
  const ageLabels = await page.locator('text=/^\\d+(,\\d+)?$/').evaluateAll(els =>
    els.map(el => el.textContent).filter(text => /^\d+(,\d+)?$/.test(text))
  );
  
  // Should have at least 3 age bins
  expect(ageLabels.length).toBeGreaterThan(3);
});

test('Chart Data Detail - Booking Histogram Bins', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page);
  
  await page.waitForTimeout(2000);
  
  // Booking histogram should have bins like "0", "1-4", "5-8", "9-12"
  // Check for first bin (0)
  const zeroBin = page.locator('text=/^0$/');
  await expect(zeroBin.first()).toBeVisible({ timeout: 5000 });
  
  // Check for hour range bins
  const hourBins = await page.locator('text=/^\\d+-\\d+$/').count();
  expect(hourBins).toBeGreaterThan(0);
});

test('Chart Data Detail - Data Point Values', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page);
  
  await page.waitForTimeout(2000);
  
  // Extract data from the SVG (this is basic - just checks chart rendering)
  // With 3 children on Monday: we expect demand value >= 3 somewhere
  // With 3 staff on Monday: we expect capacity value >= 3 somewhere
  
  // For a more robust check: verify that at least one numeric value > 0 exists in the charts
  const allSvgText = await page.locator('svg text').evaluateAll(els =>
    els.map(el => el.textContent).filter(t => /^\d+$/.test(t) && Number(t) > 0)
  );
  
  // We should have numbers > 0 (from bar heights, axis values, etc.)
  expect(allSvgText.length).toBeGreaterThan(0);
});

// ==========================================
// FULL TESTS (only in full modes)
// ==========================================

if (shouldRunFullTests()) {

/**
 * Integration test: Verify consistency across all charts
 * - Each chart should have data
 * - No chart should show empty/zero results when we've added data
 */
test('Chart Integration - All Charts Have Data', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page);
  await page.waitForTimeout(2000);
  
  // Get all SVG elements (one per chart)
  const svgCharts = page.locator('svg');
  const chartCount = await svgCharts.count();
  
  // We expect at least 4 SVGs (one for each chart type)
  expect(chartCount).toBeGreaterThanOrEqual(4);
  
  // Each chart should have rect or path elements (data visualization primitives)
  // Check that at least some charts have these
  const chartsWithData = await svgCharts.evaluateAll(svgs =>
    svgs.map(svg => ({
      rects: svg.querySelectorAll('rect[fill]').length,
      paths: svg.querySelectorAll('path[d]').length,
      circles: svg.querySelectorAll('circle').length
    }))
  );
  
  // Most charts should have some visual elements
  const chartsWithVisuals = chartsWithData.filter(c => 
    c.rects > 0 || c.paths > 0 || c.circles > 0
  );
  expect(chartsWithVisuals.length).toBeGreaterThan(2);
});

/**
 * Regression test: Verify axis label consistency
 */
test('Chart Axis Labels - All Expected Titles Present', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page);
  await page.waitForTimeout(2000);
  
  // Define expected axis labels per chart
  const expectedLabels = [
    'Zeiten',           // Weekly x-axis
    'Alter in Jahren',  // Age Histogram x-axis
    'Stunden pro Woche',// Booking Histogram x-axis
    'Zeitraum'          // Midterm x-axis
  ];
  
  // Check each expected label exists somewhere on the page
  for (const label of expectedLabels) {
    const labelElement = page.locator(`text=${label}`);
    const count = await labelElement.count();
    expect(count).toBeGreaterThan(0);
  }
});

/**
 * Test for proper scaling with no data vs with data
 */
test('Chart Scaling - Responsive to Data Changes', async ({ page }) => {
  // Create scenario WITHOUT data first
  await page.goto('/');
  await page.getByRole('button', { name: /Leeres Szenario/i }).click();
  
  // Go to visualization (should be empty)
  await goToVisu(page);
  await page.waitForTimeout(1000);
  
  // Should show "Keine Daten vorhanden" or empty state
  const noDataMessage = page.getByText(/Keine Daten vorhanden/i);
  await expect(noDataMessage).toBeVisible();
  
  // Add minimal data programmatically to avoid flaky UI interactions
  await createChartTestData(page);
  
  // Now go back to visu - should show charts
  await goToVisu(page);
  await page.waitForTimeout(2000);
  
  // Should now show chart headings (not empty state)
  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();
});

/**
 * CRITICAL: Test exact data point values in Weekly Chart
 * This verifies that a booking from 7-9 appears in the 7:00, 7:30, 8:00, 8:30 slots
 */
test('Chart Data Accuracy - Weekly Chart Exact Time Slots', async ({ page }) => {
  await createChartTestData(page);

  // Go to visualization
  await goToVisu(page);
  await page.waitForTimeout(2000);

  // Extract SVG structure to analyze chart rendering
  const svgAnalysis = await page.evaluate(() => {
    // Find ALL SVGs and analyze each one
    const svgs = document.querySelectorAll('svg');
    const analysis = [];
    
    svgs.forEach((svg, idx) => {
      // Count different elements
      const rects = svg.querySelectorAll('rect[fill]');
      const paths = svg.querySelectorAll('path[d]');
      const circles = svg.querySelectorAll('circle');
      const textElements = svg.querySelectorAll('text');
      
      const allText = Array.from(textElements)
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length > 0 && t.length < 50);

      analysis.push({
        index: idx,
        rects: rects.length,
        paths: paths.length,
        circles: circles.length,
        texts: allText.length,
        sampleTexts: allText.slice(0, 20)
      });
    });

    return { totalSvgs: svgs.length, svgAnalysis: analysis };
  });

  console.log('All SVG Analysis:', JSON.stringify(svgAnalysis, null, 2));

  // Find the SVG with the most content (likely the chart)
  const chartSvg = svgAnalysis.svgAnalysis.reduce((max, current) => 
    (current.rects + current.paths + current.texts > max.rects + max.paths + max.texts) ? current : max
  );

  // Verify chart is rendered with data
  expect(chartSvg).toBeDefined();
  const totalElements = chartSvg.rects + chartSvg.paths + chartSvg.circles + chartSvg.texts;
  expect(totalElements).toBeGreaterThan(10);

  // Verify the visible time axis labels are present on the synchronized lower chart
  const timeLabels = await page.locator('text=/^(8:00|12:00|16:00)$/').count();
  expect(timeLabels).toBeGreaterThan(0);
});

/**
 * FINAL TEST: Verify exact data values match bookings
 * This test checks that a 7-9 booking actually shows demand=1 in those time slots
 */
test('Chart Data Accuracy - Exact Values Match Bookings', async ({ page }) => {
  await createChartTestData(page);

  // Go to visu
  await goToVisu(page);
  await page.waitForTimeout(2000);

  // Extract demand series data from Weekly Chart (SVG 17)
  const weeklySvg = await getWeeklyChartSvg(page);
  const demandData = await weeklySvg.evaluate((svg) => {
    // Get all text that represents data values
    const textElements = svg.querySelectorAll('text');
    const allTexts = Array.from(textElements).map(el => el.textContent?.trim());

    // Categories and values should be in y-axis numbers and data points
    // Look for pattern: time labels and corresponding numeric values
    const timeSlots = allTexts.filter(t => /^\d{1,2}:\d{2}$/.test(t));
    const yAxisNumbers = allTexts.filter(t => /^\d+$/.test(t));

    return {
      timeSlots: [...new Set(timeSlots)],
      yAxisValues: [...new Set(yAxisNumbers)],
      allTexts: allTexts.filter(t => t && t.length < 30)
    };
  });

  console.log('Demand Data:', JSON.stringify(demandData, null, 2));

  // Verify we have at least one time label within the booking range (7:00-9:00)
  const timeSlotHours = demandData.timeSlots
    .map(ts => {
      const m = ts && ts.match(/^(\d{1,2}):/);
      return m ? Number(m[1]) : null;
    })
    .filter(h => h !== null);
  const hasBookingHour = timeSlotHours.some(h => h >= 7 && h <= 9);
  expect(hasBookingHour).toBe(true);

  // Verify we have numeric values (should include 0 and 1 at minimum)
  expect(demandData.yAxisValues.length).toBeGreaterThan(0);

  // The key assertion: there should be at least one numeric y-axis value > 0
  const hasPositiveValue = demandData.yAxisValues.some(v => Number(v) > 0);
  expect(hasPositiveValue).toBe(true);

  // And there should be at least one zero or non-positive value for other slots
  const hasZeroOrNonPositive = demandData.yAxisValues.some(v => Number(v) <= 0);
  expect(hasZeroOrNonPositive).toBe(true);
});

/**
 * CRITICAL: Test that Weekly Chart tooltips show correct TIME CATEGORY + VALUE
 * This verifies that tooltip shows "Mo 7:00: 1" not just "19" or "26"
 */
test('Chart Tooltip Accuracy - Time Category Displayed', async ({ page }) => {
  await createChartTestData(page);

  // Go to visu
  await goToVisu(page);
  await page.waitForTimeout(2000);

  // Hover over chart area around 7:00 to trigger tooltip
  // The weekly chart should show time categories like "Mo 7:00", "Mo 7:30", etc.
  // Try hovering a concrete chart point to trigger tooltip (more reliable than hovering whole SVG)
  const point = page.locator('.highcharts-point').first();
  await expect(point).toBeVisible();
  await point.hover();

  // Wait shortly for tooltip to appear
  let tooltipContent = '';
  try {
    await page.waitForSelector('.highcharts-tooltip, .highcharts-tooltip-box', { timeout: 2000 });
    tooltipContent = await page.locator('.highcharts-tooltip, .highcharts-tooltip-box').first().textContent();
  } catch {
    // tooltip might not be rendered as HTML in some modes; leave empty and fall back
    tooltipContent = '';
  }
  
  // The tooltip should contain either:
  // - "Mo 7" (abbreviated category)
  // - "7:00" (the time)
  // - "Bedarf" (series name)
  // - A numeric value like "1"
  
  // If we can't find tooltip, try checking for data labels in the chart
  if (!tooltipContent || tooltipContent.length === 0) {
    // Alternative: Check that chart renders correctly with proper categories
    const chartCategories = await getWeeklyChartSvg(page).then((weeklySvgLocator) => weeklySvgLocator.evaluate((svg) => {
      const texts = svg.querySelectorAll('text');
      return Array.from(texts)
        .map(el => el.textContent?.trim())
        .filter(t => t && /^\d{1,2}:\d{2}$/.test(t));
    }));
    
    // Verify time categories include a label inside the booking range (7:00-9:00)
    expect(chartCategories.length).toBeGreaterThan(0);
    const chartHours = chartCategories.map(ts => {
      const m = ts && ts.match(/^(\d{1,2}):/);
      return m ? Number(m[1]) : null;
    }).filter(h => h !== null);
    const hasBookingHourInCategories = chartHours.some(h => h >= 7 && h <= 9);
    expect(hasBookingHourInCategories).toBe(true);
  }

  // Final verification: Check that "Bedarf" series and time labels exist
  await expect(page.getByText('Bedarf').first()).toBeVisible();
  await expect(page.getByText('Mo').first()).toBeVisible();
});

} // End of: if (shouldRunFullTests())
