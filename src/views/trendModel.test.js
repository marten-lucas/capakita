import { describe, expect, it } from 'vitest';
import { buildTrendHistory } from './trendModel';

const times = [{ day: 1, day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '10:00', category: 'pedagogical' }] }];
function fixture() {
  return {
    simScenario: { scenarios: [{ id: 'base' }, { id: 'middle', baseScenarioId: 'base' }, { id: 'child', baseScenarioId: 'middle' }] },
    simOverlay: { overlaysByScenario: { child: {
      dataItems: { c2: { id: 'c2', name: 'Geheim Kind', type: 'demand', startdate: '2024-01-01', enddate: '2024-02-15', dateofbirth: '2020-01-01' } },
      bookings: { c1: { b: { startdate: '2024-01-01', times, rawdata: { BETRSTD: '3' } } } },
    } } },
    simData: { dataByScenario: { base: {
      c1: { id: 'c1', name: 'Privat Kind', type: 'demand', startdate: '2024-01-01', dateofbirth: '2021-01-01' },
      c2: { id: 'c2', type: 'demand', startdate: '2024-01-01' },
      staff: { id: 'staff', name: 'Privat Personal', type: 'capacity', startdate: '2024-01-01' },
      archived: { id: 'archived', type: 'demand', startdate: '2024-01-01', archived: true },
      excluded: { id: 'excluded', type: 'demand', startdate: '2024-01-01', rawdata: { STATUS: '-' } },
    } } },
    simBooking: { bookingsByScenario: { base: { c1: { b: { times } }, c2: { b: { times } }, staff: { b: { times } } } } },
    simGroup: { groupDefsByScenario: { base: [{ id: 'a', name: 'Krippe' }, { id: 'b', name: 'Regelgruppe' }] }, groupsByScenario: { base: {
      c1: { one: { groupId: 'a', start: '2024-01-01', end: '2024-02-14' }, two: { groupId: 'b', start: '2024-02-15' } },
      c2: { one: { groupId: 'b', start: '2024-01-01' } },
      staff: { one: { groupId: 'a', start: '2024-01-01', end: '2024-02-14' }, two: { groupId: 'b', start: '2024-02-15' } },
    } } },
    simQualification: { qualificationDefsByScenario: {}, qualificationAssignmentsByScenario: { base: { staff: {
      q1: { qualification: 'expert', start: '2024-01-01', end: '2024-02-14' },
      q2: { qualification: 'other', start: '2024-02-15' },
    } } } },
  };
}
const run = (state, groups = [], qualifications = [], date = '2024-03-15') => buildTrendHistory(state, { scenarioId: 'child', asOfDate: date, selectedGroups: groups, selectedQualifications: qualifications });

