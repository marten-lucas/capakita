import {
  ZEITKAT_CATALOG,
  decodeBuchungsart,
  getFeeBandZeitkatId,
  getZeitkatFactor,
  getZeitkatZoneBounds,
  getZeitkatZoneIndex,
  isAdebisTrue,
} from './adebisConstants';
import { sumWeightedBookingHours } from './chartUtils/chartUtils';
import {
  getBayKiBiGWeightForChild,
  isRecordActiveOnDate,

  pickApplicableValidityEntry,
  pickLatestValidityEntry,
} from './financeUtils';
import { minutesToTime, timeToMinutes } from './timeUtils';

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundHours = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function getFeeBandSimulationPriceKey(entry) {
  const zeitkatId = getFeeBandZeitkatId(entry) || '';
  const identity = entry?.id != null && String(entry.id) !== ''
    ? ['id', String(entry.id)]
    : ['validity', String(entry?.validFrom || ''), String(entry?.validUntil || '')];
  return `fee:${JSON.stringify([zeitkatId, ...identity])}`;
}

export function getFeeBandSimulationPriceOverride(entry, groupPrices = {}) {
  const key = getFeeBandSimulationPriceKey(entry);
  const legacyKey = getFeeBandZeitkatId(entry) || `band:${String(entry?.id || '')}`;
  const value = Object.hasOwn(groupPrices || {}, key) ? groupPrices[key] : groupPrices?.[legacyKey];
  return value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;
}

