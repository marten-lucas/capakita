import { calculateAverageWeeklyHoursForDate, getBayKiBiGWeightForChild, isRecordActiveOnDate } from './financeUtils';
import { decodeBuchungsart, isAdebisTrue, qualifikationInfo } from './adebisConstants';
import { sumWeightedBookingHours } from './chartUtils/chartUtils';
import { calculateAdebisMonthlyBaseFunding } from './adebisFinance';

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (normalized === '') return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isStaffActiveInAnalysisMonth(item, referenceDate) {
  if (item?.type !== 'capacity' || isAdebisTrue(item?.rawdata?.STATHIDE)) return false;
  const monthKey = String(referenceDate || '').slice(0, 7);
  const startDate = String(item.startdate || '').slice(0, 10);
  const endDate = String(item.enddate || '').slice(0, 10);
  const startMonth = startDate.slice(0, 7);
  const endMonth = endDate.slice(0, 7);
  const startUsesMonthRule = !item?.rawdata?.BEGINNMODE || item.rawdata.BEGINNMODE === 'E';
  const endUsesMonthRule = !item?.rawdata?.ENDMODE || item.rawdata.ENDMODE === 'E';

  if (startDate && (startMonth > monthKey || (startMonth === monthKey && !startUsesMonthRule && startDate > referenceDate))) return false;
  if (endDate && (endMonth < monthKey || (endMonth === monthKey && !endUsesMonthRule && endDate < referenceDate))) return false;
  return true;
}

