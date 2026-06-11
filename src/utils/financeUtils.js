import { sumBookingHours } from './bookingUtils';
import { minutesToTime, timeToMinutes } from './timeUtils';

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
    return getQuarterBounds(`${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`);
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

function pickLatestValidityEntry(entries, predicate = () => true) {
  if (!Array.isArray(entries)) return null;

  const applicable = entries
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
  const resolved = resolveGroupIdsAtDate(groupAssignments, date, fallbackGroupId);
  return resolved[0] || null;
}

function asAssignmentsArray(groupAssignments) {
  return Array.isArray(groupAssignments)
    ? groupAssignments
    : Object.values(groupAssignments || {});
}

function pickActiveAssignment(groupAssignments, date) {
  const assignments = asAssignmentsArray(groupAssignments);
  return assignments
    .filter((assignment) => isDateWithinRange(date, assignment.start || '', assignment.end || ''))
    .sort((left, right) => (right.start || '').localeCompare(left.start || ''))[0] || null;
}

function getValidTimeSegments(assignment) {
  const segments = Array.isArray(assignment?.timeSegments) ? assignment.timeSegments : [];

  return segments
    .map((segment) => ({
      groupId: segment?.groupId ? String(segment.groupId) : '',
      startMinutes: timeToMinutes(segment?.startTime),
      endMinutes: timeToMinutes(segment?.endTime),
    }))
    .filter((segment) => segment.groupId && segment.startMinutes !== null && segment.endMinutes !== null && segment.endMinutes > segment.startMinutes)
    .sort((left, right) => left.startMinutes - right.startMinutes);
}

