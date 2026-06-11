import { describe, expect, it } from 'vitest';
import { calculateChartDataMidterm } from './chartUtilsMidterm';

describe('calculateChartDataMidterm', () => {
  it('respects validUntil on capacity items and drops capacity after expiry', () => {
    const scenarioId = 'scenario-1';

    const result = calculateChartDataMidterm(
      ['2026-08', '2026-09'],
      '2026-08-15',
      [],
      [],
      {
        bookingsByScenario: {
          [scenarioId]: {
            'capacity-1': {
              'booking-1': {
                id: 'booking-1',
                startdate: '2026-01-01',
                enddate: '',
                times: [
                  {
                    day_name: 'Mo',
                    segments: [
                      { booking_start: '08:00', booking_end: '12:00', category: 'pedagogical' },
                    ],
                  },
                ],
              },
            },
          },
        },
        dataByScenario: {
          [scenarioId]: {
            'capacity-1': {
              id: 'capacity-1',
              type: 'capacity',
              validFrom: '2026-01-01',
              validUntil: '2026-08-31',
            },
          },
        },
        groupDefs: [],
        qualificationDefs: [],
        groupsByScenario: { [scenarioId]: {} },
        qualificationAssignmentsByScenario: { [scenarioId]: {} },
        scenarioId,
        timedimension: 'month',
      }
    );

    expect(result.capacity_pedagogical[0]).toBeGreaterThan(0);
    expect(result.capacity_pedagogical[1]).toBe(0);
  });

  it('respects booking validUntil fallback when booking enddate is missing', () => {
    const scenarioId = 'scenario-2';

    const result = calculateChartDataMidterm(
      ['2026-08', '2026-09'],
      '2026-08-15',
      [],
      [],
      {
        bookingsByScenario: {
          [scenarioId]: {
            'capacity-1': {
              'booking-1': {
                id: 'booking-1',
                startdate: '2026-01-01',
                enddate: '',
                validUntil: '2026-08-31',
                times: [
                  {
                    day_name: 'Mo',
                    segments: [
                      { booking_start: '08:00', booking_end: '12:00', category: 'pedagogical' },
                    ],
                  },
                ],
              },
            },
          },
        },
        dataByScenario: {
          [scenarioId]: {
            'capacity-1': {
              id: 'capacity-1',
              type: 'capacity',
              startdate: '2026-01-01',
              enddate: '',
            },
          },
        },
        groupDefs: [],
        qualificationDefs: [],
        groupsByScenario: { [scenarioId]: {} },
        qualificationAssignmentsByScenario: { [scenarioId]: {} },
        scenarioId,
        timedimension: 'month',
      }
    );

    expect(result.capacity_pedagogical[0]).toBeGreaterThan(0);
    expect(result.capacity_pedagogical[1]).toBe(0);
  });

  it('splits capacity hours by time-segment group assignments when filtering by group', () => {
    const scenarioId = 'scenario-3';
    const basePayload = {
      bookingsByScenario: {
        [scenarioId]: {
          'capacity-1': {
            'booking-1': {
              id: 'booking-1',
              startdate: '2026-01-01',
              enddate: '',
              times: [
                {
                  day_name: 'Mo',
                  segments: [
                    { booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' },
                  ],
                },
                {
                  day_name: 'Di',
                  segments: [
                    { booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' },
                  ],
                },
                {
                  day_name: 'Mi',
                  segments: [
                    { booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' },
                  ],
                },
                {
                  day_name: 'Do',
                  segments: [
                    { booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' },
                  ],
                },
                {
                  day_name: 'Fr',
                  segments: [
                    { booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' },
                  ],
                },
              ],
            },
          },
        },
      },
      dataByScenario: {
        [scenarioId]: {
          'capacity-1': {
            id: 'capacity-1',
            type: 'capacity',
            startdate: '2026-01-01',
            enddate: '',
          },
        },
      },
      groupDefs: [
        { id: 'g1', name: 'Fuchsgruppe' },
        { id: 'g2', name: 'Bärchengruppe' },
      ],
      qualificationDefs: [],
      groupsByScenario: {
        [scenarioId]: {
          'capacity-1': {
            ga1: {
              id: 'ga1',
              assignmentMode: 'multiple',
              start: '2026-01-01',
              end: '2026-12-31',
              timeSegments: [
                { id: 'ts-1', startTime: '08:00', endTime: '09:00', groupId: 'g1' },
                { id: 'ts-2', startTime: '09:00', endTime: '10:00', groupId: 'g2' },
              ],
            },
          },
        },
      },
      qualificationAssignmentsByScenario: { [scenarioId]: {} },
      scenarioId,
      timedimension: 'month',
    };

    const group1Result = calculateChartDataMidterm(
      ['2026-08'],
      '2026-08-15',
      ['g1'],
      [],
      basePayload
    );

    const group2Result = calculateChartDataMidterm(
      ['2026-08'],
      '2026-08-15',
      ['g2'],
      [],
      basePayload
    );

    expect(group1Result.capacity_pedagogical[0]).toBe(5);
    expect(group2Result.capacity_pedagogical[0]).toBe(5);
  });

  it('weights capacity hours by segment groupAllocations when filtering by group', () => {
    const scenarioId = 'scenario-4';
    const basePayload = {
      bookingsByScenario: {
        [scenarioId]: {
          'capacity-1': {
            'booking-1': {
              id: 'booking-1',
              startdate: '2026-01-01',
              enddate: '',
              times: [
                {
                  day_name: 'Mo',
                  segments: [
                    {
                      booking_start: '08:00',
                      booking_end: '10:00',
                      category: 'pedagogical',
                      groupAllocations: [
                        { groupId: 'g1', share: 40 },
                        { groupId: 'g2', share: 60 },
                      ],
                    },
                  ],
                },
                {
                  day_name: 'Di',
                  segments: [
                    {
                      booking_start: '08:00',
                      booking_end: '10:00',
                      category: 'pedagogical',
                      groupAllocations: [
                        { groupId: 'g1', share: 40 },
                        { groupId: 'g2', share: 60 },
                      ],
                    },
                  ],
                },
                {
                  day_name: 'Mi',
                  segments: [
                    {
                      booking_start: '08:00',
                      booking_end: '10:00',
                      category: 'pedagogical',
                      groupAllocations: [
                        { groupId: 'g1', share: 40 },
                        { groupId: 'g2', share: 60 },
                      ],
                    },
                  ],
                },
                {
                  day_name: 'Do',
                  segments: [
                    {
                      booking_start: '08:00',
                      booking_end: '10:00',
                      category: 'pedagogical',
                      groupAllocations: [
                        { groupId: 'g1', share: 40 },
                        { groupId: 'g2', share: 60 },
                      ],
                    },
                  ],
                },
                {
                  day_name: 'Fr',
                  segments: [
                    {
                      booking_start: '08:00',
                      booking_end: '10:00',
                      category: 'pedagogical',
                      groupAllocations: [
                        { groupId: 'g1', share: 40 },
                        { groupId: 'g2', share: 60 },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      dataByScenario: {
        [scenarioId]: {
          'capacity-1': {
            id: 'capacity-1',
            type: 'capacity',
            startdate: '2026-01-01',
            enddate: '',
          },
        },
      },
      groupDefs: [
        { id: 'g1', name: 'Fuchsgruppe' },
        { id: 'g2', name: 'Bärchengruppe' },
      ],
      qualificationDefs: [],
      groupsByScenario: { [scenarioId]: {} },
      qualificationAssignmentsByScenario: { [scenarioId]: {} },
      scenarioId,
      timedimension: 'month',
    };

    const group1Result = calculateChartDataMidterm(
      ['2026-08'],
      '2026-08-15',
      ['g1'],
      [],
      basePayload
    );

    const group2Result = calculateChartDataMidterm(
      ['2026-08'],
      '2026-08-15',
      ['g2'],
      [],
      basePayload
    );

    expect(group1Result.capacity_pedagogical[0]).toBe(4);
    expect(group2Result.capacity_pedagogical[0]).toBe(6);
  });
});
