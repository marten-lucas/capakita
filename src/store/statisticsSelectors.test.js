import { describe, expect, it } from 'vitest';
import { deriveAutoEventSettingsFromStatistics, selectGroupTransitionStatistics, selectHistoricalStatistics } from './statisticsSelectors';

function segment(booking_start, booking_end, category = 'pedagogical') {
  return { booking_start, booking_end, category };
}

function booking(id, startdate, enddate, segments) {
  return {
    id,
    startdate,
    enddate,
    times: [
      {
        day: 1,
        day_name: 'Mo',
        segments,
      },
    ],
  };
}

describe('statisticsSelectors', () => {
  const baseState = {
    simScenario: {
      selectedScenarioId: 's1',
    },
    simData: {
      dataByScenario: {
        s1: {
          k1: { id: 'k1', type: 'demand', startdate: '2024-01-10', enddate: '2024-03-05', dateofbirth: '2020-01-01' },
          k2: { id: 'k2', type: 'demand', startdate: '2024-02-01', enddate: '', dateofbirth: '2021-03-12' },
          e1: { id: 'e1', type: 'capacity', startdate: '2024-01-01', enddate: '' },
        },
      },
    },
    simBooking: {
      bookingsByScenario: {
        s1: {
          k1: {
            b1: booking('b1', '2024-01-10', '2024-02-14', [segment('08:00', '10:00')]),
            b4: booking('b4', '2024-02-15', '', [segment('08:00', '12:00')]),
          },
          k2: {
            b2: booking('b2', '2024-02-01', '', [segment('09:00', '12:00')]),
          },
          e1: {
            b3: booking('b3', '2024-01-01', '', [segment('08:00', '12:00', 'pedagogical')]),
          },
        },
      },
    },
    simGroup: {
      groupDefsByScenario: {
        s1: [
          { id: 'g1', name: 'Krippe' },
          { id: 'g2', name: 'Kita' },
        ],
      },
      groupsByScenario: {
        s1: {
          k1: {
            ga1: { id: 'ga1', groupId: 'g1', start: '2024-01-10', end: '2024-02-14' },
            ga2: { id: 'ga2', groupId: 'g2', start: '2024-02-15', end: '' },
          },
          k2: {
            ga3: { id: 'ga3', groupId: 'g2', start: '2024-02-01', end: '' },
          },
        },
      },
    },
  };

  it('aggregates monthly buckets with children, booking and care hours', () => {
    const result = selectHistoricalStatistics(baseState, {
      aggregation: 'month',
      asOfDate: '2024-03-31',
    });

    expect(result.aggregation).toBe('month');
    expect(result.buckets).toHaveLength(3);

    expect(result.buckets[0]).toMatchObject({
      label: '01.2024',
      childrenCount: 1,
      bookingHours: 2,
      careHours: 4,
    });

    expect(result.buckets[1]).toMatchObject({
      label: '02.2024',
      childrenCount: 2,
      bookingHours: 7,
      careHours: 4,
    });

    expect(result.buckets[2]).toMatchObject({
      label: '03.2024',
      childrenCount: 1,
      bookingHours: 3,
      careHours: 4,
    });
  });

  it('aggregates quarterly buckets', () => {
    const result = selectHistoricalStatistics(baseState, {
      aggregation: 'quarter',
      asOfDate: '2024-03-31',
    });

    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]).toMatchObject({
      label: 'Q1 2024',
      childrenCount: 1,
      bookingHours: 3,
      careHours: 4,
    });
  });

  it('returns empty buckets when no selected scenario exists', () => {
    const result = selectHistoricalStatistics(
      {
        ...baseState,
        simScenario: { selectedScenarioId: null },
      },
      { aggregation: 'month', asOfDate: '2024-03-31' }
    );

    expect(result.buckets).toEqual([]);
  });

  it('derives group transitions with age and 90-day booking deltas', () => {
    const result = selectGroupTransitionStatistics(baseState, {
      asOfDate: '2024-06-30',
      windowDays: 90,
    });

    expect(result.summary.count).toBe(3);
    expect(result.transitions).toHaveLength(3);

    expect(result.transitions.find((entry) => entry.transitionKind === 'entry_krippe')).toMatchObject({
      itemId: 'k1',
      fromGroupName: 'Einstieg',
      toGroupName: 'Krippe',
      transitionKind: 'entry_krippe',
      date: '2024-01-10',
      beforeHours: 0,
      afterHours: 2.71,
      deltaHours: 2.71,
    });

    expect(result.transitions.find((entry) => entry.transitionKind === 'krippe_to_regelgruppe')).toMatchObject({
      itemId: 'k1',
      fromGroupName: 'Krippe',
      toGroupName: 'Regelgruppe',
      transitionKind: 'krippe_to_regelgruppe',
      date: '2024-02-15',
      ageMonths: 49,
      beforeHours: 2,
      afterHours: 4,
      deltaHours: 2,
      deltaPercent: 100,
    });

    expect(result.transitions.find((entry) => entry.transitionKind === 'entry_regelgruppe')).toMatchObject({
      itemId: 'k2',
      fromGroupName: 'Einstieg',
      toGroupName: 'Regelgruppe',
      transitionKind: 'entry_regelgruppe',
      date: '2024-02-01',
      beforeHours: 0,
      afterHours: 3,
      deltaHours: 3,
    });

    expect(result.summary.averageAgeMonths).toBe(43.67);
    expect(result.summary.medianAgeMonths).toBe(48);
    expect(result.ageHistogram[0]).toMatchObject({
      label: '33-35 Monate',
      count: 1,
    });
  });

  it('derives auto-event settings from grouped transition statistics', () => {
    const derived = deriveAutoEventSettingsFromStatistics(
      {
        transitions: [
          {
            transitionKind: 'krippe_to_regelgruppe',
            ageMonths: 36,
            deltaHours: 2,
          },
          {
            transitionKind: 'entry_krippe',
            ageMonths: 35,
            deltaHours: 7,
          },
          {
            transitionKind: 'regelgruppe_to_schulkindbetreuung',
            ageMonths: 66,
            deltaHours: -1,
          },
        ],
      },
      [],
      {
        kita: { ageYears: 3, bookingDeltaHours: 0 },
        school: { ageYears: 6, bookingDeltaHours: 0 },
      }
    );

    expect(derived).toEqual({
      kita: { ageYears: 3, bookingDeltaHours: 2 },
      school: { ageYears: 5.5, bookingDeltaHours: -1 },
    });
  });

  it('falls back to the youngest non-school route when imported group types do not mark Krippe explicitly', () => {
    const derived = deriveAutoEventSettingsFromStatistics(
      {
        transitions: [
          {
            transitionKind: 'krippe_to_regelgruppe',
            ageMonths: 35,
            deltaHours: 2.4,
          },
          {
            transitionKind: 'regelgruppe_to_schulkindbetreuung',
            ageMonths: 80,
            deltaHours: -8.4,
          },
        ],
      },
      [],
      {
        kita: { ageYears: 3, bookingDeltaHours: 0 },
        school: { ageYears: 6, bookingDeltaHours: 0 },
      }
    );

    expect(derived).toEqual({
      kita: { ageYears: 2.9, bookingDeltaHours: 2.4 },
      school: { ageYears: 6.7, bookingDeltaHours: -8.4 },
    });
  });

  it('ignores unsupported reverse transitions like regelgruppe to krippe', () => {
    const state = {
      simScenario: { selectedScenarioId: 's1' },
      simData: {
        dataByScenario: {
          s1: {
            k1: { id: 'k1', type: 'demand', startdate: '2024-01-01', enddate: '', dateofbirth: '2020-01-01' },
          },
        },
      },
      simBooking: {
        bookingsByScenario: {
          s1: {
            k1: {
              b1: booking('b1', '2024-01-01', '', [segment('08:00', '10:00')]),
            },
          },
        },
      },
      simGroup: {
        groupDefsByScenario: {
          s1: [
            { id: 'g1', name: 'Regelgruppe', type: 'Regelgruppe' },
            { id: 'g2', name: 'Krippe', type: 'Krippe' },
          ],
        },
        groupsByScenario: {
          s1: {
            k1: {
              ga1: { id: 'ga1', groupId: 'g1', start: '2024-01-01', end: '2024-03-31' },
              ga2: { id: 'ga2', groupId: 'g2', start: '2024-04-01', end: '' },
            },
          },
        },
      },
    };

    const result = selectGroupTransitionStatistics(state, {
      asOfDate: '2024-06-30',
      windowDays: 90,
    });

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]).toMatchObject({
      transitionKind: 'entry_regelgruppe',
      fromGroupName: 'Einstieg',
      toGroupName: 'Regelgruppe',
    });
  });
});
