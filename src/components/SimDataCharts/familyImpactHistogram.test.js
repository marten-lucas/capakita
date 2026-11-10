import { describe, expect, it } from 'vitest';
import { buildFamilyImpactHistogramData } from './familyImpactHistogram';

const annualRows = [
  {
    year: 2026,
    familyImpacts: [{ averageMonthlyDelta: 30, averageMonthlyYearOverYearDelta: null }],
  },
  {
    year: 2027,
    familyImpacts: [
      { averageMonthlyDelta: 0, averageMonthlyYearOverYearDelta: 100 },
      { averageMonthlyDelta: 65, averageMonthlyYearOverYearDelta: -25 },
      { averageMonthlyDelta: 0, averageMonthlyYearOverYearDelta: 250 },
      { averageMonthlyDelta: 0, averageMonthlyYearOverYearDelta: 0 },
    ],
  },
];

describe('buildFamilyImpactHistogramData', () => {
  it('groups monthly year-over-year family changes into count bins', () => {
    const result = buildFamilyImpactHistogramData(annualRows, 'yearOverYear');

    expect(result.series).toEqual(['2027']);
    expect(result.affectedFamiliesByYear['2027']).toBe(3);
    expect(result.data.find((row) => row.range === 'Senkung')['2027']).toBe(1);
    expect(result.data.find((row) => row.range === '100–149 €')['2027']).toBe(1);
    expect(result.data.find((row) => row.range === '≥ 200 €')['2027']).toBe(1);
  });

  it('combines prior-year and simulation changes in the total-impact mode', () => {
    const result = buildFamilyImpactHistogramData(annualRows, 'total');

    expect(result.series).toEqual(['2026', '2027']);
    expect(result.affectedFamiliesByYear['2027']).toBe(3);
    expect(result.data.find((row) => row.range === '1–49 €')['2027']).toBe(1);
    expect(result.data.find((row) => row.range === '100–149 €')['2027']).toBe(1);
    expect(result.data.find((row) => row.range === '≥ 200 €')['2027']).toBe(1);
  });

  it('rebuilds bins from simulation changes independently of year-over-year changes', () => {
    const result = buildFamilyImpactHistogramData(annualRows, 'simulation');

    expect(result.series).toEqual(['2026', '2027']);
    expect(result.data.find((row) => row.range === '1–49 €')['2026']).toBe(1);
    expect(result.data.find((row) => row.range === '50–99 €')['2027']).toBe(1);
    expect(result.affectedFamiliesByYear['2027']).toBe(1);
  });
});
