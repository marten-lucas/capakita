import { allocateFillUpCandidates, getForecastGroupAssignments } from './forecastUtils';
import { decodeBuchungsart } from './adebisConstants';
import { isRecordActiveOnDate } from './financeUtils';
import { sumWeightedBookingHours } from './chartUtils/chartUtils';

export const FORECAST_STAGES = {
  krippe: { label: 'Krippe', color: '#14b8a6', rank: 0 },
  kita: { label: 'Regelgruppe', color: '#0ea5e9', rank: 1 },
  school: { label: 'Schulkindbetreuung', color: '#6366f1', rank: 2 },
  exit: { label: 'Austritt', color: '#cbd5e1', rank: 3 },
  unknown: { label: 'Ungeklärt', color: '#94a3b8', rank: 4 },
};

export function nextForecastDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function forecastStageForGroup(group) {
  if (!group) return 'unknown';
  if (group.forecastStage != null && group.forecastStage !== '' && group.forecastStage !== 'auto') {
    return ['krippe', 'kita', 'school', 'unknown'].includes(group.forecastStage) ? group.forecastStage : 'unknown';
  }
  const classify = (value) => {
    const text = String(value || '').toLowerCase();
    const matches = [];
    if (/(?:^|[^a-zäöüß0-9])(?:kripp\w*|u3)(?=$|[^a-zäöüß0-9])/.test(text)) matches.push('krippe');
    if (/(?:^|[^a-zäöüß0-9])(?:regel\w*|kita\w*|kiga\w*|kindergarten\w*|vorschul\w*)(?=$|[^a-zäöüß0-9])/.test(text)) matches.push('kita');
    if (/(?:^|[^a-zäöüß0-9])(?:schul\w*|hort\w*)(?=$|[^a-zäöüß0-9])/.test(text)) matches.push('school');
    return matches;
  };
  const names = classify(group.name);
  const types = classify(group.type);
  // Explicit mixed-group indications are not overridden by a single-stage name or default type.
  const mixed = /(?:mischgrupp|altersgemischt|altersübergreifend|altersuebergreifend)/i;
  if (mixed.test(String(group.name || '')) || mixed.test(String(group.type || '')) || names.length > 1 || types.length > 1) return 'unknown';
  if (names.length) return names[0];
  return types.length === 1 ? types[0] : 'unknown';
}

// Resolves a stage, not a concrete group. A current explicit assignment is always a fact;
// predictions apply only when no assignment covers the date.
export function resolveForecastStage({ item, assignments, events, groupsById, date, fillUpDecisions = [] }) {
  if (item.startdate && date < String(item.startdate)) return { stage: 'not_started', source: 'known' };
  if (item.enddate && date > String(item.enddate)) return { stage: 'exit', source: 'known' };
  const records = getForecastGroupAssignments(assignments);
  const active = records.filter((a) => (!a.start || a.start <= date) && (!a.end || a.end >= date))
    .sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')) || String(a.id || '').localeCompare(String(b.id || '')));
  if (active.length) {
    const stages = new Set(active.flatMap((assignment) => {
      const segments = assignment.assignmentMode === 'multiple' && Array.isArray(assignment.timeSegments) ? assignment.timeSegments : [];
      if (assignment.assignmentMode === 'multiple' && (!segments.length || segments.some((segment) => (
        !segment?.groupId || !/^\d{2}:\d{2}$/.test(segment.startTime || '') || !/^\d{2}:\d{2}$/.test(segment.endTime || '') || segment.startTime >= segment.endTime
      )))) return ['unknown'];
      const groupIds = assignment.assignmentMode === 'multiple' ? segments.map((segment) => segment.groupId) : [assignment.groupId];
      return groupIds.map((id) => forecastStageForGroup(groupsById.get(String(id || ''))));
    }));
    return { stage: stages.size === 1 ? [...stages][0] : 'unknown', source: stages.size === 1 && !stages.has('unknown') ? 'known' : 'unknown' };
  }
  const latestEnd = records.reduce((latest, a) => a.end && a.end < date && a.end > latest ? a.end : latest, '');
  const transition = (events || []).filter((e) => e.enabled !== false && e.type === 'auto_group_transition'
    && ['kita', 'school'].includes(e.metadata?.targetStage)
    && nextForecastDay(e.effectiveDate) && String(e.effectiveDate || '') <= date
    && (!latestEnd || String(e.effectiveDate) > latestEnd))
    .sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)))[0];
  if (transition) {
    const decision = fillUpDecisions.find((entry) => String(entry.childId) === String(item.id)
      && entry.date === transition.effectiveDate && entry.status === 'accepted');
    return { stage: transition.metadata.targetStage === 'school' ? (decision ? 'school' : 'unknown') : 'kita', source: 'projected' };
  }
  if (!records.length && item.groupId) {
    const stage = forecastStageForGroup(groupsById.get(String(item.groupId)));
    return { stage, source: stage === 'unknown' ? 'unknown' : 'known' };
  }
  return { stage: 'unknown', source: 'unknown' };
}

