import { getFeeBandZeitkatId, ZEITKAT_CATALOG } from './adebisConstants';

const REFERENCE_ZEITKAT_ID = '04';
const MINIMUM_DIFFERENCE_EURO = 5;

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getZeitkatLabel(zone) {
  return `Kategorie ${zone.kennz} (ZEITKAT ${zone.id}, ${zone.kurzbez}h)`;
}

/**
 * STMAS Newsletter 31 requires an individual parent fee for every booking-time
 * category and a step of at least max(5 EUR, 10% of the >3–4 hour category fee).
 */
export function validateFeeStaircase(entries = []) {
  const activeEntriesByZone = new Map(
    (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry?.enabled !== false)
      .map((entry) => [getFeeBandZeitkatId(entry), entry])
      .filter(([zoneId]) => Boolean(zoneId))
  );
  const missingZones = ZEITKAT_CATALOG.filter((zone) => !activeEntriesByZone.has(zone.id));
  const referenceEntry = activeEntriesByZone.get(REFERENCE_ZEITKAT_ID);
  const referenceAmount = referenceEntry ? amount(referenceEntry.monthlyAmount) : null;
  const minimumDifference = Math.round(Math.max(
    MINIMUM_DIFFERENCE_EURO,
    (referenceAmount ?? 0) * 0.1
  ) * 100) / 100;
  const stepViolations = [];

  for (let index = 1; index < ZEITKAT_CATALOG.length; index += 1) {
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
    isCompliant: missingZones.length === 0 && stepViolations.length === 0,
    missingZones,
    referenceAmount,
    minimumDifference,
    stepViolations,
  };
}
