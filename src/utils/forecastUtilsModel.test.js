import { describe, expect, it } from 'vitest';
import { buildForecastFillUp, buildForecastModel, forecastStageForGroup, limitForecastInflow, resolveForecastStage } from './forecastUtilsModel';

describe('facility fill-up decisions', () => {
  const groups = [{ id: 'regular', type: 'Regelgruppe' }, { id: 'hort', type: 'Schulkindgruppe', fillUp: true, maxFacilityCount: 4 }];
  const school = (id, date = '2026-09-01') => ({ entityType: 'demand', entityId: id, type: 'auto_group_transition', effectiveDate: date, metadata: { targetStage: 'school' } });
  const children = [{ id: 'a' }, { id: 'b' }, { id: 'leaves', enddate: '2026-08-31' }, { id: 'known', startdate: '2026-09-01' }, { id: 'stays' }];
  const assignmentsByChild = { known: [{ groupId: 'hort', start: '2026-09-01' }], stays: [{ groupId: 'regular' }] };
  const input = { referenceDate: '2026-01-01', children, groups, assignmentsByChild, events: [school('a'), school('b'), school('leaves'), school('known')] };

  it('prioritizes known admissions, assignments and inclusive end dates and does not infer exits for rejected demand', () => {
    const result = buildForecastFillUp(input);
    expect(result).toMatchObject({ capacity: 4, issues: [] });
    expect(result.decisions).toEqual([
      expect.objectContaining({ childId: 'a', date: '2026-09-01', status: 'accepted', occupied: 4, groupId: 'hort' }),
      expect.objectContaining({ childId: 'b', date: '2026-09-01', status: 'accepted', occupied: 4 }),
    ]);
    const model = buildForecastModel({ ...input, inflow: [{ startdate: '2026-09-01' }] });
    expect(model.fillUp).toEqual(result);
    expect(model.links.filter((link) => link.to === '2026-09-01__school').flatMap((link) => link.children.map((child) => child.id))).toEqual(['a', 'b', 'known']);
    expect(model.links.find((link) => link.to === '2026-09-01__exit').children.map((child) => child.id)).toEqual(['leaves']);
    expect(model.links.some((link) => link.admission === 'projected')).toBe(false);
    expect(model.groupTimeline.seriesByGroup.find((series) => series.groupId === 'krippe')).toBeUndefined();
  });

  it('does not free space by pretending rejected children have left', () => {
    const result = buildForecastFillUp({ ...input, groups: [groups[0], { ...groups[1], maxFacilityCount: 3 }] });
    expect(result.decisions).toHaveLength(2);
    expect(result.decisions.every((decision) => decision.status === 'rejected' && decision.occupied === 4)).toBe(true);
    const sameDay = buildForecastFillUp({ ...input, children: children.map((child) => child.id === 'leaves' ? { ...child, enddate: '2026-09-01' } : child) });
    expect(sameDay.decisions.every((decision) => decision.status === 'rejected')).toBe(true);
  });

  it('honors zero capacity, later explicit assignments and end dates', () => {
    const zero = buildForecastFillUp({ ...input, groups: [groups[0], { ...groups[1], maxFacilityCount: 0 }] });
    expect(zero.decisions.every((decision) => decision.status === 'rejected')).toBe(true);
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const result = buildForecastFillUp(input);
    const resolve = (date, item, assignments) => resolveForecastStage({ item, assignments, events: [school('a')], groupsById,
      referenceDate: input.referenceDate, date, fillUpDecisions: result.decisions });
    expect(resolve('2026-09-01', { id: 'a' }, [])).toEqual({ stage: 'school', source: 'projected' });
    expect(resolve('2026-10-01', { id: 'a' }, [{ groupId: 'regular', start: '2026-10-01' }])).toEqual({ stage: 'kita', source: 'known' });
    expect(resolve('2026-10-01', { id: 'a', enddate: '2026-09-30' }, [])).toEqual({ stage: 'exit', source: 'known' });
  });

  it('does not silently assume a capacity or choose between multiple school groups', () => {
    expect(buildForecastFillUp({ ...input, groups: [{ ...groups[1], maxFacilityCount: '' }] }).issues).toHaveLength(1);
    expect(buildForecastFillUp({ ...input, groups: [groups[1], { ...groups[1], id: 'other' }] }).issues).toHaveLength(1);
  });
});

