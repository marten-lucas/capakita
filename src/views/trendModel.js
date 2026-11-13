import { selectHistoricalStatistics, selectGroupTransitionStatistics } from '../store/statisticsSelectors';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { shouldIncludeDataItemInAnalysis } from '../utils/dataVisibility';
import { isRecordActiveOnDate, resolveGroupIdsAtDate, splitBookingByGroupAtDate } from '../utils/financeUtils';

import { collectCoverageQualifications, sumWeightedBookingHours } from '../utils/chartUtils/chartUtils';

const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const round = (value, digits = 2) => Number(value.toFixed(digits));
const validIso = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const matchesGroup = (ids, selection) => !selection.length || (ids.length ? ids : ['__NO_GROUP__']).some((id) => selection.includes(String(id)));


export function buildTrendHistory(state, { scenarioId, asOfDate, selectedGroups = [], selectedQualifications = [] }) {
  const reference = /^\d{4}-\d{2}-\d{2}$/.test(asOfDate || '') ? new Date(`${asOfDate}T00:00:00Z`) : null;
  if (!scenarioId || !reference || Number.isNaN(reference.getTime()) || reference.toISOString().slice(0, 10) !== asOfDate) return { categories: [], trendYearCategories: [], kpis: {} };
  const overlay = buildOverlayAwareData(scenarioId, state);
  const items = Object.fromEntries(Object.entries(overlay.effectiveDataItems).filter(([, item]) => shouldIncludeDataItemInAnalysis(item)));
  const bookings = Object.fromEntries(Object.keys(items).map((id) => [id, overlay.effectiveBookingsByItem[id] || {}]));
  const assignments = overlay.effectiveGroupAssignmentsByItem;
  const qualifications = collectCoverageQualifications(Object.keys(items), overlay.scenarioChain, state.simOverlay?.overlaysByScenario || {}, state.simQualification?.qualificationAssignmentsByScenario || {});
  const groups = selectedGroups.map(String);
  const quals = selectedQualifications.map(String);
  const groupFallback = (id, item) => Object.keys(assignments[id] || {}).length ? null : (item.groupId || null);
  const groupIds = (id, item, date) => resolveGroupIdsAtDate(assignments[id], date, groupFallback(id, item));
  const qualiMatches = (id, date) => {
    if (!quals.length) return true;
    const active = Object.values(qualifications[id] || {}).filter((record) => record?.qualification && isRecordActiveOnDate(record, date)).map((record) => String(record.qualification));
    return active.some((key) => quals.includes(key)) || (!active.length && quals.includes('__NO_QUALI__'));
  };
  const synthetic = {
    simScenario: { selectedScenarioId: scenarioId },
    simData: { dataByScenario: { [scenarioId]: items } },
    simBooking: { bookingsByScenario: { [scenarioId]: bookings } },
    simGroup: { groupsByScenario: { [scenarioId]: assignments }, groupDefsByScenario: { [scenarioId]: overlay.effectiveGroupDefs } },
  };
  const cutoff = new Date(reference.getTime());
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 10);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const buckets = selectHistoricalStatistics(synthetic, { aggregation: 'month', asOfDate }).buckets.filter((bucket) => bucket.evaluationDate >= cutoffIso);
  if (!buckets.length) return { categories: [], trendYearCategories: [], kpis: {} };
  const names = new Map(overlay.effectiveGroupDefs.map((group) => [String(group.id), group.name || 'Gruppe']));
  const groupSeries = new Map();
  const children = [], employees = [], bookingHours = [], workingHours = [];
  buckets.forEach((bucket, index) => {
    const date = bucket.evaluationDate;
    let childCount = 0, employeeCount = 0, childHours = 0, staffHours = 0;
    Object.entries(items).forEach(([id, item]) => {
      if (!isRecordActiveOnDate(item, date)) return;
      const ids = groupIds(id, item, date);
      const activeBookings = Object.values(bookings[id] || {}).filter((booking) => isRecordActiveOnDate(booking, date));
      if (item.type === 'demand' && matchesGroup(ids.slice(0, 1), groups)) {
        childCount += 1;
        const groupId = ids[0] || '__NO_GROUP__';
        if (!groupSeries.has(groupId)) groupSeries.set(groupId, { name: groupId === '__NO_GROUP__' ? 'Ohne Gruppe' : (names.get(groupId) || 'Gruppe'), data: buckets.map(() => 0) });
        groupSeries.get(groupId).data[index] += 1;
        activeBookings.forEach((booking) => { childHours += sumWeightedBookingHours(booking); });
      }
      if (item.type === 'capacity' && qualiMatches(id, date)) {
        const split = activeBookings.flatMap((booking) => splitBookingByGroupAtDate(booking, assignments[id], date, groupFallback(id, item)));
        const bookingGroups = split.map((booking) => booking.groupId || '__NO_GROUP__');
        if (matchesGroup([...ids, ...bookingGroups], groups)) employeeCount += 1;
        const selected = groups.length ? split.filter((booking) => matchesGroup(booking.groupId ? [booking.groupId] : [], groups)) : activeBookings;
        selected.forEach((booking) => { staffHours += sumWeightedBookingHours(booking, { mode: 'pedagogical' }); });
      }
    });
    children.push(childCount); employees.push(employeeCount); bookingHours.push(round(childHours)); workingHours.push(round(staffHours));
  });
  const groupChildrenSeries = [...groupSeries.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((series) => ({ type: 'line', ...series }));
  const years = Array.from({ length: reference.getUTCFullYear() - cutoff.getUTCFullYear() + 1 }, (_, index) => String(cutoff.getUTCFullYear() + index));
  const datedChildren = Object.entries(items).filter(([, item]) => item.type === 'demand' && validIso(item.startdate));
  const entryRecords = datedChildren.filter(([id, item]) => item.startdate >= cutoffIso && item.startdate <= asOfDate && matchesGroup(groupIds(id, item, item.startdate).slice(0, 1), groups));
  const firstEntryYear = datedChildren.reduce((year, [, item]) => item.startdate <= asOfDate && (!year || item.startdate.slice(0, 4) < year) ? item.startdate.slice(0, 4) : year, null);
  const entries = years.map((year) => firstEntryYear && year >= firstEntryYear ? entryRecords.filter(([, item]) => item.startdate.startsWith(year)).length : null);
  const entryAgeYears = years.map((year) => {
    const ages = entryRecords.filter(([, item]) => item.startdate.startsWith(year)).map(([, item]) => {
      const dob = new Date(`${item.dateofbirth}T00:00:00Z`), start = new Date(`${item.startdate}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.dateofbirth || '') || Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== item.dateofbirth || dob > start) return null;
      let age = start.getUTCFullYear() - dob.getUTCFullYear();
      const birthday = new Date(Date.UTC(start.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
      if (birthday > start) age -= 1;
      const lastBirthday = new Date(Date.UTC(dob.getUTCFullYear() + age, dob.getUTCMonth(), dob.getUTCDate()));
      return age + (start - lastBirthday) / 86400000 / 365.25;
    }).filter((age) => age !== null);
    const value = average(ages); return value === null ? null : round(value);
  });
  const transitions = years.map((year) => {
    const date = `${year}-12-31` < asOfDate ? `${year}-12-31` : asOfDate;
    const datedAssignments = Object.fromEntries(Object.entries(assignments).map(([id, records]) => [id, Object.fromEntries(Object.entries(records || {}).filter(([, record]) => !record.start || record.start <= date))]));
    return selectGroupTransitionStatistics({ ...synthetic, simGroup: { ...synthetic.simGroup, groupsByScenario: { [scenarioId]: datedAssignments } } }, { asOfDate: date, windowDays: 90 });
  });
  const corridorRemainPct = transitions.map((result) => result.corridor.evaluatedCount ? round(result.corridor.remainedInRegelCount / result.corridor.evaluatedCount * 100, 1) : null);
  const regelEntryAgeYears = transitions.map((result, index) => {
    const ages = result.transitions.filter((entry) => entry.transitionKind === 'krippe_to_regelgruppe' && entry.date.startsWith(years[index]) && Number.isFinite(entry.ageMonths)).map((entry) => entry.ageMonths / 12);
    const value = average(ages); return value === null ? null : round(value);
  });
  const groupAverages = groupChildrenSeries.map((series) => `${series.name}: ${average(series.data).toFixed(1)}`).join(' · ');
  return {
    categories: buckets.map((bucket) => bucket.label), evaluationDates: buckets.map((bucket) => bucket.evaluationDate), trendYearCategories: years,
    children, employees, bookingHours, workingHours, entries, entryAgeYears, groupChildrenSeries, corridorRemainPct, regelEntryAgeYears,
    kpis: { avgEntries: average(entries.filter(Number.isFinite)), avgEntryAgeYears: average(entryAgeYears.filter(Number.isFinite)), avgChildren: average(children), avgEmployees: average(employees), avgChildrenByGroupSubtitle: groupAverages || 'Keine Gruppendaten verfügbar.' },
  };
}