// Decisions are made at each school-transition date using the whole facility, never
// anonymous inflow. Rejected demand remains unresolved rather than becoming an exit.
export function buildForecastFillUp({ referenceDate, children = [], groups = [], assignmentsByChild = {}, events = [] }) {
  const enabled = groups.filter((group) => group.type === 'Schulkindgruppe' && group.fillUp);
  const values = enabled.map((group) => group.maxFacilityCount).filter((value) => value !== '' && value != null);
  const capacities = [...new Set(values.map(Number))];
  if (!enabled.length) return { decisions: [], capacity: null, issues: [] };
  if (enabled.length !== 1 || capacities.length !== 1 || !Number.isInteger(capacities[0]) || capacities[0] < 0) {
    return { decisions: [], capacity: null, issues: ['Auffüllen benötigt genau eine Schulkindgruppe und eine gültige Gesamtkapazität.'] };
  }
  const capacity = capacities[0];
  const groupsById = new Map(groups.map((group) => [String(group.id), group]));
  const childrenById = new Map(children.map((child) => [String(child.id), child]));
  const schoolEvents = events.filter((event) => event.enabled !== false && event.entityType === 'demand'
    && event.type === 'auto_group_transition' && event.metadata?.targetStage === 'school'
    && event.effectiveDate > referenceDate && nextForecastDay(event.effectiveDate)
    && childrenById.has(String(event.entityId)));
  const decisions = [];
  [...new Set(schoolEvents.map((event) => event.effectiveDate))].sort().forEach((date) => {
    const candidates = [];
    const seen = new Set();
    schoolEvents.filter ( (event) => event.effectiveDate === date).forEach((event) => {
      const id = String(event.entityId);
      if (seen.has(id)) return;
      seen.add(id);
      const child = childrenById.get(id);
      const assignments = assignmentsByChild[id];
      const state = resolveForecastStage({ item: child, assignments, events: [event], groupsById, referenceDate, date });
      if (state.stage !== 'unknown' || state.source !== 'projected') return;
      candidates.push({ id, gradePriority: event.metadata?.gradePriority, siblingPriority: event.metadata?.siblingPriority,
        dataOrder: children.indexOf(child) });
    });
    // Candidates are already in attendance. Unresolved candidates do not disappear
    // merely because they receive no offer, and must not free capacity for others.
    const occupied = children.filter((child) => (!child.startdate || child.startdate <= date)
      && (!child.enddate || child.enddate >= date)).length;
    const { accepted, rejected } = allocateFillUpCandidates(candidates, occupied <= capacity ? candidates.length : 0);
    [...accepted.map((candidate) => ({ candidate, status: 'accepted' })),
      ...rejected.map((candidate) => ({ candidate, status: 'rejected' }))].forEach(({ candidate, status }) => {
      decisions.push({ childId: candidate.id, date, status, groupId: String(enabled[0].id), capacity, occupied });
    });
  });
  return { decisions, capacity, issues: [] };
}

