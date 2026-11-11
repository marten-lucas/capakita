import { describe, expect, it } from 'vitest';
import {
  getForecastGroupAssignments,
  getFutureGroupAssignmentDates,
  shouldProjectAutoTransition,
} from './forecastUtils';

describe('forecast group transition helpers', () => {
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