describe('anonymous inflow capacity', () => {
  it('reserves known future admissions and existing estimates for the full stay', () => {
    const children = [{ id: 'known', startdate: '2027-01-01', enddate: '2027-12-31' }];
    const inflow = [
      { startdate: '2026-09-01', enddate: '2027-08-31' },
      { startdate: '2026-09-01', enddate: '2027-08-31' },
      { startdate: '2028-01-01', enddate: '2028-12-31' },
    ];
    expect(limitForecastInflow({ inflow, children, capacity: 2 })).toEqual([inflow[0], inflow[2]]);
    expect(limitForecastInflow({ inflow, children })).toEqual(inflow);
    expect(limitForecastInflow({ inflow, children, capacity: 0 })).toEqual([]);
  });
});

describe('forecast group stages', () => {
  it('uses earlier enabled transitions at the reference date without treating past school care as known', () => {
    const item = { id: 'a' };
    const events = [{ entityType: 'demand', entityId: 'a', type: 'auto_group_transition', effectiveDate: '2025-09-01', metadata: { targetStage: 'kita' } }];
    const options = { referenceDate: '2026-01-01', children: [item], events };
    expect(buildForecastModel(options).groupTimeline.seriesByGroup.find((series) => series.groupId === 'kita').sourceData.projected).toEqual([1]);
    events[0].metadata.targetStage = 'school';
    expect(buildForecastModel(options).groupTimeline.seriesByGroup.find((series) => series.groupId === 'unknown').data).toEqual([1]);
  });
  it.each(['krippe', 'kita', 'school', 'unknown'])('prefers explicit %s over name and type', (stage) => {
    expect(forecastStageForGroup({ name: 'Krippe', type: 'Regelgruppe', forecastStage: stage })).toBe(stage);
  });

  it('retains legacy automatic inference but treats mixed and invalid groups conservatively', () => {
    expect(forecastStageForGroup({ name: 'Hort Füchse', type: 'Regelgruppe' })).toBe('school');
    expect(forecastStageForGroup({ name: 'Bären', type: 'Krippe', forecastStage: 'auto' })).toBe('krippe');
    expect(forecastStageForGroup({ name: 'Mischgruppe Krippe', type: 'Regelgruppe' })).toBe('unknown');
    expect(forecastStageForGroup({ name: 'Altersübergreifende Gruppe', type: 'Regelgruppe' })).toBe('unknown');
    expect(forecastStageForGroup({ name: 'Krippe', type: 'Krippe / Regelgruppe' })).toBe('unknown');
    expect(forecastStageForGroup({ name: 'Krippe / Hort', type: 'Regelgruppe' })).toBe('unknown');
    expect(forecastStageForGroup({ name: 'Krippe', forecastStage: 'invalid' })).toBe('unknown');
    expect(forecastStageForGroup(null)).toBe('unknown');
  });

  it('uses the confirmed stage in assignments and the model, leaving conflicting simultaneous groups unresolved', () => {
    const groups = [
      { id: 'a', name: 'Krippe', type: 'Regelgruppe', forecastStage: 'school' },
      { id: 'b', name: 'Hort', type: 'Schulkindgruppe', forecastStage: 'unknown' },
    ];
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const resolve = (assignments, item = {}) => resolveForecastStage({ item, assignments, groupsById, referenceDate: '2026-01-01', date: '2026-01-01' });
    expect(resolve([{ groupId: 'a' }])).toEqual({ stage: 'school', source: 'known' });
    expect(resolve([], { groupId: 'a' })).toEqual({ stage: 'school', source: 'known' });
    expect(resolve([{ groupId: 'b' }])).toEqual({ stage: 'unknown', source: 'unknown' });
    expect(resolve([{ groupId: 'a' }, { groupId: 'b' }])).toEqual({ stage: 'unknown', source: 'unknown' });
    expect(resolve([{ assignmentMode: 'multiple', groupId: 'a', timeSegments: [] }])).toEqual({ stage: 'unknown', source: 'unknown' });
    expect(resolve([{ assignmentMode: 'multiple', timeSegments: [
      { groupId: 'a', startTime: '08:00', endTime: '10:00' }, { startTime: '10:00', endTime: '12:00' },
    ] }])).toEqual({ stage: 'unknown', source: 'unknown' });
    expect(resolve([{ assignmentMode: 'multiple', timeSegments: [
      { groupId: 'a', startTime: '08:00', endTime: '10:00' },
      { groupId: 'b', startTime: '10:00', endTime: '12:00' },
    ] }])).toEqual({ stage: 'unknown', source: 'unknown' });
    const model = buildForecastModel({ referenceDate: '2026-01-01', groups, children: [{ id: 'child', groupId: 'a' }] });
    expect(model.groupTimeline.seriesByGroup.find((series) => series.groupId === 'school').data).toEqual([1]);
  });
});
