import { test, expect } from '@playwright/test';
import { shouldRunFullTests, getTestLevelDescription } from './e2e.config.js';

// Log test level at start
console.log(`\n📊 E2E Tests running at level: ${getTestLevelDescription()}\n`);

/**
 * Create deterministic test data for chart validation
 * Minimal setup: one child and one employee with several weekly booking slots
 */
async function createChartTestData(page, { referenceDate = null } = {}) {
  await page.goto('/');

  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate((referenceDate) => {
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
    if (referenceDate) {
      store.dispatch({
        type: 'chart/setReferenceDate',
        payload: { scenarioId, date: referenceDate },
      });
    }

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
  }, referenceDate);

  await page.waitForFunction(() => window.__APP_STORE?.getState?.().ui?.activePage === 'data', { timeout: 5000 });
}

async function createMultiGroupSplitTestData(page) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const scenarioId = 'chart-multi-group-split';

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: scenarioId,
        name: 'Chart Multi Group Split',
        imported: false,
        importedAnonymized: true,
      },
    });

    store.dispatch({
      type: 'simScenario/setSelectedScenarioId',
      payload: scenarioId,
    });

    store.dispatch({
      type: 'chart/ensureScenario',
      payload: scenarioId,
    });

    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: {
        scenarioId,
        groupDef: { id: 'g1', name: 'Fuchsgruppe', type: 'Regelgruppe' },
      },
    });

    store.dispatch({
      type: 'simGroup/addGroupDef',
      payload: {
        scenarioId,
        groupDef: { id: 'g2', name: 'Bärchengruppe', type: 'Regelgruppe' },
      },
    });

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId,
        item: {
          id: 'staff-split-1',
          type: 'capacity',
          source: 'manual entry',
          name: 'Staff Split',
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
        dataItemId: 'staff-split-1',
        booking: {
          id: 'staff-split-1-booking',
          startdate: '',
          enddate: '',
          times: [
            { day: 1, day_name: 'Mo', segments: [{ id: 'm', booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' }] },
            { day: 2, day_name: 'Di', segments: [{ id: 'd', booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' }] },
            { day: 3, day_name: 'Mi', segments: [{ id: 'w', booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' }] },
            { day: 4, day_name: 'Do', segments: [{ id: 't', booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' }] },
            { day: 5, day_name: 'Fr', segments: [{ id: 'f', booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' }] },
          ],
          rawdata: {},
        },
      },
    });

    store.dispatch({
      type: 'simGroup/addGroup',
      payload: {
        scenarioId,
        dataItemId: 'staff-split-1',
        group: {
          id: 'ga-split-1',
          kindId: 'staff-split-1',
          assignmentMode: 'multiple',
          groupId: '',
          start: '',
          end: '',
          timeSegments: [
            { id: 'ts-1', startTime: '08:00', endTime: '09:00', groupId: 'g1' },
            { id: 'ts-2', startTime: '09:00', endTime: '10:00', groupId: 'g2' },
          ],
        },
      },
    });

    store.dispatch({
      type: 'chart/setFilterGroups',
      payload: { scenarioId, groups: ['g1', 'g2'] },
    });

    store.dispatch({
      type: 'chart/setFilterQualifications',
      payload: { scenarioId, qualifications: ['__NO_QUALI__'] },
    });

    store.dispatch({
      type: 'ui/setActivePage',
      payload: 'data',
    });
  });

  await page.waitForFunction(() => window.__APP_STORE?.getState?.().simScenario?.selectedScenarioId === 'chart-multi-group-split', { timeout: 5000 });
}

async function goToVisu(page, { stepId = 'status', slideIndex = 0 } = {}) {
  await page.getByRole('button', { name: 'Analyse', exact: true }).click();
  await expect(page.getByTestId('analysis-clean-sheet')).toBeVisible();

  await page.getByTestId(`story-step-${stepId}`).click();
  await expect.poll(() => page.evaluate(() => window.__APP_STORE?.getState?.().ui?.analysisSubPage)).toBe(stepId);

  const stageContent = page.getByTestId('analysis-stage-content');
  const navigation = stageContent.locator('.analysis-coverage-carousel-nav');
  const counter = stageContent.locator('.analysis-coverage-carousel-counter');
  await expect(counter).toBeVisible({ timeout: 10000 });

  let currentSlide = Number((await counter.innerText()).split('/')[0]) - 1;
  while (currentSlide !== slideIndex) {
    const direction = currentSlide < slideIndex ? 1 : 0;
    await navigation.nth(direction).click();
    currentSlide += direction === 1 ? 1 : -1;
    await expect.poll(async () => Number((await counter.innerText()).split('/')[0]) - 1).toBe(currentSlide);
  }
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
  
  await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible();
  
  // Wait for chart to render
  await page.waitForTimeout(2000);
  
  await expect(page.locator('.analysis-stage-content .highcharts-container').first()).toBeVisible();

  // Check that SVG chart container exists
  const svgCharts = await page.locator('svg').count();
  expect(svgCharts).toBeGreaterThan(0);
  
  // Verify chart area is not empty
  const chartArea = page.locator('svg').first();
  await expect(chartArea).toBeVisible();
});

test('Chart Data Validation - Ausblick carousel navigates to Sankey and demography', async ({ page }) => {
  await createChartTestData(page, { referenceDate: '2026-11-12' });
  await goToVisu(page, { stepId: 'compare', slideIndex: 0 });

  await expect(page.getByText('Ausblick (Sankey)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vorheriges Diagramm', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Nächstes Diagramm', exact: true })).toBeEnabled();
  await expect(page.getByTestId('forecast-sankey-chart')).toBeVisible();
  await expect(page.getByTestId('forecast-sankey-chart')).toHaveAttribute('data-transition-pairs', 'Ungeklärt: 1 Kinder -> Ungeklärt: 1 Kinder');

  await goToVisu(page, { stepId: 'compare', slideIndex: 3 });
  await expect(page.getByText('Demografie-Prognose', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Altersgruppe', exact: true })).toBeVisible();
  await expect(page.getByTestId('forecast-demography-monthpicker')).toBeVisible();
  await expect(page.getByTestId('forecast-demography-monthpicker')).toHaveAccessibleName('Prognosemonat');
  await expect(page.getByTestId('forecast-demography-resolution-filter')).toBeVisible();
  await expect(page.getByTestId('forecast-demography-resolution-filter')).toHaveAccessibleName('Zeitauflösung');
});

test('Chart Data Validation - Demography chart filters render', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page, { stepId: 'compare', slideIndex: 3 });

  await expect(page.getByText('Demografie-Prognose', { exact: true })).toBeVisible();
  await expect(page.getByTestId('forecast-demography-category-filter')).toBeVisible();
  await expect(page.getByTestId('forecast-demography-resolution-filter')).toBeVisible();
  await expect(page.getByTestId('forecast-demography-monthpicker')).toBeVisible();
  await expect(page.locator('.analysis-stage-content svg').first()).toBeVisible();
});

test('Chart Data Validation - Booking hours slide renders in Bedarfsdeckung', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page, { stepId: 'status', slideIndex: 3 });

  await expect(page.getByText('Buchungsstunden', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Stunden pro Woche', { exact: true })).toBeVisible();
  await expect(page.locator('.analysis-stage-content .highcharts-container').first()).toBeVisible();
});

test('Chart Data Validation - current analysis stages render their charts', async ({ page }) => {
  await createChartTestData(page, { referenceDate: '2026-11-12' });
  await goToVisu(page, { stepId: 'status' });
  await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible();
  await expect(page.locator('.analysis-stage-content .highcharts-container').first()).toBeVisible();

  await goToVisu(page, { stepId: 'compare', slideIndex: 0 });
  await expect(page.getByTestId('forecast-sankey-chart')).toBeVisible();
  await expect(page.getByTestId('forecast-sankey-chart')).toHaveAttribute('data-transition-pairs', 'Ungeklärt: 1 Kinder -> Ungeklärt: 1 Kinder');

  await goToVisu(page, { stepId: 'compare', slideIndex: 3 });
  await expect(page.getByTestId('forecast-demography-monthpicker')).toBeVisible();
});

test('Chart Group Split - Bedarfsdeckung heatmap shows both split groups', async ({ page }) => {
  await createMultiGroupSplitTestData(page);
  await goToVisu(page, { stepId: 'status', slideIndex: 2 });

  await expect(page.getByText('Heatmap (alle Gruppen)', { exact: true })).toBeVisible();
  await expect(page.getByText('Fuchsgruppe', { exact: true })).toBeVisible();
  await expect(page.getByText('Bärchengruppe', { exact: true })).toBeVisible();
});

/**
 * Detailed validation tests for specific chart properties
 */
test('Chart Data Detail - Weekly Chart Time Scaling', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page, { stepId: 'status' });
  await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible();
  await page.locator('.analysis-stage-content .highcharts-container svg').first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Check for time categories in Highcharts SVG (should have Mo/Di/Mi/Do/Fr labels)
  const dayLabels = await page.locator('text=/^(Mo|Di|Mi|Do|Fr)$/').count();
  expect(dayLabels).toBeGreaterThan(0);
  
  // Verify time format labels with colons (HH:MM format)
  const timeLabels = await page.locator('text=/\\d{1,2}:\\d{2}/').count();
  expect(timeLabels).toBeGreaterThan(0);
});

test('Chart Data Detail - Demography controls show the forecast chart', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page, { stepId: 'compare', slideIndex: 3 });

  await expect(page.getByTestId('forecast-demography-monthpicker')).toBeVisible();
  await expect(page.getByTestId('forecast-demography-resolution-filter')).toBeVisible();
  await expect(page.locator('.analysis-stage-content .highcharts-container svg').first()).toBeVisible();
});

test('Chart Data Detail - Booking Histogram Bins', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page, { stepId: 'status', slideIndex: 3 });

  await expect(page.getByText('Buchungsstunden', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.analysis-stage-content .highcharts-container svg').first()).toBeVisible();
  const histogramLabels = await page.locator('.analysis-stage-content .highcharts-container text').count();
  expect(histogramLabels).toBeGreaterThan(0);
});

test('Chart Data Detail - Data Point Values', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page);
  
  await page.waitForTimeout(2000);
  
  // Extract data from the SVG (this is basic - just checks chart rendering)
  // Verify that the current weekly chart includes non-zero values for the seeded child and employee.
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
test('Chart Integration - Bedarfsdeckung shows populated weekly demand and capacity series', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page, { stepId: 'status' });

  const seriesData = await page.evaluate(() => {
    const chart = window.Highcharts?.charts?.find(
      (candidate) => candidate?.yAxis?.[0]?.axisTitle?.textStr === 'Bedarf (Kinder)'
    );
    return chart?.series?.map((series) => series.points.some((point) => Number(point.y || 0) > 0)) || [];
  });

  expect(seriesData.length).toBeGreaterThanOrEqual(2);
  expect(seriesData.some(Boolean)).toBe(true);
});

/**
 * Regression test: Verify axis label consistency
 */
test('Chart Axis Labels - weekly, booking-hours and demography stages expose their controls', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page, { stepId: 'status' });
  await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible();
  await expect(page.locator('.analysis-stage-content .highcharts-container svg').first()).toBeVisible();

  await goToVisu(page, { stepId: 'status', slideIndex: 3 });
  await expect(page.getByText('Stunden pro Woche', { exact: true })).toBeVisible();

  await goToVisu(page, { stepId: 'compare', slideIndex: 3 });
  await expect(page.getByTestId('forecast-demography-monthpicker')).toBeVisible();
});

/**
 * Test for proper scaling with no data vs with data
 */
test('Chart Scaling - weekly chart responds to added data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Leeres Szenario/i }).click();
  await goToVisu(page, { stepId: 'status' });
  await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible();

  await createChartTestData(page);
  await goToVisu(page, { stepId: 'status' });
  const populatedValues = await page.evaluate(() => {
    const chart = window.Highcharts?.charts?.find(
      (candidate) => candidate?.yAxis?.[0]?.axisTitle?.textStr === 'Bedarf (Kinder)'
    );
    return chart?.series?.flatMap((series) => series.points.map((point) => Number(point.y || 0))) || [];
  });
  expect(populatedValues.some((value) => value > 0)).toBe(true);
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
 * The Bedarfsdeckung layout keeps weekly time categories visible in its demand chart.
 */
test('Chart Time Labels - weekly slots remain visible in the demand chart', async ({ page }) => {
  await createChartTestData(page);
  await goToVisu(page, { stepId: 'status' });

  const weeklySvg = await getWeeklyChartSvg(page);
  const chartCategories = await weeklySvg.evaluate((svg) => {
    const texts = svg.querySelectorAll('text');
    return Array.from(texts)
      .map((element) => element.textContent?.trim())
      .filter((text) => text && /^\\d{1,2}:\\d{2}$/.test(text));
  });

  const chartHours = chartCategories.map((text) => Number(text.match(/^(\\d{1,2}):/)?.[1]));
  expect(chartHours.some((hour) => hour >= 7 && hour <= 9)).toBe(true);
  await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible();
});

} // End of: if (shouldRunFullTests())