function getAgeInMonths(item, referenceDate) {
  const dateOfBirth = String(item?.dateofbirth || item?.rawdata?.GEBDATUM || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);
  const [year, month, day] = String(referenceDate || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  let ageMonths = (year - birthYear) * 12 + month - birthMonth;
  if (day < birthDay) ageMonths -= 1;
  return ageMonths;
}

function hasUnderThreeFundingMarker(item, bookings, referenceDate) {
  if (isAdebisTrue(item?.rawdata?.KEINUNTER3)
    || isAdebisTrue(item?.rawdata?.LLU3AUSNAHME)
    || (bookings || []).some((booking) => (
      isAdebisTrue(booking?.rawdata?.KEINUNTER3)
      || isAdebisTrue(booking?.rawdata?.LLU3AUSNAHME)
    ))) return false;
  if (isAdebisTrue(item?.rawdata?.ISKRIPPENKIND)
    || (bookings || []).some((booking) => isAdebisTrue(booking?.rawdata?.ISKRIPPENKIND)
      || isAdebisTrue(booking?.rawdata?.KRIPPENK)
      || isAdebisTrue(booking?.rawdata?.FIXUNTER3)
      || ['D', 'DA', 'DB'].includes(String(booking?.rawdata?.GEWKAT || '').trim().toUpperCase()))) return true;
  const ageMonths = getAgeInMonths(item, referenceDate);
  return ageMonths != null && ageMonths < 36;
}

function hasPreparatoryCourseMarker(bookings) {
  return bookings.some((booking) => isAdebisTrue(booking?.rawdata?.VORKURS));
}

function isStaffExpert(itemId, item, assignmentsByItem, qualificationDefsByKey) {
  const assignment = Object.values(assignmentsByItem?.[itemId] || {})[0];
  const qualification = assignment?.qualification || item?.rawdata?.QUALIFIK;
  if (!qualification) return false;

  const definition = qualificationDefsByKey?.[String(qualification)];
  if (typeof definition?.IsExpert === 'boolean') return definition.IsExpert;
  return qualifikationInfo(qualification)?.isExpert ?? true;
}

/** Aggregates the ADEBIS analysis values that Capakita can derive for a month. */
export function calculateAdebisMonthMetrics({
  monthlyFinance,
  simulationData,
  qualificationDefs = [],
  groupDefs = [],
  basisValue: basisValueOverride,
  qualityBonusBenchmark = 0,
  under3AdditionalFactor = 0.025,
  under3ChildrenOverride = null,
  under3AdditionalOverride = null,
  activeBasisChildRecords = null,
  preparatoryCoursePerChild = 0,
  integratedChildrenOverride = null,
  expertRatioPercentOverride = null,
  operatingDaysOverride = null,
  referenceDate,
}) {
  const childRowsById = new Map();
  (monthlyFinance?.childRows || []).forEach((row) => {
    const id = String(row.itemId);
    if (!childRowsById.has(id)) childRowsById.set(id, row);
  });
  const childRows = Array.from(childRowsById.values());
  const qualificationDefsByKey = Object.fromEntries(
    (qualificationDefs || []).map((definition) => [String(definition.key), definition])
  );
  const groupDefsById = new Map((groupDefs || []).map((definition) => [String(definition.id), definition]));
  const childMetricsById = {};
  childRows.forEach((row) => {
    const id = String(row.itemId);
    const item = row.item || simulationData?.dataItems?.[id] || {};
    const activeBookings = Object.values(simulationData?.bookingsByItem?.[id] || {})
      .filter((booking) => isRecordActiveOnDate(booking, referenceDate));
    const basisBookings = activeBookings.filter((booking) => {
      const kind = booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART);
      return kind ? kind.basis !== false : true;
    });
    let weeklyHours = 0;
    let weightedWeeklyHours = 0;

    if (activeBookings.length === 0) {
      weeklyHours = Number(row.weeklyHours) || 0;
      weightedWeeklyHours = weeklyHours * (Number(row.bayKiBiGWeight) || 0);
    } else {
      const groupDef = groupDefsById.get(String(row.groupId)) || null;
      basisBookings.forEach((booking) => {
        const bookingHours = sumWeightedBookingHours(booking);
        const weight = getBayKiBiGWeightForChild(
          item,
          groupDef,
          referenceDate,
          row.bayKiBiGRule?.weightFactors,
          booking
        );
        weeklyHours += bookingHours;
        weightedWeeklyHours += bookingHours * weight;
      });
    }

    if (weeklyHours > 0) {
      childMetricsById[id] = {
        weeklyHours,
        weightedDailyHours: weightedWeeklyHours / 5,
        under3: hasUnderThreeFundingMarker(item, basisBookings, referenceDate),
        preparatoryCourse: hasPreparatoryCourseMarker(basisBookings),
      };
    }
  });
  const measuredChildren = Object.values(childMetricsById);
  const children = measuredChildren.length;
  const weeklyBookingHours = measuredChildren.reduce((sum, child) => sum + child.weeklyHours, 0);
  const weightedDailyBookingHours = measuredChildren.reduce((sum, child) => sum + child.weightedDailyHours, 0);
  const overTwentyHoursChildren = measuredChildren.filter((child) => child.weeklyHours >= 20).length;
  const derivedUnder3Children = Array.isArray(activeBasisChildRecords)
    ? new Set(activeBasisChildRecords.flatMap((record) => {
      const itemId = String(record?.itemId || '');
      const item = record?.item || simulationData?.dataItems?.[itemId] || {};
      const activeBasisBookings = (record?.bookings || []).filter((booking) => (
        isRecordActiveOnDate(booking, referenceDate)
        && (booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART))?.basis !== false
      ));
      return itemId && item?.type === 'demand' && activeBasisBookings.length > 0
        && hasUnderThreeFundingMarker(item, activeBasisBookings, referenceDate)
        ? [itemId]
        : [];
    })).size
    : measuredChildren.filter((child) => child.under3).length;
  const under3ChildrenOverrideValue = toNumber(under3ChildrenOverride);
  const under3Children = under3ChildrenOverrideValue ?? derivedUnder3Children;
  const preparatoryCourseChildren = measuredChildren.filter((child) => child.preparatoryCourse).length;
  const childBasisValue = childRows.find((row) => Number.isFinite(Number(row.bayKiBiGRule?.baseValue)))?.bayKiBiGRule?.baseValue;
  const basisValue = Number(basisValueOverride ?? childBasisValue) || 0;
  const qualityBonus = weightedDailyBookingHours * (Number(qualityBonusBenchmark) || 0) / 48;
  const calculatedUnder3Additional = under3Children * basisValue * (Number(under3AdditionalFactor) || 0);
  const under3AdditionalOverrideValue = toNumber(under3AdditionalOverride);
  const under3Additional = under3AdditionalOverrideValue ?? calculatedUnder3Additional;
  const preparatoryCourses = preparatoryCourseChildren * (Number(preparatoryCoursePerChild) || 0);

  let totalStaffHours = 0;
  let expertStaffHours = 0;
  Object.entries(simulationData?.dataItems || {}).forEach(([itemId, item]) => {
    if (!isStaffActiveInAnalysisMonth(item, referenceDate)) return;

    const contractHours = toNumber(item?.rawdata?.ARBZEIT);
    const scheduleHours = calculateAverageWeeklyHoursForDate(
      Object.values(simulationData?.bookingsByItem?.[itemId] || {}),
      referenceDate
    );
    const hours = Math.max(0, contractHours ?? scheduleHours);
    totalStaffHours += hours;
    if (isStaffExpert(itemId, item, simulationData?.qualificationAssignmentsByItem, qualificationDefsByKey)) {
      expertStaffHours += hours;
    }
  });

  const minimumExpertHours = weightedDailyBookingHours / 4.4;
  const monthlyBaseFunding = calculateAdebisMonthlyBaseFunding(weightedDailyBookingHours, basisValue);

  return {
    children,
    childrenById: childMetricsById,
    weeklyBookingHours,
    under3Children,
    under3ChildrenOverride: under3ChildrenOverrideValue,
    under3AdditionalOverride: under3AdditionalOverrideValue,
    preparatoryCourseChildren,
    qualityBonus,
    under3Additional,
    preparatoryCourses,
    integratedChildren: toNumber(integratedChildrenOverride),
    overTwentyHoursPercent: children ? (overTwentyHoursChildren / children) * 100 : 0,
    bookingHoursDaily: weeklyBookingHours / 5,
    weightedBookingHoursDaily: weightedDailyBookingHours,
    staffHours: totalStaffHours,
    expertStaffHours,
    minimumExpertHours,
    expertHoursDelta: expertStaffHours - minimumExpertHours,
    expertRatioPercent: toNumber(expertRatioPercentOverride)
      ?? (totalStaffHours ? (expertStaffHours / totalStaffHours) * 100 : null),
    employmentKey: totalStaffHours ? (weightedDailyBookingHours * 5) / totalStaffHours : null,
    basisValue,
    estimatedFunding: monthlyBaseFunding,
    operatingDays: toNumber(operatingDaysOverride),
  };
}
