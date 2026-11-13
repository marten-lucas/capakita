import { describe, expect, it } from 'vitest';
import { filterBookings } from './chartUtils';

const booking = {
  id: 'booking', startdate: '2026-01-01', enddate: '',
  times: [{ day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '12:00', category: 'pedagogical' }] }],
};

function filtered(type, absences, referenceDate = '2026-03-01', overlayAbsences) {
  const item = { id: 'item', type, groupId: 'group', absences };
  return filterBookings({
    scenarioId: 'scenario', referenceDate, selectedGroups: [], selectedQualifications: [],
    dataByScenario: { scenario: { item } },
    bookingsByScenario: { scenario: { item: { booking } } },
    qualificationAssignmentsByScenario: { scenario: {} },
    overlaysByScenario: { scenario: overlayAbsences === undefined ? {} : { dataItems: { item: { ...item, absences: overlayAbsences } } } },
    groupsByScenario: { scenario: {} },
  })[type];
}

describe('filterBookings absences', () => {
  it.each(['demand', 'capacity'])('filters %s only on inclusive absence dates in both formats', (type) => {
    for (const absence of [
      { start: '2026-03-01', end: '2026-03-02' },
      { startdate: '2026-03-01', enddate: '2026-03-02' },
      { start: '2026-03-01', enddate: '2026-03-02' },
    ]) {
      expect(filtered(type, [absence], '2026-02-28')).toHaveLength(1);
      expect(filtered(type, [absence], '2026-03-01')).toHaveLength(0);
      expect(filtered(type, [absence], '2026-03-02')).toHaveLength(0);
      expect(filtered(type, [absence], '2026-03-03')).toHaveLength(1);
    }
    expect(filtered(type, [{ start: '2030-01-01', end: '2030-01-31' }])).toHaveLength(1);
  });

  it.each(['demand', 'capacity'])('supports open %s absence boundaries and overlay data', (type) => {
    for (const absence of [
      { start: '', end: '2026-03-01' }, { startdate: '', enddate: '2026-03-01' },
      { start: '2026-03-01', end: '' }, { startdate: '2026-03-01', enddate: '' }, {},
    ]) expect(filtered(type, [absence])).toHaveLength(0);
    expect(filtered(type, [{ start: '', end: '2026-02-28' }])).toHaveLength(1);
    expect(filtered(type, [{ start: '2026-03-02', end: '' }])).toHaveLength(1);
    expect(filtered(type, [], '2026-03-01', [{ start: '2026-03-01', end: '2026-03-01' }])).toHaveLength(0);
    expect(filtered(type, [{ start: '2026-03-01', end: '2026-03-01' }], '2026-03-01', [])).toHaveLength(1);
  });

  it('prefers explicitly cleared UI fields to stale legacy fields', () => {
    expect(filtered('demand', [{ start: '', end: '2026-03-01', startdate: '2030-01-01' }])).toHaveLength(0);
    expect(filtered('demand', [{ start: '2026-03-01', end: '', enddate: '2020-01-01' }])).toHaveLength(0);
  });
});