export function buildForecastInflow({ referenceDate, history = [], futureAdmissions = [], years = 6 }) {
  const counts = new Map();
  history.forEach((item) => {
    if (!item.startdate || item.startdate > referenceDate) return;
    const year = String(item.startdate).slice(0, 4);
    counts.set(year, (counts.get(year) || 0) + 1);
  });
  const annual = counts.size ? Math.round([...counts.values()].reduce((sum, count) => sum + count, 0) / counts.size) : 0;
  const startYear = Number(referenceDate.slice(0, 4));
  const inflow = [];
  for (let offset = 1; offset <= years; offset += 1) {
    const year = startYear + offset;
    const known = futureAdmissions.filter((item) => String(item.startdate || '').slice(0, 4) === String(year)).length;
    for (let i = known; i < annual; i += 1) {
      inflow.push({ startdate: `${year}-09-01`, enddate: `${year + 3}-08-31` });
    }
  }
  return inflow;
}

// Known children and earlier accepted estimates have priority over new anonymous
// estimates throughout their entire assumed stay. No unknown exit is invented.
export function limitForecastInflow({ inflow = [], children = [], capacity = null }) {
  if (!Number.isInteger(capacity) || capacity < 0) return inflow;
  const accepted = [];
  for (const entry of inflow) {
    if (!entry.startdate) continue;
    const end = entry.enddate || '9999-12-31';
    const dates = new Set([entry.startdate]);
    [...children, ...accepted].forEach((item) => {
      if (item.startdate && item.startdate > entry.startdate && item.startdate <= end) dates.add(item.startdate);
    });
    const fits = [...dates].every((date) => [...children, ...accepted].filter((item) => (
      (!item.startdate || item.startdate <= date) && (!item.enddate || item.enddate >= date)
    )).length < capacity);
    if (fits) accepted.push(entry);
  }
  return accepted;
}

