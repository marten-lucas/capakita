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

describe('validateFeeStaircase', () => {
  it('accepts a complete staircase whose adjacent steps meet the 10% rule', () => {
    const result = validateFeeStaircase(makeStaircase(10, 100));

    expect(result.isCompliant).toBe(true);
    expect(result.minimumDifference).toBe(10);
    expect(result.missingZones).toEqual([]);
    expect(result.stepViolations).toEqual([]);
  });

  it('requires at least five euros even when ten percent is lower', () => {
    const result = validateFeeStaircase(makeStaircase(5, 40));

    expect(result.minimumDifference).toBe(5);
    expect(result.isCompliant).toBe(true);
  });

  it('reports adjacent prices that are too close', () => {
    const entries = makeStaircase(10, 100);
    entries[1].monthlyAmount = entries[0].monthlyAmount + 9;

    const result = validateFeeStaircase(entries);

    expect(result.isCompliant).toBe(false);
    expect(result.stepViolations[0]).toMatchObject({
      previousZone: { id: '01' },
      zone: { id: '02' },
      difference: 9,
      requiredAmount: entries[0].monthlyAmount + 10,
    });
  });

  it('treats disabled categories as missing and reports a missing reference category', () => {
    const entries = makeStaircase(10, 100).filter((entry) => entry.zeitkatId !== '04');
    entries.find((entry) => entry.zeitkatId === '08').enabled = false;

    const result = validateFeeStaircase(entries);

    expect(result.isCompliant).toBe(false);
    expect(result.referenceAmount).toBeNull();
    expect(result.missingZones.map((zone) => zone.id)).toContain('04');
    expect(result.missingZones.map((zone) => zone.id)).toContain('08');
  });
});
