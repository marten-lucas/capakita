import {
  ZEITKAT_CATALOG,
  decodeBuchungsart,
  getFeeBandZeitkatId,
  getZeitkatFactor,
  getZeitkatZoneBounds,
  getZeitkatZoneIndex,
} from './adebisConstants';
import { sumWeightedBookingHours } from './chartUtils/chartUtils';
import {
  findFeeEntryForZeitkat,
  getBayKiBiGWeightForChild,

  pickApplicableValidityEntry,
  pickLatestValidityEntry,
} from './financeUtils';
import { minutesToTime, timeToMinutes } from './timeUtils';

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundHours = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function getFeeBandSimulationPriceKey(entry) {
  const zeitkatId = getFeeBandZeitkatId(entry);
  return zeitkatId || `band:${String(entry?.id || '')}`;
}

export function getFeeCatalogSimulationRows(groupFeeCatalogs = {}, groupLabels = new Map(), referenceDate) {
  return Object.entries(groupFeeCatalogs || {}).flatMap(([groupId, catalog]) => {
    const feeEntries = Array.isArray(catalog) ? catalog : [];
    const zeitkatRows = ZEITKAT_CATALOG.flatMap((zone) => {
      const entry = findFeeEntryForZeitkat(feeEntries, zone.id, referenceDate);
      return entry ? [{
        groupId: String(groupId),
        groupName: groupLabels.get(String(groupId)) || String(groupId),
        key: getFeeBandSimulationPriceKey(entry),
        kind: 'zeitkat',
        label: `ZEITKAT ${zone.id}`,
        detail: `${zone.kurzbez} h/Tag`,
        zeitkatId: zone.id,
        entry,
        originalAmount: Number(entry.monthlyAmount) || 0,
      }] : [];
    });
    return zeitkatRows;
  });
}

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

function segmentShareFactor(segment) {
  const allocation = Number(segment?.allocationSharePercent);
  return Number.isFinite(allocation) ? Math.max(0, allocation) / 100 : 1;
}

function dailyMinutes(day) {
  return (day?.segments || []).reduce((total, segment) => {
    const start = timeToMinutes(segment?.booking_start);
    const end = timeToMinutes(segment?.booking_end);
    if (start === null || end === null || end <= start) return total;
    return total + (end - start) * segmentShareFactor(segment);
  }, 0);
}

/** Use stored ZEITKAT first, then infer it from the mean daily duration in Capakita's booking schedule. */
export function deriveZeitkatIdFromBooking(booking) {
  const days = (booking?.times || []).map(dailyMinutes).filter((minutes) => minutes > 0);
  if (days.length === 0) return null;
  const meanDailyHours = days.reduce((sum, minutes) => sum + minutes, 0) / days.length / 60;
  return ZEITKAT_CATALOG.find((zone) => meanDailyHours > zone.minHours && meanDailyHours <= zone.maxHours)?.id
    || (meanDailyHours > 12 ? '13' : null);
}

function resolveBookingZeitkat(booking) {
  const stored = String(booking?.rawdata?.ZEITKAT || '').trim();
  return getZeitkatZoneIndex(stored) >= 0 ? stored : deriveZeitkatIdFromBooking(booking);
}

function withResolvedZeitkat(booking, zeitkatId) {
  const stored = String(booking?.rawdata?.ZEITKAT || '').trim();
  if (!zeitkatId || getZeitkatZoneIndex(stored) >= 0) return booking;
  return { ...booking, rawdata: { ...(booking.rawdata || {}), ZEITKAT: zeitkatId } };
}

function getEditedFeeEntryPrice(entry, groupId, temporaryPrices) {
  if (!entry) return { entry: null, originalAmount: null, amount: null };
  const originalAmount = Number(entry.monthlyAmount) || 0;
  const key = getFeeBandSimulationPriceKey(entry);
  const override = temporaryPrices?.[groupId]?.[key];
  return {
    entry,
    originalAmount,
    amount: Number.isFinite(Number(override)) ? roundMoney(override) : roundMoney(originalAmount),
  };
}

function getEditedZeitkatPrice(feeCatalog, groupId, zeitkatId, referenceDate, temporaryPrices) {
  const entry = findFeeEntryForZeitkat(feeCatalog, zeitkatId, referenceDate);
  return getEditedFeeEntryPrice(entry, groupId, temporaryPrices);
}

