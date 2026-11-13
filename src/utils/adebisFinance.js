import { decodeBuchungsart, GEWKAT_CATALOG, getFeeBandZeitkatId } from './adebisConstants';
import { sumWeightedBookingHours } from './chartUtils/chartUtils';
import {
  calculateChildMonthlyRevenue, calculateScenarioMonthlyFinance, getBayKiBiGWeightForChild,
  getAbsenceRange, getPeriodBoundsForCategory, isRecordActiveOnDate, pickApplicableValidityEntry, rangesOverlap,
} from './financeUtils';


/** ADEBIS analysis: one month of weighted daily hours at the annual basis value. */
export function calculateAdebisMonthlyBaseFunding(weightedDailyHours, annualBasisValue) {
  if (weightedDailyHours == null || annualBasisValue == null
    || !Number.isFinite(Number(weightedDailyHours)) || Number(weightedDailyHours) < 0
    || !Number.isFinite(Number(annualBasisValue)) || Number(annualBasisValue) <= 0) return null;
  return Number(weightedDailyHours) * Number(annualBasisValue) / 24;
}

/** Gross fee and ADEBIS base funding at a snapshot, not the total funding entitlement. */
export function calculateAdebisChildMonthlyRevenue(input) {
  const { item, bookings = [], groupDefs = [], financeScenario, referenceDate } = input;
  if (!item || item.type !== 'demand' || !isRecordActiveOnDate(item, referenceDate)) {
    return { weeklyHours: 0, parentFeeAmount: 0, bayKiBiGAmount: 0, totalAmount: 0, reasons: [] };
  }
  const legacy = calculateChildMonthlyRevenue(input);
  const activeBasis = bookings.filter((booking) => isRecordActiveOnDate(booking, referenceDate)
    && (booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART))?.basis !== false);
  const reasons = [];
  if (activeBasis.length !== 1) reasons.push(activeBasis.length ? 'Mehrere aktive Basisbuchungen' : 'Basisbuchung fehlt');
  const booking = activeBasis.length === 1 ? activeBasis[0] : null;
  const assignments = Object.values(input.groupAssignments || {}).filter((entry) => entry && isRecordActiveOnDate(entry, referenceDate));
  const assignmentGroups = new Set(assignments.map((entry) => String(entry.groupId || '')));
  const ambiguousGroup = assignments.some((entry) => entry.assignmentMode === 'multiple') || assignmentGroups.size > 1
    || (Array.isArray(booking?.times) && booking.times.some((day) => (Array.isArray(day?.segments) ? day.segments : []).some((segment) => (
      (segment.groupId && String(segment.groupId) !== String(legacy.groupId || ''))
      || (Array.isArray(segment.groupAllocations) && segment.groupAllocations.some((allocation) => !allocation.groupId || String(allocation.groupId) !== String(legacy.groupId || '')))
    ))));
  if (ambiguousGroup) reasons.push('Buchungsgruppe ungeklärt');
  const monthStart = `${referenceDate.slice(0, 7)}-01`;
  const monthEndDate = new Date(`${monthStart}T00:00:00Z`);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const absenceUnclear = item.absences != null && (!Array.isArray(item.absences) || item.absences.some((absence) => {
    if (!absence || typeof absence !== 'object') return true;
    const { start, end } = getAbsenceRange(absence);
    if ((start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) || (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) || (start && end && start > end)) return true;
    return rangesOverlap(start, end, monthStart, monthEnd);
  }));
  if (absenceUnclear) reasons.push('Abrechnungsregel bei Abwesenheit ungeklärt');
  const weeklyHours = booking ? sumWeightedBookingHours(booking) : 0;
  if (booking && weeklyHours <= 0) reasons.push('Buchungsstunden fehlen');
  const rule = pickApplicableValidityEntry(financeScenario?.bayKiBiGRules, referenceDate);
  if (!rule || !(Number(rule.baseValue) > 0)) reasons.push('Gültiger Jahresbasiswert fehlt');
  const gewkat = String(booking?.rawdata?.GEWKAT || '').trim().toUpperCase();
  const birthDate = String(item.dateofbirth || '');
  const parsedBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? Date.parse(`${birthDate}T00:00:00Z`) : NaN;
  const validBirthDate = Number.isFinite(parsedBirthDate) && new Date(parsedBirthDate).toISOString().slice(0, 10) === birthDate;
  const knownGewkat = GEWKAT_CATALOG.some((entry) => entry.id === gewkat);
  if (!knownGewkat && !validBirthDate) reasons.push('Gewichtung bzw. Geburtsdatum ungeklärt');
  const group = groupDefs.find((entry) => String(entry.id) === String(legacy.groupId));
  if (!knownGewkat && validBirthDate && !group?.type) reasons.push('Betreuungsstufe für Gewichtung ungeklärt');
  const weight = booking && rule ? getBayKiBiGWeightForChild(item, group, referenceDate, rule.weightFactors, booking) : null;
  const funding = reasons.length ? null : calculateAdebisMonthlyBaseFunding(weeklyHours * weight / 5, rule.baseValue);
  const feeEntry = pickApplicableValidityEntry(financeScenario?.groupFeeCatalogs?.[legacy.groupId], referenceDate, (entry) => (
    entry.enabled !== false && getFeeBandZeitkatId(entry) === legacy.zeitkatId
    && entry.monthlyAmount != null && String(entry.monthlyAmount).trim() !== ''
    && Number.isFinite(Number(entry.monthlyAmount)) && Number(entry.monthlyAmount) >= 0
  ));
  const fee = !absenceUnclear && !ambiguousGroup && booking && legacy.zeitkatId && feeEntry ? Number(feeEntry.monthlyAmount) : null;
  if (!booking || !legacy.zeitkatId || !feeEntry) reasons.push('Gruppe, ZEITKAT oder Beitragstarif ungeklärt');
  return { ...legacy, weeklyHours, parentFeeAmount: fee, bayKiBiGAmount: funding,
    totalAmount: fee == null || funding == null ? null : fee + funding, reasons };
}

