import { describe, expect, it } from 'vitest';
import {
  allocateFillUpCandidates,
  getForecastGroupAssignments,
  getForecastGroupRank,
  getFutureGroupAssignmentDates,
  shouldProjectAutoTransition,
  buildForecastInflow,
  buildForecastModel,
  resolveForecastStage,
  nextForecastDay,
  forecastStageForGroup,
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

describe('forecast stages and snapshots', () => {
  const groups = [{ id: 'nursery', type: 'Krippe' }, { id: 'regular', type: 'Regelgruppe' }, { id: 'hort', type: 'Schulkindgruppe' }];
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const transition = (date, stage) => ({ type: 'auto_group_transition', effectiveDate: date, metadata: { targetStage: stage } });
  const resolve = (item, assignments, events, date) => resolveForecastStage({ item, assignments, events, groupsById, referenceDate: '2026-01-01', date });

  it('prefers unambiguous group names over imported types and leaves mixed stages unresolved', () => {
    expect(forecastStageForGroup({ name: 'Krippengruppe Bären', type: 'Regelgruppe' })).toBe('krippe');
    expect(forecastStageForGroup({ name: 'Hortgruppe Füchse', type: 'Regelgruppe' })).toBe('school');
    expect(forecastStageForGroup({ name: 'Vorschule', type: 'Schulkindgruppe' })).toBe('kita');
    expect(forecastStageForGroup({ name: 'Krippe / Kindergarten', type: 'Regelgruppe' })).toBe('unknown');
    expect(forecastStageForGroup({ name: 'Bären', type: 'Krippe / Regelgruppe' })).toBe('unknown');
    expect(forecastStageForGroup({ name: 'Bären', type: 'Regelgruppe' })).toBe('kita');
    expect(forecastStageForGroup({ name: 'Bären' })).toBe('unknown');
  });

  it('uses inclusive real assignments and exits before assumptions, including weekends', () => {
    const item = { id: 'a', startdate: '2026-01-01', enddate: '2026-08-28' };
    const assignments = [{ groupId: 'regular', start: '2026-01-01', end: '2026-08-28' }];
    const events = [transition('2026-08-28', 'school'), transition('2026-08-29', 'school')];
    expect(resolve(item, assignments, events, '2026-08-28')).toEqual({ stage: 'kita', source: 'known' });
    expect(resolve(item, assignments, events, '2026-08-29')).toEqual({ stage: 'exit', source: 'known' });
    expect(nextForecastDay('2026-08-28')).toBe('2026-08-29');
    expect(nextForecastDay('2026-02-30')).toBeNull();
  });

  it('only projects a stage, never assigns a real group or infers school care from enrollment', () => {
    const item = { id: 'a' };
    const events = [transition('2026-03-01', 'kita'), transition('2026-09-01', 'school')];
    const assignments = [{ groupId: 'nursery', start: '2025-01-01', end: '2026-02-28' }, { groupId: 'hort', start: '2026-10-01' }];
    expect(resolve(item, assignments, events, '2026-03-01')).toEqual({ stage: 'kita', source: 'projected' });
    expect(resolve(item, assignments, events, '2026-09-01')).toEqual({ stage: 'unknown', source: 'projected' });
    expect(resolve(item, assignments, events, '2026-10-01')).toEqual({ stage: 'school', source: 'known' });
    expect(resolve(item, [{ groupId: 'nursery' }], events, '2026-09-01')).toEqual({ stage: 'krippe', source: 'known' });
    expect(resolve(item, [{ groupId: 'nursery' }, { groupId: 'hort' }], events, '2026-09-01').stage).toBe('unknown');
    const multiple = [{ assignmentMode: 'multiple', timeSegments: [{ groupId: 'nursery', startTime: '08:00', endTime: '10:00' }, { groupId: 'hort', startTime: '10:00', endTime: '12:00' }] }];
    expect(resolve(item, multiple, events, '2026-09-01').stage).toBe('unknown');
  });

  it('includes future known admissions as separately labelled Sankey inflows', () => {
    const children = [{ id: 'a', startdate: '2025-01-01', enddate: '2026-08-28' }, { id: 'b', startdate: '2026-09-01' }];
    const assignmentsByChild = { a: [{ groupId: 'regular', start: '2025-01-01' }], b: [{ groupId: 'hort', start: '2026-09-01' }] };
    const model = buildForecastModel({ referenceDate: '2026-01-01', children, groups, assignmentsByChild });
    const series = (id) => model.groupTimeline.seriesByGroup.find((row) => row.groupId === id);
    const dateIndex = (date) => model.groupTimeline.dates.indexOf(date);
    expect(model.kpis.activeNowCount).toBe(1);
    expect(series('kita').data[dateIndex('2026-01-01')]).toBe(1);
    expect(series('kita').data[dateIndex('2026-08-29')]).toBe(0);
    expect(series('school').data[dateIndex('2026-09-01')]).toBe(1);
    const admission = model.links.find((link) => link.admission === 'known');
    expect(admission).toMatchObject({ weight: 1, known: 1, projected: 0, to: '2026-09-01__school', children: [{ id: 'b', name: 'Kind' }] });
    expect(model.nodes.find((node) => node.id === admission.from).name).toBe('Bekannte Aufnahme');
    expect(model.links.find((link) => link.to.endsWith('__exit')).known).toBe(1);
    expect(model.kpis.transitionCount).toBe(1);
  });

  it('splits known, projected and unresolved counts without double-counting simulated admissions', () => {
    const inflow = buildForecastInflow({ referenceDate: '2026-01-01', history: [{ startdate: '2025-01-01' }, { startdate: '2025-02-01' }], futureAdmissions: [{ startdate: '2027-05-01' }], years: 1 });
    expect(inflow).toEqual([{ startdate: '2027-09-01', enddate: '2030-08-31' }]);
    const children = [{ id: 'a' }, { id: 'b', startdate: '2027-05-01' }];
    const model = buildForecastModel({ referenceDate: '2026-01-01', children, groups, assignmentsByChild: { a: [{ groupId: 'nursery', end: '2026-12-31' }], b: [{ groupId: 'nursery', start: '2027-05-01' }] }, events: [{ ...transition('2027-01-01', 'kita'), entityId: 'a', entityType: 'demand' }], inflow });
    const i = model.groupTimeline.dates.indexOf('2027-09-01');
    const krippe = model.groupTimeline.seriesByGroup.find((row) => row.groupId === 'krippe');
    const kita = model.groupTimeline.seriesByGroup.find((row) => row.groupId === 'kita');
    expect(krippe.data[i]).toBe(2);
    expect(krippe.sourceData.known[i]).toBe(1);
    expect(krippe.sourceData.projected[i]).toBe(1);
    expect(kita.sourceData.projected[i]).toBe(1);
    expect(model.links.some((link) => link.admission === 'projected')).toBe(false);
    expect(model.nodes.some((node) => node.dateIso === '2027-09-01')).toBe(false);
  });

  it('balances all stage nodes across simultaneous admissions, transitions and exits', () => {
    const children = [
      { id: 'a', enddate: '2027-08-31' },
      { id: 'b', startdate: '2027-09-01', enddate: '2028-08-31' },
      { id: 'c', startdate: '2027-09-01' },
    ];
    const inflow = [{ startdate: '2027-09-01', enddate: '2028-08-31' }, { startdate: '2027-09-01', enddate: '2028-08-31' }];
    const model = buildForecastModel({ referenceDate: '2026-01-01', children, groups, inflow,
      assignmentsByChild: { a: [{ groupId: 'regular' }], b: [{ groupId: 'nursery', end: '2027-12-31' }], c: [{ groupId: 'nursery' }] },
      events: [{ ...transition('2028-01-01', 'school'), entityId: 'b', entityType: 'demand' }],
    });
    const { nodes, links, groupTimeline } = model;
    expect(links.filter((link) => link.admission).map((link) => [link.admission, link.weight])).toEqual([['known', 2]]);
    expect(links.find((link) => link.to === '2028-01-01__unknown')).toMatchObject({ projected: 1, known: 0 });
    expect(links.find((link) => link.from === '2028-01-01__krippe' && link.to === '2028-09-01__exit')).toBeUndefined();
    expect(model.kpis.transitionCount).toBe(3);
    expect(model.kpis.concentrationPct).toBeLessThanOrEqual(100);
    nodes.filter((node) => node.dateIso).forEach((node) => {
      const incoming = links.filter((link) => link.to === node.id).reduce((sum, link) => sum + link.weight, 0);
      const outgoing = links.filter((link) => link.from === node.id).reduce((sum, link) => sum + link.weight, 0);
      const dateIndex = groupTimeline.dates.indexOf(node.dateIso);
      if (dateIndex > 0 && node.groupId !== 'exit') {
        const series = groupTimeline.seriesByGroup.find((row) => row.groupId === node.groupId);
        expect(incoming).toBe(series.sourceData.known[dateIndex] + series.sourceData.unknown[dateIndex] + series.sourceData.projected[dateIndex] - (node.groupId === 'krippe' ? inflow.filter((entry) => entry.startdate <= node.dateIso && entry.enddate >= node.dateIso).length : 0));
      }
      if (node.groupId !== 'exit' && dateIndex < groupTimeline.dates.length - 1) expect(outgoing).toBe(dateIndex === 0 ? 1 : incoming);
      if (node.groupId === 'exit') expect(outgoing).toBe(0);
    });
    links.forEach((link) => {
      expect(link.known + link.projected + link.unknown).toBe(link.weight);
      expect(nodes.find((node) => node.id === link.from).column + 1).toBe(nodes.find((node) => node.id === link.to).column);
    });
  });

  it('shows an admission even when the reference-date cohort is empty', () => {
    const model = buildForecastModel({ referenceDate: '2026-01-01', children: [{ id: 'a', startdate: '2026-02-01' }], groups });
    expect(model.kpis.activeNowCount).toBe(0);
    expect(model.links).toHaveLength(1);
    expect(model.links[0]).toMatchObject({ admission: 'known', to: '2026-02-01__unknown', weight: 1, known: 0, unknown: 1 });
    expect(model.kpis.transitionCount).toBe(0);
  });

  it('tracks basis booking boundaries and authoritative weekly hours without adding Sankey columns', () => {
    const segment = (allocationSharePercent) => ({ day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '14:00', ...(allocationSharePercent == null ? {} : { allocationSharePercent }) }] });
    const children = [{ id: 'a', name: 'Anna', enddate: '2026-06-30' }];
    const bookingsByChild = { a: {
      first: { id: 'first', startdate: '2025-01-01', enddate: '2026-02-28', rawdata: { BETRSTD: '25,5' }, times: [segment()] },
      second: { id: 'second', startdate: '2026-03-01', enddate: '2026-04-30', times: [segment(50)], rawdata: { BETRSTD: '40' } },
      third: { id: 'third', startdate: '2026-05-01', times: [segment()] },
      alternative: { id: 'alternative', rawdata: { ART: 'A', BETRSTD: '50' } },
      explicitNonBasis: { id: 'nonbasis', buchungsart: { basis: false }, rawdata: { BETRSTD: '80' } },
    } };
    const events = [{ id: 'stored', type: 'booking_start', entityId: 'a', entityType: 'demand', relatedId: 'second', effectiveDate: '2026-03-01' }];
    const model = buildForecastModel({ referenceDate: '2026-01-01', children, groups, bookingsByChild, events,
      assignmentsByChild: { a: [{ groupId: 'nursery' }] },
      inflow: [{ startdate: '2026-03-01', enddate: '2026-06-30' }] });
    const { dates, seriesByGroup, timelinePoints } = model.groupTimeline;
    const krippe = seriesByGroup.find((row) => row.groupId === 'krippe');
    expect(dates).toEqual(['2026-01-01', '2026-03-01', '2026-05-01', '2026-07-01']);
    expect(krippe.data).toEqual([1, 2, 2, 0]);
    expect(krippe.hoursData).toEqual([25.5, 3, 6, 0]);
    expect(krippe.childrenByIndex[1]).toEqual([{ id: 'a', name: 'Anna' }]);
    const march = timelinePoints.find((point) => point.dateLabel === '01.03.26');
    expect(march.eventList.map((event) => event.type).sort()).toEqual(['booking_end', 'booking_start']);
    expect(model.nodes.some((node) => node.dateIso === '2026-05-01')).toBe(false);
    expect(model.kpis.transitionCount).toBe(1);
  });

  it('records separate booking-only starts and inclusive ends without inventing hours in gaps', () => {
    const model = buildForecastModel({ referenceDate: '2026-01-01', groups,
      children: [{ id: 'a', groupId: 'nursery' }],
      bookingsByChild: { a: [
        { id: 'first', enddate: '2026-02-28', rawdata: { BETRSTD: '15' } },
        { id: 'next', startdate: '2026-03-03', enddate: '2026-04-10', rawdata: { BETRSTD: '20' } },
      ] },
    });
    expect(model.groupTimeline.dates).toEqual(['2026-01-01', '2026-03-01', '2026-03-03', '2026-04-11']);
    expect(model.groupTimeline.seriesByGroup.find((row) => row.groupId === 'krippe').hoursData).toEqual([15, 0, 20, 0]);
    expect(model.groupTimeline.timelinePoints.map((point) => point.eventList[0].type)).toEqual(['booking_end', 'booking_start', 'booking_end']);
    expect(model.kpis.transitionCount).toBe(0);
  });

  it('omits booking boundaries outside the child attendance and keeps the last day inclusive', () => {
    const model = buildForecastModel({ referenceDate: '2026-01-01', groups,
      children: [{ id: 'a', startdate: '2026-02-01', enddate: '2026-03-31' }],
      assignmentsByChild: { a: [{ groupId: 'regular' }] },
      bookingsByChild: { a: [
        { id: 'a', startdate: '2026-01-01', enddate: '2026-02-28', rawdata: { BETRSTD: '12' } },
        { id: 'b', startdate: '2026-03-01', enddate: '2026-04-30', rawdata: { BETRSTD: '20' } },
      ] },
    });
    expect(model.groupTimeline.dates).toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']);
    expect(model.groupTimeline.seriesByGroup.find((row) => row.groupId === 'kita').hoursData).toEqual([0, 12, 20, 0]);
  });

  it('does not mark an assumed school transition as a known destination on admission', () => {
    const model = buildForecastModel({ referenceDate: '2026-01-01', children: [{ id: 'a', startdate: '2026-09-01' }], groups,
      events: [{ ...transition('2026-09-01', 'school'), entityId: 'a', entityType: 'demand' }] });
    expect(model.links[0]).toMatchObject({ admission: 'known', to: '2026-09-01__unknown', known: 0, projected: 1 });
  });
});