function chooseRule(rules, referenceDate) {
  return pickApplicableValidityEntry(rules, referenceDate) || pickLatestValidityEntry(rules) || null;
}

function parseBirthDate(child) {
  const raw = String(child?.dateofbirth || child?.rawdata?.GEBDAT || '').trim();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : (raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      ? `${raw.slice(6, 10)}-${raw.slice(3, 5)}-${raw.slice(0, 2)}`
      : '');
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEligibleForParentFeeSubsidy(child, groupDef, subsidyRule, referenceDate) {
  if (typeof child?.parentFeeSubsidyEligible === 'boolean') return child.parentFeeSubsidyEligible;

  const groupDescription = `${groupDef?.type || ''} ${groupDef?.name || ''} ${child?.groupType || ''}`.toLowerCase();
  if (subsidyRule?.excludeSchoolChildren !== false && /(schul|hort)/.test(groupDescription)) return false;

  const birthDate = parseBirthDate(child);
  const currentDate = new Date(`${String(referenceDate || '').slice(0, 10)}T00:00:00Z`);
  if (!birthDate || Number.isNaN(currentDate.getTime())) return false;

  const ageInMonths = (currentDate.getUTCFullYear() - birthDate.getUTCFullYear()) * 12
    + currentDate.getUTCMonth() - birthDate.getUTCMonth();
  const minimumAgeMonths = Math.max(0, Number(subsidyRule?.minimumAgeYears ?? 3) || 0) * 12;
  const maximumAgeMonths = Math.max(0, Number(subsidyRule?.maximumAgeYears ?? 7) || 0) * 12;
  return ageInMonths >= minimumAgeMonths
    && (maximumAgeMonths === 0 || ageInMonths < maximumAgeMonths);
}

function calculateAppliedParentFeeSubsidy(grossFee, isEligible, monthlyAmount) {
  if (!isEligible) return 0;
  return Math.min(Math.max(0, Number(grossFee) || 0), Math.max(0, Number(monthlyAmount) || 0));
}

function calculateExpectedFeeAfterMigration({ sourceAmount, nextAmount, migrationShare, eligible, subsidyAmount }) {
  const share = Math.max(0, Math.min(1, Number(migrationShare) || 0));
  const source = Math.max(0, Number(sourceAmount) || 0);
  const next = Math.max(0, Number(nextAmount ?? sourceAmount) || 0);
  const grossFee = source * (1 - share) + next * share;
  const subsidy = calculateAppliedParentFeeSubsidy(source, eligible, subsidyAmount) * (1 - share)
    + calculateAppliedParentFeeSubsidy(next, eligible, subsidyAmount) * share;
  return { grossFee, subsidy, parentFee: Math.max(0, grossFee - subsidy) };
}

function resizeBookingToZeitkat(booking, toZeitkat, allowReduction = false) {
  const targetHours = getZeitkatZoneBounds(toZeitkat)?.maxHours;
  if (!Number.isFinite(targetHours)) return booking;

  const times = (booking?.times || []).map((day) => {
    const segments = Array.isArray(day?.segments) ? day.segments : [];
    const currentMinutes = dailyMinutes(day);
    if (segments.length === 0 || currentMinutes <= 0) return day;

    const targetMinutes = allowReduction
      ? Math.min(targetHours * 60, currentMinutes)
      : Math.max(targetHours * 60, currentMinutes);
    const scale = targetMinutes / currentMinutes;
    return {
      ...day,
      segments: segments.map((segment) => {
        const start = timeToMinutes(segment?.booking_start);
        const end = timeToMinutes(segment?.booking_end);
        if (start === null || end === null || end <= start) return segment;
        return {
          ...segment,
          booking_end: minutesToTime(Math.max(start + 1, Math.round(start + (end - start) * scale))),
        };
      }),
    };
  });

  const { BETRSTD: _betrstd, betrstd: _betrstdLower, ...rawdata } = booking?.rawdata || {};
  return { ...booking, times, rawdata: { ...rawdata, ZEITKAT: toZeitkat } };
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
    deltaMonthlyParentSubsidy: 0,
  };
}

