import { decodeBuchungsart, getFeeBandZeitkatId, getZeitkatZoneIndex, isAdebisTrue } from './adebisConstants';
import { shouldIncludeDataItemInAnalysis } from './dataVisibility';
import { isDateWithinRange, isRecordActiveOnDate, pickApplicableValidityEntry } from './financeUtils';
import { forecastStageForGroup, getForecastGroupAssignments, resolveForecastStage } from './forecastUtils';
import { buildForecastFillUp, limitForecastInflow } from './forecastUtilsModel';
import { deriveZeitkatIdFromBooking } from './foerderSimulation';
import { getAbsenceRange, sumWeightedBookingHours } from './chartUtils/chartUtils';


function concreteGroup(item, assignments, date, groupsById, state) {
  if (state.source === 'projected') return null;
  const records = getForecastGroupAssignments(assignments);
  const active = records.filter((entry) => isDateWithinRange(date, entry.start || '', entry.end || ''));
  if (!active.length) {
    const id = !records.length && item.groupId ? String(item.groupId) : null;
    return id && groupsById.has(id) ? id : null;
  }
  const ids = new Set();
  for (const entry of active) {
    // Multiple-mode assignments can leave booking times uncovered even if all
    // segments name the same group; a single tariff cannot safely represent them.
    if (entry.assignmentMode === 'multiple') return null;
    if (entry.groupId) ids.add(String(entry.groupId));
    else return null;
  }
  if (ids.size !== 1) return null;
  const id = [...ids][0];
  return groupsById.has(id) ? id : null;
}

function hasConflictingAllocations(booking, groupId) {
  return (booking.times || []).some((day) => (day.segments || []).some((segment) => (
    (segment.groupId && String(segment.groupId) !== groupId)
    || (segment.groupAllocations || []).some((allocation) => !allocation.groupId || String(allocation.groupId) !== groupId)
  )));
}

/**
 * Builds a first-of-month occupancy snapshot and conservative inputs for the existing
 * funding simulation. `mode` is 'known' (no assumptions) or 'projected'.
 * Inputs are overlay-effective maps as used by FundingSimulationPanel. `inflow` is
 * the optional anonymous result of buildForecastInflow; it is counted only in
 * projected mode and never converted into fictitious children or bookings.
 *
 * `demand` and the effective maps contain only children with a single known group,
 * a resolved forecast stage, one active usable basis booking, and a valid current tariff.
 * A concrete group can be known even when the resolver cannot classify its stage;
 * that state is reported but excluded from the financial inputs. Conflicting name
 * and type classifications are also excluded, as is a school stage that the
 * existing funding model would not recognize from the group type. When
 * `diagnostics.complete` is false, the result can be partial or provisional, not
 * a complete financial result.
 * Absence does not remove a booking; an overlapping or invalid absence produces
 * a gap because its effect on monthly funding and fees is not known here.
 * Required input maps must be supplied explicitly, even when empty; projected
 * mode also requires an explicit events array. Input omissions are reported as
 * gaps. `diagnostics.complete` covers only these occupancy/booking/current-tariff
 * checks, not baseline tariff, funding rule, family, subsidy or other finance
 * diagnostics; `financialComplete` is null until the caller checks those separately.
 * The adapter does not calculate money, prorate partial months, extend bookings,
 * assign forecast stages to real groups, or resolve funding/subsidy policy. The
 * caller must produce inflow with the same settings as the forecast and avoid
 * counting known admissions twice.
 */
