import { test, expect } from '@playwright/test';

async function createEmptyScenarioViaUi(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('button', { name: 'Leeres Szenario' })).toBeVisible();
  await page.getByRole('button', { name: 'Leeres Szenario' }).click();

  await expect(page.getByLabel('Hinzufügen')).toBeVisible({ timeout: 10000 });
}

async function addDataItemViaUi(page, typeLabel, name) {
  await page.getByLabel('Hinzufügen').click();
  await page.getByRole('menuitem', { name: typeLabel }).click();

  const nameField = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(nameField).toBeVisible({ timeout: 10000 });
  await nameField.fill(name);
}

async function addMondayBookingViaUi(page, { addSecondSegment = false } = {}) {
  await page.getByRole('tab', { name: 'Zeiten' }).click();
  await page.getByRole('button', { name: 'Buchungszeitraum hinzufügen' }).click();

  const bookingAccordion = page.getByRole('button', { name: /0 h/ }).first();
  await expect(bookingAccordion).toBeVisible({ timeout: 10000 });
  await bookingAccordion.click();

  const mondaySwitch = page.getByRole('switch', { name: 'Montag' });
  await expect(mondaySwitch).toBeVisible({ timeout: 10000 });
  await mondaySwitch.check({ force: true });
  await expect(mondaySwitch).toBeChecked();
  await page.getByRole('button', { name: 'Details einblenden' }).first().click();

  await expect(page.getByLabel('Segment 1 Startzeit')).toHaveValue('08:00');
  await expect(page.getByLabel('Segment 1 Endzeit')).toHaveValue('08:30');

  if (addSecondSegment) {
    await page.getByRole('button', { name: 'Segment hinzufügen' }).click();
    await expect(page.getByLabel('Segment 2 Startzeit')).toHaveValue('09:00');
    await expect(page.getByLabel('Segment 2 Endzeit')).toHaveValue('09:30');
  }
}

async function goToWeeklyChart(page) {
  await page.getByRole('button', { name: 'Analyse' }).click();
  await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible({ timeout: 10000 });
}

async function getWeeklyCharts(page) {
  const demandChart = page.locator('.highcharts-container').filter({ hasText: 'Bedarf (Kinder)' }).first();
  const ratioChart = page.locator('.highcharts-container').filter({ hasText: 'Zeiten' }).first();

  await expect(demandChart).toBeVisible({ timeout: 10000 });
  await expect(ratioChart).toBeVisible({ timeout: 10000 });

  return { demandChart, ratioChart };
}

async function hoverWeeklyPoint(page, axisTitle, pointIndex) {
  const coords = await page.evaluate(({ axisTitle, pointIndex }) => {
    const chart = Highcharts.charts.find((candidate) => candidate?.yAxis?.[0]?.axisTitle?.textStr === axisTitle);
    if (!chart) return null;

    const point = chart.series[0]?.points?.[pointIndex];
    if (!point) return null;

    const rect = chart.container.getBoundingClientRect();
    const event = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + chart.plotLeft + point.plotX,
      clientY: rect.top + chart.plotTop + (chart.plotHeight / 2),
    });

    chart.container.dispatchEvent(event);

    return true;
  }, { axisTitle, pointIndex });

  if (!coords) {
    throw new Error(`Unable to resolve hover coordinates for ${axisTitle} index ${pointIndex}`);
  }

  await page.waitForTimeout(250);
}

test.describe.serial('weekly chart ui sync', () => {
  test('single staff slot is shown and synchronized', async ({ page }) => {
    await createEmptyScenarioViaUi(page);
    await addDataItemViaUi(page, 'Kapazität', 'Mitarbeiter Mo 8');
    await addMondayBookingViaUi(page);
    await goToWeeklyChart(page);

    const { demandChart, ratioChart } = await getWeeklyCharts(page);
    await hoverWeeklyPoint(page, 'Bedarf (Kinder)', 2);
    await hoverWeeklyPoint(page, 'Betreuungsschlüssel', 2);

    await expect(demandChart).toContainText('Kapazität: 1');
    await expect(ratioChart).toContainText('Mo 8:00');
    await expect(ratioChart).toContainText('Betreuungsschlüssel: 0');
  });

  test('returning from data to analysis does not break the weekly chart', async ({ page }) => {
    const pageErrors = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await createEmptyScenarioViaUi(page);
    await addDataItemViaUi(page, 'Kapazität', 'Mitarbeiter Rückweg');
    await addMondayBookingViaUi(page);

    await goToWeeklyChart(page);
    await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible();

    await page.getByRole('button', { name: 'Daten', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mitarbeiter Rückweg' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Analyse', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Regelbetrieb' })).toBeVisible({ timeout: 10000 });

    const { demandChart, ratioChart } = await getWeeklyCharts(page);
    await hoverWeeklyPoint(page, 'Bedarf (Kinder)', 2);
    await hoverWeeklyPoint(page, 'Betreuungsschlüssel', 2);

    await expect(demandChart).toContainText('Kapazität: 1');
    await expect(ratioChart).toContainText('Betreuungsschlüssel: 0');
    expect(pageErrors).toEqual([]);
  });

  test('multiple staff slots keep the tooltip synchronized', async ({ page }) => {
    await createEmptyScenarioViaUi(page);
    await addDataItemViaUi(page, 'Kapazität', 'Mitarbeiter mit zwei Zeiten');
    await addMondayBookingViaUi(page, { addSecondSegment: true });
    await goToWeeklyChart(page);

    const { demandChart, ratioChart } = await getWeeklyCharts(page);
    await hoverWeeklyPoint(page, 'Bedarf (Kinder)', 4);
    await hoverWeeklyPoint(page, 'Betreuungsschlüssel', 4);

    await expect(demandChart).toContainText('Mo 9:00');
    await expect(demandChart).toContainText('Kapazität: 1');
    await expect(ratioChart).toContainText('Mo 9:00');
    await expect(ratioChart).toContainText('Betreuungsschlüssel: 0');
  });

  test('staff and child show matching tooltip positions and data', async ({ page }) => {
    await createEmptyScenarioViaUi(page);

    await addDataItemViaUi(page, 'Kapazität', 'Mitarbeiter A');
    await addMondayBookingViaUi(page);

    await addDataItemViaUi(page, 'Bedarf', 'Kind A');
    await addMondayBookingViaUi(page);

    await goToWeeklyChart(page);

    const { demandChart, ratioChart } = await getWeeklyCharts(page);
    await hoverWeeklyPoint(page, 'Bedarf (Kinder)', 2);
    await hoverWeeklyPoint(page, 'Betreuungsschlüssel', 2);

    await expect(demandChart).toContainText('Bedarf: 1');
    await expect(demandChart).toContainText('Kapazität: 1');
    await expect(ratioChart).toContainText('Mo 8:00');
    await expect(ratioChart).toContainText('Betreuungsschlüssel: 1');
  });
});
