import { test, expect } from '@playwright/test';

async function createEmptyScenarioViaUi(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('button', { name: 'Leeres Szenario' })).toBeVisible();
  await page.getByRole('button', { name: 'Leeres Szenario' }).click();

  await expect(page.getByLabel('Hinzufügen')).toBeVisible({ timeout: 10000 });
}

async function addDataItemViaUi(page, typeLabel, name) {
  const isStaff = typeLabel === 'Kapazität';
  await page.getByRole('button', { name: isStaff ? 'Mitarbeiter' : 'Kinder', exact: true }).click();
  await page.getByLabel('Hinzufügen').click();
  await page.getByRole('menuitem', { name: isStaff ? 'Mitarbeiter' : 'Kind', exact: true }).click();

  const nameField = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(nameField).toBeVisible({ timeout: 10000 });
  await nameField.fill(name);
}

async function seedMondayBooking(page, itemName, { addSecondSegment = false } = {}) {
  await page.evaluate(({ itemName, addSecondSegment }) => {
    const store = window.__APP_STORE;
    const state = store?.getState?.();
    const scenarioId = state?.simScenario?.selectedScenarioId;
    const items = state?.simData?.dataByScenario?.[scenarioId] || {};
    const dataItemId = Object.keys(items).find((id) => items[id]?.name === itemName);
    if (!dataItemId) throw new Error(`Could not find seeded data item: ${itemName}`);

    const segments = [
      { id: `${dataItemId}-monday-1`, booking_start: '08:00', booking_end: '08:30', category: 'pedagogical' },
    ];
    if (addSecondSegment) {
      segments.push({ id: `${dataItemId}-monday-2`, booking_start: '09:00', booking_end: '09:30', category: 'pedagogical' });
    }

    store.dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId,
        dataItemId,
        booking: {
          id: `${dataItemId}-monday-booking`,
          startdate: '',
          enddate: '',
          times: [{ day: 1, day_name: 'Mo', segments }],
          rawdata: {},
        },
      },
    });
  }, { itemName, addSecondSegment });
}

async function goToWeeklyChart(page, slideIndex = 0) {
  await page.getByRole('button', { name: 'Analyse', exact: true }).click();
  await expect(page.getByTestId('analysis-clean-sheet')).toBeVisible();
  await page.getByTestId('story-step-status').click();
  await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible({ timeout: 10000 });

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

async function getWeeklyChart(page) {
  const chart = page.locator('.analysis-stage-content .highcharts-container').first();
  await expect(chart).toBeVisible({ timeout: 10000 });
  return chart;
}


async function readWeeklyPointValues(page, pointIndex) {
  const values = await page.evaluate(({ pointIndex }) => {
    const chart = window.Highcharts.charts.find((candidate) => candidate?.yAxis?.[0]?.axisTitle?.textStr === 'Bedarf (Kinder)');
    if (!chart) return null;

    const demandPoint = chart.series?.[0]?.points?.[pointIndex];
    const pedagogicalPoint = chart.series?.[1]?.points?.[pointIndex];
    const administrativePoint = chart.series?.[2]?.points?.[pointIndex];
    if (!demandPoint || !pedagogicalPoint || !administrativePoint) return null;

    return {
      demand: Number(demandPoint.y || 0),
      capacity: Number(pedagogicalPoint.y || 0) + Number(administrativePoint.y || 0),
    };
  }, { pointIndex });

  if (!values) {
    throw new Error(`Unable to read weekly demand and capacity values for point index ${pointIndex}`);
  }

  return values;
}

async function readWeeklyRatio(page, pointIndex) {
  return page.evaluate(({ pointIndex }) => {
    const chart = window.Highcharts.charts.find((candidate) => candidate?.yAxis?.[0]?.axisTitle?.textStr === 'Betreuungsschlüssel');
    return chart?.series?.[0]?.points?.[pointIndex]?.y ?? null;
  }, { pointIndex });
}

test.describe.serial('weekly chart analysis carousel', () => {
  test('demand and capacity are shown in the first slide and ratios in the next slide', async ({ page }) => {
    await createEmptyScenarioViaUi(page);
    await addDataItemViaUi(page, 'Kapazität', 'Mitarbeiter Mo 8');
    await seedMondayBooking(page, 'Mitarbeiter Mo 8');
    await goToWeeklyChart(page);

    const demandChart = await getWeeklyChart(page);
    const demandValues = await readWeeklyPointValues(page, 2);
    await expect(demandChart).toBeVisible();
    expect(demandValues.capacity).toBe(1);

    await goToWeeklyChart(page, 1);
    const ratioChart = await getWeeklyChart(page);
    await expect(ratioChart).toBeVisible();
    expect(await readWeeklyRatio(page, 2)).toBe(0);
  });

  test('returning from data to analysis does not break the weekly chart', async ({ page }) => {
    const pageErrors = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await createEmptyScenarioViaUi(page);
    await addDataItemViaUi(page, 'Kapazität', 'Mitarbeiter Rückweg');
    await seedMondayBooking(page, 'Mitarbeiter Rückweg');

    await goToWeeklyChart(page);
    await expect(page.getByText('Kapazität & Bedarf', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Daten', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mitarbeiter Rückweg' })).toBeVisible({ timeout: 10000 });

    await goToWeeklyChart(page);

    const demandChart = await getWeeklyChart(page);
    await expect(demandChart).toBeVisible();
    const values = await readWeeklyPointValues(page, 2);
    expect(values.capacity).toBe(1);
    expect(pageErrors).toEqual([]);
  });

  test('multiple staff slots contribute to the weekly capacity chart', async ({ page }) => {
    await createEmptyScenarioViaUi(page);
    await addDataItemViaUi(page, 'Kapazität', 'Mitarbeiter mit zwei Zeiten');
    await seedMondayBooking(page, 'Mitarbeiter mit zwei Zeiten', { addSecondSegment: true });
    await goToWeeklyChart(page);

    const demandChart = await getWeeklyChart(page);
    await expect(demandChart).toBeVisible();
    const values = await readWeeklyPointValues(page, 4);
    expect(values.capacity).toBe(1);
  });

  test('weekly chart shows matching child demand and staff capacity', async ({ page }) => {
    await createEmptyScenarioViaUi(page);

    await addDataItemViaUi(page, 'Kapazität', 'Mitarbeiter A');
    await seedMondayBooking(page, 'Mitarbeiter A');

    await addDataItemViaUi(page, 'Bedarf', 'Kind A');
    await seedMondayBooking(page, 'Kind A');

    await goToWeeklyChart(page);

    const demandChart = await getWeeklyChart(page);
    await expect(demandChart).toBeVisible();
    const values = await readWeeklyPointValues(page, 2);
    expect(values.demand).toBe(1);
    expect(values.capacity).toBe(1);
  });
});
