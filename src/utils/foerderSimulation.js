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
  findFeeEntryForHours,
  findFeeEntryForZeitkat,
  getBayKiBiGWeightForChild,
  isDateWithinRange,
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
    const weeklyBandRows = feeEntries
      .filter((entry) => !getFeeBandZeitkatId(entry))
      .filter((entry) => isDateWithinRange(referenceDate, entry.validFrom || '', entry.validUntil || ''))
      .map((entry) => ({
        groupId: String(groupId),
        groupName: groupLabels.get(String(groupId)) || String(groupId),
        key: getFeeBandSimulationPriceKey(entry),
        kind: 'weeklyHours',
        label: entry.label || (Number.isFinite(Number(entry.maxHours))
          ? `bis ${String(entry.maxHours).replace('.', ',')} Wochenstunden`
          : 'offene Wochenstundenstaffel'),
        detail: Number.isFinite(Number(entry.maxHours)) ? `Max. ${String(entry.maxHours).replace('.', ',')} Wochenstunden` : 'offene Wochenstundenobergrenze',
        entry,
        originalAmount: Number(entry.monthlyAmount) || 0,
      }));
    return [...zeitkatRows, ...weeklyBandRows];
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

function resizeBookingToZeitkat(booking, toZeitkat) {
  const targetHours = getZeitkatZoneBounds(toZeitkat)?.maxHours;
  if (!Number.isFinite(targetHours)) return booking;

  const times = (booking?.times || []).map((day) => {
    const segments = Array.isArray(day?.segments) ? day.segments : [];
    const currentMinutes = dailyMinutes(day);
    if (segments.length === 0 || currentMinutes <= 0) return day;

    const targetMinutes = Math.max(targetHours * 60, currentMinutes);
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

function resizeBookingByFactor(booking, factor) {
  const segmentHours = sumWeightedBookingHours(booking, { preferBetrstd: false });
  if (!Array.isArray(booking?.times) || segmentHours <= 0 || factor <= 1) return booking;
  const times = booking.times.map((day) => ({
    ...day,
    segments: (day?.segments || []).map((segment) => {
      const start = timeToMinutes(segment?.booking_start);
      const end = timeToMinutes(segment?.booking_end);
      if (start === null || end === null || end <= start) return segment;
      return {
        ...segment,
        booking_end: minutesToTime(Math.max(start + 1, Math.round(start + (end - start) * factor))),
      };
    }),
  }));
  const { BETRSTD: _betrstd, betrstd: _betrstdLower, ...rawdata } = booking?.rawdata || {};
  const resized = { ...booking, times, rawdata };
  const derivedZeitkat = deriveZeitkatIdFromBooking(resized);
  if (derivedZeitkat) resized.rawdata.ZEITKAT = derivedZeitkat;
  return resized;
}

function findNextWeeklyBand(feeCatalog, currentEntry, referenceDate) {
  const currentMaxHours = Number(currentEntry?.maxHours);
  if (!Number.isFinite(currentMaxHours)) return null;
  return (feeCatalog || [])
    .filter((entry) => !getFeeBandZeitkatId(entry))
    .filter((entry) => isDateWithinRange(referenceDate, entry.validFrom || '', entry.validUntil || ''))
    .filter((entry) => Number.isFinite(Number(entry.maxHours)) && Number(entry.maxHours) > currentMaxHours)
    .sort((left, right) => Number(left.maxHours) - Number(right.maxHours)
      || String(right.validFrom || '').localeCompare(String(left.validFrom || '')))[0] || null;
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
 * Simulate Capakita's stored tariff catalogs: ZEITKAT rates are matched by daily
 * category; legacy JSON maxHours rates are matched by weekly booking hours. When
 * ZEITKAT is missing, active booking times provide a read-only category fallback.
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
    const childHoursBefore = bookings.reduce((sum, booking) => sum + sumWeightedBookingHours(booking), 0);
    let childHoursAfter = 0;
    let childFundingDelta = 0;
    let childMigratedBookings = 0;
    let firstZone = null;
    let firstTargetZone = null;
    let childChanged = false;
    let firstBookingGroupId = primaryGroupId;
    const childSimulatedBookings = [];
    const childBookingGroups = [];

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
      childBookingGroups.push(group);

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
    let parentFeeBefore = 0;
    let parentFeeAfter = 0;
    let parentFeeDelta = 0;
    let weeklyMigrationShare = 0;
    const directFeeEntry = primaryZone
      ? findFeeEntryForZeitkat(primaryFeeCatalog, primaryZone, referenceDate)
      : null;

    if (directFeeEntry) {
      const sourceFee = getEditedFeeEntryPrice(directFeeEntry, primaryGroupId, temporaryPrices);
      const baselineFee = getEditedFeeEntryPrice(directFeeEntry, primaryGroupId, {});
      const primaryNextZone = ZEITKAT_CATALOG[getZeitkatZoneIndex(primaryZone) + 1] || null;
      const nextFee = primaryNextZone
        ? getEditedZeitkatPrice(primaryFeeCatalog, primaryGroupId, primaryNextZone.id, referenceDate, temporaryPrices)
        : { entry: null, originalAmount: null, amount: null };
      const canMigrate = Boolean(nextFee.entry && Math.round(sourceFee.amount * 100) === Math.round(nextFee.amount * 100));
      const migrationShare = canMigrate ? utilization : 0;
      parentFeeBefore = baselineFee.originalAmount;
      parentFeeAfter = sourceFee.amount * (1 - migrationShare)
        + (canMigrate ? nextFee.amount * migrationShare : 0);
      parentFeeDelta = parentFeeAfter - parentFeeBefore;
      childChanged = childChanged || sourceFee.amount !== sourceFee.originalAmount;
    } else {
      const sourceBand = findFeeEntryForHours(primaryFeeCatalog, childHoursBefore, referenceDate);
      const nextBand = sourceBand ? findNextWeeklyBand(primaryFeeCatalog, sourceBand, referenceDate) : null;
      if (sourceBand) {
        const baselineFee = getEditedFeeEntryPrice(sourceBand, primaryGroupId, {});
        const sourceFee = getEditedFeeEntryPrice(sourceBand, primaryGroupId, temporaryPrices);
        const nextFee = getEditedFeeEntryPrice(nextBand, primaryGroupId, temporaryPrices);
        const canMigrate = Boolean(nextBand && Math.round(sourceFee.amount * 100) === Math.round(nextFee.amount * 100));
        weeklyMigrationShare = canMigrate ? utilization : 0;
        parentFeeBefore = baselineFee.originalAmount;
        parentFeeAfter = sourceFee.amount * (1 - weeklyMigrationShare)
          + (canMigrate ? nextFee.amount * weeklyMigrationShare : 0);
        parentFeeDelta = parentFeeAfter - parentFeeBefore;
        childChanged = childChanged || sourceFee.amount !== sourceFee.originalAmount;

        if (weeklyMigrationShare > 0 && Number.isFinite(Number(nextBand.maxHours))) {
          const targetWeeklyHours = Math.max(childHoursBefore, Number(nextBand.maxHours));
          const weeklyGrowth = (targetWeeklyHours - childHoursBefore) * weeklyMigrationShare;
          const segmentHoursBefore = bookings.reduce(
            (sum, booking) => sum + sumWeightedBookingHours(booking, { preferBetrstd: false }),
            0
          );
          const scale = segmentHoursBefore > 0 ? targetWeeklyHours / segmentHoursBefore : 1;
          if (weeklyGrowth > 0) {
            childHoursAfter += weeklyGrowth;
            totalBookingHoursAfter += weeklyGrowth;
            const primaryGroup = groups.get(primaryGroupId);
            if (primaryGroup) {
              primaryGroup.bookingHoursAfter += weeklyGrowth;
              primaryGroup.migratedBookings += weeklyMigrationShare;
            }
            childMigratedBookings += weeklyMigrationShare;
            totalMigratedBookings += weeklyMigrationShare;
            childChanged = true;

            bookings.forEach((booking, index) => {
              const resized = resizeBookingByFactor(withResolvedZeitkat(booking, resolveBookingZeitkat(booking)), scale);
              const fromZone = resolveBookingZeitkat(booking);
              const toZone = deriveZeitkatIdFromBooking(resized) || fromZone;
              if (fromZone && toZone) {
                const grantDelta = baseValue * weight
                  * ((getZeitkatFactor(toZone) ?? 1) - (getZeitkatFactor(fromZone) ?? 1))
                  * weeklyMigrationShare;
                childFundingDelta += grantDelta;
                totalDeltaMonthlyFunding += grantDelta;
                const group = childBookingGroups[index];
                if (group) group.deltaMonthlyFunding += grantDelta;
              }
              childSimulatedBookings[index] = resized;
              if (index === 0 && toZone) {
                firstZone = fromZone || firstZone;
                firstTargetZone = toZone;
              }
            });
          }
        }
      }
    }

    totalDeltaMonthlyParentFees += parentFeeDelta;
    childChanged = childChanged || Math.abs(parentFeeDelta) >= 0.005;
    if (primaryGroupId || Math.abs(parentChangedTotal(childFundingDelta, parentFeeDelta)) > 0.005 || childChanged) {
      if (!groups.has(primaryGroupId)) {
        groups.set(primaryGroupId, makeGroupTotals(primaryGroupId, groupNames.get(primaryGroupId)));
      }
      groups.get(primaryGroupId).deltaMonthlyParentFees += parentFeeDelta;
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

function parentChangedTotal(fundingDelta, parentFeeDelta) {
  return fundingDelta + parentFeeDelta;
}

// Kept as an alias for callers from older local branches; simulation semantics are now tariff-based.
export const simulateZeitkatUpgrade = simulateContributionChanges;