/** Scenario snapshot: preserve personnel calculations, but do not turn missing child inputs into zero. */
export function calculateAdebisScenarioMonthlyFinance(input) {
  const legacy = calculateScenarioMonthlyFinance(input);
  const children = Object.entries(input.effectiveDataItems || {}).filter(([, item]) => item?.type === 'demand')
    .map(([itemId, item]) => ({ itemId, ...calculateAdebisChildMonthlyRevenue({
      item, bookings: Object.values(input.effectiveBookingsByItem?.[itemId] || {}),
      groupAssignments: input.effectiveGroupAssignmentsByItem?.[itemId] || {},
      groupDefs: input.effectiveGroupDefs, financeScenario: input.financeScenario, referenceDate: input.referenceDate,
    }) }));
  const total = (field) => children.some((child) => child[field] == null) ? null
    : children.reduce((sum, child) => sum + child[field], 0);
  const incomeParents = total('parentFeeAmount');
  const incomeBayKiBiG = total('bayKiBiGAmount');
  const incomeTotal = incomeParents == null || incomeBayKiBiG == null ? null : incomeParents + incomeBayKiBiG;
  const validAmount = (value) => value != null && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
  const missingStaffCost = Object.entries(input.effectiveDataItems || {}).some(([itemId, item]) => {
    if (item?.type !== 'capacity' || !isRecordActiveOnDate(item, input.referenceDate)) return false;
    const finance = input.financeScenario?.itemFinances?.[itemId];
    const active = (finance?.personnelCostHistory || []).filter((entry) => isRecordActiveOnDate(entry, input.referenceDate));
    if (active.length) return active.some((entry) => !validAmount(entry.annualGrossSalary) || !validAmount(entry.employerOnCostPercent));
    const salary = pickApplicableValidityEntry(finance?.salaryHistory, input.referenceDate);
    const onCost = pickApplicableValidityEntry(finance?.employerOnCostHistory, input.referenceDate);
    return !validAmount(salary?.annualGrossSalary) || !validAmount(onCost?.employerOnCostPercent);
  });
  const expensesTotal = missingStaffCost ? null : legacy.summary.expensesTotal;
  return { ...legacy, childRows: children, summary: { ...legacy.summary, incomeParents, incomeBayKiBiG, incomeTotal,
    expensesPersonnel: missingStaffCost ? null : legacy.summary.expensesPersonnel, expensesTotal,
    net: incomeTotal == null || expensesTotal == null ? null : incomeTotal - expensesTotal } };
}

/** Month-start snapshots for long periods; weeks are explicitly an estimate. */
export function calculateAdebisFinancePeriod(input, timedimension, category) {
  const bounds = getPeriodBoundsForCategory(timedimension, category);
  if (!bounds) return { income: null, expenses: null, net: null };
  const dates = [];
  if (timedimension === 'year' || timedimension === 'quarter') {
    const date = new Date(`${bounds.start}T00:00:00Z`);
    while (date.toISOString().slice(0, 10) <= bounds.end) {
      dates.push(date.toISOString().slice(0, 10));
      date.setUTCMonth(date.getUTCMonth() + 1);
    }
  } else dates.push(bounds.start);
  const snapshots = dates.map((referenceDate) => calculateAdebisScenarioMonthlyFinance({ ...input, referenceDate }).summary);
  const scale = timedimension === 'week' ? 12 / 52 : 1;
  const sum = (field) => snapshots.some((snapshot) => snapshot[field] == null) ? null
    : snapshots.reduce((value, snapshot) => value + snapshot[field], 0) * scale;
  return { income: sum('incomeTotal'), expenses: sum('expensesTotal'), net: sum('net') };
}
