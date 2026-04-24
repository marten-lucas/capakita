import { sumBookingHours } from './bookingUtils';

function parseIsoDate(value) {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getComparableStart(value) {
  return value?.validFrom || value?.startdate || value?.start || '';
}

function getComparableEnd(value) {
  return value?.validUntil || value?.enddate || value?.end || '';
}

export function isDateWithinRange(date, start, end) {
  if (!date) return false;
  const startOk = !start || start <= date;
  const endOk = !end || end >= date;
  return startOk && endOk;
}

export function isRecordActiveOnDate(record, date) {
  return isDateWithinRange(date, getComparableStart(record), getComparableEnd(record));
}

export function rangesOverlap(startA, endA, startB, endB) {
  const effectiveStartA = startA || '0000-01-01';
  const effectiveEndA = endA || '9999-12-31';
  const effectiveStartB = startB || '0000-01-01';
  const effectiveEndB = endB || '9999-12-31';
  return effectiveStartA <= effectiveEndB && effectiveStartB <= effectiveEndA;
}

export function getWeekBounds(referenceDate) {
  const parsed = parseIsoDate(referenceDate);
  if (!parsed) return null;
  const day = parsed.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addUtcDays(parsed, mondayOffset);
  const end = addUtcDays(start, 6);
  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
  };
}

function getMonthBounds(referenceDate) {
  const parsed = parseIsoDate(referenceDate);
  if (!parsed) return null;
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
  };
}

function getQuarterBounds(referenceDate) {
  const parsed = parseIsoDate(referenceDate);
  if (!parsed) return null;
  const year = parsed.getUTCFullYear();
  const quarterStartMonth = Math.floor(parsed.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(year, quarterStartMonth, 1));
  const end = new Date(Date.UTC(year, quarterStartMonth + 3, 0));
  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
  };
}

function getYearBounds(referenceDate) {
  const parsed = parseIsoDate(referenceDate);
  if (!parsed) return null;
  const year = parsed.getUTCFullYear();
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

function getIsoWeekStart(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = addUtcDays(jan4, 1 - jan4Day);
  return addUtcDays(mondayWeek1, (week - 1) * 7);
}

export function getPeriodBoundsForCategory(timedimension, category) {
  if (!category) return null;

  if (timedimension === 'week') {
    const match = /^(\d{4})-W(\d{1,2})$/.exec(category);
    if (!match) return null;
    const year = Number(match[1]);
    const week = Number(match[2]);
    const startDate = getIsoWeekStart(year, week);
    const endDate = addUtcDays(startDate, 6);
    return { start: formatIsoDate(startDate), end: formatIsoDate(endDate) };
  }

  if (timedimension === 'month') {
    return getMonthBounds(`${category}-01`);
  }

  if (timedimension === 'quarter') {
    const match = /^(\d{4})-Q([1-4])$/.exec(category);
    if (!match) return null;
    const year = Number(match[1]);
    const quarter = Number(match[2]);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 0));
    return { start: formatIsoDate(start), end: formatIsoDate(end) };
  }

  if (timedimension === 'year') {
    return getYearBounds(`${category}-01-01`);
  }

  return { start: category, end: category };
}

export function convertMonthlyAmountToPeriod(monthlyAmount, timedimension) {
  const numericAmount = Number(monthlyAmount) || 0;
  if (timedimension === 'week') {
    return (numericAmount * 12) / 52;
  }
  if (timedimension === 'quarter') {
    return numericAmount * 3;
  }
  if (timedimension === 'year') {
    return numericAmount * 12;
  }
  return numericAmount;
}

export function pickApplicableValidityEntry(entries, date, predicate = () => true) {
  if (!Array.isArray(entries)) return null;

  const applicable = entries
    .filter((entry) => isDateWithinRange(date, entry.validFrom || '', entry.validUntil || ''))
    .filter(predicate)
    .sort((left, right) => {
      const leftStart = left.validFrom || '';
      const rightStart = right.validFrom || '';
      if (leftStart === rightStart) return String(left.id).localeCompare(String(right.id));
      return rightStart.localeCompare(leftStart);
    });

  return applicable[0] || null;
}

