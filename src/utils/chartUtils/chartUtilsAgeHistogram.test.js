import { describe, expect, it } from 'vitest';

import { calculateChartDataAgeHistogram } from './chartUtilsAgeHistogram';

describe('calculateChartDataAgeHistogram', () => {
  it('labels age bins with the upper category bound', () => {
    const result = calculateChartDataAgeHistogram('2026-05-18', [], {
      scenarioId: 'scenario-1',
      dataByScenario: {
        'scenario-1': {
          child1: { id: 'child1', type: 'demand', dateofbirth: '2025-05-18', groupId: '', startdate: '', enddate: '' },
          child2: { id: 'child2', type: 'demand', dateofbirth: '2024-05-18', groupId: '', startdate: '', enddate: '' },
        },
      },
      groupsByScenario: {
        'scenario-1': {},
      },
    });

    expect(result.categories[0]).toBe('0,25');
    expect(result.categories).toContain('1');
    expect(result.categories).toContain('2,5');
    expect(result.categories).toContain('2,75');
  });

  it('excludes archived children from analysis histogram', () => {
    const result = calculateChartDataAgeHistogram('2026-05-18', [], {
      scenarioId: 'scenario-1',
      dataByScenario: {
        'scenario-1': {
          child1: { id: 'child1', type: 'demand', dateofbirth: '2025-05-18', groupId: '', startdate: '', enddate: '' },
          child2: { id: 'child2', type: 'demand', dateofbirth: '2024-05-18', groupId: '', startdate: '', enddate: '', archived: true },
        },
      },
      groupsByScenario: {
        'scenario-1': {},
      },
    });

    expect(result.series.reduce((sum, value) => sum + value, 0)).toBe(1);
  });
});