function normalizeAllocationShare(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

function distributeEvenAllocation(groupIds) {
  const normalized = [...new Set((groupIds || []).map((groupId) => String(groupId)).filter(Boolean))];
  if (normalized.length === 0) return [];
  const base = Math.floor(100 / normalized.length);
  const rest = 100 - (base * normalized.length);
  return normalized.map((groupId, index) => ({
    groupId,
    share: base + (index < rest ? 1 : 0),
  }));
}

function getSegmentAllocations(segment) {
  if (!segment) return [];

  if (Array.isArray(segment.groupAllocations) && segment.groupAllocations.length > 0) {
    const prepared = segment.groupAllocations
      .map((entry) => ({
        groupId: String(entry?.groupId || ''),
        share: normalizeAllocationShare(entry?.share),
      }))
      .filter((entry) => entry.groupId);

    if (prepared.length === 0) return [];

    const sum = prepared.reduce((total, entry) => total + entry.share, 0);
    if (sum <= 0) {
      return distributeEvenAllocation(prepared.map((entry) => entry.groupId));
    }

    return prepared.map((entry) => ({
      groupId: entry.groupId,
      share: (entry.share / sum) * 100,
    }));
  }

  if (segment.groupId) {
    return [{ groupId: String(segment.groupId), share: 100 }];
  }

  return [];
}

function hasBookingSegmentAllocations(booking) {
  return Array.isArray(booking?.times)
    && booking.times.some((dayEntry) => Array.isArray(dayEntry?.segments)
      && dayEntry.segments.some((segment) => getSegmentAllocations(segment).length > 0));
}

export function resolveGroupIdsAtDate(groupAssignments, date, fallbackGroupId = null) {
  const activeAssignment = pickActiveAssignment(groupAssignments, date);
  if (!activeAssignment) {
    return fallbackGroupId ? [String(fallbackGroupId)] : [];
  }

  if (activeAssignment.assignmentMode !== 'multiple') {
    return activeAssignment.groupId ? [String(activeAssignment.groupId)] : (fallbackGroupId ? [String(fallbackGroupId)] : []);
  }

  const segmentGroupIds = [...new Set(getValidTimeSegments(activeAssignment).map((segment) => segment.groupId))];
  if (segmentGroupIds.length > 0) return segmentGroupIds;

  return activeAssignment.groupId ? [String(activeAssignment.groupId)] : (fallbackGroupId ? [String(fallbackGroupId)] : []);
}

export function resolveGroupIdsForBounds(groupAssignments, bounds, fallbackGroupId = null) {
  if (!bounds?.start || !bounds?.end) {
    return fallbackGroupId ? [String(fallbackGroupId)] : [];
  }

  const assignments = asAssignmentsArray(groupAssignments)
    .filter((assignment) => rangesOverlap(assignment?.start || '', assignment?.end || '', bounds.start, bounds.end))
    .sort((left, right) => String(left.start || '').localeCompare(String(right.start || '')));

  if (assignments.length === 0) {
    return fallbackGroupId ? [String(fallbackGroupId)] : [];
  }

  const collected = new Set();
  assignments.forEach((assignment) => {
    if (assignment?.assignmentMode === 'multiple') {
      getValidTimeSegments(assignment).forEach((segment) => {
        collected.add(segment.groupId);
      });
      return;
    }

    if (assignment?.groupId) {
      collected.add(String(assignment.groupId));
    }
  });

  if (collected.size > 0) return [...collected];
  return fallbackGroupId ? [String(fallbackGroupId)] : [];
}

function subtractInterval(interval, overlapStart, overlapEnd) {
  if (overlapEnd <= interval.start || overlapStart >= interval.end) {
    return [interval];
  }

  const parts = [];
  if (overlapStart > interval.start) {
    parts.push({ start: interval.start, end: overlapStart });
  }
  if (overlapEnd < interval.end) {
    parts.push({ start: overlapEnd, end: interval.end });
  }
  return parts;
}

export function splitBookingByGroupAtDate(booking, groupAssignments, date, fallbackGroupId = null) {
  const activeAssignment = pickActiveAssignment(groupAssignments, date);
  const baseGroupId = activeAssignment?.groupId || fallbackGroupId || null;

  const bookingDefinesAllocations = hasBookingSegmentAllocations(booking);

  const groupedTimes = new Map();

  const appendSegment = (groupId, day, dayName, sourceSegment, startMinutes, endMinutes, allocationSharePercent = 100) => {
    if (endMinutes <= startMinutes) return;

    const key = groupId || '__NO_GROUP__';
    if (!groupedTimes.has(key)) groupedTimes.set(key, {});
    const byDay = groupedTimes.get(key);

    if (!byDay[dayName]) {
      byDay[dayName] = { day, day_name: dayName, segments: [] };
    }

    byDay[dayName].segments.push({
      ...sourceSegment,
      id: `${sourceSegment?.id || 'segment'}-${key}-${dayName}-${startMinutes}-${endMinutes}`,
      booking_start: minutesToTime(startMinutes),
      booking_end: minutesToTime(endMinutes),
      allocationSharePercent: Math.max(0, Number(allocationSharePercent) || 0),
    });
  };

  if (bookingDefinesAllocations) {
    (booking?.times || []).forEach((dayEntry) => {
      const day = dayEntry?.day;
      const dayName = dayEntry?.day_name;
      if (!dayName || !Array.isArray(dayEntry?.segments)) return;

      dayEntry.segments.forEach((segment) => {
        const start = timeToMinutes(segment?.booking_start);
        const end = timeToMinutes(segment?.booking_end);
        if (start === null || end === null || end <= start) return;

        const allocations = getSegmentAllocations(segment);
        if (allocations.length === 0) {
          appendSegment(null, day, dayName, segment, start, end, 100);
          return;
        }

        let assignedShare = 0;
        allocations.forEach((allocation) => {
          assignedShare += allocation.share;
          appendSegment(allocation.groupId, day, dayName, segment, start, end, allocation.share);
        });

        if (assignedShare < 99.999) {
          appendSegment(null, day, dayName, segment, start, end, 100 - assignedShare);
        }
      });
    });
  } else {
    if (!activeAssignment || activeAssignment.assignmentMode !== 'multiple') {
      return [{ ...booking, groupId: baseGroupId ? String(baseGroupId) : null }];
    }

    const timeSegments = getValidTimeSegments(activeAssignment);
    if (timeSegments.length === 0) {
      return [{ ...booking, groupId: baseGroupId ? String(baseGroupId) : null }];
    }

    (booking?.times || []).forEach((dayEntry) => {
      const day = dayEntry?.day;
      const dayName = dayEntry?.day_name;
      if (!dayName || !Array.isArray(dayEntry?.segments)) return;

      dayEntry.segments.forEach((segment) => {
        const start = timeToMinutes(segment?.booking_start);
        const end = timeToMinutes(segment?.booking_end);
        if (start === null || end === null || end <= start) return;

        let uncovered = [{ start, end }];
        timeSegments.forEach((groupSegment) => {
          const overlapStart = Math.max(start, groupSegment.startMinutes);
          const overlapEnd = Math.min(end, groupSegment.endMinutes);
          if (overlapEnd <= overlapStart) return;

          appendSegment(groupSegment.groupId, day, dayName, segment, overlapStart, overlapEnd, 100);

          uncovered = uncovered.flatMap((interval) => subtractInterval(interval, overlapStart, overlapEnd));
        });

        uncovered.forEach((interval) => {
          appendSegment(null, day, dayName, segment, interval.start, interval.end, 100);
        });
      });
    });
  }

  const splitBookings = [];
  groupedTimes.forEach((byDay, groupId) => {
    const times = Object.values(byDay)
      .map((dayEntry) => ({
        ...dayEntry,
        segments: dayEntry.segments.sort((left, right) => (
          timeToMinutes(left.booking_start) - timeToMinutes(right.booking_start)
        )),
      }))
      .filter((dayEntry) => dayEntry.segments.length > 0)
      .sort((left, right) => Number(left.day || 0) - Number(right.day || 0));

    if (times.length === 0) return;

    const resolvedGroupId = groupId === '__NO_GROUP__' ? null : groupId;
    splitBookings.push({
      ...booking,
      id: `${booking?.id || 'booking'}::${groupId}`,
      groupId: resolvedGroupId,
      times,
    });
  });

  if (splitBookings.length === 0) {
    return [{ ...booking, groupId: baseGroupId ? String(baseGroupId) : null }];
  }

  return splitBookings;
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
  const activePersonnelEntries = Array.isArray(itemFinance?.personnelCostHistory)
    ? itemFinance.personnelCostHistory.filter((entry) => isDateWithinRange(referenceDate, entry.validFrom || '', entry.validUntil || ''))
    : [];
  const salaryEntry = pickApplicableValidityEntry(itemFinance?.salaryHistory, referenceDate);
  const onCostEntry = pickApplicableValidityEntry(itemFinance?.employerOnCostHistory, referenceDate);

  let annualGrossSalary = 0;
  let employerOnCostPercent = 0;
  let baseMonthlyCost = 0;

  if (activePersonnelEntries.length > 0) {
    let weightedOnCostNumerator = 0;
    activePersonnelEntries.forEach((entry) => {
      const annual = Number(entry?.annualGrossSalary) || 0;
      const onCostPercent = Number(entry?.employerOnCostPercent) || 0;
      annualGrossSalary += annual;
      weightedOnCostNumerator += annual * onCostPercent;
      baseMonthlyCost += (annual / 12) * (1 + (onCostPercent / 100));
    });

    employerOnCostPercent = annualGrossSalary > 0
      ? (weightedOnCostNumerator / annualGrossSalary)
      : 0;
  } else {
    annualGrossSalary = Number(
      personnelEntry?.annualGrossSalary ?? salaryEntry?.annualGrossSalary
    ) || 0;
    employerOnCostPercent = Number(
      personnelEntry?.employerOnCostPercent ?? onCostEntry?.employerOnCostPercent
    ) || 0;
    baseMonthlyCost = (annualGrossSalary / 12) * (1 + (employerOnCostPercent / 100));
  }

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
  const bayKiBiGRule = pickApplicableValidityEntry(financeScenario?.bayKiBiGRules, referenceDate)
    || pickLatestValidityEntry(financeScenario?.bayKiBiGRules);
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
