import {
  ZEITKAT_CATALOG,
  decodeBuchungsart,
  getZeitkatFactor,
  getZeitkatZoneBounds,
  getZeitkatZoneIndex,
} from './adebisConstants';
import { sumWeightedBookingHours } from './chartUtils/chartUtils';
import {
  calculateZeitkatFeeAmount,
  getBayKiBiGWeightForChild,
  pickApplicableValidityEntry,
  pickLatestValidityEntry,
} from './financeUtils';
import { minutesToTime, timeToMinutes } from './timeUtils';

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundHours = (value) => Math.round((Number(value) || 0) * 100) / 100;

function isBasisBooking(booking) {
  const art = booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART);
  return art ? art.basis !== false : true;
}

function isBookingActiveOnDate(booking, referenceDate) {
  return (!booking?.startdate || booking.startdate <= referenceDate)
    && (!booking?.enddate || booking.enddate >= referenceDate);
}

function bookingGroupId(booking, child) {
  return String(booking?.groupId || child?.groupId || '');
}

function getEditedPrice(groupFeeCatalogs, temporaryPrices, groupId, zeitkatId, referenceDate) {
  const feeCatalog = groupFeeCatalogs?.[groupId] || [];
  const { entry, baseAmount } = calculateZeitkatFeeAmount(feeCatalog, zeitkatId, referenceDate);
  if (!entry) return { entry: null, originalAmount: null, amount: null };
  const override = temporaryPrices?.[groupId]?.[zeitkatId];
  return {
    entry,
    originalAmount: baseAmount,
    amount: Number.isFinite(Number(override)) ? roundMoney(override) : roundMoney(baseAmount),
  };
}

function chooseRule(rules, referenceDate) {
  return pickApplicableValidityEntry(rules, referenceDate) || pickLatestValidityEntry(rules) || null;
}

function resizedBooking(booking, toZeitkat, utilizationPercent) {
  const targetHours = getZeitkatZoneBounds(toZeitkat)?.maxHours;
  const utilization = Math.max(0, Math.min(100, Number(utilizationPercent) || 0)) / 100;
  if (!Number.isFinite(targetHours) || utilization <= 0) return booking;

  const times = (booking?.times || []).map((day) => {
    const segments = Array.isArray(day?.segments) ? day.segments : [];
    const validSegments = segments.map((segment) => {
      const start = timeToMinutes(segment?.booking_start);
      const end = timeToMinutes(segment?.booking_end);
      return { segment, start, end };
    }).filter(({ start, end }) => start !== null && end !== null && end > start);
    const currentMinutes = validSegments.reduce((total, { segment, start, end }) => {
      const allocation = Number(segment?.allocationSharePercent);
      return total + (end - start) * (Number.isFinite(allocation) ? Math.max(0, allocation) / 100 : 1);
    }, 0);
    if (validSegments.length === 0 || currentMinutes <= 0) return day;

    const targetMinutes = Math.max(targetHours * 60, currentMinutes);
    const resultingMinutes = currentMinutes + (targetMinutes - currentMinutes) * utilization;
    const scale = resultingMinutes / currentMinutes;
    const nextSegments = segments.map((segment) => {
      const start = timeToMinutes(segment?.booking_start);
      const end = timeToMinutes(segment?.booking_end);
      if (start === null || end === null || end <= start) return segment;
      return {
        ...segment,
        booking_end: minutesToTime(Math.max(start + 1, Math.round(start + (end - start) * scale))),
      };
    });
    return { ...day, segments: nextSegments };
  });

  const { BETRSTD: _betrstd, betrstd: _betrstdLower, ...rawdata } = booking?.rawdata || {};
  return {
    ...booking,
    times,
    rawdata: { ...rawdata, ZEITKAT: toZeitkat },
  };
}

function makeGroupTotals(groupId, groupName) {
  return {
    id: groupId,
    name: groupName || groupId || 'Ohne Gruppe',
    bookings: 0,
    migratedBookings: 0,
    bookingHoursBefore: 0,
    bookingHoursAfter: 0,
    deltaMonthlyFunding: 0,
    deltaMonthlyParentFees: 0,
  };
}