export function getFeeCatalogSimulationRows(groupFeeCatalogs = {}, groupLabels = new Map(), referenceDate) {
  return Object.entries(groupFeeCatalogs || {}).flatMap(([groupId, catalog]) => {
    const feeEntries = Array.isArray(catalog) ? catalog : [];
    const zeitkatRows = ZEITKAT_CATALOG.flatMap((zone) => {
      const entry = findSimulationFeeEntry(feeEntries, zone.id, referenceDate);
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
  if (!entry || entry.enabled === false) return { entry: null, originalAmount: null, amount: null };
  const originalAmount = Number(entry.monthlyAmount) || 0;
  const override = getFeeBandSimulationPriceOverride(entry, temporaryPrices?.[groupId]);
  return {
    entry,
    originalAmount,
    amount: override !== undefined ? roundMoney(override) : roundMoney(originalAmount),
  };
}

function findSimulationFeeEntry(feeCatalog, zeitkatId, referenceDate) {
  if (!zeitkatId) return null;
  return pickApplicableValidityEntry(feeCatalog, referenceDate, (entry) => (
    entry.enabled !== false
    && entry.monthlyAmount != null && entry.monthlyAmount !== ''
    && Number.isFinite(Number(entry.monthlyAmount)) && Number(entry.monthlyAmount) >= 0
    && getFeeBandZeitkatId(entry) === zeitkatId
  ));
}

function getEditedZeitkatPrice(feeCatalog, groupId, zeitkatId, referenceDate, temporaryPrices) {
  const entry = findSimulationFeeEntry(feeCatalog, zeitkatId, referenceDate);
  return getEditedFeeEntryPrice(entry, groupId, temporaryPrices);
}

function chooseRule(rules, referenceDate) {
  return pickApplicableValidityEntry(rules, referenceDate) || pickLatestValidityEntry(rules) || null;
}


function calculateAppliedParentFeeSubsidy(isEligible, monthlyAmount, grossFee = Infinity) {
  if (!isEligible) return 0;
  return Math.min(Math.max(0, grossFee), Math.max(0, Number(monthlyAmount) || 0));
}

export function isParentFeeSubsidyEligible(child, group, bookings, referenceDate) {
  if (String(group?.type || '').toLowerCase() === 'schulkindgruppe') return false;
  if ((bookings || []).some((booking) => isAdebisTrue(booking?.rawdata?.SCHULKIND))) return false;

  const birthDate = String(child?.dateofbirth || child?.rawdata?.GEBDATUM || '').slice(0, 10);
  const dateParts = birthDate.match(/^(\d{4})-(\d{2})-\d{2}$/);
  const referenceParts = String(referenceDate || '').slice(0, 7).match(/^(\d{4})-(\d{2})$/);
  if (!dateParts || !referenceParts) return false;

  const thirdBirthdayYear = Number(dateParts[1]) + 3;
  const referenceYear = Number(referenceParts[1]);
  const referenceMonth = Number(referenceParts[2]);
  return referenceYear > thirdBirthdayYear
    || (referenceYear === thirdBirthdayYear && referenceMonth >= 9);
}

function calculateExpectedFeeAfterMigration({ sourceAmount, nextAmount, migrationShare, eligible, subsidyAmount }) {
  const share = Math.max(0, Math.min(1, Number(migrationShare) || 0));
  const source = Math.max(0, Number(sourceAmount) || 0);
  const next = Math.max(0, Number(nextAmount ?? sourceAmount) || 0);
  const grossFee = source * (1 - share) + next * share;
  const subsidy = calculateAppliedParentFeeSubsidy(eligible, subsidyAmount, source) * (1 - share)
    + calculateAppliedParentFeeSubsidy(eligible, subsidyAmount, next) * share;
  return { grossFee, subsidy, parentFee: grossFee - subsidy };
}

function resizeBookingToZeitkat(booking, toZeitkat, allowReduction = false) {
  const targetHours = getZeitkatZoneBounds(toZeitkat)?.maxHours;
  if (!Number.isFinite(targetHours)) return null;

  if (!(booking?.times || []).some((day) => dailyMinutes(day) > 0)) return null;

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
 * mutating the stored booking. Subsidy fields used in fee deltas are the
 * tariff-limited relief, not a claim about actual payments above the tariff.
 * policyParentFeeSubsidy and baselineNominalParentFeeSubsidy are configured
 * nominal amounts; deltaNominalParentFeeSubsidy is their difference, independent
 * of tariff-limited deltaParentFeeSubsidy. Missing comparisons
 * are omitted from monetary aggregates and reported in diagnostics.missingTariffs;
 * aggregates are therefore partial when diagnostics.feeCalculationComplete is false.
 * diagnostics.subsidyExceedsTariff identifies cases whose actual payment is unknown.
 * The BayKiBiG baseValue is annual; funding deltas use ZEITKAT factors per month.
 * totals.monthlyParentFeesBefore/After include unchanged children and are partial
 * if tariff diagnostics are incomplete. familyGroupIds is an identity mapping, not a label.
 * activeChildren optionally supplies the complete in-scope cohort as of referenceDate:
 * [{ itemId, item, groupId, bookings }], including children without basis bookings.
 * bookings should include active basis bookings even without hours. Records omitted
 * from demandBookings are diagnosed, not turned into zero-fee or synthetic bookings.
 * Without activeChildren the known cohort is partial; feeCalculationComplete only
 * covers children known to this call. It does not certify cohort completeness.
 */
export function simulateContributionChanges({
  demandBookings = [],
  dataItems = {},
  familyGroupIds = {},
  groupDefs = [],
  bayKiBiGRules = [],
  groupFeeCatalogs = {},
  originalGroupFeeCatalogs = null,
  parentFeeSubsidy = {},
  parentFeeSubsidiesByGroup = {},
  baselineParentFeeSubsidy = null,
  baselineParentFeeSubsidiesByGroup = null,
  parentFeeSubsidyChildren = null,
  activeChildren = null,
  temporaryPrices = {},
  utilizationPercent = 100,
  referenceDate,
} = {}) {
  const rule = chooseRule(bayKiBiGRules, referenceDate);
  const baseValue = Number(rule?.baseValue) || 0;
  const weightFactors = rule?.weightFactors || null;
  const utilization = Math.max(0, Math.min(100, Number(utilizationPercent) || 0)) / 100;
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
  const missingTariffs = [];
  const incompleteMigrations = [];
  const subsidyExceedsTariff = [];
  let skippedNoZone = 0;
  let totalBookingHoursBefore = 0;
  let totalBookingHoursAfter = 0;
  let totalDeltaMonthlyFunding = 0;
  let totalDeltaMonthlyParentFees = 0;
  let totalDeltaMonthlyParentSubsidy = 0;
  let totalGrossParentFees = 0;
  let totalMonthlyParentFeesBefore = 0;
  let totalMonthlyParentFeesAfter = 0;
  let totalPolicyParentFeeSubsidy = 0;
  let totalBaselineNominalParentFeeSubsidy = 0;
  let eligibleParentFeeSubsidyChildren = 0;
  let totalMigratedBookings = 0;
  const getConfiguredSubsidyAmount = (subsidyRule, respectEndDate) => {
    if (subsidyRule?.enabled === false) return 0;
    const isExpired = respectEndDate && Boolean(subsidyRule?.endDate)
      && String(referenceDate || '').slice(0, 10) > String(subsidyRule.endDate).slice(0, 10);
    return isExpired ? 0 : Math.max(0, Number(subsidyRule?.monthlyAmount ?? 100) || 0);
  };
  const subsidyChildren = Array.isArray(parentFeeSubsidyChildren)
    ? parentFeeSubsidyChildren
    : Array.from(bookingsByChild, ([itemId, bookings]) => ({ itemId, bookings }));
  const subsidyStateByChild = new Map();
  const knownChildren = new Map();
  [...subsidyChildren, ...(Array.isArray(activeChildren) ? activeChildren : [])].forEach((record) => {
    const itemId = String(record?.itemId ?? record?.id ?? '');
    if (!itemId) return;
    const item = record.item || dataItems?.[itemId];
    if (item && !isRecordActiveOnDate(item, referenceDate)) return;
    knownChildren.set(itemId, { ...knownChildren.get(itemId), ...record, itemId });
  });
  bookingsByChild.forEach((bookings, itemId) => {
    if (!knownChildren.has(itemId)) knownChildren.set(itemId, { itemId, bookings });
  });

  subsidyChildren.forEach((subsidyChild) => {
    const childId = String(subsidyChild?.itemId ?? subsidyChild?.id ?? '');
    if (!childId) return;
    const child = subsidyChild.item || dataItems?.[childId] || null;
    const bookings = Array.isArray(subsidyChild.bookings)
      ? subsidyChild.bookings
      : bookingsByChild.get(childId) || [];
    const latestBooking = bookings.slice().sort((left, right) => (
      String(right?.startdate || '').localeCompare(String(left?.startdate || ''))
    ))[0];
    const groupId = String(subsidyChild.groupId || bookingGroupId(latestBooking, child));
    const group = groupDefById.get(groupId) || null;
    if (subsidyChild.isSchoolChild || !isParentFeeSubsidyEligible(child, group, bookings, referenceDate)) return;

    const childSubsidyRule = parentFeeSubsidiesByGroup?.[groupId] || parentFeeSubsidy;
    const baselineChildSubsidyRule = baselineParentFeeSubsidiesByGroup?.[groupId]
      || baselineParentFeeSubsidy
      || childSubsidyRule;
    const hasExplicitBaseline = baselineParentFeeSubsidy != null
      || baselineParentFeeSubsidiesByGroup != null;
    const baselineAmount = getConfiguredSubsidyAmount(baselineChildSubsidyRule, hasExplicitBaseline);
    const policyAmount = getConfiguredSubsidyAmount(childSubsidyRule, true);
    if (baselineAmount > 0 || policyAmount > 0) eligibleParentFeeSubsidyChildren += 1;
    totalPolicyParentFeeSubsidy += policyAmount;
    totalBaselineNominalParentFeeSubsidy += baselineAmount;
    subsidyStateByChild.set(childId, { eligible: true, baselineAmount, policyAmount, groupId });
  });

  bookingsByChild.forEach((childBookings, childKey) => {
    const bookings = childBookings.slice().sort((a, b) => String(b?.startdate || '').localeCompare(String(a?.startdate || '')));
    const child = dataItems?.[childKey] || null;
    const firstBooking = bookings[0];
    const primaryGroupId = bookingGroupId(firstBooking, child);
    const primaryGroup = groupDefById.get(primaryGroupId) || null;
    const weight = getBayKiBiGWeightForChild(child, primaryGroup, referenceDate, weightFactors);
    const subsidyState = subsidyStateByChild.get(childKey);
    const subsidyEligible = Boolean(subsidyState);
    const baselineSubsidyAmount = subsidyState?.baselineAmount || 0;
    const policySubsidyAmount = subsidyState?.policyAmount || 0;
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
      const resizedBooking = sameSimulatedZeitkatPrice && bookingHoursBefore > 0
        ? resizeBookingToZeitkat(bookingWithZone, nextZone.id)
        : null;
      if (utilization > 0 && sameSimulatedZeitkatPrice && !resizedBooking) {
        incompleteMigrations.push({ itemId: childKey, bookingId: booking.id ?? null, groupId, zeitkatId: zoneBefore,
          reason: bookingHoursBefore > 0 ? 'missing-booking-segments' : 'no-booking-hours' });
      }
      const migrationShare = resizedBooking ? utilization : 0;
      const zoneAfter = migrationShare > 0 ? nextZone.id : zoneBefore;
      const factorBefore = zoneBefore ? getZeitkatFactor(zoneBefore) ?? 1 : null;
      const factorAfter = zoneAfter ? getZeitkatFactor(zoneAfter) ?? factorBefore : factorBefore;
      const fundingDelta = factorBefore == null || factorAfter == null
        ? 0
        : (baseValue / 12) * weight * (factorAfter - factorBefore) * migrationShare;
      const simulatedBooking = migrationShare > 0 ? resizedBooking : bookingWithZone;
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
    const activeDirectFeeEntry = primaryZone
      ? findSimulationFeeEntry(primaryFeeCatalog, primaryZone, referenceDate)
      : null;
    const baselineDirectFeeEntry = primaryZone
      ? findSimulationFeeEntry(baselinePrimaryFeeCatalog, primaryZone, referenceDate)
      : null;
    const directFeeEntry = activeDirectFeeEntry;

    if (directFeeEntry && baselineDirectFeeEntry) {
      const sourceFee = getEditedFeeEntryPrice(directFeeEntry, primaryGroupId, temporaryPrices);
      const baselineFee = baselineDirectFeeEntry
        ? getEditedFeeEntryPrice(baselineDirectFeeEntry, primaryGroupId, {})
        : { entry: null, originalAmount: 0, amount: 0 };
      const primaryNextZone = ZEITKAT_CATALOG[getZeitkatZoneIndex(primaryZone) + 1] || null;
      const nextFee = primaryNextZone
        ? getEditedZeitkatPrice(primaryFeeCatalog, primaryGroupId, primaryNextZone.id, referenceDate, temporaryPrices)
        : { entry: null, originalAmount: null, amount: null };
      const canMigrate = Boolean(sumWeightedBookingHours(firstBooking) > 0 && nextFee.entry
        && Math.round(sourceFee.amount * 100) === Math.round(nextFee.amount * 100)
        && resizeBookingToZeitkat(firstBooking, primaryNextZone.id));
      const migrationShare = canMigrate ? utilization : 0;
      const grossFeeBefore = baselineFee.amount;
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
        subsidyEligible,
        baselineSubsidyAmount,
        grossFeeBefore
      );
      parentFeeSubsidyAfter = expectedAfter.subsidy;
      parentFeeBefore = Math.max(0, grossFeeBefore - parentFeeSubsidyBefore);
      parentFeeAfter = expectedAfter.parentFee;
      parentFeeDelta = parentFeeAfter - parentFeeBefore;
      parentFeeSubsidyDelta = parentFeeSubsidyAfter - parentFeeSubsidyBefore;
      if (baselineSubsidyAmount > grossParentFeeBefore || policySubsidyAmount > grossParentFeeAfter) {
        subsidyExceedsTariff.push({
          itemId: childKey, groupId: primaryGroupId,
          grossParentFeeBefore: roundMoney(grossParentFeeBefore),
          grossParentFeeAfter: roundMoney(grossParentFeeAfter),
          nominalSubsidyBefore: roundMoney(baselineSubsidyAmount),
          nominalSubsidyAfter: roundMoney(policySubsidyAmount),
        });
      }
      childChanged = childChanged || sourceFee.amount !== sourceFee.originalAmount;
    } else {
      missingTariffs.push({
        itemId: childKey,
        groupId: primaryGroupId,
        zeitkatId: primaryZone,
        missingBaseline: !baselineDirectFeeEntry,
        missingCurrent: !directFeeEntry,
        reason: primaryZone ? 'missing-tariff' : 'missing-zeitkat',
      });
    }

    totalDeltaMonthlyParentSubsidy += parentFeeSubsidyDelta;
    if (subsidyState) subsidyState.appliedDelta = parentFeeSubsidyDelta;

    const familyId = String(familyGroupIds[childKey] || child?.familyId || `child:${childKey}`);
    if (!familyContributionTotals.has(familyId)) {
      familyContributionTotals.set(familyId, {
        id: familyId,
        label: child?.familyLabel || child?.familyId || child?.name || familyId,
        monthlyParentFeesBefore: 0,
        monthlyParentFeesAfter: 0,
        childIds: [],
      });
    }
    const familyContribution = familyContributionTotals.get(familyId);
    familyContribution.childIds.push(childKey);
    familyContribution.monthlyParentFeesBefore += parentFeeBefore;
    familyContribution.monthlyParentFeesAfter += parentFeeAfter;

    totalDeltaMonthlyParentFees += parentFeeDelta;
    totalMonthlyParentFeesBefore += parentFeeBefore;
    totalMonthlyParentFeesAfter += parentFeeAfter;
    totalGrossParentFees += grossParentFeeBefore;
    childChanged = childChanged || Math.abs(parentFeeDelta) >= 0.005 || Math.abs(parentFeeSubsidyDelta) >= 0.005;
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
      familyId,
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

  const childrenWithoutBookingHours = [];
  knownChildren.forEach((record, childId) => {
    const demand = bookingsByChild.get(childId) || [];
    const supplied = Array.isArray(record.bookings) ? record.bookings.filter((booking) => (
      isBasisBooking(booking) && isBookingActiveOnDate(booking, referenceDate)
    )) : [];
    const bookings = [...demand, ...supplied];
    const groupId = String(record.groupId || bookingGroupId(bookings[0], record.item || dataItems?.[childId]));
    if (!bookings.some((booking) => sumWeightedBookingHours(booking) > 0)) {
      childrenWithoutBookingHours.push({
        itemId: childId, groupId,
        reason: bookings.length ? 'no-booking-hours' : 'missing-basis-booking',
      });
    }
    if (demand.length === 0) {
      missingTariffs.push({
        itemId: childId, groupId, zeitkatId: null,
        missingBaseline: true, missingCurrent: true,
        reason: bookings.length ? 'missing-demand-booking' : 'missing-booking',
      });
    }
  });

  subsidyStateByChild.forEach((subsidyState) => {
    if (!groups.has(subsidyState.groupId)) {
      groups.set(subsidyState.groupId, makeGroupTotals(
        subsidyState.groupId,
        groupNames.get(subsidyState.groupId)
      ));
    }
    groups.get(subsidyState.groupId).deltaMonthlyParentSubsidy += subsidyState.appliedDelta || 0;
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
      monthlyParentFeesBefore: roundMoney(totalMonthlyParentFeesBefore),
      monthlyParentFeesAfter: roundMoney(totalMonthlyParentFeesAfter),
      deltaParentFeeSubsidy: roundMoney(totalDeltaMonthlyParentSubsidy),
      grossParentFees: roundMoney(totalGrossParentFees),
      policyParentFeeSubsidy: roundMoney(totalPolicyParentFeeSubsidy),
      baselineNominalParentFeeSubsidy: roundMoney(totalBaselineNominalParentFeeSubsidy),
      deltaNominalParentFeeSubsidy: roundMoney(totalPolicyParentFeeSubsidy - totalBaselineNominalParentFeeSubsidy),
      eligibleParentFeeSubsidyChildren,
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
    diagnostics: {
      feeCalculationComplete: missingTariffs.length === 0,
      activeChildrenCoverage: Array.isArray(activeChildren) ? 'caller-provided' : 'partial',
      missingTariffs, childrenWithoutBookingHours, subsidyExceedsTariff, incompleteMigrations,
    },
    skippedNoZone,
    rule,
  };
}

function parentChangedTotal(fundingDelta, parentFeeDelta) {
  return fundingDelta + parentFeeDelta;
}

function maximumPotentialWithinBudget(options, budget) {
  const capacity = Math.max(0, Math.floor((Number(budget) || 0) * 100 + 0.000001));
  let freeHours = 0;
  let freeWeightedHours = 0;
  let freeCost = 0;
  const choices = [];
  options.forEach(({ cost, hours, weightedHours }) => {
    if (!(hours > 0)) return;
    const costInCents = Math.max(0, Math.round(cost * 100));
    if (costInCents === 0) {
      freeHours += hours;
      freeWeightedHours += weightedHours;
      freeCost += costInCents;
    } else if (costInCents <= capacity) {
      choices.push({ cost: costInCents, hours, weightedHours });
    }
  });

  const best = Array(capacity + 1).fill(null);
  best[0] = { hours: 0, weightedHours: 0, cost: 0 };
  choices.forEach((choice) => {
    for (let remaining = capacity; remaining >= choice.cost; remaining -= 1) {
      const previous = best[remaining - choice.cost];
      if (!previous) continue;
      const candidate = {
        hours: previous.hours + choice.hours,
        weightedHours: previous.weightedHours + choice.weightedHours,
        cost: previous.cost + choice.cost,
      };
      const current = best[remaining];
      if (!current || candidate.hours > current.hours + 0.005
        || (Math.abs(candidate.hours - current.hours) <= 0.005
          && candidate.weightedHours > current.weightedHours)) best[remaining] = candidate;
    }
  });

  const selected = best.reduce((current, candidate) => {
    if (!candidate) return current;
    if (!current || candidate.hours > current.hours + 0.005
      || (Math.abs(candidate.hours - current.hours) <= 0.005
        && candidate.weightedHours > current.weightedHours)) return candidate;
    return current;
  }, null) || { hours: 0, weightedHours: 0, cost: 0 };
  return {
    weeklyHours: roundHours(freeHours + selected.hours),
    weightedDailyHours: roundHours((freeWeightedHours + selected.weightedHours) / 5),
    monthlyParentFeeChange: roundMoney((freeCost + selected.cost) / 100),
  };
}

/** Indicative adjacent-band opportunities, not a prediction of family behavior.
 * Without usable segments, weekly hours are scaled by the ratio of target to
 * source ZEITKAT upper bounds. This assumes proportional hours, not weekdays
 * or opening times. The open-ended ZEITKAT 13 has no usable upper bound.
 * Missing rates or booking data are reported on the affected family.
 */
export function calculateFamilyFeePotentials({
  demandBookings = [],
  dataItems = {},
  familyGroupIds = {},
  groupDefs = [],
  bayKiBiGRules = [],
  groupFeeCatalogs = {},
  parentFeeSubsidy = {},
  parentFeeSubsidiesByGroup = {},
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
    const familyId = String(familyGroupIds[childId] || child.familyId || `child:${childId}`);
    if (!families.has(familyId)) {
      families.set(familyId, {
        id: familyId,
        label: child.familyLabel || child.familyId || child.name || familyId,
        upgrades: [],
        downgrades: [],
        childIds: [],
        missingTariffs: [],
        incompleteBookings: [],
      });
    }
    families.get(familyId).childIds.push(childId);

    const orderedBookings = bookings.slice().sort((left, right) => (
      String(right?.startdate || '').localeCompare(String(left?.startdate || ''))
    ));
    const firstBooking = orderedBookings[0];
    const groupId = bookingGroupId(firstBooking, child);
    const primaryZone = resolveBookingZeitkat(firstBooking);
    const primaryZoneIndex = getZeitkatZoneIndex(primaryZone);
    const family = families.get(familyId);
    if (!primaryZone || primaryZoneIndex < 0) {
      family.missingTariffs.push({ itemId: childId, groupId, zeitkatId: null, reason: 'missing-zeitkat' });
      return;
    }

    const catalog = groupFeeCatalogs?.[groupId] || [];
    const currentPrice = getEditedZeitkatPrice(catalog, groupId, primaryZone, referenceDate, temporaryPrices);
    if (!currentPrice.entry) {
      family.missingTariffs.push({ itemId: childId, groupId, zeitkatId: primaryZone, reason: 'missing-tariff' });
      return;
    }
    const groupDef = (groupDefs || []).find((entry) => String(entry.id) === groupId) || null;
    const childSubsidyRule = parentFeeSubsidiesByGroup?.[String(groupId)] || parentFeeSubsidy;
    const subsidyBaseAmount = childSubsidyRule?.enabled === false
      ? 0
      : Math.max(0, Number(childSubsidyRule?.monthlyAmount ?? 100) || 0);
    const subsidyEnded = Boolean(childSubsidyRule?.endDate)
      && String(referenceDate || '').slice(0, 10) > String(childSubsidyRule.endDate).slice(0, 10);
    const effectiveSubsidyAmount = subsidyEnded ? 0 : subsidyBaseAmount;
    const subsidyEligible = isParentFeeSubsidyEligible(
      child,
      groupDef,
      orderedBookings,
      referenceDate
    );
    const parentContribution = (grossFee) => Math.max(
      0,
      grossFee - calculateAppliedParentFeeSubsidy(subsidyEligible, effectiveSubsidyAmount)
    );

    const currentParentContribution = parentContribution(currentPrice.amount);
    const activeRule = chooseRule(bayKiBiGRules, referenceDate);

    const resizeChangeForDirection = (direction) => {
      let hours = 0;
      let weightedHours = 0;
      let complete = true;
      orderedBookings.forEach((booking) => {
        const zoneId = resolveBookingZeitkat(booking);
        const zoneIndex = getZeitkatZoneIndex(zoneId);
        const targetZone = zoneIndex < 0 ? null : ZEITKAT_CATALOG[zoneIndex + direction];
        const currentHours = sumWeightedBookingHours(booking);
        const adjustedBooking = targetZone && currentHours > 0
          ? resizeBookingToZeitkat(booking, targetZone.id, direction < 0)
          : null;
        if (zoneIndex < 0 || !(currentHours > 0) || (targetZone && !adjustedBooking)) {
          complete = false;
          family.incompleteBookings.push({
            itemId: childId,
            bookingId: booking.id ?? null,
            groupId: bookingGroupId(booking, child),
            zeitkatId: zoneId,
            direction: direction > 0 ? 'upgrade' : 'downgrade',
            reason: zoneIndex < 0 ? 'missing-zeitkat' : !(currentHours > 0) ? 'no-booking-hours' : 'missing-booking-segments',
          });
          return;
        }
        if (!targetZone) return;
        const bookingGroup = (groupDefs || []).find((entry) => String(entry.id) === bookingGroupId(booking, child)) || null;
        const weight = getBayKiBiGWeightForChild(child, bookingGroup, referenceDate, activeRule?.weightFactors, booking);
        const change = sumWeightedBookingHours(adjustedBooking) - currentHours;
        hours += change;
        weightedHours += change * weight;
      });
      return { hours, weightedHours, complete };
    };
    const nextZone = ZEITKAT_CATALOG[primaryZoneIndex + 1];
    if (nextZone) {
      const change = resizeChangeForDirection(1);
      const nextPrice = getEditedZeitkatPrice(catalog, groupId, nextZone.id, referenceDate, temporaryPrices);
      if (nextPrice.entry) {
        if (change.complete) family.upgrades.push({
          cost: Math.max(0, roundMoney(parentContribution(nextPrice.amount) - currentParentContribution)),
          hours: Math.max(0, change.hours),
          weightedHours: Math.max(0, change.weightedHours),
        });
      } else {
        family.missingTariffs.push({ itemId: childId, groupId, zeitkatId: nextZone.id, reason: 'missing-tariff' });
      }
    }

    const previousZone = ZEITKAT_CATALOG[primaryZoneIndex - 1];
    if (previousZone) {
      const change = resizeChangeForDirection(-1);
      const previousPrice = getEditedZeitkatPrice(catalog, groupId, previousZone.id, referenceDate, temporaryPrices);
      if (previousPrice.entry) {
        const monthlySaving = roundMoney(currentParentContribution - parentContribution(previousPrice.amount));
        if (monthlySaving > 0) {
          if (change.complete) family.downgrades.push({
            cost: monthlySaving,
            hours: Math.max(0, -change.hours),
            weightedHours: Math.max(0, -change.weightedHours),
          });
        }
      } else {
        family.missingTariffs.push({ itemId: childId, groupId, zeitkatId: previousZone.id, reason: 'missing-tariff' });
      }
    }
  });

  return Array.from(families.values()).map((family) => {
    const upgrade = maximumPotentialWithinBudget(family.upgrades, monthlyBudget);
    const downgrade = maximumPotentialWithinBudget(family.downgrades, monthlyBudget);
    return {
      id: family.id,
      label: family.label,
      childIds: family.childIds,
      potentialUpgradeWeeklyHours: upgrade.weeklyHours,
      potentialDowngradeWeeklyHours: downgrade.weeklyHours,
      potentialUpgradeWeightedDailyHours: upgrade.weightedDailyHours,
      potentialDowngradeWeightedDailyHours: downgrade.weightedDailyHours,
      potentialUpgradeMonthlyParentFeeChange: upgrade.monthlyParentFeeChange,
      potentialDowngradeMonthlyParentFeeChange: -downgrade.monthlyParentFeeChange,
      ...(family.missingTariffs.length || family.incompleteBookings.length ? {
        diagnostics: {
          potentialCalculationComplete: false,
          missingTariffs: family.missingTariffs,
          incompleteBookings: family.incompleteBookings,
        },
      } : {}),
    };
  });
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

  totals.annualParentFeesBefore = roundMoney(months.reduce((sum, month) => sum + month.result.totals.monthlyParentFeesBefore, 0));
  totals.annualParentFeesAfter = roundMoney(months.reduce((sum, month) => sum + month.result.totals.monthlyParentFeesAfter, 0));
  totals.annualGrossParentFees = roundMoney(months.reduce((sum, month) => sum + (month.result?.totals?.grossParentFees || 0), 0));
  totals.annualParentFeeSubsidy = roundMoney(months.reduce((sum, month) => sum + (month.result?.totals?.policyParentFeeSubsidy || 0), 0));
  totals.annualBaselineNominalParentFeeSubsidy = roundMoney(months.reduce((sum, month) => sum + month.result.totals.baselineNominalParentFeeSubsidy, 0));
  totals.deltaYearlyNominalParentFeeSubsidy = roundMoney(months.reduce((sum, month) => sum + month.result.totals.deltaNominalParentFeeSubsidy, 0));
  totals.eligibleParentFeeSubsidyChildMonths = months.reduce(
    (sum, month) => sum + (month.result?.totals?.eligibleParentFeeSubsidyChildren || 0),
    0
  );
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
  const missingTariffs = months.flatMap(({ referenceDate, result }) => (
    result.diagnostics.missingTariffs.map((entry) => ({ referenceDate, ...entry }))
  ));
  const subsidyExceedsTariff = months.flatMap(({ referenceDate, result }) => (
    result.diagnostics.subsidyExceedsTariff.map((entry) => ({ referenceDate, ...entry }))
  ));
  const childrenWithoutBookingHours = months.flatMap(({ referenceDate, result }) => (
    result.diagnostics.childrenWithoutBookingHours.map((entry) => ({ referenceDate, ...entry }))
  ));
  const incompleteMigrations = months.flatMap(({ referenceDate, result }) => (
    result.diagnostics.incompleteMigrations.map((entry) => ({ referenceDate, ...entry }))
  ));

  return {
    year: numericYear, months, totals, perChild: [], groups: [],
    diagnostics: {
      feeCalculationComplete: missingTariffs.length === 0,
      activeChildrenCoverage: Array.isArray(simulationOptions.activeChildren) ? 'caller-provided' : 'partial',
      missingTariffs, childrenWithoutBookingHours, subsidyExceedsTariff, incompleteMigrations,
    },
  };
}
