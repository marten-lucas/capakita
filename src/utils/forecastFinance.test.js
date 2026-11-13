import { describe, expect, it } from 'vitest';
import { buildForecastFinanceMonth } from './forecastFinance';
import { buildForecastFillUp } from './forecastUtilsModel';
import { simulateContributionChanges } from './foerderSimulation';
import { getEffectiveBookings, getEffectiveDataItems, getEffectiveGroupAssignments, getEffectiveGroupDefs } from './overlayUtils';

const groups = [
  { id: 'nursery', type: 'Krippe' },
  { id: 'regular', type: 'Regelgruppe' },
  { id: 'regular2', type: 'Regelgruppe' },
  { id: 'hort', type: 'Schulkindgruppe' },
];
const booking = (extra = {}) => ({
  id: 'b', startdate: '2026-01-01', enddate: '2026-12-31',
  rawdata: { ART: '0', ZEITKAT: '06' },
  times: [{ day_name: 'Montag', segments: [{ booking_start: '08:00', booking_end: '14:00' }] }],
  ...extra,
});
const transition = (date, targetStage) => ({ entityType: 'demand', entityId: 'a', type: 'auto_group_transition', effectiveDate: date, metadata: { targetStage } });
const base = {
  mode: 'projected', referenceDate: '2026-01-01', monthDate: '2026-03-01', groups,
  dataItems: { a: { id: 'a', type: 'demand', startdate: '2026-01-01' } },
  bookingsByItem: { a: { b: booking() } },
  groupAssignmentsByItem: { a: { a1: { groupId: 'nursery', end: '2026-02-28' } } },
  groupFeeCatalogs: { nursery: [{ id: 'n', zeitkatId: '06', monthlyAmount: 100 }], regular: [{ id: 'r', zeitkatId: '06', monthlyAmount: 200 }] },
  events: [transition('2026-03-01', 'kita')],
};
const snapshot = (overrides = {}) => buildForecastFinanceMonth({ ...base, ...overrides });