/**
 * Simuliert absolute Elternbeitragssätze je ZEITKAT und die anteilige Nutzung
 * einer Mehrstunden-Staffel, sofern Quelle und direkt nächste Staffel gleich teuer sind.
 * Sämtliche Preisänderungen bleiben Eingabewerte der Berechnung und werden nie gespeichert.
 */
export function simulateContributionChanges({
  demandBookings = [],
  dataItems = {},
  groupDefs = [],
  bayKiBiGRules = [],
  groupFeeCatalogs = {},
  temporaryPrices = {},
  utilizationPercent = 100,
  referenceDate,
} = {}) {
  const rule = chooseRule(bayKiBiGRules, referenceDate);
  const baseValue = Number(rule?.baseValue) || 0;
  const weightFactors = rule?.weightFactors || null;
  const utilization = Math.max(0, Math.min(100, Number(utilizationPercent) || 0)) / 100;
  const groupNames = new Map((groupDefs || []).map((group) => [String(group.id), group.name]));
  const groupDefById = new Map((groupDefs || []).map((group) => [String(group.id), group]));
  const bookingsByChild = new Map();

  (demandBookings || []).forEach((booking) => {
    if (!isBasisBooking(booking) || !isBookingActiveOnDate(booking, referenceDate)) return;
    const childKey = String(booking?.itemId ?? '');
    if (!childKey) return;
    if (!bookingsByChild.has(childKey)) bookingsByChild.set(childKey, []);
    bookingsByChild.get(childKey).push(booking);
  });

  const perChild = [];
  const simulatedBookings = [];
  const groups = new Map();
  let skippedNoZone = 0;
  let totalBookingHoursBefore = 0;
  let totalBookingHoursAfter = 0;
  let totalDeltaMonthlyFunding = 0;
  let totalDeltaMonthlyParentFees = 0;
  let totalMigratedBookings = 0;

  bookingsByChild.forEach((childBookings, childKey) => {
    const bookings = childBookings.slice().sort((a, b) => String(b?.startdate || '').localeCompare(String(a?.startdate || '')));
    const child = dataItems?.[childKey] || null;
    const firstBooking = bookings[0];
    const primaryGroupId = bookingGroupId(firstBooking, child);
    const primaryGroup = groupDefById.get(primaryGroupId) || null;
    const weight = getBayKiBiGWeightForChild(child, primaryGroup, referenceDate, weightFactors);
    let childHoursBefore = 0;
    let childHoursAfter = 0;
    let childFundingDelta = 0;
    let childMigratedBookings = 0;
    let firstZone = null;
    let firstTargetZone = null;
    let childChanged = false;
    let firstBookingGroupId = primaryGroupId;

    bookings.forEach((booking) => {
      const zoneBefore = String(booking?.rawdata?.ZEITKAT || '').trim();
      const zoneIndex = getZeitkatZoneIndex(zoneBefore);
      const groupId = bookingGroupId(booking, child);
      const hoursBefore = sumWeightedBookingHours(booking);
      childHoursBefore += hoursBefore;
      totalBookingHoursBefore += hoursBefore;
      const groupName = groupNames.get(groupId) || groupId || 'Ohne Gruppe';
      if (!groups.has(groupId)) groups.set(groupId, makeGroupTotals(groupId, groupName));
      const group = groups.get(groupId);
      group.bookings += 1;
      group.bookingHoursBefore += hoursBefore;

      if (zoneIndex < 0) {
        skippedNoZone += 1;
        childHoursAfter += hoursBefore;
        totalBookingHoursAfter += hoursBefore;
        group.bookingHoursAfter += hoursBefore;
        simulatedBookings.push(booking);
        return;
      }

      const nextZone = ZEITKAT_CATALOG[zoneIndex + 1] || null;
      const sourcePrice = getEditedPrice(groupFeeCatalogs, temporaryPrices, groupId, zoneBefore, referenceDate);
      const nextPrice = nextZone
        ? getEditedPrice(groupFeeCatalogs, temporaryPrices, groupId, nextZone.id, referenceDate)
        : { entry: null, amount: null, originalAmount: null };
      const sameSimulatedPrice = sourcePrice.entry && nextPrice.entry
        && Math.round(sourcePrice.amount * 100) === Math.round(nextPrice.amount * 100);
      const migrationShare = sameSimulatedPrice ? utilization : 0;
      const zoneAfter = migrationShare > 0 ? nextZone.id : zoneBefore;
      const originalFactor = getZeitkatFactor(zoneBefore) ?? 1;
      const nextFactor = nextZone ? (getZeitkatFactor(nextZone.id) ?? originalFactor) : originalFactor;
      const fundingDelta = baseValue * weight * (nextFactor - originalFactor) * migrationShare;
      const simulatedBooking = migrationShare > 0
        ? resizedBooking(booking, nextZone.id, 100)
        : booking;
      const hoursAfter = sumWeightedBookingHours(simulatedBooking);
      const expectedHoursAfter = hoursBefore + (hoursAfter - hoursBefore) * migrationShare;
      const changed = migrationShare > 0 || (sourcePrice.entry && sourcePrice.amount !== sourcePrice.originalAmount);

      childHoursAfter += expectedHoursAfter;
      totalBookingHoursAfter += expectedHoursAfter;
      childFundingDelta += fundingDelta;
      totalDeltaMonthlyFunding += fundingDelta;
      if (migrationShare > 0) {
        childMigratedBookings += migrationShare;
        totalMigratedBookings += migrationShare;
      }
      childChanged = childChanged || changed;
      if (!firstZone) {
        firstZone = zoneBefore;
        firstTargetZone = zoneAfter;
        firstBookingGroupId = groupId;
      }

      group.migratedBookings += migrationShare;
      group.bookingHoursAfter += expectedHoursAfter;
      group.deltaMonthlyFunding += fundingDelta;

      simulatedBookings.push(simulatedBooking);
    });

    const primaryZone = String(firstBooking?.rawdata?.ZEITKAT || '').trim();
    const originalParentFee = getEditedPrice(groupFeeCatalogs, {}, primaryGroupId, primaryZone, referenceDate);
    const simulatedSourceFee = getEditedPrice(groupFeeCatalogs, temporaryPrices, primaryGroupId, primaryZone, referenceDate);
    const primaryZoneIndex = getZeitkatZoneIndex(primaryZone);
    const primaryNextZone = primaryZoneIndex >= 0 ? ZEITKAT_CATALOG[primaryZoneIndex + 1] : null;
    const primaryNextFee = primaryNextZone
      ? getEditedPrice(groupFeeCatalogs, temporaryPrices, primaryGroupId, primaryNextZone.id, referenceDate)
      : { entry: null, amount: null };
    const primaryCanMigrate = Boolean(simulatedSourceFee.entry && primaryNextFee.entry
      && Math.round(simulatedSourceFee.amount * 100) === Math.round(primaryNextFee.amount * 100));
    const primaryMigrationShare = primaryCanMigrate ? utilization : 0;
    const parentFeeBefore = originalParentFee.entry ? originalParentFee.originalAmount : 0;
    const parentFeeAfter = simulatedSourceFee.entry
      ? simulatedSourceFee.amount * (1 - primaryMigrationShare)
        + (primaryCanMigrate ? primaryNextFee.amount * primaryMigrationShare : 0)
      : 0;
    const parentFeeDelta = parentFeeAfter - parentFeeBefore;
    totalDeltaMonthlyParentFees += parentFeeDelta;
    childChanged = childChanged || Math.abs(parentFeeDelta) >= 0.005;

    const childDeltaMonthlyTotal = childFundingDelta + parentFeeDelta;
    if (primaryGroupId || Math.abs(childDeltaMonthlyTotal) > 0.005 || childChanged) {
      if (!groups.has(primaryGroupId)) {
        groups.set(primaryGroupId, makeGroupTotals(primaryGroupId, groupNames.get(primaryGroupId)));
      }
      groups.get(primaryGroupId).deltaMonthlyParentFees += parentFeeDelta;
    }

    if (!childChanged && childMigratedBookings === 0) return;
    perChild.push({
      itemId: childKey,
      name: child?.name || childKey,
      familyId: child?.familyId || '',
      familyLabel: child?.familyLabel || '',
      groupId: firstBookingGroupId,
      groupName: groupNames.get(firstBookingGroupId) || firstBookingGroupId || 'Ohne Gruppe',
      fromZone: firstZone || primaryZone,
      toZone: firstTargetZone || primaryZone,
      weight,
      deltaMonthly: roundMoney(childFundingDelta),
      deltaYearly: roundMoney(childFundingDelta * 12),
      deltaMonthlyParentFees: roundMoney(parentFeeDelta),
      deltaYearlyParentFees: roundMoney(parentFeeDelta * 12),
      deltaMonthlyTotal: roundMoney(childDeltaMonthlyTotal),
      deltaYearlyTotal: roundMoney(childDeltaMonthlyTotal * 12),
      weeklyHoursBefore: roundHours(childHoursBefore),
      weeklyHoursAfter: roundHours(childHoursAfter),
      deltaWeeklyHours: roundHours(childHoursAfter - childHoursBefore),
      parentFeeBefore: roundMoney(parentFeeBefore),
      parentFeeAfter: roundMoney(parentFeeAfter),
      migratedBookings: roundHours(childMigratedBookings),
      parentFeeChanged: Math.abs(parentFeeDelta) >= 0.005,
    });
  });

  const roundedGroups = Array.from(groups.values()).map((group) => ({
    ...group,
    migratedBookings: roundHours(group.migratedBookings),
    bookingHoursBefore: roundHours(group.bookingHoursBefore),
    bookingHoursAfter: roundHours(group.bookingHoursAfter),
    deltaMonthlyFunding: roundMoney(group.deltaMonthlyFunding),
    deltaMonthlyParentFees: roundMoney(group.deltaMonthlyParentFees),
    deltaMonthlyTotal: roundMoney(group.deltaMonthlyFunding + group.deltaMonthlyParentFees),
    deltaYearlyFunding: roundMoney(group.deltaMonthlyFunding * 12),
    deltaYearlyParentFees: roundMoney(group.deltaMonthlyParentFees * 12),
    deltaYearlyTotal: roundMoney((group.deltaMonthlyFunding + group.deltaMonthlyParentFees) * 12),
  })).sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const familiesMap = new Map();
  perChild.forEach((row) => {
    if (!row.familyId) return;
    if (!familiesMap.has(row.familyId)) {
      familiesMap.set(row.familyId, {
        id: row.familyId,
        label: row.familyLabel || row.familyId,
        affectedChildren: 0,
        childrenWithMoreHours: 0,
        childrenWithHigherFees: 0,
        childrenWithLowerFees: 0,
        weeklyHoursAdded: 0,
        monthlyParentCostIncrease: 0,
        monthlyParentCostReduction: 0,
        deltaMonthlyFunding: 0,
        deltaMonthlyParentFees: 0,
        deltaMonthlyTotal: 0,
        deltaYearlyTotal: 0,
        deltaWeeklyHours: 0,
      });
    }
    const family = familiesMap.get(row.familyId);
    family.affectedChildren += 1;
    if (row.deltaWeeklyHours > 0.005) {
      family.childrenWithMoreHours += 1;
      family.weeklyHoursAdded += row.deltaWeeklyHours;
    }
    if (row.deltaMonthlyParentFees > 0.005) {
      family.childrenWithHigherFees += 1;
      family.monthlyParentCostIncrease += row.deltaMonthlyParentFees;
    }
    if (row.deltaMonthlyParentFees < -0.005) {
      family.childrenWithLowerFees += 1;
      family.monthlyParentCostReduction += Math.abs(row.deltaMonthlyParentFees);
    }
    family.deltaMonthlyFunding += row.deltaMonthly;
    family.deltaMonthlyParentFees += row.deltaMonthlyParentFees;
    family.deltaMonthlyTotal += row.deltaMonthlyTotal;
    family.deltaYearlyTotal += row.deltaYearlyTotal;
    family.deltaWeeklyHours += row.deltaWeeklyHours;
  });
  const families = Array.from(familiesMap.values()).map((family) => ({
    ...family,
    weeklyHoursAdded: roundHours(family.weeklyHoursAdded),
    monthlyParentCostIncrease: roundMoney(family.monthlyParentCostIncrease),
    monthlyParentCostReduction: roundMoney(family.monthlyParentCostReduction),
    deltaMonthlyFunding: roundMoney(family.deltaMonthlyFunding),
    deltaMonthlyParentFees: roundMoney(family.deltaMonthlyParentFees),
    deltaMonthlyTotal: roundMoney(family.deltaMonthlyTotal),
    deltaYearlyTotal: roundMoney(family.deltaYearlyTotal),
    deltaWeeklyHours: roundHours(family.deltaWeeklyHours),
  })).sort((a, b) => Math.abs(b.deltaMonthlyTotal) - Math.abs(a.deltaMonthlyTotal));

  const childrenWithMoreHours = perChild.filter((row) => row.deltaWeeklyHours > 0.005);
  const childrenWithHigherFees = perChild.filter((row) => row.deltaMonthlyParentFees > 0.005);
  const childrenWithLowerFees = perChild.filter((row) => row.deltaMonthlyParentFees < -0.005);
  const familiesWithMoreHours = families.filter((family) => family.childrenWithMoreHours > 0);
  const familiesWithHigherFees = families.filter((family) => family.childrenWithHigherFees > 0);
  const familiesWithLowerFees = families.filter((family) => family.childrenWithLowerFees > 0);

  return {
    perChild: perChild.sort((a, b) => Math.abs(b.deltaMonthlyTotal) - Math.abs(a.deltaMonthlyTotal)),
    families,
    groups: roundedGroups,
    totals: {
      bookingHoursBefore: roundHours(totalBookingHoursBefore),
      bookingHoursAfter: roundHours(totalBookingHoursAfter),
      deltaWeeklyDemandHours: roundHours(totalBookingHoursAfter - totalBookingHoursBefore),
      migratedBookings: roundHours(totalMigratedBookings),
      deltaMonthlyBayKiBiG: roundMoney(totalDeltaMonthlyFunding),
      deltaYearlyBayKiBiG: roundMoney(totalDeltaMonthlyFunding * 12),
      deltaParentFees: roundMoney(totalDeltaMonthlyParentFees),
      deltaMonthlyTotal: roundMoney(totalDeltaMonthlyFunding + totalDeltaMonthlyParentFees),
      deltaYearlyTotal: roundMoney((totalDeltaMonthlyFunding + totalDeltaMonthlyParentFees) * 12),
      affectedChildren: perChild.length,
      affectedFamilies: families.length,
      childrenWithMoreHours: childrenWithMoreHours.length,
      familiesWithMoreHours: familiesWithMoreHours.length,
      weeklyHoursAdded: roundHours(childrenWithMoreHours.reduce((sum, row) => sum + row.deltaWeeklyHours, 0)),
      childrenWithHigherFees: childrenWithHigherFees.length,
      familiesWithHigherFees: familiesWithHigherFees.length,
      monthlyParentCostIncrease: roundMoney(childrenWithHigherFees.reduce((sum, row) => sum + row.deltaMonthlyParentFees, 0)),
      childrenWithLowerFees: childrenWithLowerFees.length,
      familiesWithLowerFees: familiesWithLowerFees.length,
      monthlyParentCostReduction: roundMoney(childrenWithLowerFees.reduce((sum, row) => sum + Math.abs(row.deltaMonthlyParentFees), 0)),
    },
    simulatedBookings,
    skippedNoZone,
    rule,
  };
}

// Kept as an alias for callers from older local branches; simulation semantics are now tariff-based.
export const simulateZeitkatUpgrade = simulateContributionChanges;
