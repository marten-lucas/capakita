import { describe, expect, it } from 'vitest';
import {
  allocateFillUpCandidates,
  getForecastGroupAssignments,
  getForecastGroupRank,
  getFutureGroupAssignmentDates,
  shouldProjectAutoTransition,
} from './forecastUtils';

describe('forecast group transition helpers', () => {
  it('sorts Sankey stages from Krippe through Regelgruppe to school, without mistaking Vorschule for school', () => {
    expect(getForecastGroupRank('krippe', { name: 'Bärchengruppe', type: 'Krippe' })).toBe(0);
    expect(getForecastGroupRank('vorschule', { name: 'Vorschule', type: 'Regelgruppe' })).toBe(1);
    expect(getForecastGroupRank('school', { name: 'Schulkind-Fuchsgruppe', type: 'Schulkindgruppe' })).toBe(2);
    expect(getForecastGroupRank('__AUTO_STAGE_EXIT__', { name: 'Aus Einrichtung', type: 'Exit' })).toBe(3);
  });

  it('allocates fill-up places by grade, then sibling priority, then source order', () => {
    const { accepted, rejected } = allocateFillUpCandidates([
      { id: 'single', gradePriority: 1, siblingPriority: 0, dataOrder: 0 },
      { id: 'sibling-a', gradePriority: 1, siblingPriority: 1, dataOrder: 1 },
      { id: 'sibling-b', gradePriority: 1, siblingPriority: 1, dataOrder: 2 },
      { id: 'older-grade', gradePriority: 2, siblingPriority: 1, dataOrder: 3 },
    ], 2);

    expect(accepted.map((candidate) => candidate.id)).toEqual(['sibling-a', 'sibling-b']);
    expect(rejected.map((candidate) => candidate.id)).toEqual(['single', 'older-grade']);
  });

  it('normalizes imported assignment maps and includes future explicit assignment dates', () => {
    const assignments = {
      old: { id: 'old', groupId: 'krippe', start: '2024-09-01', end: '2026-08-31' },
      next: { id: 'next', groupId: 'regel', start: '2027-09-01', end: '' },
    };

    expect(getForecastGroupAssignments(assignments)).toHaveLength(2);
    expect(getFutureGroupAssignmentDates(assignments, '2026-11-09')).toEqual(['2027-09-01']);
  });

  it('supports assignment arrays and excludes empty or past starts', () => {
    expect(getFutureGroupAssignmentDates([
      { start: '' },
      { start: '2026-11-08' },
      { start: '2026-11-09' },
    ], '2026-11-09')).toEqual(['2026-11-09']);
  });

  it('projects an anticipated transition unless a later real assignment supersedes it', () => {
    const beforeRealAssignment = { a: { groupId: 'regel', start: '2027-09-01' } };
    const afterRealAssignment = { a: { groupId: 'regel', start: '2027-08-01' } };

    expect(shouldProjectAutoTransition({}, '2027-09-01', '2027-09-01')).toBe(true);
    expect(shouldProjectAutoTransition(beforeRealAssignment, '2027-08-01', '2027-09-01')).toBe(false);
    expect(shouldProjectAutoTransition(afterRealAssignment, '2027-09-01', '2027-10-01')).toBe(true);
    expect(shouldProjectAutoTransition({}, '2027-09-01', '2027-08-31')).toBe(false);
  });
});
