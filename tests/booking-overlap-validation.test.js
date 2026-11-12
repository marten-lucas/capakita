import { test, expect } from '@playwright/test';

async function seedScenarioWithCapacityBooking(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 5000 });

  await page.evaluate(() => {
    const store = window.__APP_STORE;
    if (!store) return;

    store.dispatch({
      type: 'simScenario/addScenario',
      payload: {
        id: 'booking-overlap-validation-test',
        name: 'Overlap Validation Test',
        imported: false,
        importedAnonymized: true,
      },
    });

    const scenarioId = store.getState().simScenario.selectedScenarioId;
    const itemId = 'overlap-capacity-item';

    store.dispatch({
      type: 'simData/simDataItemAdd',
      payload: {
        scenarioId,
        item: {
          id: itemId,
          type: 'capacity',
          source: 'manual entry',
          name: 'Mitarbeiter Overlap',
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
      type: 'simScenario/setSelectedItem',
      payload: itemId,
    });

    store.dispatch({
      type: 'ui/setActivePage',
      payload: 'data',
    });

    store.dispatch({
      type: 'simBooking/addBooking',
      payload: {
        scenarioId,
        dataItemId: itemId,
        booking: {
          id: 'booking-overlap-validation',
          startdate: '',
          enddate: '',
          times: [
            {
              day: 1,
              day_name: 'Mo',
              segments: [
                {
                  id: 'segment-1',
                  booking_start: '08:00',
                  booking_end: '10:00',
                  category: 'pedagogical',
                },
                {
                  id: 'segment-2',
                  booking_start: '10:30',
                  booking_end: '12:30',
                  category: 'pedagogical',
                },
              ],
            },
          ],
          rawdata: {},
        },
      },
    });
  });
}

async function waitForStableBoundingBox(locator) {
  let previousBox;
  await expect.poll(async () => {
    const currentBox = await locator.boundingBox();
    if (!currentBox) return false;
    const stable = previousBox && ['x', 'y', 'width', 'height'].every((key) => Math.abs(previousBox[key] - currentBox[key]) < 0.5);
    previousBox = currentBox;
    return Boolean(stable);
  }, { timeout: 5000, intervals: [50, 100] }).toBe(true);
}

test('booking editor rejects overlapping times on the same day', async ({ page }) => {
  const runtimeErrors = [];

  page.on('pageerror', (error) => {
    runtimeErrors.push(error.message);
  });

  await seedScenarioWithCapacityBooking(page);

  await page.waitForFunction(() => window.__APP_STORE?.getState?.().ui?.activePage === 'data', { timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Optionen' })).toBeVisible();

  await page.getByRole('tab', { name: 'Zeiten' }).click();
  await page.locator('.mantine-Accordion-control').first().click();

  await expect(page.getByText('Montag')).toBeVisible();

  const movableBlock = page.locator('[aria-label="Segment 2 verschieben"]').first();
  await waitForStableBoundingBox(movableBlock);
  const movableBox = await movableBlock.boundingBox();
  expect(movableBox).not.toBeNull();

  const moveStartX = movableBox.x + (movableBox.width * 0.7);
  const moveY = movableBox.y + (movableBox.height / 2);

  await page.mouse.move(moveStartX, moveY);
  await page.mouse.down();
  await page.mouse.move(moveStartX + 70, moveY, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(() => {
    const state = window.__APP_STORE?.getState?.();
    const scenarioId = state?.simScenario?.selectedScenarioId;
    const booking = state?.simBooking?.bookingsByScenario?.[scenarioId]?.['overlap-capacity-item']?.['booking-overlap-validation'];
    const segment = booking?.times?.[0]?.segments?.[1];
    return segment ? `${segment.booking_start}-${segment.booking_end}` : '';
  }), { timeout: 5000 }).not.toBe('10:30-12:30');

  const beforeResize = await page.evaluate(() => {
    const state = window.__APP_STORE?.getState?.();
    const scenarioId = state?.simScenario?.selectedScenarioId;
    const booking = state?.simBooking?.bookingsByScenario?.[scenarioId]?.['overlap-capacity-item']?.['booking-overlap-validation'];
    const segment = booking?.times?.[0]?.segments?.[1];
    return segment ? `${segment.booking_start}-${segment.booking_end}` : '';
  });

  const resizedHandle = page.locator('[aria-label="Segment 2 Start ändern"]').first();
  const resizedBox = await resizedHandle.boundingBox();
  expect(resizedBox).not.toBeNull();

  await page.mouse.move(resizedBox.x + (resizedBox.width / 2), resizedBox.y + (resizedBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(resizedBox.x - 160, resizedBox.y + (resizedBox.height / 2), { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(() => {
    const state = window.__APP_STORE?.getState?.();
    const scenarioId = state?.simScenario?.selectedScenarioId;
    const booking = state?.simBooking?.bookingsByScenario?.[scenarioId]?.['overlap-capacity-item']?.['booking-overlap-validation'];
    const segment = booking?.times?.[0]?.segments?.[1];
    return segment ? `${segment.booking_start}-${segment.booking_end}` : '';
  }), { timeout: 5000 }).not.toBe(beforeResize);

  await page.getByLabel('Details einblenden').first().click();
  const startInput = page.getByLabel('Segment 2 Startzeit');
  const endInput = page.getByLabel('Segment 2 Endzeit');

  await startInput.fill('09:00');
  await endInput.fill('11:00');
  await endInput.blur();

  await expect(page.getByText('Zeitüberschneidung am Mo')).toBeVisible();
  await expect(page.getByText('zählt nicht in Kapazität')).not.toBeVisible();

  expect(runtimeErrors).toEqual([]);
});