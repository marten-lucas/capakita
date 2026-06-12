import path from 'path';
import { test, expect } from '@playwright/test';

const importZip = path.resolve(process.cwd(), 'tests/testdata/kita-anonym-29247781.zip');

async function importScenarioAndOpenForecast(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Daten importieren/i }).click();
  const importDialog = page.getByRole('dialog', { name: 'Datenimport-Wizard' });
  await expect(importDialog).toBeVisible();

  await importDialog.locator('input[type="file"]').setInputFiles(importZip);
  await importDialog.getByRole('button', { name: /Datei analysieren/i }).click();
  await importDialog.getByRole('button', { name: /Weiter zur Vorschau/i }).click();
  await importDialog.getByRole('button', { name: /Import ausführen/i }).click();

  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 15000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    const state = store.getState();
    const scenarioId = state.simScenario?.selectedScenarioId;
    store.dispatch({ type: 'chart/setReferenceDate', payload: { scenarioId, date: '2026-06-11' } });
    store.dispatch({ type: 'ui/setActivePage', payload: 'visu' });
    store.dispatch({ type: 'ui/setAnalysisSubPage', payload: 'compare' });
  });

  await expect(page.getByTestId('analysis-clean-sheet')).toBeVisible();
  await expect(page.locator('.analysis-stage-content')).toBeVisible();
  await expect(page.getByText('Gruppenverlauf & Event-Timeline')).toBeVisible();
}

test('forecast: graphical validation for 2026-09-01 transition alignment and direction', async ({ page }) => {
  await importScenarioAndOpenForecast(page);

  const chartMetrics = await page.evaluate(() => {
    const charts = (window.Highcharts?.charts || []).filter(Boolean);
    const timelineChart = charts.find((chart) => chart?.series?.some((series) => String(series.type) === 'timeline')) || null;
    const lineCharts = charts.filter((chart) => chart?.series?.length === 1 && String(chart.series[0]?.type) === 'line');

    const allLineSeries = lineCharts.map((chart) => ({ chart, series: chart.series[0] })).filter((entry) => entry?.series);
    const fuchsEntry = allLineSeries.find((entry) => {
      const name = String(entry.series?.name || '').toLowerCase();
      return name.includes('fuchsgruppe') && !name.includes('schul');
    }) || null;
    const schoolEntry = allLineSeries.find((entry) => {
      const name = String(entry.series?.name || '').toLowerCase();
      return name.includes('schul');
    }) || null;

    if (!timelineChart || !fuchsEntry || !schoolEntry) {
      return {
        ok: false,
        reason: 'missing required charts/series',
        chartCount: charts.length,
        lineSeriesNames: allLineSeries.map((entry) => entry.series?.name || ''),
      };
    }

    const targetMs = new Date('2026-09-01T00:00:00Z').getTime();

    const timelineSeries = timelineChart.series.find((series) => String(series.type) === 'timeline') || timelineChart.series[0];
    const timelinePoint = (timelineSeries?.points || []).find((point) => Number(point.x) === targetMs) || null;

    const fuchsSeries = fuchsEntry.series;
    const schoolSeries = schoolEntry.series;

    const fuchsPoint = (fuchsSeries.points || []).find((point) => Number(point.x) === targetMs) || null;
    const schoolPoint = (schoolSeries.points || []).find((point) => Number(point.x) === targetMs) || null;

    const fuchsPrev = [...(fuchsSeries.points || [])].filter((point) => Number(point.x) < targetMs).sort((a, b) => Number(b.x) - Number(a.x))[0] || null;
    const schoolPrev = [...(schoolSeries.points || [])].filter((point) => Number(point.x) < targetMs).sort((a, b) => Number(b.x) - Number(a.x))[0] || null;

    const fuchsAxis = fuchsEntry.chart.xAxis?.[0] || null;
    const schoolAxis = schoolEntry.chart.xAxis?.[0] || null;
    const timelineAxis = timelineChart.xAxis?.[0] || null;

    const renderedDeltaPx = (fuchsPoint && timelinePoint)
      ? Math.abs((fuchsEntry.chart.plotLeft + Number(fuchsPoint.plotX || 0)) - (timelineChart.plotLeft + Number(timelinePoint.plotX || 0)))
      : null;

    return {
      ok: true,
      targetMs,
      hasTimelinePoint: Boolean(timelinePoint),
      hasFuchsPoint: Boolean(fuchsPoint),
      hasSchoolPoint: Boolean(schoolPoint),
      fuchsBefore: fuchsPrev ? Number(fuchsPrev.y || 0) : null,
      fuchsAtSep01: fuchsPoint ? Number(fuchsPoint.y || 0) : null,
      schoolBefore: schoolPrev ? Number(schoolPrev.y || 0) : null,
      schoolAtSep01: schoolPoint ? Number(schoolPoint.y || 0) : null,
      fuchsAxisMin: fuchsAxis ? Number(fuchsAxis.min) : null,
      fuchsAxisMax: fuchsAxis ? Number(fuchsAxis.max) : null,
      schoolAxisMin: schoolAxis ? Number(schoolAxis.min) : null,
      schoolAxisMax: schoolAxis ? Number(schoolAxis.max) : null,
      timelineAxisMin: timelineAxis ? Number(timelineAxis.min) : null,
      timelineAxisMax: timelineAxis ? Number(timelineAxis.max) : null,
      renderedDeltaPx,
    };
  });

  expect(chartMetrics.ok, JSON.stringify(chartMetrics)).toBe(true);
  expect(chartMetrics.hasTimelinePoint, JSON.stringify(chartMetrics)).toBe(true);
  expect(chartMetrics.hasFuchsPoint, JSON.stringify(chartMetrics)).toBe(true);
  expect(chartMetrics.hasSchoolPoint, JSON.stringify(chartMetrics)).toBe(true);

  expect(chartMetrics.fuchsAtSep01, JSON.stringify(chartMetrics)).toBeLessThan(chartMetrics.fuchsBefore);
  expect(chartMetrics.schoolAtSep01, JSON.stringify(chartMetrics)).toBeGreaterThan(chartMetrics.schoolBefore);

  expect(chartMetrics.fuchsAxisMin, JSON.stringify(chartMetrics)).toBe(chartMetrics.timelineAxisMin);
  expect(chartMetrics.fuchsAxisMax, JSON.stringify(chartMetrics)).toBe(chartMetrics.timelineAxisMax);
  expect(chartMetrics.schoolAxisMin, JSON.stringify(chartMetrics)).toBe(chartMetrics.timelineAxisMin);
  expect(chartMetrics.schoolAxisMax, JSON.stringify(chartMetrics)).toBe(chartMetrics.timelineAxisMax);

  expect(chartMetrics.renderedDeltaPx, JSON.stringify(chartMetrics)).not.toBeNull();
  expect(chartMetrics.renderedDeltaPx, JSON.stringify(chartMetrics)).toBeLessThanOrEqual(2);

  await page.locator('.analysis-stage-content').screenshot({
    path: 'test-results/forecast-graphical-validation.png',
  });
});
