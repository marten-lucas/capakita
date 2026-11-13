import { describe, expect, it } from 'vitest';
import { coverageGroupMetrics, coverageGroups, coverageHeatValue, coverageHoursModel, coverageWeeklyData } from './coverageModel';
import { collectCoverageQualifications, filterBookings } from '../utils/chartUtils/chartUtils';
import { generateBookingDataSeries, generateTimeSegments } from '../utils/chartUtils/chartUtilsWeekly';
import { buildHistogramDataFromBookings, generateSharedHistogramBins } from '../utils/chartUtils/chartUtilsHistogram';
import { calculateZeitkatDistribution } from '../utils/chartUtils/chartUtilsZeitkat';
import { createAppStore } from '../store/store';
import { setFilterGroups, setReferenceDate } from '../store/chartSlice';
import { selectWeeklyChartDataByGroup } from '../store/chartSelectors';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { buildResilienceStaff, compensateResilienceSlot, drawResilienceDay } from '../utils/resilienceModel';

const times = [{ day: 1, day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '09:00', category: 'pedagogical' }] }];
const input = {
  scenarioId: 's', referenceDate: '2026-01-05', overlaysByScenario: {}, selectedQualifications: [],
  dataByScenario: { s: {
    grouped: { type: 'demand', groupId: 'g' }, free: { type: 'demand' },
    expert: { type: 'capacity', groupId: 'g' }, other: { type: 'capacity' },
  } },
  bookingsByScenario: { s: Object.fromEntries(['grouped', 'free', 'expert', 'other'].map((id) => [id, { b: { id: 'b', times, rawdata: { ART: '0', ZEITKAT: '04' } } }])) },
  groupsByScenario: { s: {} },
  qualificationAssignmentsByScenario: { s: { expert: { q: { qualification: 'expert' } }, other: { q: { qualification: 'other' } } } },
};
const defs = [{ id: 'g', name: 'Gruppe G' }];
const filtered = (selectedGroups) => filterBookings({ ...input, selectedGroups });

