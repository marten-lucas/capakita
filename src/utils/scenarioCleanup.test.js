import { describe, expect, it } from 'vitest';
import { buildScenarioCleanupResult } from './scenarioCleanup';

describe('buildScenarioCleanupResult', () => {
  it('removes orphan item-bound records and keeps valid records', () => {
    const state = {
      simScenario: {
        scenarios: [{ id: 's1' }],
      },
      simData: {
        dataByScenario: {
          s1: {
            child1: { id: 'child1', type: 'demand' },
          },
        },
      },
      simBooking: {
        bookingsByScenario: {
          s1: {
            child1: { b1: { id: 'b1' } },
            orphan: { b2: { id: 'b2' } },
          },
        },
      },
      simGroup: {
        groupsByScenario: {
          s1: {
            child1: { g1: { id: 'g1' } },
            orphan: { g2: { id: 'g2' } },
          },
        },
        groupDefsByScenario: {
          s1: [],
        },
      },
      simQualification: {
        qualificationAssignmentsByScenario: {
          s1: {
            child1: { q1: { id: 'q1', qualification: 'A' } },
            orphan: { q2: { id: 'q2', qualification: 'B' } },
          },
        },
        qualificationDefsByScenario: {
          s1: [],
        },
      },
      simOverlay: {
        overlaysByScenario: {
          s1: {
            bookings: {
              child1: { b3: { id: 'b3' } },
              orphan: { b4: { id: 'b4' } },
            },
            groupassignments: {
              child1: { g3: { id: 'g3' } },
              orphan: { g4: { id: 'g4' } },
            },
          },
        },
      },
      simFinance: {
        financeByScenario: {
          s1: {
            settings: {},
            bayKiBiGRules: [],
            groupFeeCatalogs: {},
            itemFinances: {
              child1: { personnelCostHistory: [] },
              orphan: { personnelCostHistory: [] },
            },
          },
        },
      },
    };

    const result = buildScenarioCleanupResult(state, 's1');

    expect(Object.keys(result.bookingsByScenario.s1)).toEqual(['child1']);
    expect(Object.keys(result.groupsByScenario.s1)).toEqual(['child1']);
    expect(Object.keys(result.qualificationAssignmentsByScenario.s1)).toEqual(['child1']);
    expect(Object.keys(result.overlaysByScenario.s1.bookings)).toEqual(['child1']);
    expect(Object.keys(result.overlaysByScenario.s1.groupassignments)).toEqual(['child1']);
    expect(Object.keys(result.financeByScenario.s1.itemFinances)).toEqual(['child1']);

    expect(result.stats).toMatchObject({
      removedBookingItemBuckets: 1,
      removedGroupItemBuckets: 1,
      removedQualificationItemBuckets: 1,
      removedOverlayBookingBuckets: 1,
      removedOverlayGroupBuckets: 1,
      removedFinanceItemEntries: 1,
    });
  });
});