export function resolveGroupIdAtDate(groupAssignments, date, fallbackGroupId = null) {
  const assignments = Array.isArray(groupAssignments)
    ? groupAssignments
    : Object.values(groupAssignments || {});

  const activeAssignment = assignments
    .filter((assignment) => isDateWithinRange(date, assignment.start || '', assignment.end || ''))
    .sort((left, right) => (right.start || '').localeCompare(left.start || ''))[0];

  return activeAssignment?.groupId || fallbackGroupId || null;
}

function getAgeInYearsAtDate(dateOfBirth, referenceDate) {
  const birthDate = parseIsoDate(dateOfBirth);
  const compareDate = parseIsoDate(referenceDate);
  if (!birthDate || !compareDate) return null;

  let age = compareDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const compareMonth = compareDate.getUTCMonth();
  const birthMonth = birthDate.getUTCMonth();
  if (
    compareMonth < birthMonth ||
    (compareMonth === birthMonth && compareDate.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}

/**
 * Calculates BayKiBiG weight for a child based on 8 legal categories.
 * Returns the highest applicable weight (weights are additive in priority order).
 * 
 * Categories (from BayKiBiG law):
 * 1. Children < 3 years: 2.0
 * 2. Children 3–school: 1.0
 * 3. School-age: 1.2
 * 4. Children with disability (SGB IX §99 agreement): 4.5
 * 5. Temporary disability (6-month application period): 4.5
 * 6. Day-care (Tagespflege): 1.3
 * 7. Disabled children in day-care: 4.5
 * 8. Children of non-German-speaking parents: 1.3
 */
/**
 * Calculate BayKiBiG weight for a child based on 8 legal categories.
 * Optionally uses weight factors from official BayKiBiG rule.
 * 
 * @param {Object} child - Child data item with attributes like hasDisability, dateofbirth, etc.
 * @param {Object} groupDef - Group definition (for school-age type detection)
 * @param {string} referenceDate - ISO date for age/disability window calculations
 * @param {Object} weightFactors - Optional weight factors from BayKiBiG rule {regelkind_3to6, schulkind, migration, under3, disabled}
 * @returns {number} Calculated weight for BayKiBiG subsidy
 */
export function getBayKiBiGWeightForChild(child, groupDef, referenceDate, weightFactors = null) {
  if (!child) return 1;

  // Use provided weight factors as defaults (from official table import)
  const factors = {
    regelkind_3to6: weightFactors?.regelkind_3to6 ?? 1.0,
    schulkind: weightFactors?.schulkind ?? 1.2,
    migration: weightFactors?.migration ?? 1.3,
    under3: weightFactors?.under3 ?? 2.0,
    disabled: weightFactors?.disabled ?? 4.5,
  };

  // Category 3: School-age children
  if (groupDef?.type === 'Schulkindgruppe') return factors.schulkind;

  const derivedAge = getAgeInYearsAtDate(child.dateofbirth, referenceDate);
  const age = Number.isFinite(derivedAge) ? derivedAge : Number(child.age || child.rawdata?.ALTER || 3);

  let weight = factors.regelkind_3to6; // Default weight for category 2 (3–school)

  // Category 1: Children < 3 years
  if (Number.isFinite(age) && age < 3) {
    weight = factors.under3;
  }

  // Category 4: Permanent disability with SGB IX agreement - overrides base weight
  if (child.hasDisability === true) {
    return factors.disabled;
  }

  // Category 5: Temporary disability (6-month application period)
  if (child.temporaryDisabilityDate) {
    const tempDisabilityDate = parseIsoDate(child.temporaryDisabilityDate);
    const currentDate = parseIsoDate(referenceDate);
    if (tempDisabilityDate && currentDate) {
      const daysSinceApplication = Math.floor(
        (currentDate.getTime() - tempDisabilityDate.getTime()) / 86400000
      );
      // Active for 6 months (180 days)
      if (daysSinceApplication >= 0 && daysSinceApplication <= 180) {
        return factors.disabled;
      }
    }
  }

  // Category 6: Children in day-care (Tagespflege)
  if (child.isInDaycare === true) {
    return factors.migration; // Day-care uses same factor as migration (1.3)
  }

  // Category 8: Children of non-German-speaking parents
  if (child.hasNonGermanSpeakingParents === true) {
    return factors.migration;
  }

  return weight;
}

export function calculateAverageWeeklyHoursForDate(bookings, date) {
  if (!Array.isArray(bookings)) return 0;
  return bookings
    .filter((booking) => isRecordActiveOnDate(booking, date))
    .reduce((total, booking) => total + sumBookingHours(booking), 0);
}

export function hasAnyBookingInWeek(bookings, referenceDate) {
  if (!Array.isArray(bookings)) return false;
  const weekBounds = getWeekBounds(referenceDate);
  if (!weekBounds) return false;

  return bookings.some((booking) => (
    rangesOverlap(
      getComparableStart(booking),
      getComparableEnd(booking),
      weekBounds.start,
      weekBounds.end
    ) && sumBookingHours(booking) > 0
  ));
}

function getAbsenceDayCostShare(absence, isoDate, thresholdDays = 42, employerShareAfterThreshold) {
  const payType = absence?.payType || 'fully_paid';
  if (payType === 'fully_paid') return 1;
  if (payType === 'unpaid') return 0;

  const start = parseIsoDate(absence?.start || absence?.startdate || '');
  const current = parseIsoDate(isoDate);
  if (!start || !current) return 1;

  const daysSinceStart = Math.floor((current.getTime() - start.getTime()) / 86400000) + 1;
  if (daysSinceStart <= thresholdDays) return 1;
  return Math.max(0, Number(employerShareAfterThreshold) || 0) / 100;
}

export function calculateMonthlyStaffCost({
  item,
  itemFinance,
  referenceDate,
  partialAbsenceThresholdDays = 42,
  partialAbsenceEmployerSharePercent = 0,
}) {
  if (!item || item.type !== 'capacity' || !isRecordActiveOnDate(item, referenceDate)) {
    return {
      annualGrossSalary: 0,
      employerOnCostPercent: 0,
      baseMonthlyCost: 0,
      adjustedMonthlyCost: 0,
      absenceCostFactor: 1,
    };
  }

  const personnelEntry = pickApplicableValidityEntry(itemFinance?.personnelCostHistory, referenceDate);
  const salaryEntry = pickApplicableValidityEntry(itemFinance?.salaryHistory, referenceDate);
  const onCostEntry = pickApplicableValidityEntry(itemFinance?.employerOnCostHistory, referenceDate);
  const annualGrossSalary = Number(
    personnelEntry?.annualGrossSalary ?? salaryEntry?.annualGrossSalary
  ) || 0;
  const employerOnCostPercent = Number(
    personnelEntry?.employerOnCostPercent ?? onCostEntry?.employerOnCostPercent
  ) || 0;
  const baseMonthlyCost = (annualGrossSalary / 12) * (1 + (employerOnCostPercent / 100));

  const monthBounds = getMonthBounds(referenceDate);
  if (!monthBounds || baseMonthlyCost === 0) {
    return {
      annualGrossSalary,
      employerOnCostPercent,
      baseMonthlyCost,
      adjustedMonthlyCost: baseMonthlyCost,
      absenceCostFactor: 1,
    };
  }

  const absences = Array.isArray(item.absences) ? item.absences : [];
  let payableDays = 0;
  let totalDays = 0;
  for (let cursor = parseIsoDate(monthBounds.start); cursor && formatIsoDate(cursor) <= monthBounds.end; cursor = addUtcDays(cursor, 1)) {
    const isoDate = formatIsoDate(cursor);
    totalDays += 1;
    const activeAbsence = absences.find((absence) => isDateWithinRange(isoDate, absence.start || absence.startdate || '', absence.end || absence.enddate || ''));
    payableDays += activeAbsence
      ? getAbsenceDayCostShare(activeAbsence, isoDate, partialAbsenceThresholdDays, partialAbsenceEmployerSharePercent)
      : 1;
  }

  const absenceCostFactor = totalDays > 0 ? payableDays / totalDays : 1;
  return {
    annualGrossSalary,
    employerOnCostPercent,
    baseMonthlyCost,
    adjustedMonthlyCost: baseMonthlyCost * absenceCostFactor,
    absenceCostFactor,
  };
}

export function calculateChildMonthlyRevenue({
  item,
  bookings,
  groupAssignments,
  groupDefs,
  financeScenario,
  referenceDate,
}) {
  if (!item || item.type !== 'demand' || !isRecordActiveOnDate(item, referenceDate)) {
    return {
      weeklyHours: 0,
      parentFeeAmount: 0,
      bayKiBiGAmount: 0,
      totalAmount: 0,
      groupId: null,
      feeEntry: null,
      bayKiBiGRule: null,
      bayKiBiGWeight: 0,
    };
  }

  const weeklyHours = calculateAverageWeeklyHoursForDate(bookings, referenceDate);
  const groupId = resolveGroupIdAtDate(groupAssignments, referenceDate, item.groupId || null);
  const groupDef = (groupDefs || []).find((entry) => String(entry.id) === String(groupId));
  const feeCatalog = financeScenario?.groupFeeCatalogs?.[groupId] || [];
  const feeEntry = pickApplicableValidityEntry(
    feeCatalog,
    referenceDate,
    (entry) => {
      const minHours = Number(entry.minHours);
      const maxHours = Number(entry.maxHours);
      const minOk = !Number.isFinite(minHours) || weeklyHours >= minHours;
      const maxOk = !Number.isFinite(maxHours) || weeklyHours <= maxHours;
      return minOk && maxOk;
    }
  );
  const bayKiBiGRule = pickApplicableValidityEntry(financeScenario?.bayKiBiGRules, referenceDate);
  const bayKiBiGWeight = getBayKiBiGWeightForChild(item, groupDef, referenceDate, bayKiBiGRule?.weightFactors);
  const parentFeeAmount = Number(feeEntry?.monthlyAmount) || 0;
  const bayKiBiGAmount = (Number(bayKiBiGRule?.baseValue) || 0) * bayKiBiGWeight;

  return {
    weeklyHours,
    parentFeeAmount,
    bayKiBiGAmount,
    totalAmount: parentFeeAmount + bayKiBiGAmount,
    groupId,
    feeEntry,
    bayKiBiGRule,
    bayKiBiGWeight,
  };
}

export function createEmptyFinanceSummary() {
  return {
    incomeParents: 0,
    incomeBayKiBiG: 0,
    incomeTotal: 0,
    expensesPersonnel: 0,
    expensesTotal: 0,
    net: 0,
  };
}

export function calculateScenarioMonthlyFinance({
  referenceDate,
  effectiveDataItems,
  effectiveBookingsByItem,
  effectiveGroupAssignmentsByItem,
  effectiveGroupDefs,
  financeScenario,
}) {
  const summary = createEmptyFinanceSummary();
  const childRows = [];
  const staffRows = [];

  Object.entries(effectiveDataItems || {}).forEach(([itemId, item]) => {
    const bookings = Object.values(effectiveBookingsByItem?.[itemId] || {});
    const groupAssignments = effectiveGroupAssignmentsByItem?.[itemId] || {};
    const itemFinance = financeScenario?.itemFinances?.[itemId] || null;

    if (item?.type === 'demand') {
      const childFinance = calculateChildMonthlyRevenue({
        item,
        bookings,
        groupAssignments,
        groupDefs: effectiveGroupDefs,
        financeScenario,
        referenceDate,
      });
      if (childFinance.totalAmount > 0) {
        childRows.push({ itemId, item, ...childFinance });
      }
      summary.incomeParents += childFinance.parentFeeAmount;
      summary.incomeBayKiBiG += childFinance.bayKiBiGAmount;
      summary.incomeTotal += childFinance.totalAmount;
    }

    if (item?.type === 'capacity') {
      const staffFinance = calculateMonthlyStaffCost({
        item,
        itemFinance,
        referenceDate,
        partialAbsenceThresholdDays: financeScenario?.settings?.partialAbsenceThresholdDays ?? 42,
        partialAbsenceEmployerSharePercent: financeScenario?.settings?.partialAbsenceEmployerSharePercent ?? 0,
      });
      if (staffFinance.adjustedMonthlyCost > 0) {
        staffRows.push({ itemId, item, ...staffFinance });
      }
      summary.expensesPersonnel += staffFinance.adjustedMonthlyCost;
      summary.expensesTotal += staffFinance.adjustedMonthlyCost;
    }
  });

  summary.net = summary.incomeTotal - summary.expensesTotal;

  return {
    summary,
    childRows,
    staffRows,
  };
}