describe('Bedarfsdarstellung', () => {
  it.each([[[]], [['g', '__NO_GROUP__']], [['__NO_GROUP__']], [['g']]])('nutzt dieselben Gruppen und Buchungen für Heatmap und gestapelte Kinderreihen: %j', (selection) => {
    const all = filtered(selection);
    const groups = coverageGroups(defs, selection, all.demand, all.capacity);
    const bins = generateSharedHistogramBins(all.demand, all.capacity);
    const rows = groups.map((group) => {
      const bookings = filtered([group.id]);
      return {
        demand: generateBookingDataSeries(input.referenceDate, bookings.demand, ['Mo 8:00'])[0],
        hours: buildHistogramDataFromBookings(bookings.demand, bookings.capacity, bins).demand.reduce((a, b) => a + b, 0),
        zones: calculateZeitkatDistribution(bookings.demand).total,
      };
    });
    expect(rows.reduce((sum, row) => sum + row.demand, 0)).toBe(all.demand.length);
    expect(rows.reduce((sum, row) => sum + row.hours, 0)).toBe(all.demand.length);
    expect(rows.reduce((sum, row) => sum + row.zones, 0)).toBe(calculateZeitkatDistribution(all.demand).total);
    expect(groups.map((group) => group.id)).toEqual(selection.length === 1 ? selection : ['g', '__NO_GROUP__']);
  });

  it('gibt auch im wöchentlichen Gruppenselektor die ausgewählte gruppenlose Reihe aus', () => {
    const store = createAppStore({ preloadedState: {
      simScenario: { scenarios: [{ id: 's' }], selectedScenarioId: 's', selectedItems: {} },
      simData: { dataByScenario: input.dataByScenario }, simBooking: { bookingsByScenario: input.bookingsByScenario },
      simGroup: { groupDefsByScenario: { s: defs }, groupsByScenario: input.groupsByScenario },
      simQualification: { qualificationDefsByScenario: { s: [] }, qualificationAssignmentsByScenario: input.qualificationAssignmentsByScenario },
    } });
    store.dispatch(setReferenceDate({ scenarioId: 's', date: input.referenceDate }));
    store.dispatch(setFilterGroups({ scenarioId: 's', groups: ['g', '__NO_GROUP__'] }));
    const rows = selectWeeklyChartDataByGroup(store.getState());
    expect(rows.map((row) => row.groupName)).toEqual(['Gruppe G', 'Keine Gruppe']);
    expect(rows.map((row) => row.chartData.demand[row.chartData.categories.indexOf('Mo 8:00')])).toEqual([1, 1]);
    store.dispatch(setFilterGroups({ scenarioId: 's', groups: [] }));
    expect(selectWeeklyChartDataByGroup(store.getState()).map((row) => row.groupId)).toEqual(['g', '__NO_GROUP__']);
    store.dispatch(setFilterGroups({ scenarioId: 's', groups: ['__NO_GROUP__'] }));
    expect(selectWeeklyChartDataByGroup(store.getState()).map((row) => row.groupId)).toEqual(['__NO_GROUP__']);
  });

  it('beachtet anteilige Personalzuordnung ohne Doppelzählung und Qualifikationsfilter', () => {
    const allocationInput = structuredClone(input);
    allocationInput.groupsByScenario.s.expert = { a: { assignmentMode: 'multiple', timeSegments: [{ groupId: 'g', startTime: '08:00', endTime: '08:30' }] } };
    allocationInput.selectedQualifications = ['expert'];
    const all = filterBookings({ ...allocationInput, selectedGroups: [] });
    const g = filterBookings({ ...allocationInput, selectedGroups: ['g'] });
    const free = filterBookings({ ...allocationInput, selectedGroups: ['__NO_GROUP__'] });
    const series = (bookings) => generateBookingDataSeries(input.referenceDate, bookings, ['Mo 8:00', 'Mo 8:30'], 'pedagogical');
    expect(series(g.capacity)).toEqual([1, 0]);
    expect(series(free.capacity)).toEqual([0, 1]);
    expect(series(all.capacity)).toEqual([1, 1]);
  });

  it('berücksichtigt zeitgleiche anteilige Gruppenzuordnungen nur mit ihrem Anteil', () => {
    const allocationInput = structuredClone(input);
    allocationInput.bookingsByScenario.s.expert.b.times[0].segments[0].groupAllocations = [{ groupId: 'g', share: 40 }, { groupId: 'h', share: 60 }];
    allocationInput.selectedQualifications = ['expert'];
    const series = (groups) => generateBookingDataSeries(input.referenceDate, filterBookings({ ...allocationInput, selectedGroups: groups }).capacity, ['Mo 8:00'], 'pedagogical')[0];
    expect(series(['g'])).toBe(0.4);
    expect(series(['h'])).toBe(0.6);
    expect(series([])).toBe(1);
  });

  it('verwendet am Stichtag gültige Qualifikationen für Gruppenfilter, Heatmap und Resilienz', () => {
    const fixture = structuredClone(input);
    fixture.qualificationAssignmentsByScenario.s.expert = {
      old: { qualification: 'old', end: '2026-01-04' },
      expert: { qualification: 'expert', start: '2026-01-06', end: '2026-01-07' },
      openStart: { qualification: 'openStart', enddate: '2026-01-05' },
      openEnd: { qualification: 'openEnd', validFrom: '2026-01-05' },
    };
    const defs = [{ key: 'expert', IsExpert: true }, { key: 'old', IsExpert: true }, { key: 'openStart', IsExpert: false }, { key: 'openEnd', IsExpert: false }];
    const select = (date, groups = ['g'], quals = []) => filterBookings({ ...fixture, referenceDate: date, selectedGroups: groups, selectedQualifications: quals });
    for (const [date, expectedKeys, ratio] of [
      ['2026-01-04', ['old', 'openStart'], 100],
      ['2026-01-05', ['openStart', 'openEnd'], 0],
      ['2026-01-06', ['expert', 'openEnd'], 100],
      ['2026-01-07', ['expert', 'openEnd'], 100],
      ['2026-01-08', ['openEnd'], 0],
    ]) {
      const result = select(date);
      expect(result.capacity[0].qualifications).toEqual(expectedKeys);
      expect(coverageGroupMetrics(['Mo 8:00'], result.demand, result.capacity, fixture.dataByScenario.s, [{ id: 'g' }], defs, date).expertRatio).toEqual([ratio]);
      expect(buildResilienceStaff(result.capacity, ['Mo 8:00'], defs)[0].expert).toBe(ratio === 100);
      expect(select(date, ['g'], ['expert']).capacity.length).toBe(expectedKeys.includes('expert') ? 1 : 0);
      expect(select(date, ['__NO_GROUP__'], ['expert']).capacity).toHaveLength(0);
    }
    fixture.qualificationAssignmentsByScenario.s.expert = { future: { qualification: 'expert', start: '2026-01-06' } };
    expect(select('2026-01-05', ['g'], ['__NO_QUALI__']).capacity).toHaveLength(1);
    expect(select('2026-01-06', ['g'], ['__NO_QUALI__']).capacity).toHaveLength(0);
  });

  it('wertet effektive Qualifikationsoverlays zeitlich aus', () => {
    const state = {
      simScenario: { scenarios: [{ id: 's' }] }, simOverlay: { overlaysByScenario: { s: { qualificationDefs: [{ id: 'q', dataItemId: 'expert', qualification: 'expert', start: '2026-01-06', end: '2026-01-07' }] } } },
      simData: { dataByScenario: input.dataByScenario }, simBooking: { bookingsByScenario: input.bookingsByScenario },
      simGroup: { groupsByScenario: input.groupsByScenario, groupDefsByScenario: { s: [] } },
      simQualification: { qualificationAssignmentsByScenario: { s: {} }, qualificationDefsByScenario: { s: [{ key: 'expert', IsExpert: true }] } },
    };
    const overlay = buildOverlayAwareData('s', state);
    const select = (date) => filterBookings({ ...input, referenceDate: date, selectedGroups: ['g'], selectedQualifications: ['expert'], qualificationAssignmentsByScenario: { s: overlay.effectiveQualificationAssignmentsByItem } });
    expect(select('2026-01-05').capacity).toHaveLength(0);
    expect(select('2026-01-06').capacity[0].qualifications).toEqual(['expert']);
    expect(select('2026-01-08').capacity).toHaveLength(0);
    const direct = (date) => filterBookings({ ...input, referenceDate: date, selectedGroups: ['g'], selectedQualifications: ['expert'], qualificationAssignmentsByScenario: { s: {} }, overlaysByScenario: state.simOverlay.overlaysByScenario });
    expect(direct('2026-01-05').capacity).toHaveLength(0);
    expect(direct('2026-01-06').capacity[0].qualifications).toEqual(['expert']);
    expect(direct('2026-01-08').capacity).toHaveLength(0);
  });

  it('bewahrt in Heatmap und Resilienz getrennte Zeitintervalle derselben Qualifikation entlang der Overlay-Kette', () => {
    const scenarios = [{ id: 's' }, { id: 'child', baseScenarioId: 's' }];
    const assignments = { s: { expert: { old: { id: 'old', qualification: 'expert', start: '2026-01-01', end: '2026-01-05' } } } };
    const overlays = { child: { qualificationDefs: [{ id: 'new', dataItemId: 'expert', qualification: 'expert', start: '2026-01-07', end: '2026-01-09' }] } };
    const records = collectCoverageQualifications(['expert'], [...scenarios].reverse(), overlays, assignments);
    const select = (date) => filterBookings({ ...input, referenceDate: date, selectedGroups: ['g'], selectedQualifications: [], qualificationAssignmentsByScenario: { s: records } });
    for (const [date, expert] of [['2026-01-05', true], ['2026-01-06', false], ['2026-01-07', true], ['2026-01-10', false]]) {
      const result = select(date);
      const definitions = [{ key: 'expert', IsExpert: true }];
      expect(coverageGroupMetrics(['Mo 8:00'], result.demand, result.capacity, input.dataByScenario.s, defs, definitions, date).expertRatio).toEqual([expert ? 100 : 0]);
      expect(buildResilienceStaff(result.capacity, ['Mo 8:00'], definitions)[0].expert).toBe(expert);
      expect(filterBookings({ ...input, referenceDate: date, selectedGroups: ['g'], selectedQualifications: ['expert'], qualificationAssignmentsByScenario: { s: records } }).capacity).toHaveLength(expert ? 1 : 0);
    }
    overlays.child.qualificationDefs.push({ id: 'old', dataItemId: 'expert', qualification: 'other', start: '2026-01-01', end: '2026-01-05' });
    const overridden = collectCoverageQualifications(['expert'], [...scenarios].reverse(), overlays, assignments);
    expect(Object.values(overridden.expert).find((record) => record.id === 'old').qualification).toBe('other');
  });

  it('sperrt in der Resilienz auch separat gebuchte Verwaltung und Arbeit außerhalb des Gruppenfilters', () => {
    const fixture = structuredClone(input);
    fixture.bookingsByScenario.s.expert.b.times[0].segments[0].booking_end = '08:30';
    fixture.bookingsByScenario.s.expert.admin = { startdate: '2026-01-01', enddate: '2026-01-31', times: [{ day: 1, day_name: 'Mo', segments: [{ booking_start: '08:30', booking_end: '09:00', category: 'administrative', groupAllocations: [{ groupId: 'h', share: 100 }] }] }] };
    const selection = { ...fixture, selectedGroups: ['g'], selectedQualifications: ['expert'] };
    const selected = filterBookings(selection).capacity;
    const work = filterBookings({ ...selection, selectedGroups: [], includeAllCapacityWork: true }).capacity;
    expect(selected).toHaveLength(1);
    expect(work).toHaveLength(2);
    const people = buildResilienceStaff(selected, ['Mo 8:00', 'Mo 8:30'], [{ key: 'expert', IsExpert: true }], work);
    expect(people[0].slots).toEqual([{ g: 1 }, {}]);
    expect(people[0].busySlots).toEqual([true, true]);
    const day = drawResilienceDay(people, 0, 2, 0, 1, 0, 0, 0, () => 0.5);
    const slot = compensateResilienceSlot({ people: day.scheduled, absent: day.absent, slotIndex: 1, groupDemand: { g: 2 }, groupMinimums: { g: 1 }, demand: 2, maxCareRatio: 8, minExpertRatioPct: 0, overtimeRemaining: { expert: 2 } });
    expect(slot).toMatchObject({ staff: 0, used: 0, overtimeRemaining: { expert: 2 } });
    fixture.bookingsByScenario.s.expert.admin.times[0].segments[0].category = 'pedagogical';
    const otherGroupWork = filterBookings({ ...selection, selectedGroups: [], includeAllCapacityWork: true }).capacity;
    const otherGroupStaff = buildResilienceStaff(selected, ['Mo 8:00', 'Mo 8:30'], [{ key: 'expert', IsExpert: true }], otherGroupWork);
    expect(otherGroupStaff[0].busySlots[1]).toBe(true);
    expect(compensateResilienceSlot({ people: otherGroupStaff, absent: new Set(), slotIndex: 1, groupDemand: { g: 2 }, groupMinimums: { g: 1 }, demand: 2, maxCareRatio: 8, minExpertRatioPct: 0, overtimeRemaining: { expert: 2 } }).used).toBe(0);
    fixture.bookingsByScenario.s.expert.admin.enddate = '2026-01-04';
    const expiredWork = filterBookings({ ...selection, selectedGroups: [], includeAllCapacityWork: true }).capacity;
    expect(buildResilienceStaff(selected, ['Mo 8:00', 'Mo 8:30'], [], expiredWork)[0].busySlots[1]).toBe(false);
  });

  it('unterscheidet Gruppenquoten und lässt Quotienten ohne pädagogische Kraft undefiniert', () => {
    const qualifications = [{ key: 'expert', IsExpert: true }, { key: 'other', IsExpert: false }];
    const metrics = (group) => {
      const bookings = filtered([group]);
      return coverageGroupMetrics(['Mo 8:00'], bookings.demand, bookings.capacity, input.dataByScenario.s, defs, qualifications, input.referenceDate);
    };
    expect(metrics('g').expertRatio).toEqual([100]);
    expect(metrics('__NO_GROUP__').expertRatio).toEqual([0]);
    expect(metrics('g').demand).toEqual([1]);
    expect(metrics('__NO_GROUP__').pedagogical).toEqual([1]);
    expect(coverageHeatValue('unweightedQuotient', 5, 0, 0)).toBeNull();
    expect(coverageHeatValue('careKey', 0, 0, 0)).toBeNull();
    expect(coverageHeatValue('presentStaff', 5, 0, null)).toBe(0);
    expect(coverageHeatValue('unweightedQuotient', 5, 2, 3)).toBe(2.5);
  });

  it('grenzt nur die intervallbasierte Analyse samt Reihen und Achsenmaxima auf 7 bis 17 Uhr ein', () => {
    const categories = generateTimeSegments();
    const source = Object.fromEntries(['demand', 'capacity', 'capacity_pedagogical', 'capacity_administrative', 'care_ratio', 'expert_ratio'].map((key) => [key, categories.map((category, index) => category.endsWith('17:00') ? 1000 : index)]));
    const weekly = { categories, ...source, maxdemand: 1000, maxcapacity: 1000, max_care_ratio: 1000, maxexpert_ratio: 1000 };
    const result = coverageWeeklyData(weekly);
    expect(result.categories).toHaveLength(100);
    expect(result.categories[19]).toBe('Mo 16:30');
    expect(result.categories[20]).toBe('Di 7:00');
    expect(result.categories[99]).toBe('Fr 16:30');
    for (const key of Object.keys(source)) {
      expect(result[key]).toHaveLength(100);
      expect(result[key][19]).toBe(19);
      expect(result[key][20]).toBe(21);
      expect(result[key][99]).toBe(103);
    }
    expect([result.maxdemand, result.maxcapacity, result.max_care_ratio, result.maxexpert_ratio]).toEqual([103, 103, 103, 103]);
    expect(weekly.categories).toHaveLength(105);
    expect(weekly.demand[20]).toBe(1000);
  });

  it('berechnet Randzeiten und anteilige Zuordnungen mit denselben Startzeit-Slots für FTE und Heatmap', () => {
    const categories = generateTimeSegments();
    const makeBooking = (start, end, share) => ({ times: [{ day_name: 'Mo', segments: [{ booking_start: start, booking_end: end, category: 'pedagogical', ...(share == null ? {} : { allocationSharePercent: share }) }] }] });
    const bookings = [makeBooking('06:30', '07:00'), makeBooking('16:30', '17:00'), makeBooking('17:00', '18:00'), makeBooking('08:00', '08:30', 40), makeBooking('08:00', '08:30', 60)];
    const sampled = generateBookingDataSeries(input.referenceDate, bookings, categories);
    expect(sampled[categories.indexOf('Mo 7:00')]).toBe(0);
    expect(sampled[categories.indexOf('Mo 8:00')]).toBe(1);
    expect(sampled[categories.indexOf('Mo 16:30')]).toBe(1);
    expect(sampled[categories.indexOf('Mo 17:00')]).toBe(1);
    const weekly = coverageWeeklyData({ categories, demand: sampled, capacity: sampled, capacity_pedagogical: sampled });
    const metrics = coverageGroupMetrics(weekly.categories, bookings, bookings, {}, [], [], input.referenceDate);
    expect(metrics.demand).toEqual(weekly.demand);
    expect(metrics.pedagogical).toEqual(weekly.capacity_pedagogical);
    expect(coverageHoursModel(weekly.demand, weekly.capacity_pedagogical, 2)).toEqual({ weeklyChildHours: 1, weeklyStaffHours: 1, monthlyStaffFte: 4.33 / 160, monthlyModelFte: 0.5 * 4.33 / 160 });
    const staff = buildResilienceStaff([{ ...bookings[2], itemId: 'late' }], weekly.categories, []);
    expect(staff[0].slots.every((slot) => Object.keys(slot).length === 0)).toBe(true);
  });

  it('zählt bei durchgehender Belegung über die ganze Woche genau 50 Stunden', () => {
    const categories = generateTimeSegments();
    const booking = { times: ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((day_name) => ({ day_name, segments: [{ booking_start: '06:30', booking_end: '18:00' }] })) };
    const sampled = generateBookingDataSeries(input.referenceDate, [booking], categories);
    const weekly = coverageWeeklyData({ categories, demand: sampled, capacity_pedagogical: sampled });
    expect(sampled.reduce((a, b) => a + b, 0)).toBe(105);
    expect(coverageHoursModel(weekly.demand, weekly.capacity_pedagogical, 5)).toEqual({ weeklyChildHours: 50, weeklyStaffHours: 50, monthlyStaffFte: 50 * 4.33 / 160, monthlyModelFte: 10 * 4.33 / 160 });
  });

  it('bewertet bei geteilten Zeit-Slots den Stand zu Beginn, nicht die Überlappungsdauer', () => {
    const bookings = [{ times: [{ day_name: 'Mo', segments: [
      { booking_start: '07:00', booking_end: '07:15' },
      { booking_start: '07:15', booking_end: '07:30' },
    ] }] }];
    const series = generateBookingDataSeries(input.referenceDate, bookings, ['Mo 7:00', 'Mo 7:30']);
    expect(series).toEqual([1, 0]);
    expect(coverageHoursModel(series, [], 2).weeklyChildHours).toBe(0.5);
    expect(generateBookingDataSeries(input.referenceDate, [bookings[0]], ['Mo 7:00'])).toEqual([1]);
    expect(generateBookingDataSeries(input.referenceDate, [{ times: [{ day_name: 'Mo', segments: [{ booking_start: '07:15', booking_end: '07:30' }] }] }], ['Mo 7:00'])).toEqual([0]);
  });

  it('errechnet ohne positive explizite Modellannahme keinen Personalbedarf', () => {
    for (const key of ['', 0, -1, null, '5']) expect(coverageHoursModel([10, 10], [2, 2], key).monthlyModelFte).toBeNull();
    expect(coverageHoursModel([10, 10], [2, 2], 5)).toEqual({ weeklyChildHours: 10, weeklyStaffHours: 2, monthlyStaffFte: 2 * 4.33 / 160, monthlyModelFte: 2 * 4.33 / 160 });
  });
});