/**
 * Simulates the single tariff model used by Capakita: ZEITKAT rates are matched by
 * daily category. Missing ZEITKAT values are derived from active booking times without
 * mutating the stored booking.
 */
export function simulateContributionChanges({
  demandBookings = [],
  dataItems = {},
  groupDefs = [],
  bayKiBiGRules = [],
  groupFeeCatalogs = {},
  originalGroupFeeCatalogs = null,
  parentFeeSubsidy = {},
  temporaryPrices = {},
  utilizationPercent = 100,
  referenceDate,
} = {}) {
  const rule = chooseRule(bayKiBiGRules, referenceDate);
  const baseValue = Number(rule?.baseValue) || 0;
  const weightFactors = rule?.weightFactors || null;
  const utilization = Math.max(0, Math.min(100, Number(utilizationPercent) || 0)) / 100;
  const baselineSubsidyAmount = parentFeeSubsidy?.enabled === false
    ? 0
    : Math.max(0, Number(parentFeeSubsidy?.monthlyAmount ?? 100) || 0);
  const subsidyEndsBeforeReferenceDate = Boolean(parentFeeSubsidy?.endDate)
    && String(referenceDate || '').slice(0, 10) > String(parentFeeSubsidy.endDate).slice(0, 10);
  const policySubsidyAmount = subsidyEndsBeforeReferenceDate ? 0 : baselineSubsidyAmount;
  const baselineFeeCatalogs = originalGroupFeeCatalogs || groupFeeCatalogs;
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
  const familyContributionTotals = new Map();
  const simulatedBookings = [];
  const groups = new Map();
  let skippedNoZone = 0;
  let totalBookingHoursBefore = 0;
  let totalBookingHoursAfter = 0;
  let totalDeltaMonthlyFunding = 0;
  let totalDeltaMonthlyParentFees = 0;
  let totalDeltaMonthlyParentSubsidy = 0;
  let totalGrossParentFees = 0;
  let totalPolicyParentFeeSubsidy = 0;
  let totalMigratedBookings = 0;

  bookingsByChild.forEach((childBookings, childKey) => {
    const bookings = childBookings.slice().sort((a, b) => String(b?.startdate || '').localeCompare(String(a?.startdate || '')));
    const child = dataItems?.[childKey] || null;
    const firstBooking = bookings[0];
    const primaryGroupId = bookingGroupId(firstBooking, child);
    const primaryGroup = groupDefById.get(primaryGroupId) || null;
    const weight = getBayKiBiGWeightForChild(child, primaryGroup, referenceDate, weightFactors);
    const subsidyEligible = isEligibleForParentFeeSubsidy(child, primaryGroup, parentFeeSubsidy, referenceDate);
    const childHoursBefore = bookings.reduce((sum, booking) => sum + sumWeightedBookingHours(booking), 0);
    let childHoursAfter = 0;
    let childFundingDelta = 0;
    let childMigratedBookings = 0;
    let firstZone = null;
    let firstTargetZone = null;
    let childChanged = false;
    let firstBookingGroupId = primaryGroupId;
    const childSimulatedBookings = [];

    bookings.forEach((booking) => {
      const zoneBefore = resolveBookingZeitkat(booking);
      const bookingWithZone = withResolvedZeitkat(booking, zoneBefore);
      const zoneIndex = getZeitkatZoneIndex(zoneBefore);
      const groupId = bookingGroupId(booking, child);
      const bookingHoursBefore = sumWeightedBookingHours(booking);
      totalBookingHoursBefore += bookingHoursBefore;
      const groupName = groupNames.get(groupId) || groupId || 'Ohne Gruppe';
      if (!groups.has(groupId)) groups.set(groupId, makeGroupTotals(groupId, groupName));
      const group = groups.get(groupId);
      group.bookings += 1;
      group.bookingHoursBefore += bookingHoursBefore;


      if (zoneIndex < 0) skippedNoZone += 1;
      const nextZone = zoneIndex >= 0 ? ZEITKAT_CATALOG[zoneIndex + 1] || null : null;
      const feeCatalog = groupFeeCatalogs?.[groupId] || [];
      const sourcePrice = zoneBefore
        ? getEditedZeitkatPrice(feeCatalog, groupId, zoneBefore, referenceDate, temporaryPrices)
        : { entry: null, originalAmount: null, amount: null };
      const nextPrice = nextZone
        ? getEditedZeitkatPrice(feeCatalog, groupId, nextZone.id, referenceDate, temporaryPrices)
        : { entry: null, originalAmount: null, amount: null };
      const sameSimulatedZeitkatPrice = sourcePrice.entry && nextPrice.entry
        && Math.round(sourcePrice.amount * 100) === Math.round(nextPrice.amount * 100);
      const migrationShare = sameSimulatedZeitkatPrice ? utilization : 0;
      const zoneAfter = migrationShare > 0 ? nextZone.id : zoneBefore;
      const factorBefore = zoneBefore ? getZeitkatFactor(zoneBefore) ?? 1 : null;
      const factorAfter = zoneAfter ? getZeitkatFactor(zoneAfter) ?? factorBefore : factorBefore;
      const fundingDelta = factorBefore == null || factorAfter == null
        ? 0
        : baseValue * weight * (factorAfter - factorBefore) * migrationShare;
      const simulatedBooking = migrationShare > 0
        ? resizeBookingToZeitkat(bookingWithZone, nextZone.id)
        : bookingWithZone;
      const bookingHoursAfter = sumWeightedBookingHours(simulatedBooking);
      const expectedHoursAfter = bookingHoursBefore + (bookingHoursAfter - bookingHoursBefore) * migrationShare;
      const priceOverrideApplied = sourcePrice.entry && sourcePrice.amount !== sourcePrice.originalAmount;
      const changed = migrationShare > 0 || priceOverrideApplied;

      childHoursAfter += expectedHoursAfter;
      totalBookingHoursAfter += expectedHoursAfter;
      childFundingDelta += fundingDelta;
      totalDeltaMonthlyFunding += fundingDelta;
      if (migrationShare > 0) {
        childMigratedBookings += migrationShare;
        totalMigratedBookings += migrationShare;
      }
      childChanged = childChanged || changed;
      if (!firstZone && zoneBefore) {
        firstZone = zoneBefore;
        firstTargetZone = zoneAfter;
        firstBookingGroupId = groupId;
      }
      group.migratedBookings += migrationShare;
      group.bookingHoursAfter += expectedHoursAfter;
      group.deltaMonthlyFunding += fundingDelta;
      childSimulatedBookings.push(simulatedBooking);
    });

    const primaryZone = resolveBookingZeitkat(firstBooking);
    const primaryFeeCatalog = groupFeeCatalogs?.[primaryGroupId] || [];
    const baselinePrimaryFeeCatalog = baselineFeeCatalogs?.[primaryGroupId] || [];
    let grossParentFeeBefore = 0;
    let grossParentFeeAfter = 0;
    let parentFeeBefore = 0;
    let parentFeeAfter = 0;
    let parentFeeDelta = 0;
    let parentFeeSubsidyBefore = 0;
    let parentFeeSubsidyAfter = 0;
    let parentFeeSubsidyDelta = 0;
    const directFeeEntry = primaryZone
      ? findFeeEntryForZeitkat(primaryFeeCatalog, primaryZone, referenceDate)
      : null;
    const baselineDirectFeeEntry = primaryZone
      ? findFeeEntryForZeitkat(baselinePrimaryFeeCatalog, primaryZone, referenceDate)
      : null;

    if (directFeeEntry) {
      const sourceFee = getEditedFeeEntryPrice(directFeeEntry, primaryGroupId, temporaryPrices);
      const baselineFee = baselineDirectFeeEntry
        ? getEditedFeeEntryPrice(baselineDirectFeeEntry, primaryGroupId, {})
        : { entry: null, originalAmount: 0, amount: 0 };
      const primaryNextZone = ZEITKAT_CATALOG[getZeitkatZoneIndex(primaryZone) + 1] || null;
      const nextFee = primaryNextZone
        ? getEditedZeitkatPrice(primaryFeeCatalog, primaryGroupId, primaryNextZone.id, referenceDate, temporaryPrices)
        : { entry: null, originalAmount: null, amount: null };
      const canMigrate = Boolean(nextFee.entry && Math.round(sourceFee.amount * 100) === Math.round(nextFee.amount * 100));
      const migrationShare = canMigrate ? utilization : 0;
      const grossFeeBefore = baselineFee.originalAmount;
      const expectedAfter = calculateExpectedFeeAfterMigration({
        sourceAmount: sourceFee.amount,
        nextAmount: canMigrate ? nextFee.amount : sourceFee.amount,
        migrationShare,
        eligible: subsidyEligible,
        subsidyAmount: policySubsidyAmount,
      });
      grossParentFeeBefore = grossFeeBefore;
      grossParentFeeAfter = expectedAfter.grossFee;
      parentFeeSubsidyBefore = calculateAppliedParentFeeSubsidy(
        grossFeeBefore,
        subsidyEligible,
        baselineSubsidyAmount
      );
      parentFeeSubsidyAfter = expectedAfter.subsidy;
      parentFeeBefore = Math.max(0, grossFeeBefore - parentFeeSubsidyBefore);
      parentFeeAfter = expectedAfter.parentFee;
      parentFeeDelta = parentFeeAfter - parentFeeBefore;
      parentFeeSubsidyDelta = parentFeeSubsidyAfter - parentFeeSubsidyBefore;
      childChanged = childChanged || sourceFee.amount !== sourceFee.originalAmount;
    }

    const familyId = String(child?.familyId || child?.familyLabel || `child:${childKey}`);
    if (!familyContributionTotals.has(familyId)) {
      familyContributionTotals.set(familyId, {
        id: familyId,
        label: child?.familyLabel || child?.familyId || child?.name || familyId,
        monthlyParentFeesBefore: 0,
        monthlyParentFeesAfter: 0,
      });
    }
    const familyContribution = familyContributionTotals.get(familyId);
    familyContribution.monthlyParentFeesBefore += Math.max(
      0,
      grossParentFeeBefore - calculateAppliedParentFeeSubsidy(
        grossParentFeeBefore,
        subsidyEligible,
        policySubsidyAmount
      )
    );
    familyContribution.monthlyParentFeesAfter += parentFeeAfter;

    totalDeltaMonthlyParentFees += parentFeeDelta;
    totalDeltaMonthlyParentSubsidy += parentFeeSubsidyDelta;
    totalGrossParentFees += grossParentFeeBefore;
    totalPolicyParentFeeSubsidy += parentFeeSubsidyAfter;
    childChanged = childChanged || Math.abs(parentFeeDelta) >= 0.005 || Math.abs(parentFeeSubsidyDelta) >= 0.005;
    if (primaryGroupId || Math.abs(parentChangedTotal(childFundingDelta, parentFeeDelta)) > 0.005 || childChanged) {
      if (!groups.has(primaryGroupId)) {
        groups.set(primaryGroupId, makeGroupTotals(primaryGroupId, groupNames.get(primaryGroupId)));
      }
      groups.get(primaryGroupId).deltaMonthlyParentFees += parentFeeDelta;
      groups.get(primaryGroupId).deltaMonthlyParentSubsidy += parentFeeSubsidyDelta;
    }

    simulatedBookings.push(...childSimulatedBookings);
    if (!childChanged && childMigratedBookings === 0) return;
    const childDeltaMonthlyTotal = childFundingDelta + parentFeeDelta;
    perChild.push({
      itemId: childKey,
      name: child?.name || childKey,
      familyId: child?.familyId || '',
      familyLabel: child?.familyLabel || '',
      groupId: firstBookingGroupId,
      groupName: groupNames.get(firstBookingGroupId) || firstBookingGroupId || 'Ohne Gruppe',
      fromZone: firstZone,
      toZone: firstTargetZone || firstZone,
      weight,
      deltaMonthly: roundMoney(childFundingDelta),
      deltaYearly: roundMoney(childFundingDelta * 12),
      deltaMonthlyParentFees: roundMoney(parentFeeDelta),
      deltaYearlyParentFees: roundMoney(parentFeeDelta * 12),
      grossParentFeeBefore: roundMoney(grossParentFeeBefore),
      grossParentFeeAfter: roundMoney(grossParentFeeAfter),
      parentFeeSubsidyBefore: roundMoney(parentFeeSubsidyBefore),
      parentFeeSubsidyAfter: roundMoney(parentFeeSubsidyAfter),
      deltaMonthlyParentSubsidy: roundMoney(parentFeeSubsidyDelta),
      deltaYearlyParentSubsidy: roundMoney(parentFeeSubsidyDelta * 12),
      deltaMonthlyTotal: roundMoney(childDeltaMonthlyTotal + parentFeeSubsidyDelta),
      deltaYearlyTotal: roundMoney((childDeltaMonthlyTotal + parentFeeSubsidyDelta) * 12),
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
    deltaMonthlyParentSubsidy: roundMoney(group.deltaMonthlyParentSubsidy),
    deltaMonthlyTotal: roundMoney(group.deltaMonthlyFunding + group.deltaMonthlyParentFees + group.deltaMonthlyParentSubsidy),
    deltaYearlyFunding: roundMoney(group.deltaMonthlyFunding * 12),
    deltaYearlyParentFees: roundMoney(group.deltaMonthlyParentFees * 12),
    deltaYearlyTotal: roundMoney((group.deltaMonthlyFunding + group.deltaMonthlyParentFees + group.deltaMonthlyParentSubsidy) * 12),
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
        deltaMonthlyParentSubsidy: 0,
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
    family.deltaMonthlyParentSubsidy += row.deltaMonthlyParentSubsidy;
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
    deltaMonthlyParentSubsidy: roundMoney(family.deltaMonthlyParentSubsidy),
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
    familyContributions: Array.from(familyContributionTotals.values()).map((family) => ({
      ...family,
      monthlyParentFeesBefore: roundMoney(family.monthlyParentFeesBefore),
      monthlyParentFeesAfter: roundMoney(family.monthlyParentFeesAfter),
      deltaMonthlyParentFees: roundMoney(family.monthlyParentFeesAfter - family.monthlyParentFeesBefore),
    })),
    groups: roundedGroups,
    totals: {
      bookingHoursBefore: roundHours(totalBookingHoursBefore),
      bookingHoursAfter: roundHours(totalBookingHoursAfter),
      deltaWeeklyDemandHours: roundHours(totalBookingHoursAfter - totalBookingHoursBefore),
      migratedBookings: roundHours(totalMigratedBookings),
      deltaMonthlyBayKiBiG: roundMoney(totalDeltaMonthlyFunding),
      deltaYearlyBayKiBiG: roundMoney(totalDeltaMonthlyFunding * 12),
      deltaParentFees: roundMoney(totalDeltaMonthlyParentFees),
      deltaParentFeeSubsidy: roundMoney(totalDeltaMonthlyParentSubsidy),
      grossParentFees: roundMoney(totalGrossParentFees),
      policyParentFeeSubsidy: roundMoney(totalPolicyParentFeeSubsidy),
      deltaYearlyParentFeeSubsidy: roundMoney(totalDeltaMonthlyParentSubsidy * 12),
      deltaMonthlyTotal: roundMoney(totalDeltaMonthlyFunding + totalDeltaMonthlyParentFees + totalDeltaMonthlyParentSubsidy),
      deltaYearlyTotal: roundMoney((totalDeltaMonthlyFunding + totalDeltaMonthlyParentFees + totalDeltaMonthlyParentSubsidy) * 12),
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

function parentChangedTotal(fundingDelta, parentFeeDelta) {
  return fundingDelta + parentFeeDelta;
}

function maximumHoursWithinBudget(options, budget) {
  const capacity = Math.max(0, Math.floor((Number(budget) || 0) * 100 + 0.000001));
  let freeHours = 0;
  const choices = [];
  options.forEach(({ cost, hours }) => {
    if (!(hours > 0)) return;
    const costInCents = Math.max(0, Math.round(cost * 100));
    if (costInCents === 0) freeHours += hours;
    else if (costInCents <= capacity) choices.push({ cost: costInCents, hours });
  });

  const bestHours = Array(capacity + 1).fill(0);
  choices.forEach(({ cost, hours }) => {
    for (let remaining = capacity; remaining >= cost; remaining -= 1) {
      bestHours[remaining] = Math.max(bestHours[remaining], bestHours[remaining - cost] + hours);
    }
  });
  return roundHours(freeHours + Math.max(...bestHours));
}

export function calculateFamilyFeePotentials({
  demandBookings = [],
  dataItems = {},
  groupDefs = [],
  groupFeeCatalogs = {},
  parentFeeSubsidy = {},
  temporaryPrices = {},
  referenceDate,
  monthlyBudget = 0,
} = {}) {
  const bookingsByChild = new Map();
  (demandBookings || []).forEach((booking) => {
    if (!isBasisBooking(booking) || !isBookingActiveOnDate(booking, referenceDate)) return;
    const childId = String(booking?.itemId ?? '');
    if (!childId) return;
    if (!bookingsByChild.has(childId)) bookingsByChild.set(childId, []);
    bookingsByChild.get(childId).push(booking);
  });

  const families = new Map();
  bookingsByChild.forEach((bookings, childId) => {
    const child = dataItems?.[childId] || {};
    const familyId = String(child.familyId || child.familyLabel || `child:${childId}`);
    if (!families.has(familyId)) {
      families.set(familyId, {
        id: familyId,
        label: child.familyLabel || child.familyId || child.name || familyId,
        upgrades: [],
        downgrades: [],
      });
    }

    const orderedBookings = bookings.slice().sort((left, right) => (
      String(right?.startdate || '').localeCompare(String(left?.startdate || ''))
    ));
    const firstBooking = orderedBookings[0];
    const groupId = bookingGroupId(firstBooking, child);
    const primaryZone = resolveBookingZeitkat(firstBooking);
    const primaryZoneIndex = getZeitkatZoneIndex(primaryZone);
    if (!primaryZone || primaryZoneIndex < 0) return;

    const catalog = groupFeeCatalogs?.[groupId] || [];
    const currentPrice = getEditedZeitkatPrice(catalog, groupId, primaryZone, referenceDate, temporaryPrices);
    if (!currentPrice.entry) return;
    const groupDef = (groupDefs || []).find((entry) => String(entry.id) === groupId) || null;
    const subsidyBaseAmount = parentFeeSubsidy?.enabled === false
      ? 0
      : Math.max(0, Number(parentFeeSubsidy?.monthlyAmount ?? 100) || 0);
    const subsidyEnded = Boolean(parentFeeSubsidy?.endDate)
      && String(referenceDate || '').slice(0, 10) > String(parentFeeSubsidy.endDate).slice(0, 10);
    const effectiveSubsidyAmount = subsidyEnded ? 0 : subsidyBaseAmount;
    const subsidyEligible = isEligibleForParentFeeSubsidy(child, groupDef, parentFeeSubsidy, referenceDate);
    const parentContribution = (grossFee) => Math.max(
      0,
      grossFee - calculateAppliedParentFeeSubsidy(grossFee, subsidyEligible, effectiveSubsidyAmount)
    );
    const currentParentContribution = parentContribution(currentPrice.amount);

    const resizeForDirection = (direction) => orderedBookings.reduce((sum, booking) => {
      const zoneId = resolveBookingZeitkat(booking);
      const zoneIndex = getZeitkatZoneIndex(zoneId);
      const targetZone = zoneIndex < 0 ? null : ZEITKAT_CATALOG[zoneIndex + direction];
      const adjustedBooking = targetZone
        ? resizeBookingToZeitkat(booking, targetZone.id, direction < 0)
        : booking;
      return sum + sumWeightedBookingHours(adjustedBooking);
    }, 0);
    const currentWeeklyHours = orderedBookings.reduce((sum, booking) => sum + sumWeightedBookingHours(booking), 0);
    const family = families.get(familyId);
    const nextZone = ZEITKAT_CATALOG[primaryZoneIndex + 1];
    if (nextZone) {
      const nextPrice = getEditedZeitkatPrice(catalog, groupId, nextZone.id, referenceDate, temporaryPrices);
      if (nextPrice.entry) {
        family.upgrades.push({
          cost: Math.max(0, roundMoney(parentContribution(nextPrice.amount) - currentParentContribution)),
          hours: Math.max(0, resizeForDirection(1) - currentWeeklyHours),
        });
      }
    }

    const previousZone = ZEITKAT_CATALOG[primaryZoneIndex - 1];
    if (previousZone) {
      const previousPrice = getEditedZeitkatPrice(catalog, groupId, previousZone.id, referenceDate, temporaryPrices);
      if (previousPrice.entry) {
        const monthlySaving = roundMoney(currentParentContribution - parentContribution(previousPrice.amount));
        if (monthlySaving > 0) {
          family.downgrades.push({
            cost: monthlySaving,
            hours: Math.max(0, currentWeeklyHours - resizeForDirection(-1)),
          });
        }
      }
    }
  });

  return Array.from(families.values()).map((family) => ({
    id: family.id,
    label: family.label,
    potentialUpgradeWeeklyHours: maximumHoursWithinBudget(family.upgrades, monthlyBudget),
    potentialDowngradeWeeklyHours: maximumHoursWithinBudget(family.downgrades, monthlyBudget),
  }));
}

// Kept as an alias for callers from older local branches; simulation semantics are now tariff-based.
export const simulateZeitkatUpgrade = simulateContributionChanges;

/**
 * Sum the contribution-change model month by month for a calendar year. This
 * preserves tariff/rule validity and makes annual totals correct when a tariff
 * or the parent-fee subsidy changes partway through the year.
 */
export function simulateAnnualContributionChanges({ year, ...simulationOptions } = {}) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 9999) {
    return { year: null, months: [], totals: null, perChild: [], groups: [] };
  }

  const months = Array.from({ length: 12 }, (_, monthIndex) => {
    const referenceDate = `${numericYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    return {
      referenceDate,
      result: simulateContributionChanges({ ...simulationOptions, referenceDate }),
    };
  });
  const yearlyMoneyFields = [
    ['deltaYearlyBayKiBiG', 'deltaMonthlyBayKiBiG'],
    ['deltaYearlyParentFees', 'deltaParentFees'],
    ['deltaYearlyParentSubsidy', 'deltaParentFeeSubsidy'],
    ['deltaYearlyTotal', 'deltaMonthlyTotal'],
  ];
  const totals = Object.fromEntries(yearlyMoneyFields.map(([yearlyKey, monthlyKey]) => [
    yearlyKey,
    roundMoney(months.reduce((sum, month) => sum + (month.result?.totals?.[monthlyKey] || 0), 0)),
  ]));
  const affectedChildIds = new Set(months.flatMap(({ result }) => (result?.perChild || []).map((row) => row.itemId)));
  const affectedFamilyIds = new Set(months.flatMap(({ result }) => (result?.families || []).map((row) => row.id)));
  const parentCostMonthly = months.reduce((sum, month) => sum + (month.result?.totals?.monthlyParentCostIncrease || 0), 0);
  const parentCostReductionMonthly = months.reduce((sum, month) => sum + (month.result?.totals?.monthlyParentCostReduction || 0), 0);
  const childrenWithHigherFees = new Set(months.flatMap(({ result }) => (result?.perChild || [])
    .filter((row) => row.deltaMonthlyParentFees > 0.005).map((row) => row.itemId)));
  const childrenWithLowerFees = new Set(months.flatMap(({ result }) => (result?.perChild || [])
    .filter((row) => row.deltaMonthlyParentFees < -0.005).map((row) => row.itemId)));

  totals.annualGrossParentFees = roundMoney(months.reduce((sum, month) => sum + (month.result?.totals?.grossParentFees || 0), 0));
  totals.annualParentFeeSubsidy = roundMoney(months.reduce((sum, month) => sum + (month.result?.totals?.policyParentFeeSubsidy || 0), 0));
  totals.deltaMonthlyBayKiBiG = roundMoney(totals.deltaYearlyBayKiBiG / 12);
  totals.deltaMonthlyParentFees = roundMoney(totals.deltaYearlyParentFees / 12);
  totals.deltaMonthlyParentSubsidy = roundMoney(totals.deltaYearlyParentSubsidy / 12);
  totals.deltaMonthlyTotal = roundMoney(totals.deltaYearlyTotal / 12);
  totals.affectedChildren = affectedChildIds.size;
  totals.affectedFamilies = affectedFamilyIds.size;
  totals.monthlyParentCostIncrease = roundMoney(parentCostMonthly);
  totals.monthlyParentCostReduction = roundMoney(parentCostReductionMonthly);
  totals.childrenWithHigherFees = childrenWithHigherFees.size;
  totals.childrenWithLowerFees = childrenWithLowerFees.size;
  totals.skippedNoZone = months.reduce((sum, month) => sum + (month.result?.skippedNoZone || 0), 0);

  return { year: numericYear, months, totals, perChild: [], groups: [] };
}
