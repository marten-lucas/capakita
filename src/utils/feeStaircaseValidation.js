import { getFeeBandZeitkatId, ZEITKAT_CATALOG } from './adebisConstants';

const REFERENCE_ZEITKAT_ID = '04';
const MINIMUM_DIFFERENCE_EURO = 5;

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isActiveEntry(entry) {
  return entry?.enabled !== false && amount(entry?.monthlyAmount) > 0;
}

export function getZeitkatLabel(zone) {
  return `Kategorie ${zone.kennz} (ZEITKAT ${zone.id}, ${zone.kurzbez}h)`;
}

/**
 * Checks the selected contiguous range of booking-time categories against
 * STMAS Newsletter 31. Categories outside the active min/max range are optional.
 */
export function validateFeeStaircase(entries = []) {
  const feeEntries = Array.isArray(entries) ? entries : [];
  const activeEntriesByZone = new Map(
    feeEntries
      .filter(isActiveEntry)
      .map((entry) => [getFeeBandZeitkatId(entry), entry])
      .filter(([zoneId]) => Boolean(zoneId))
  );
  const activeZones = ZEITKAT_CATALOG.filter((zone) => activeEntriesByZone.has(zone.id));
  const firstActiveIndex = activeZones.length > 0
    ? ZEITKAT_CATALOG.findIndex((zone) => zone.id === activeZones[0].id)
    : -1;
  const lastActiveIndex = activeZones.length > 0
    ? ZEITKAT_CATALOG.findIndex((zone) => zone.id === activeZones.at(-1).id)
    : -1;
  const gaps = firstActiveIndex < 0
    ? []
    : ZEITKAT_CATALOG.slice(firstActiveIndex, lastActiveIndex + 1)
      .filter((zone) => !activeEntriesByZone.has(zone.id));

  const referenceEntry = activeEntriesByZone.get(REFERENCE_ZEITKAT_ID)
    || feeEntries.find((entry) => getFeeBandZeitkatId(entry) === REFERENCE_ZEITKAT_ID);
  const referenceValue = referenceEntry
    ? amount(referenceEntry.monthlyAmount) || amount(referenceEntry.lastNonZeroAmount)
    : 0;
  const referenceAmount = referenceValue > 0 ? referenceValue : null;
  const minimumDifference = Math.round(Math.max(
    MINIMUM_DIFFERENCE_EURO,
    (referenceAmount ?? 0) * 0.1
  ) * 100) / 100;
  const stepViolations = [];

  for (let index = firstActiveIndex + 1; index <= lastActiveIndex; index += 1) {
    const previousZone = ZEITKAT_CATALOG[index - 1];
    const zone = ZEITKAT_CATALOG[index];
    const previousEntry = activeEntriesByZone.get(previousZone.id);
    const entry = activeEntriesByZone.get(zone.id);
    if (!previousEntry || !entry) continue;

    const previousAmount = amount(previousEntry.monthlyAmount);
    const currentAmount = amount(entry.monthlyAmount);
    const difference = Math.round((currentAmount - previousAmount) * 100) / 100;
    if (difference + 0.000001 < minimumDifference) {
      stepViolations.push({
        previousZone,
        zone,
        previousAmount,
        currentAmount,
        difference,
        requiredAmount: Math.round((previousAmount + minimumDifference) * 100) / 100,
      });
    }
  }

  return {
    isCompliant: activeZones.length > 0 && gaps.length === 0 && stepViolations.length === 0,
    noActiveZones: activeZones.length === 0,
    activeZones,
    firstActiveZone: activeZones[0] || null,
    lastActiveZone: activeZones.at(-1) || null,
    gaps,
    referenceAmount,
    minimumDifference,
    stepViolations,
  };
}
