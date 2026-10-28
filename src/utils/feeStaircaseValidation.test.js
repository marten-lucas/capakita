import { describe, expect, it } from 'vitest';
import { ZEITKAT_CATALOG } from './adebisConstants';
import { validateFeeStaircase } from './feeStaircaseValidation';

function makeStaircase(step, referenceAmount = 100) {
  const referenceIndex = ZEITKAT_CATALOG.findIndex((zone) => zone.id === '04');
  return ZEITKAT_CATALOG.map((zone, index) => ({
    id: `fee-${zone.id}`,
    zeitkatId: zone.id,
    monthlyAmount: referenceAmount + (index - referenceIndex) * step,
  }));
}

function keepActiveZones(entries, activeIds) {
  const activeIdSet = new Set(activeIds);
  return entries.map((entry) => ({
    ...entry,
    monthlyAmount: activeIdSet.has(entry.zeitkatId) ? entry.monthlyAmount : 0,
  }));
}

describe('validateFeeStaircase', () => {
  it('allows unused categories outside the configured minimum and maximum', () => {
    const entries = keepActiveZones(makeStaircase(10, 100), ['04', '05', '06']);
    const result = validateFeeStaircase(entries);

    expect(result.isCompliant).toBe(true);
    expect(result.minimumDifference).toBe(10);
    expect(result.firstActiveZone.id).toBe('04');
    expect(result.lastActiveZone.id).toBe('06');
    expect(result.gaps).toEqual([]);
    expect(result.stepViolations).toEqual([]);
  });

  it('requires at least five euros when ten percent is lower', () => {
    const entries = keepActiveZones(makeStaircase(5, 40), ['01', '02', '04']);
    const result = validateFeeStaircase(entries);

    expect(result.minimumDifference).toBe(5);
    expect(result.isCompliant).toBe(true);
  });

  it('reports zero-value categories that leave a gap inside the active range', () => {
    const entries = keepActiveZones(makeStaircase(10, 100), ['04', '05', '07']);
    const result = validateFeeStaircase(entries);

    expect(result.isCompliant).toBe(false);
    expect(result.gaps.map((zone) => zone.id)).toEqual(['06']);
  });

  it('reports adjacent prices that are too close', () => {
    const entries = keepActiveZones(makeStaircase(10, 100), ['01', '02', '04']);
    const firstAmount = entries.find((entry) => entry.zeitkatId === '01').monthlyAmount;
    entries.find((entry) => entry.zeitkatId === '02').monthlyAmount = firstAmount + 9;

    const result = validateFeeStaircase(entries);

    expect(result.isCompliant).toBe(false);
    expect(result.stepViolations[0]).toMatchObject({
      previousZone: { id: '01' },
      zone: { id: '02' },
      difference: 9,
      requiredAmount: entries.find((entry) => entry.zeitkatId === '01').monthlyAmount + 10,
    });
  });

  it('reports when no positive category is activated', () => {
    const result = validateFeeStaircase(makeStaircase(10).map((entry) => ({ ...entry, monthlyAmount: 0 })));

    expect(result.isCompliant).toBe(false);
    expect(result.noActiveZones).toBe(true);
    expect(result.gaps).toEqual([]);
  });
});