export function buildForecastFinanceMonth({
  mode, referenceDate, monthDate, dataItems, bookingsByItem,
  groupAssignmentsByItem, groups, events, inflow = [], groupFeeCatalogs, fillUp = null, inflowCapacityChecked = false,
}) {
  if (!['known', 'projected'].includes(mode)) throw new Error('mode must be known or projected');
  const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '')
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!validDate(referenceDate) || !validDate(monthDate) || !monthDate.endsWith('-01')) {
    throw new Error('referenceDate must be an ISO date and monthDate the first day of a month');
  }
  const monthEndDate = new Date(`${monthDate}T00:00:00Z`);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const gaps = [];
  const requiredMap = (value, name) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    gaps.push({ input: name, reasons: ['missing-or-invalid-input'] });
    return {};
  };
  const requiredArray = (value, name) => {
    if (Array.isArray(value)) return value;
    gaps.push({ input: name, reasons: ['missing-or-invalid-input'] });
    return [];
  };
  const items = requiredMap(dataItems, 'dataItems');
  const bookings = requiredMap(bookingsByItem, 'bookingsByItem');
  const assignmentsByItem = requiredMap(groupAssignmentsByItem, 'groupAssignmentsByItem');
  const catalogs = requiredMap(groupFeeCatalogs, 'groupFeeCatalogs');
  const groupDefs = requiredArray(groups, 'groups');
  const forecastEvents = mode === 'projected' ? requiredArray(events, 'events') : [];
  const proposedInflow = requiredArray(inflow, 'inflow');
  const facilityChildren = Object.entries(items).filter(([, item]) => item?.type === 'demand' && shouldIncludeDataItemInAnalysis(item))
    .map(([id, item]) => ({ ...item, id: item.id ?? id }));
  const fillUpResult = mode === 'projected' ? (fillUp || buildForecastFillUp({
    referenceDate, children: facilityChildren,
    groups: groupDefs.filter((group) => group && typeof group === 'object'), assignmentsByChild: assignmentsByItem,
    events: forecastEvents.filter((event) => event && typeof event === 'object'),
  })) : { decisions: [], issues: [] };
  if (fillUpResult.issues.length) gaps.push({ input: 'fillUp', reasons: ['invalid-fill-up-capacity'] });
  const forecastInflow = inflowCapacityChecked ? proposedInflow
    : limitForecastInflow({ inflow: proposedInflow, children: facilityChildren, capacity: fillUpResult.capacity });
  const groupsById = new Map();
  groupDefs.forEach((group, index) => {
    if (!group || typeof group !== 'object' || group.id == null || String(group.id) === '') {
      gaps.push({ input: 'groups', index, reasons: ['invalid-group'] });
      return;
    }
    groupsById.set(String(group.id), group);
  });
  const eventsByChild = new Map();
  forecastEvents.forEach((event, index) => {
    if (!event || typeof event !== 'object') {
      gaps.push({ input: 'events', index, reasons: ['invalid-event'] });
      return;
    }
    if (event.entityType !== 'demand') return;
    const id = String(event.entityId);
    if (!eventsByChild.has(id)) eventsByChild.set(id, []);
    eventsByChild.get(id).push(event);
  });
  const counts = { known: 0, projected: 0, unknown: 0 };
  const states = [];
  const demand = [];
  const effectiveDataItems = {};
  const effectiveBookingsByItem = {};
  const effectiveGroupAssignmentsByItem = {};
  const parentFeeSubsidyChildren = [];

  Object.entries(items).forEach(([itemId, item]) => {
    if (!item || typeof item !== 'object' || !item.type) {
      gaps.push({ itemId, reasons: ['invalid-item'] });
      return;
    }
    if (item.type !== 'demand' || !shouldIncludeDataItemInAnalysis(item)) return;
    const assignments = assignmentsByItem[itemId];
    const state = resolveForecastStage({ item: { ...item, id: item.id ?? itemId }, assignments, events: eventsByChild.get(itemId) || [], groupsById, referenceDate, date: monthDate, fillUpDecisions: fillUpResult.decisions });
    if (state.stage === 'not_started' || state.stage === 'exit' || !isRecordActiveOnDate(item, monthDate)) return;
    counts[state.source] += 1;
    const groupId = concreteGroup(item, assignments, monthDate, groupsById, state);
    states.push({ itemId, ...state, groupId });
    const absenceBillingUnclear = item.absences != null && (!Array.isArray(item.absences)
      || item.absences.some((absence) => {
        if (!absence || typeof absence !== 'object') return true;
        const { start, end } = getAbsenceRange(absence);
        if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)) return true;
        return (!start || start <= monthEnd) && (!end || end >= monthDate);
      }));
    const reasons = [];
    if (Object.hasOwn(assignmentsByItem, itemId) && (!assignments || typeof assignments !== 'object')) {
      reasons.push('invalid-group-assignments');
    }
    if (!groupId) reasons.push('unknown-group');
    else if (state.stage === 'unknown') reasons.push('unknown-stage');
    else {
      const group = groupsById.get(groupId);
      const nameStage = forecastStageForGroup({ name: group.name });
      const typeStage = forecastStageForGroup({ type: group.type });
      if ((nameStage !== 'unknown' && typeStage !== 'unknown' && nameStage !== typeStage)
        || (state.stage === 'school') !== (group.type === 'Schulkindgruppe')) {
        reasons.push('conflicting-group-stage');
      }
    }
    const activeBookings = Object.entries(bookings[itemId] || {}).filter(([, booking]) => {
      if (!booking || typeof booking !== 'object') return false;
      const art = booking.buchungsart || decodeBuchungsart(booking.rawdata?.ART);
      return art?.basis !== false && isDateWithinRange(monthDate, booking.startdate || '', booking.enddate || '');
    });
    if (!activeBookings.length) reasons.push('missing-basis-booking');
    else if (activeBookings.length > 1) reasons.push('ambiguous-basis-booking');
    const [bookingKey, booking] = activeBookings.length === 1 ? activeBookings[0] : [null, null];
    if (booking && sumWeightedBookingHours(booking) <= 0) reasons.push('missing-booking-hours');
    if (booking && groupId && hasConflictingAllocations(booking, groupId)) reasons.push('ambiguous-booking-groups');
    const stored = String(booking?.rawdata?.ZEITKAT || '').trim();
    const zeitkatId = booking ? (getZeitkatZoneIndex(stored) >= 0 ? stored : deriveZeitkatIdFromBooking(booking)) : null;
    if (booking && !zeitkatId) reasons.push('missing-zeitkat');
    if (groupId && zeitkatId && !pickApplicableValidityEntry(catalogs[groupId], monthDate, (entry) => (
      entry.enabled !== false && (typeof entry.monthlyAmount === 'number'
        || (typeof entry.monthlyAmount === 'string' && entry.monthlyAmount.trim() !== ''))
      && Number.isFinite(Number(entry.monthlyAmount)) && Number(entry.monthlyAmount) >= 0
      && getFeeBandZeitkatId(entry) === zeitkatId
    ))) reasons.push('missing-tariff');
    const hasBlockingReasons = reasons.length > 0;
    if (absenceBillingUnclear) reasons.push('Abrechnungsregel bei Abwesenheit ungeklärt');
    if (reasons.length) {
      gaps.push({ itemId, stage: state.stage, source: state.source, groupId, zeitkatId, reasons });
    }
    if (hasBlockingReasons) return;
    const financeBooking = { ...booking, itemId, groupId };
    demand.push(financeBooking);
    effectiveDataItems[itemId] = item;
    effectiveBookingsByItem[itemId] = { [bookingKey]: financeBooking };
    effectiveGroupAssignmentsByItem[itemId] = assignments || {};
    parentFeeSubsidyChildren.push({ itemId, item, groupId, bookings: [financeBooking], isSchoolChild: isAdebisTrue(booking.rawdata?.SCHULKIND) });
  });

  if (mode === 'projected') forecastInflow.forEach((entry, index) => {
    if (!entry.startdate || !isDateWithinRange(monthDate, entry.startdate, entry.enddate || '')) return;
    counts.projected += 1;
    gaps.push({ inflowIndex: index, stage: 'krippe', source: 'projected', groupId: null, zeitkatId: null, reasons: ['anonymous-inflow', 'unknown-group', 'missing-basis-booking'] });
  });
  return {
    mode, referenceDate, monthDate, counts, states, demand, effectiveDataItems,
    effectiveBookingsByItem, effectiveGroupAssignmentsByItem, parentFeeSubsidyChildren,
    diagnostics: { complete: gaps.length === 0, financialComplete: null, gaps },
  };
}