export function buildForecastModel({ referenceDate, children = [], groups = [], assignmentsByChild = {}, bookingsByChild = {}, events = [], inflow: proposedInflow = [], fillUp = null }) {
  const fillUpResult = fillUp || buildForecastFillUp({ referenceDate, children, groups, assignmentsByChild, events });
  const inflow = limitForecastInflow({ inflow: proposedInflow, children, capacity: fillUpResult.capacity });
  const groupsById = new Map(groups.map((g) => [String(g.id), g]));
  const ids = new Set(children.map((child) => String(child.id)));
  const relevantEvents = events.filter((e) => e.enabled !== false && ids.has(String(e.entityId)) && e.entityType === 'demand'
    && ['auto_group_transition', 'group_assignment_start', 'group_assignment_end', 'presence_start', 'presence_end', 'booking_start', 'booking_end'].includes(e.type)
    && !(e.type === 'auto_group_transition' && e.metadata?.targetStage === 'exit')
    && nextForecastDay(e.effectiveDate));
  const dates = new Set([referenceDate]);
  const sankeyDates = new Set([referenceDate]);
  const addStageDate = (date) => { dates.add(date); sankeyDates.add(date); };
  const bookingEvents = [];
  const bookingsFor = (child) => Object.values(bookingsByChild[String(child.id)] || {}).filter(Boolean);
  children.forEach((child) => {
    if (child.startdate && child.startdate > referenceDate) addStageDate(child.startdate);
    const exit = nextForecastDay(child.enddate);
    if (exit && exit >= referenceDate) addStageDate(exit);
    getForecastGroupAssignments(assignmentsByChild[String(child.id)]).forEach((a) => {
      if (a.start && a.start >= referenceDate) addStageDate(a.start);
      const end = nextForecastDay(a.end);
      if (end && end >= referenceDate) addStageDate(end);
    });
    bookingsFor(child).forEach((booking, index) => {
      const start = booking.validFrom || booking.startdate || booking.start;
      const end = nextForecastDay(booking.validUntil || booking.enddate || booking.end);
      [[start, 'booking_start'], [end, 'booking_end']].forEach(([date, type]) => {
        if (!date || !nextForecastDay(date) || date < referenceDate || !isRecordActiveOnDate(child, date)) return;
        dates.add(date);
        const relatedId = String(booking.id ?? index);
        if (!relevantEvents.some((event) => event.type === type && String(event.entityId) === String(child.id)
          && String(event.relatedId ?? '') === relatedId && event.effectiveDate === date)) {
          bookingEvents.push({ id: `${type}_${child.id}_${relatedId}`, type, effectiveDate: date,
            entityName: [child.firstName, child.name].filter(Boolean).join(' ') || 'Kind' });
        }
      });
    });
  });
  relevantEvents.forEach((e) => {
    if (e.effectiveDate < referenceDate) return;
    if (e.type === 'booking_start' || e.type === 'booking_end') dates.add(e.effectiveDate);
    else addStageDate(e.effectiveDate);
  });
  inflow.forEach((entry) => {
    if (entry.startdate >= referenceDate) dates.add(entry.startdate);
    const end = nextForecastDay(entry.enddate);
    if (end && end >= referenceDate) dates.add(end);
  });
  const timelineDates = [...dates].sort();
  const flowDates = [...sankeyDates].sort();
  const eventsByChild = new Map();
  relevantEvents.forEach((e) => {
    const id = String(e.entityId);
    if (!eventsByChild.has(id)) eventsByChild.set(id, []);
    eventsByChild.get(id).push(e);
  });
  const stateAt = (child, date) => resolveForecastStage({ item: child, assignments: assignmentsByChild[String(child.id)],
    events: eventsByChild.get(String(child.id)), groupsById, referenceDate, date, fillUpDecisions: fillUpResult.decisions });
  const formatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });
  const label = (date) => formatter.format(new Date(`${date}T00:00:00Z`));
  const nodes = new Map();
  const links = new Map();
  const nodeId = (date, stage) => `${date}__${stage}`;
  const ensureNode = (date, stage, count, column) => {
    const id = nodeId(date, stage);
    nodes.set(id, { id, name: `${FORECAST_STAGES[stage].label}: ${count} Kinder`, groupId: stage, dateIso: date, column,
      rank: FORECAST_STAGES[stage].rank, stageLabel: date === referenceDate ? 'Stichtag' : label(date) });
  };
  const snapshots = timelineDates.map((date) => children.map((child) => stateAt(child, date)));
  const flowSnapshots = flowDates.map((date) => children.map((child) => stateAt(child, date)));
  const syntheticStateAt = (entry, date) => {
    if (entry.startdate && date < entry.startdate) return { stage: 'not_started', source: 'projected' };
    if (entry.enddate && date > entry.enddate) return { stage: 'exit', source: 'projected' };
    return { stage: 'krippe', source: 'projected' };
  };
  const participants = [
    ...children.map((child, index) => ({ child, states: flowSnapshots.map((snapshot) => snapshot[index]), admission: 'known' })),
  ].filter((participant) => participant.states[0].stage !== 'exit');
  const activeNowCount = children.filter((child) => !['not_started', 'exit'].includes(stateAt(child, referenceDate).stage)).length;
  const eventDates = [];
  let transitionCount = 0;
  flowDates.forEach((date, index) => {
    const counts = {};
    participants.forEach(({ states }) => {
      const stage = states[index].stage;
      if (stage === 'not_started' || (stage === 'exit' && (!index || ['not_started', 'exit'].includes(states[index - 1].stage)))) return;
      counts[stage] = (counts[stage] || 0) + 1;
    });
    Object.entries(counts).forEach(([stage, count]) => ensureNode(date, stage, count, index));
    if (!index) return;
    let changed = 0;
    let linked = 0;
    participants.forEach(({ child, states, admission }) => {
      const to = states[index];
      const from = states[index - 1];
      if (from.stage === 'exit' || to.stage === 'not_started' || (from.stage === 'not_started' && to.stage === 'exit')) return;
      const entering = from.stage === 'not_started';
      linked += 1;
      if (!entering && from.stage !== to.stage) changed += 1;
      const fromId = entering ? `${date}__admission_${admission}` : nodeId(flowDates[index - 1], from.stage);
      if (entering && !nodes.has(fromId)) {
        nodes.set(fromId, { id: fromId, name: admission === 'known' ? 'Bekannte Aufnahme' : 'Geschätzter Zulauf',
          groupId: `admission_${admission}`, admission, rank: -1, column: index - 1, stageLabel: label(date) });
      }
      const toId = nodeId(date, to.stage);
      const key = `${fromId}|${toId}`;
      if (!links.has(key)) links.set(key, { from: fromId, to: toId, weight: 0, known: 0, projected: 0, unknown: 0, children: [], stepDateIso: date, stepLabel: label(date), ...(entering ? { admission } : {}) });
      const link = links.get(key);
      link.weight += 1;
      link[to.source] += 1;
      if (child) link.children.push({ id: String(child.id), name: [child.firstName, child.name].filter(Boolean).join(' ') || 'Kind' });
    });
    transitionCount += changed;
    if (linked) eventDates.push({ dateIso: date, label: label(date), changed, linked });
  });
  const seriesByGroup = Object.entries(FORECAST_STAGES).filter(([stage]) => stage !== 'exit').map(([stage, meta]) => {
    const inflowAt = (date) => stage === 'krippe' ? inflow.filter((entry) => syntheticStateAt(entry, date).stage === 'krippe').length : 0;
    const sourceData = Object.fromEntries(['known', 'projected', 'unknown'].map((source) => [source,
      timelineDates.map((date, i) => snapshots[i].filter((state) => state.stage === stage && state.source === source).length + (source === 'projected' ? inflowAt(date) : 0)),
    ]));
    return { groupId: stage, name: meta.label, color: meta.color, sourceData,
      data: timelineDates.map((date, i) => snapshots[i].filter((state) => state.stage === stage).length + inflowAt(date)),
      childrenByIndex: timelineDates.map((_, i) => children.flatMap((child, childIndex) => (
        snapshots[i][childIndex].stage === stage ? [{ id: String(child.id), name: String(child.name || 'Kind') }] : []
      ))),
      hoursData: timelineDates.map((date, i) => children.reduce((total, child, childIndex) => {
        if (snapshots[i][childIndex].stage !== stage) return total;
        return total + bookingsFor(child).filter((booking) => isRecordActiveOnDate(booking, date)
          && (booking.buchungsart || decodeBuchungsart(booking.rawdata?.ART))?.basis !== false)
          .reduce((sum, booking) => sum + sumWeightedBookingHours(booking), 0);
      }, 0)) };
  }).filter((series) => series.data.some(Boolean));
  const eventByDate = new Map();
  [...relevantEvents, ...bookingEvents].filter((event) => event.effectiveDate >= referenceDate).forEach((event) => {
    const date = event.effectiveDate;
    if (!eventByDate.has(date)) eventByDate.set(date, []);
    eventByDate.get(date).push(event);
  });
  const timelinePoints = [...eventByDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => ({
    x: new Date(`${date}T00:00:00Z`).getTime(), name: `${entries.length} Ereignisse`, label: `${label(date)} · ${entries.length}`,
    description: `${entries.filter((e) => e.type === 'auto_group_transition').length} Annahmen`, count: entries.length,
    autoCount: entries.filter((e) => e.type === 'auto_group_transition').length, dateLabel: label(date),
    eventList: entries.map((e) => ({ id: e.id, type: e.type, entityName: e.entityName, description: e.description, targetStage: e.metadata?.targetStage || '' })),
  }));
  const changedLinks = [...links.values()].filter((link) => !link.admission && nodes.get(link.from)?.groupId !== nodes.get(link.to)?.groupId);
  const top = [...changedLinks].sort((a, b) => b.weight - a.weight);
  return { referenceDate, fillUp: fillUpResult, nodes: [...nodes.values()], links: [...links.values()], eventDates,
    groupColorsById: Object.fromEntries(Object.entries(FORECAST_STAGES).map(([id, meta]) => [id, meta.color])),
    groupTimeline: { dates: timelineDates, labels: timelineDates.map(label), seriesByGroup, timelinePoints, rangeStartIso: referenceDate, rangeEndIso: timelineDates[timelineDates.length - 1] },
    kpis: { activeNowCount, eventStepsCount: eventDates.filter((entry) => entry.changed).length, transitionCount,
      concentrationPct: transitionCount ? top.slice(0, 3).reduce((sum, link) => sum + link.weight, 0) / transitionCount * 100 : 0,
      topTransition: top.length ? { from: FORECAST_STAGES[nodes.get(top[0].from).groupId].label, to: FORECAST_STAGES[nodes.get(top[0].to).groupId].label, weight: top[0].weight } : null },
  };
}