describe('Trend-Radar Historie', () => {
  it('nutzt Vererbung und Overlays für alle Monatsreihen und zählt zum Monatsende bzw. Stichtag', () => {
    const result = run(fixture());
    expect(result.evaluationDates).toEqual(['2024-01-31', '2024-02-29', '2024-03-15']);
    expect(result.children).toEqual([2, 1, 1]);
    expect(result.employees).toEqual([1, 1, 1]);
    expect(result.bookingHours).toEqual([5, 3, 3]);
    expect(result.workingHours).toEqual([2, 2, 2]);
    expect(result.groupChildrenSeries.map(({ name, data }) => [name, data])).toEqual([['Krippe', [1, 0, 0]], ['Regelgruppe', [1, 1, 1]]]);
    expect(result.entries.at(-1)).toBe(2);
  });
  it('wendet Gruppen am historischen Datum und Qualifikationen zeitabhängig nur auf Personal an', () => {
    const state = fixture();
    const a = run(state, ['a'], ['expert']);
    const b = run(state, ['b'], ['expert']);
    expect(a.children).toEqual([1, 0, 0]);
    expect(b.children).toEqual([1, 1, 1]);
    expect(a.employees).toEqual([1, 0, 0]);
    expect(b.employees).toEqual([0, 0, 0]);
    expect(a.workingHours).toEqual([2, 0, 0]);
    expect(a.entries.at(-1)).toBe(1);
    expect(b.entries.at(-1)).toBe(1);
    expect(run(state, ['b'], ['other']).employees).toEqual([0, 1, 1]);
    expect(run(state, [], ['__NO_QUALI__']).employees).toEqual([0, 0, 0]);
    expect(run(state).children).toEqual([2, 1, 1]);
  });
  it('übernimmt Gruppen- und Qualifikationsoverlays entlang der Vererbungskette', () => {
    const state = fixture();
    state.simOverlay.overlaysByScenario.middle = { groupassignments: { c1: { one: { groupId: 'b', start: '2024-01-01', end: '2024-02-14' } } }, qualificationDefs: [{ id: 'q1', dataItemId: 'staff', qualification: 'other', start: '2024-01-01', end: '2024-02-14' }] };
    expect(run(state, ['a'], ['expert']).children[0]).toBe(0);
    expect(run(state, ['b']).children[0]).toBe(2);
    expect(run(state, ['a'], ['expert']).employees[0]).toBe(0);
    expect(run(state, ['a'], ['other']).employees[0]).toBe(1);
  });
  it('behält anonyme zeitliche Qualifikationsoverlays verschiedener Szenarien getrennt', () => {
    const state = fixture();
    state.simQualification.qualificationAssignmentsByScenario.base.staff = {};
    state.simOverlay.overlaysByScenario.middle = { qualificationDefs: [{ dataItemId: 'staff', qualification: 'expert', start: '2024-01-01', end: '2024-02-14' }] };
    state.simOverlay.overlaysByScenario.child.qualificationDefs = [{ dataItemId: 'staff', qualification: 'other', start: '2024-02-15' }];
    expect(run(state, [], ['expert']).employees).toEqual([1, 0, 0]);
    expect(run(state, [], ['other']).employees).toEqual([0, 1, 1]);
    expect(run(state, [], ['expert']).workingHours).toEqual([2, 0, 0]);
    expect(run(state, [], ['other']).workingHours).toEqual([0, 2, 2]);
  });
  it('wertet Übergänge einrichtungsweit aus, aber mit effektiven Gruppenzuordnungen', () => {
    const state = fixture();
    const all = run(state);
    const filtered = run(state, ['a'], ['expert']);
    expect(all.regelEntryAgeYears.at(-1)).not.toBeNull();
    expect(filtered.regelEntryAgeYears).toEqual(all.regelEntryAgeYears);
    expect(filtered.corridorRemainPct).toEqual(all.corridorRemainPct);
    state.simOverlay.overlaysByScenario.child.groupassignments = { c1: { two: { groupId: 'a', start: '2024-02-15' } } };
    expect(run(state, ['a'], ['expert']).regelEntryAgeYears.at(-1)).toBeNull();
  });
  it('erfindet bei Lücken in einer Gruppenhistorie keine Zuordnung aus der aktuellen Gruppe', () => {
    const state = fixture();
    state.simData.dataByScenario.base.c1.groupId = 'b';
    state.simGroup.groupsByScenario.base.c1.one.end = '2024-01-15';
    state.simGroup.groupsByScenario.base.c1.two.start = '2024-02-15';
    expect(run(state, ['__NO_GROUP__']).children[0]).toBe(1);
    expect(run(state, ['b']).children[0]).toBe(1);
  });
  it('zählt den letzten Betreuungstag und ignoriert spätere Eintritte', () => {
    const state = fixture();
    expect(run(state, ['b'], [], '2024-02-15').children.at(-1)).toBe(2);
    expect(run(state, ['b'], [], '2024-02-16').children.at(-1)).toBe(1);
    state.simData.dataByScenario.base.c1.startdate = '2024-12-01';
    expect(run(state, [], [], '2024-03-15').entries.at(-1)).toBe(1);
  });
  it('begrenzt Jahresübergänge auf den Stichtag und behandelt fehlende Werte nicht als Null', () => {
    const state = fixture();
    state.simGroup.groupsByScenario.base.c1.two.start = '2024-09-01';
    const before = run(state, [], [], '2024-03-15');
    expect(before.regelEntryAgeYears.at(-1)).toBeNull();
    expect(before.corridorRemainPct.at(-1)).toBeNull();
    const after = run(state, [], [], '2024-12-31');
    expect(after.regelEntryAgeYears.at(-1)).not.toBeNull();
    delete state.simData.dataByScenario.base.c1.dateofbirth;
    delete state.simOverlay.overlaysByScenario.child.dataItems.c2.dateofbirth;
    expect(run(state).entryAgeYears.at(-1)).toBeNull();
    expect(run(state).entries[0]).toBeNull();
    delete state.simBooking.bookingsByScenario.base.staff;
    expect(run(state).workingHours.at(-1)).toBe(0);
    state.simData.dataByScenario.base = {};
    state.simOverlay.overlaysByScenario = {};
    expect(run(state).categories).toEqual([]);
    expect(run(state).kpis.avgChildren).toBeUndefined();
  });
  it('gibt keine Personen-IDs oder Namen in aggregierten Ergebnissen aus', () => {
    const result = JSON.stringify(run(fixture()));
    expect(result).not.toMatch(/Privat|Geheim|c1|c2|staff/);
  });
  it('anteilige Personalstunden werden nicht doppelt gezählt', () => {
    const state = fixture();
    state.simBooking.bookingsByScenario.base.staff.b.times = [{ day: 1, day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '10:00', category: 'pedagogical', groupAllocations: [{ groupId: 'a', share: 25 }, { groupId: 'b', share: 75 }] }] }];
    expect(run(state, ['a']).workingHours[0]).toBe(0.5);
    expect(run(state, ['b']).workingHours[0]).toBe(1.5);
    expect(run(state).workingHours[0]).toBe(2);
    expect(run(state, ['a', 'b']).employees[0]).toBe(1);
  });
});