describe('buildForecastFinanceMonth', () => {
  it('uses month-start snapshots, known exit and the shared transition resolver', () => {
    const before = snapshot({ monthDate: '2026-02-01' });
    expect(before.counts).toEqual({ known: 1, projected: 0, unknown: 0 });
    expect(before.demand).toHaveLength(1);
    expect(before.diagnostics.complete).toBe(true);
    const projected = snapshot();
    expect(projected.counts).toEqual({ known: 0, projected: 1, unknown: 0 });
    expect(projected.states[0]).toMatchObject({ stage: 'kita', source: 'projected', groupId: null });
    expect(projected.demand).toHaveLength(0);
    expect(projected.diagnostics.gaps[0].reasons).toContain('unknown-group');
    const known = snapshot({ mode: 'known' });
    expect(known.states[0]).toMatchObject({ stage: 'unknown', source: 'unknown' });
    expect(snapshot({ dataItems: { a: { ...base.dataItems.a, enddate: '2026-02-28' } } }).states).toEqual([]);
    expect(snapshot({ dataItems: { a: { ...base.dataItems.a, enddate: '2026-03-01' } } }).states).toHaveLength(1);
  });

  it('prefers a concrete future assignment over assumptions and produces usable simulation inputs', () => {
    const result = snapshot({ groupAssignmentsByItem: { a: [
      { groupId: 'nursery', end: '2026-02-28' }, { groupId: 'regular', start: '2026-03-01' },
    ] } });
    expect(result.states[0]).toMatchObject({ stage: 'kita', source: 'known', groupId: 'regular' });
    expect(result.demand[0]).toMatchObject({ itemId: 'a', groupId: 'regular' });
    const finance = simulateContributionChanges({ demandBookings: result.demand, dataItems: result.effectiveDataItems,
      groupDefs: groups, groupFeeCatalogs: base.groupFeeCatalogs, referenceDate: base.monthDate, utilizationPercent: 0 });
    expect(finance.totals.monthlyParentFeesAfter).toBe(200);
    expect(finance.diagnostics.feeCalculationComplete).toBe(true);
  });

  it('never infers school care or a concrete group from a stage', () => {
    const result = snapshot({ monthDate: '2026-09-01', events: [transition('2026-03-01', 'kita'), transition('2026-09-01', 'school')] });
    expect(result.states[0]).toMatchObject({ stage: 'unknown', source: 'projected', groupId: null });
    expect(result.diagnostics.gaps[0].reasons).toContain('unknown-group');
  });

  it('uses the shared fill-up decision without inventing a tariff group', () => {
    const schoolGroups = [...groups.slice(0, 3), { ...groups[3], fillUp: true, maxFacilityCount: 1 }];
    const options = { groups: schoolGroups, monthDate: '2026-09-01', events: [transition('2026-09-01', 'school')] };
    const accepted = snapshot(options);
    expect(accepted.states[0]).toMatchObject({ stage: 'school', source: 'projected', groupId: null });
    expect(accepted.demand).toEqual([]);
    expect(accepted.diagnostics.gaps[0].reasons).toContain('unknown-group');
    const rejected = snapshot({ ...options, groups: [...groups.slice(0, 3), { ...schoolGroups[3], maxFacilityCount: 0 }] });
    expect(rejected.states[0]).toMatchObject({ stage: 'unknown', source: 'projected', groupId: null });
    expect(snapshot({ ...options, mode: 'known' }).states[0].stage).toBe('unknown');
    const withInflow = snapshot({ ...options, inflow: [{ startdate: '2026-09-01', enddate: '2027-08-31' }] });
    expect(withInflow.counts).toEqual({ known: 0, projected: 1, unknown: 0 });
    expect(withInflow.diagnostics.gaps.flatMap((gap) => gap.reasons)).not.toContain('anonymous-inflow');
  });

  it('honors facility-wide fill-up decisions even when the finance view filters out other children', () => {
    const schoolGroups = [...groups.slice(0, 3), { ...groups[3], fillUp: true, maxFacilityCount: 1 }];
    const events = [transition('2026-09-01', 'school')];
    const fillUp = buildForecastFillUp({ referenceDate: base.referenceDate, groups: schoolGroups, events,
      children: [base.dataItems.a, { id: 'other', type: 'demand', startdate: '2026-01-01' }],
      assignmentsByChild: base.groupAssignmentsByItem });
    expect(fillUp.decisions[0].status).toBe('rejected');
    const result = snapshot({ groups: schoolGroups, monthDate: '2026-09-01', events, fillUp });
    expect(result.states[0]).toMatchObject({ stage: 'unknown', source: 'projected' });
  });

  it('reports ambiguous real groups, including same-stage and multiple assignments', () => {
    const conflicting = snapshot({ groupAssignmentsByItem: { a: [{ groupId: 'regular' }, { groupId: 'regular2' }] } });
    expect(conflicting.states[0]).toMatchObject({ stage: 'kita', source: 'known', groupId: null });
    expect(conflicting.diagnostics.gaps[0].reasons).toContain('unknown-group');
    const multiple = snapshot({ groupAssignmentsByItem: { a: [{ assignmentMode: 'multiple', timeSegments: [
      { groupId: 'regular', startTime: '08:00', endTime: '10:00' },
      { groupId: 'regular2', startTime: '10:00', endTime: '14:00' },
    ] }] } });
    expect(multiple.demand).toEqual([]);
    expect(multiple.diagnostics.complete).toBe(false);
  });

  it('uses a legacy group only without assignment history and rejects uncovered multiple-mode time', () => {
    const item = { ...base.dataItems.a, groupId: 'regular' };
    const legacy = snapshot({ dataItems: { a: item }, groupAssignmentsByItem: {}, events: [] });
    expect(legacy.diagnostics.complete).toBe(true);
    expect(legacy.demand[0].groupId).toBe('regular');
    const ended = snapshot({ dataItems: { a: item }, events: [], groupAssignmentsByItem: { a: [{ groupId: 'regular', end: '2026-02-28' }] } });
    expect(ended.diagnostics.gaps[0].reasons).toContain('unknown-group');
    const multiple = snapshot({ groupAssignmentsByItem: { a: [{ assignmentMode: 'multiple', timeSegments: [
      { groupId: 'regular', startTime: '08:00', endTime: '10:00' },
    ] }] } });
    expect(multiple.diagnostics.gaps[0].reasons).toContain('unknown-group');
  });

  it('keeps concrete legacy and assigned groups separate from the resolver’s stage classification', () => {
    const item = { ...base.dataItems.a, groupId: 'regular' };
    const run = (group, assignments = {}) => snapshot({ groups: [group], dataItems: { a: item }, groupAssignmentsByItem: assignments, events: [] });
    const named = run({ id: 'regular', name: 'Krippengruppe Bären', type: 'Regelgruppe' });
    expect(named.states[0]).toMatchObject({ stage: 'krippe', source: 'known', groupId: 'regular' });
    expect(named.diagnostics.gaps[0].reasons).toContain('conflicting-group-stage');
    expect(named.demand).toEqual([]);
    const typed = run({ id: 'regular', name: 'Sonnengruppe', type: 'Regelgruppe' });
    expect(typed.states[0]).toMatchObject({ stage: 'kita', source: 'known', groupId: 'regular' });
    expect(typed.diagnostics.complete).toBe(true);
    for (const group of [{ id: 'regular', name: 'Krippe / Kindergarten', type: 'Regelgruppe' }, { id: 'regular', name: 'Sonnengruppe' }]) {
      for (const assignments of [{}, { a: [{ groupId: 'regular' }] }]) {
        const unresolved = run(group, assignments);
        expect(unresolved.states[0]).toMatchObject({ stage: 'unknown', source: 'unknown', groupId: 'regular' });
        expect(unresolved.diagnostics.gaps[0].reasons).toContain('unknown-stage');
        expect(unresolved.demand).toEqual([]);
      }
    }
    const schoolMismatch = run({ id: 'regular', name: 'Hortgruppe Füchse', type: 'Regelgruppe' });
    expect(schoolMismatch.states[0]).toMatchObject({ stage: 'school', groupId: 'regular' });
    expect(schoolMismatch.diagnostics.gaps[0].reasons).toContain('conflicting-group-stage');
    const preschoolMismatch = run({ id: 'regular', name: 'Vorschule', type: 'Schulkindgruppe' });
    expect(preschoolMismatch.states[0]).toMatchObject({ stage: 'kita', groupId: 'regular' });
    expect(preschoolMismatch.diagnostics.gaps[0].reasons).toContain('conflicting-group-stage');
    const schoolWithoutType = run({ id: 'regular', name: 'Hortgruppe Füchse' });
    expect(schoolWithoutType.diagnostics.gaps[0].reasons).toContain('conflicting-group-stage');
    const school = run({ id: 'regular', name: 'Hortgruppe Füchse', type: 'Schulkindgruppe' });
    expect(school.diagnostics.complete).toBe(true);
    const missing = run({ id: 'other', type: 'Regelgruppe' });
    expect(missing.states[0].groupId).toBeNull();
    expect(missing.diagnostics.gaps[0].reasons).toContain('unknown-group');
  });

  it('does not promote an automatic stage projection to a group even with only one matching tariff', () => {
    const item = { ...base.dataItems.a, groupId: 'regular' };
    const projected = snapshot({ dataItems: { a: item }, groupAssignmentsByItem: {}, groups: [groups[1]], groupFeeCatalogs: { regular: base.groupFeeCatalogs.regular } });
    expect(projected.states[0]).toMatchObject({ stage: 'kita', source: 'projected', groupId: null });
    expect(projected.diagnostics.gaps[0].reasons).toContain('unknown-group');
    expect(projected.demand).toEqual([]);
    const disabled = snapshot({ dataItems: { a: item }, groupAssignmentsByItem: {}, events: [{ ...transition('2026-03-01', 'kita'), enabled: false }] });
    expect(disabled.states[0]).toMatchObject({ stage: 'kita', source: 'known', groupId: 'regular' });
    expect(disabled.diagnostics.complete).toBe(true);
    const known = snapshot({ mode: 'known', dataItems: { a: item }, groupAssignmentsByItem: {} });
    expect(known.states[0]).toMatchObject({ source: 'known', groupId: 'regular' });
    expect(known.diagnostics.complete).toBe(true);
  });

  it('retains genuinely open bookings without extending expired ones or a known exit', () => {
    const open = booking({ startdate: '', enddate: '' });
    const options = { events: [], dataItems: { a: { ...base.dataItems.a, groupId: 'regular', enddate: '2027-03-01' } }, groupAssignmentsByItem: {}, bookingsByItem: { a: [open] } };
    const future = snapshot({ ...options, monthDate: '2027-03-01' });
    expect(future.diagnostics.complete).toBe(true);
    expect(future.demand[0]).toMatchObject({ startdate: '', enddate: '' });
    expect(snapshot({ ...options, monthDate: '2027-04-01' }).states).toEqual([]);
    const expired = snapshot({ ...options, bookingsByItem: { a: [booking({ enddate: '2026-02-28' })] } });
    expect(expired.diagnostics.gaps[0].reasons).toContain('missing-basis-booking');
    expect(expired.demand).toEqual([]);
    const nullBooking = snapshot({ ...options, bookingsByItem: { a: [null] } });
    expect(nullBooking.diagnostics.gaps[0].reasons).toContain('missing-basis-booking');
  });

  it('reports missing valid bookings, overlapping basis bookings, categories and tariffs', () => {
    const assignment = { a: [{ groupId: 'regular' }] };
    const run = (bookingsByItem, groupFeeCatalogs = base.groupFeeCatalogs) => snapshot({ groupAssignmentsByItem: assignment, bookingsByItem, groupFeeCatalogs });
    expect(run({ a: [booking({ enddate: '2026-02-28' }), booking({ rawdata: { ART: 'A' } })] }).diagnostics.gaps[0].reasons).toContain('missing-basis-booking');
    expect(run({ a: [booking(), booking({ id: 'b2' })] }).diagnostics.gaps[0].reasons).toContain('ambiguous-basis-booking');
    expect(run({ a: [booking({ rawdata: {}, times: [] })] }).diagnostics.gaps[0].reasons).toEqual(expect.arrayContaining(['missing-booking-hours', 'missing-zeitkat']));
    expect(run({ a: [booking()] }, { regular: [{ zeitkatId: '06', monthlyAmount: 200, validUntil: '2026-02-28' }] }).diagnostics.gaps[0].reasons).toContain('missing-tariff');
    expect(run({ a: [booking()] }, { regular: [{ zeitkatId: '06', monthlyAmount: 0 }] }).diagnostics.complete).toBe(true);
    expect(run({ a: [booking({ rawdata: { ART: '0' } })] }).diagnostics.complete).toBe(true);
  });

  it('accepts a single applicable ZEITKAT tariff without requiring a full staircase', () => {
    const assignment = { a: [{ groupId: 'regular' }] };
    const options = { groupAssignmentsByItem: assignment, events: [] };
    const single = { id: 'only', zeitkatId: '06', monthlyAmount: 145, validFrom: '2026-03-01', validUntil: '2026-03-01' };
    const result = snapshot({ ...options, groupFeeCatalogs: { regular: [single] } });
    expect(result.diagnostics.complete).toBe(true);
    const finance = simulateContributionChanges({ demandBookings: result.demand, dataItems: result.effectiveDataItems,
      groupDefs: groups, groupFeeCatalogs: { regular: [single] }, referenceDate: base.monthDate, utilizationPercent: 0 });
    expect(finance.totals.monthlyParentFeesAfter).toBe(145);
    for (const tariff of [
      { ...single, enabled: false }, { ...single, validFrom: '2026-03-02' },
      { ...single, validUntil: '2026-02-28' }, { ...single, monthlyAmount: '' },
      { ...single, monthlyAmount: -1 }, { ...single, monthlyAmount: '   ' },
      { ...single, monthlyAmount: false }, { ...single, zeitkatId: '05' },
    ]) {
      const missing = snapshot({ ...options, groupFeeCatalogs: { regular: [tariff] } });
      expect(missing.demand).toEqual([]);
      expect(missing.diagnostics.gaps[0].reasons).toContain('missing-tariff');
    }
  });

  it('does not silently collapse conflicting booking allocations', () => {
    const result = snapshot({ groupAssignmentsByItem: { a: [{ groupId: 'regular' }] }, bookingsByItem: { a: [booking({ times: [{ day_name: 'Montag', segments: [{ booking_start: '08:00', booking_end: '14:00', groupAllocations: [{ groupId: 'regular2', share: 100 }] }] }] })] } });
    expect(result.diagnostics.gaps[0].reasons).toContain('ambiguous-booking-groups');
    const direct = snapshot({ groupAssignmentsByItem: { a: [{ groupId: 'regular' }] }, bookingsByItem: { a: [booking({ times: [{ day_name: 'Montag', segments: [{ booking_start: '08:00', booking_end: '14:00', groupId: 'nursery' }] }] })] } });
    expect(direct.diagnostics.gaps[0].reasons).toContain('ambiguous-booking-groups');
  });

  it('counts anonymous inflow without fabricating finance inputs and ignores it in known mode', () => {
    const inflow = [{ startdate: '2026-03-01', enddate: '2026-08-31' }];
    const result = snapshot({ dataItems: {}, inflow });
    expect(result.counts.projected).toBe(1);
    expect(result.demand).toEqual([]);
    expect(result.diagnostics.gaps[0]).toMatchObject({ inflowIndex: 0, reasons: expect.arrayContaining(['anonymous-inflow']) });
    expect(snapshot({ dataItems: {}, inflow, mode: 'known' }).counts.projected).toBe(0);
    expect(snapshot({ dataItems: {}, inflow, monthDate: '2026-09-01' }).counts.projected).toBe(0);
  });

  it('honors inclusion, admission, absence and validFrom without mutating inputs', () => {
    const items = {
      a: { ...base.dataItems.a, absences: [{ startdate: '2026-03-01', enddate: '2026-03-01' }] },
      archived: { id: 'archived', type: 'demand', archived: true },
      rejected: { id: 'rejected', type: 'demand', rawdata: { STATUS: '-' } },
      future: { id: 'future', type: 'demand', startdate: '2026-03-02' },
      notValid: { id: 'notValid', type: 'demand', validFrom: '2026-03-02' },
    };
    const input = { ...base, dataItems: items };
    const copy = structuredClone(input);
    const result = buildForecastFinanceMonth(input);
    expect(result.states.map((state) => state.itemId)).toEqual(['a']);
    expect(result.demand).toEqual([]);
    expect(result.diagnostics.gaps[0].reasons).toEqual(expect.arrayContaining([
      'unknown-group', 'Abrechnungsregel bei Abwesenheit ungeklärt',
    ]));
    expect(input).toEqual(copy);
  });

  it.each(['known', 'projected'])('retains the original monthly booking during absence in %s mode and flags unclear billing', (mode) => {
    const originalBooking = booking({ id: 'booking-id', enddate: '', rawdata: { ART: '0', ZEITKAT: '06', SCHULKIND: '0' } });
    const item = { ...base.dataItems.a, absences: [{ startdate: '2026-03-01', enddate: '2026-03-01' }] };
    const input = { ...base, mode, events: [], dataItems: { a: item },
      bookingsByItem: { a: { 'booking-key': originalBooking } }, groupAssignmentsByItem: { a: [{ groupId: 'regular' }] } };
    const copy = structuredClone(input);
    const result = buildForecastFinanceMonth(input);
    const expectedBooking = { ...originalBooking, itemId: 'a', groupId: 'regular' };
    expect(result.counts).toEqual({ known: 1, projected: 0, unknown: 0 });
    expect(result.states).toHaveLength(1);
    expect(result.demand).toEqual([expectedBooking]);
    expect(result.effectiveBookingsByItem).toEqual({ a: { 'booking-key': expectedBooking } });
    expect(result.effectiveDataItems).toEqual({ a: item });
    expect(result.effectiveGroupAssignmentsByItem).toEqual(input.groupAssignmentsByItem);
    expect(result.parentFeeSubsidyChildren).toEqual([{ itemId: 'a', item, groupId: 'regular', bookings: [expectedBooking], isSchoolChild: false }]);
    expect(result.diagnostics).toMatchObject({ complete: false, financialComplete: null,
      gaps: [{ itemId: 'a', reasons: ['Abrechnungsregel bei Abwesenheit ungeklärt'] }] });
    const finance = simulateContributionChanges({ demandBookings: result.demand, dataItems: result.effectiveDataItems,
      groupDefs: groups, groupFeeCatalogs: base.groupFeeCatalogs, referenceDate: base.monthDate, utilizationPercent: 0 });
    expect(finance.totals.monthlyParentFeesAfter).toBe(200);
    expect(input).toEqual(copy);
  });

  it('checks absence overlap over the whole calendar month, including open and invalid ranges', () => {
    const run = (absences, monthDate = '2026-03-01') => snapshot({ monthDate, events: [],
      dataItems: { a: { ...base.dataItems.a, absences } }, groupAssignmentsByItem: { a: [{ groupId: 'regular' }] } });
    const unclear = 'Abrechnungsregel bei Abwesenheit ungeklärt';
    for (const absence of [
      { startdate: '2026-03-15', enddate: '2026-03-15' },
      { startdate: '2026-03-31', enddate: '2026-04-01' },
      { startdate: '2026-02-28', enddate: '2026-03-01' },
      { startdate: '2026-02-01', enddate: '2026-04-30' },
      { startdate: '', enddate: '2026-03-15' },
      { startdate: '2026-03-15', enddate: '' },
      {}, null, { startdate: '2026-02-30', enddate: '2026-03-01' },
      { startdate: '2026-03-20', enddate: '2026-03-10' },
    ]) {
      const result = run([absence]);
      expect(result.demand).toHaveLength(1);
      expect(result.diagnostics.complete).toBe(false);
      expect(result.diagnostics.gaps[0].reasons).toContain(unclear);
    }
    for (const absence of [
      { startdate: '2026-02-01', enddate: '2026-02-28' },
      { startdate: '2026-04-01', enddate: '2026-04-30' },
    ]) expect(run([absence]).diagnostics).toMatchObject({ complete: true, gaps: [] });
    expect(run('invalid').diagnostics.gaps[0].reasons).toContain(unclear);
    const leapYear = snapshot({ monthDate: '2028-02-01', events: [],
      dataItems: { a: { ...base.dataItems.a, absences: [{ startdate: '2028-02-29', enddate: '2028-02-29' }] } },
      bookingsByItem: { a: [booking({ enddate: '' })] }, groupAssignmentsByItem: { a: [{ groupId: 'regular' }] } });
    expect(leapYear.demand).toHaveLength(1);
    expect(leapYear.diagnostics.gaps[0].reasons).toEqual([unclear]);
  });

  it.each(['known', 'projected'])('resolves UI, legacy and mixed absence dates consistently in %s mode', (mode) => {
    const run = (absence) => snapshot({ mode, events: [],
      dataItems: { a: { ...base.dataItems.a, absences: [absence] } },
      groupAssignmentsByItem: { a: [{ groupId: 'regular' }] } });
    const overlaps = [
      { start: '2026-03-01', end: '2026-03-01' },
      { start: '2026-03-31', end: '2026-04-01' },
      { start: '2026-02-28', end: '2026-03-01' },
      { start: '', end: '2026-03-15' },
      { start: '2026-03-15', end: '' },
      { start: '2026-03-15', enddate: '2026-03-15' },
      { startdate: '2026-03-15', end: '2026-03-15' },
      { start: '', startdate: '2030-01-01', end: '2026-03-01' },
      { start: '2026-03-01', end: '', enddate: '2020-01-01' },
    ];
    for (const absence of overlaps) {
      const result = run(absence);
      expect(result.demand).toEqual([{ ...base.bookingsByItem.a.b, itemId: 'a', groupId: 'regular' }]);
      expect(result.diagnostics).toMatchObject({ complete: false,
        gaps: [{ itemId: 'a', reasons: ['Abrechnungsregel bei Abwesenheit ungeklärt'] }] });
    }
    for (const absence of [
      { start: '2030-01-01', end: '2030-01-31' },
      { start: '2026-04-01', end: '' },
      { start: '', end: '2026-02-28' },
      { start: '2026-02-01', end: '2026-02-28' },
    ]) {
      const result = run(absence);
      expect(result.demand).toHaveLength(1);
      expect(result.diagnostics).toMatchObject({ complete: true, gaps: [] });
    }
    for (const absence of [
      { start: '2026-02-30', end: '2026-03-01' },
      { start: '2026-03-20', end: '2026-03-10' },
    ]) expect(run(absence).diagnostics.gaps[0].reasons).toContain('Abrechnungsregel bei Abwesenheit ungeklärt');
  });

  it('reports absence alongside booking gaps without including inactive children', () => {
    const absent = { startdate: '2026-03-01', enddate: '2026-03-01' };
    const result = snapshot({ events: [], dataItems: {
      a: { ...base.dataItems.a, absences: [absent] },
      active: { id: 'active', type: 'demand' },
      exited: { id: 'exited', type: 'demand', enddate: '2026-02-28', absences: [absent] },
      future: { id: 'future', type: 'demand', startdate: '2026-03-02', absences: [absent] },
    }, bookingsByItem: { active: [booking()] },
    groupAssignmentsByItem: { a: [{ groupId: 'regular' }], active: [{ groupId: 'regular' }] } });
    expect(result.states.map((state) => state.itemId)).toEqual(['a', 'active']);
    expect(result.demand.map((entry) => entry.itemId)).toEqual(['active']);
    expect(result.diagnostics.gaps).toEqual([expect.objectContaining({ itemId: 'a', reasons: expect.arrayContaining([
      'missing-basis-booking', 'Abrechnungsregel bei Abwesenheit ungeklärt',
    ]) })]);
  });

  it('preserves effective overlay records and their booking map keys in finance inputs', () => {
    const chain = [{ id: 'child' }, { id: 'root' }];
    const originalItem = { ...base.dataItems.a, name: 'Original', groupId: 'nursery' };
    const overlayItem = { ...originalItem, name: 'Overlay', familyId: 'overlay-family' };
    const originalBooking = booking({ id: 'internal-id', rawdata: { ART: '0', ZEITKAT: '06' } });
    const overlayBooking = booking({ id: 'internal-id', rawdata: { ART: '0', ZEITKAT: '05' }, enddate: '' });
    const overlays = { child: {
      dataItems: { a: overlayItem }, bookings: { a: { 'overlay-key': overlayBooking } },
      groupassignments: { a: { assignment: { id: 'assignment', groupId: 'regular' } } },
      groupDefs: [{ id: 'regular', name: 'Kindergarten Overlay', type: 'Regelgruppe' }],
    } };
    const items = getEffectiveDataItems(chain, overlays, { root: { a: originalItem } });
    const bookings = getEffectiveBookings(chain, overlays, { root: { a: { 'overlay-key': originalBooking } } }, 'a');
    const assignments = getEffectiveGroupAssignments(chain, overlays, { root: { a: { assignment: { id: 'assignment', groupId: 'nursery' } } } }, 'a');
    const effectiveGroups = getEffectiveGroupDefs(chain, overlays, { root: groups });
    const input = { ...base, events: [], dataItems: items, bookingsByItem: { a: bookings }, groupAssignmentsByItem: { a: assignments },
      groups: effectiveGroups, groupFeeCatalogs: { regular: [{ zeitkatId: '05', monthlyAmount: 135 }] } };
    const before = structuredClone(input);
    const result = buildForecastFinanceMonth(input);
    expect(result.diagnostics).toMatchObject({ complete: true, financialComplete: null });
    expect(result.effectiveDataItems.a).toEqual(overlayItem);
    expect(result.effectiveGroupAssignmentsByItem.a).toEqual(assignments);
    expect(Object.keys(result.effectiveBookingsByItem.a)).toEqual(['overlay-key']);
    expect(result.effectiveBookingsByItem.a['overlay-key']).toMatchObject({ ...overlayBooking, itemId: 'a', groupId: 'regular' });
    expect(result.parentFeeSubsidyChildren[0]).toMatchObject({ item: overlayItem, groupId: 'regular' });
    const finance = simulateContributionChanges({ demandBookings: result.demand, dataItems: result.effectiveDataItems,
      groupDefs: effectiveGroups, groupFeeCatalogs: input.groupFeeCatalogs, referenceDate: base.monthDate, utilizationPercent: 0 });
    expect(finance.totals.monthlyParentFeesAfter).toBe(135);
    expect(input).toEqual(before);
  });

  it('never marks a populated partial snapshot complete when other children or required inputs are missing', () => {
    const inputs = { ...base, events: [], groupAssignmentsByItem: { a: [{ groupId: 'regular' }], b: [{ groupId: 'regular' }] },
      dataItems: { a: base.dataItems.a, b: { id: 'b', type: 'demand' } }, bookingsByItem: { a: [booking()] } };
    const result = buildForecastFinanceMonth(inputs);
    expect(result.demand.map((entry) => entry.itemId)).toEqual(['a']);
    expect(result.diagnostics).toMatchObject({ complete: false, financialComplete: null });
    expect(result.diagnostics.gaps).toEqual(expect.arrayContaining([expect.objectContaining({ itemId: 'b', reasons: expect.arrayContaining(['missing-basis-booking']) })]));
    const partialFinance = simulateContributionChanges({ demandBookings: result.demand, dataItems: result.effectiveDataItems,
      groupDefs: groups, groupFeeCatalogs: base.groupFeeCatalogs, referenceDate: base.monthDate, utilizationPercent: 0 });
    expect(partialFinance.totals.monthlyParentFeesAfter).toBe(200);
    // The downstream simulation only sees the usable subset; its flag must not replace the adapter's flag.
    expect(partialFinance.diagnostics.feeCalculationComplete).toBe(true);
    const missingGroup = buildForecastFinanceMonth({ ...inputs, bookingsByItem: { a: [booking()], b: [booking()] }, groupAssignmentsByItem: { a: [{ groupId: 'regular' }], b: [] } });
    expect(missingGroup.diagnostics.complete).toBe(false);
    expect(missingGroup.diagnostics.gaps).toEqual(expect.arrayContaining([expect.objectContaining({ itemId: 'b', reasons: expect.arrayContaining(['unknown-group']) })]));
    const missingTariff = buildForecastFinanceMonth({ ...inputs, bookingsByItem: { a: [booking()], b: [booking()] }, groupAssignmentsByItem: { a: [{ groupId: 'regular' }], b: [{ groupId: 'regular2' }] } });
    expect(missingTariff.demand.map((entry) => entry.itemId)).toEqual(['a']);
    expect(missingTariff.diagnostics.complete).toBe(false);
    expect(missingTariff.diagnostics.gaps).toEqual(expect.arrayContaining([expect.objectContaining({ itemId: 'b', reasons: expect.arrayContaining(['missing-tariff']) })]));
    for (const field of ['dataItems', 'bookingsByItem', 'groupAssignmentsByItem', 'groups', 'events', 'groupFeeCatalogs']) {
      const incomplete = buildForecastFinanceMonth({ ...base, [field]: undefined });
      expect(incomplete.diagnostics.complete).toBe(false);
      expect(incomplete.diagnostics.gaps).toEqual(expect.arrayContaining([expect.objectContaining({ input: field, reasons: ['missing-or-invalid-input'] })]));
    }
    const empty = buildForecastFinanceMonth({ ...base, dataItems: {}, bookingsByItem: {}, groupAssignmentsByItem: {}, groupFeeCatalogs: {}, events: [], groups: [] });
    expect(empty.diagnostics).toMatchObject({ complete: true, financialComplete: null });
    const invalid = snapshot({ dataItems: { a: base.dataItems.a, invalid: null }, groupAssignmentsByItem: { a: null }, groups: [groups[0], null], events: [null] });
    expect(invalid.diagnostics.complete).toBe(false);
    expect(invalid.diagnostics.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: 'invalid', reasons: ['invalid-item'] }),
      expect.objectContaining({ input: 'groups', reasons: ['invalid-group'] }),
      expect.objectContaining({ input: 'events', reasons: ['invalid-event'] }),
      expect.objectContaining({ itemId: 'a', reasons: expect.arrayContaining(['invalid-group-assignments']) }),
    ]));
  });

  it('rejects invalid modes and invalid or non-first-of-month dates', () => {
    expect(() => snapshot({ mode: 'guess' })).toThrow();
    expect(() => snapshot({ monthDate: '2026-02-30' })).toThrow();
    expect(() => snapshot({ monthDate: '2026-03-02' })).toThrow();
    expect(() => snapshot({ referenceDate: '' })).toThrow();
  });
});
