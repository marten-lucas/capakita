/**
 * Förder-Simulation „Buchungsgruppen verändern" für Capakita.
 *
 * Reverse-Engineering-Basis (adebisKITA 7.5, adebis-re/docs/fachdomaene.md §3/§6):
 * - Förderbetrag = Basiswert × Buchungszeitfaktor × Gewichtungsfaktor (§ 21 BayKiBiG,
 *   Repabrechnung: „Monate x Gew.-faktor x Zeitfaktor)/12 x Basiswert").
 * - Zeitkategorien (ZEITKAT) sind tagesbezogene Stundenzonen (01 „>1-2" … 13 „>12");
 *   Faktoren 0,5–2,5 mit Deckelung >9 h.
 * - Nur Basisbuchungen (art 0/K) tragen den Förderanspruch; Alternativ- (A/B) und
 *   Ferienbuchungen (F/G/H) werden nicht angehoben und nicht doppelt gezählt.
 *
 * Getrennte Wirkungen (Konzeptentscheid 26.10.2026):
 * - Zeitkat-Upgrade → Förderbetrag (Anspruch, nutzungsunabhängig)
 * - Nutzungsgrad (globaler Slider, 0–100 %) → Wochenstunden/Bedarf: gebuchte Tage
 *   werden anteilig auf die Zielzone ausgedehnt (100 % = Zonenvollausnutzung).
 *
 * Die Simulation ist eine reine Transformationsfunktion: Basisdaten werden nie
 * mutiert, es entstehen Overlay-artige Kopien (simulatedBookings) für die
 * bestehenden Chart-Pipelines.
 */

import {
  ZEITKAT_CATALOG,
  decodeBuchungsart,
  getZeitkatFactor,
  getZeitkatZoneBounds,
  getZeitkatZoneIndex,
} from './adebisConstants';
import { sumWeightedBookingHours } from './chartUtils/chartUtils';
import {
  findFeeEntryForHours,
  getBayKiBiGWeightForChild,
  pickApplicableValidityEntry,
  pickLatestValidityEntry,
} from './financeUtils';
import { minutesToTime, timeToMinutes } from './timeUtils';

function isBasisBooking(booking) {
  const art = booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART);
  return art ? art.basis !== false : true;
}

function isBookingActiveOnDate(booking, referenceDate) {
  const start = booking?.startdate || '';
  const end = booking?.enddate || '';
  return (!start || start <= referenceDate) && (!end || end >= referenceDate);
}

function segmentShareFactor(segment) {
  const allocation = Number(segment?.allocationSharePercent);
  if (!Number.isFinite(allocation)) return 1;
  return Math.max(0, allocation) / 100;
}

/** Netto-Tagesminuten eines Buchungstags (Allocation-Shares eingerechnet). */
function dailyMinutes(day) {
  return (day?.segments || []).reduce((sum, segment) => {
    const start = timeToMinutes(segment?.booking_start);
    const end = timeToMinutes(segment?.booking_end);
    if (start === null || end === null || end <= start) return sum;
    return sum + (end - start) * segmentShareFactor(segment);
  }, 0);
}

/**
 * Streckt die Segmente je gebuchter Tag proportional auf die Zieltagesstunden
 * (Startzeiten bleiben; 100 % = Zonenvollausnutzung, 0 % = unverändert).
 * Tage ohne Segmente bleiben unverändert (keine erfundenen Betreuungstage).
 */
function scaleTimesToDailyMinutes(times, targetDailyMinutes, utilizationPercent) {
  const util = Math.max(0, Math.min(100, Number(utilizationPercent))) / 100;
  if (!Array.isArray(times) || util <= 0) return times;

  return times.map((day) => {
    const current = dailyMinutes(day);
    if (!Array.isArray(day?.segments) || day.segments.length === 0 || current <= 0) {
      return day;
    }
    const target = current + (targetDailyMinutes - current) * util;
    const factor = target / current;
    const segments = day.segments.map((segment) => {
      const start = timeToMinutes(segment?.booking_start);
      const end = timeToMinutes(segment?.booking_end);
      if (start === null || end === null || end <= start) return segment;
      const scaledEnd = Math.round(start + (end - start) * factor);
      return {
        ...segment,
        booking_end: minutesToTime(Math.max(start + 1, scaledEnd)),
      };
    });
    return { ...day, segments };
  });
}

/**
 * Ermittelt die Zielzone eines Zonensprungs.
 * - 'nextZone': nächsthöhere Zone (Default)
 * - 'targetZone': feste Zielzone (nur aufwärts; Gleichbleiben = null)
 * - 'minHours': kleinste Zone, deren Obergrenze ≥ minHours (keine Änderung, wenn
 *   die aktuelle Zone das Ziel bereits abdeckt)
 * Rückgabe: Ziel-ZEITKAT-Id oder null (keine Änderung möglich/nötig).
 */
export function computeUpgradeTarget(fromZeitkat, upgrade = {}) {
  const fromIndex = getZeitkatZoneIndex(fromZeitkat);
  if (fromIndex < 0) return null;

  const mode = upgrade?.mode || 'nextZone';
  if (mode === 'targetZone') {
    const targetIndex = getZeitkatZoneIndex(upgrade.targetZeitkat);
    return targetIndex > fromIndex ? ZEITKAT_CATALOG[targetIndex].id : null;
  }
  if (mode === 'minHours') {
    const minHours = Number(upgrade.minHours);
    if (!Number.isFinite(minHours)) return null;
    const bounds = getZeitkatZoneBounds(fromZeitkat);
    if (bounds && bounds.maxHours >= minHours) return null;
    const target = ZEITKAT_CATALOG.find((zone) => zone.maxHours >= minHours);
    return target ? target.id : null;
  }
  const next = ZEITKAT_CATALOG[fromIndex + 1];
  return next ? next.id : null;
}

function resolveBayKiBiGRule(bayKiBiGRules, referenceDate) {
  return pickApplicableValidityEntry(bayKiBiGRules, referenceDate)
    || pickLatestValidityEntry(bayKiBiGRules)
    || null;
}

/**
 * Führt die Zeitkat-Upgrade-Simulation aus.
 *
 * @param {Object} params
 * @param {Array} params.demandBookings - gefilterte Demand-Buchungen (filterBookings,
 *   enthält itemId/groupId, aktiv am Stichtag)
 * @param {Object} params.dataItems - { [itemId]: childItem }
 * @param {Array} params.groupDefs
 * @param {Array} [params.bayKiBiGRules] - Förderregeln (simFinanceSlice)
 * @param {Object} [params.groupFeeCatalogs] - { [groupId]: [{ maxHours, monthlyAmount, … }] }
 * @param {Object} [params.upgrade] - { mode, targetZeitkat, minHours, utilizationPercent }
 * @param {string} params.referenceDate
 * @returns {{ perChild: Array, families: Array, totals: Object, simulatedBookings: Array,
 *   skippedNoZone: number, rule: Object|null }}
 */
export function simulateZeitkatUpgrade({
  demandBookings = [],
  dataItems = {},
  groupDefs = [],
  bayKiBiGRules = [],
  groupFeeCatalogs = {},
  upgrade = {},
  referenceDate,
}) {
  const rule = resolveBayKiBiGRule(bayKiBiGRules, referenceDate);
  const baseValue = Number(rule?.baseValue) || 0;
  const weightFactors = rule?.weightFactors || null;
  const utilizationPercent = upgrade?.utilizationPercent ?? 100;

  // Aktive Basisbuchungen je Kind gruppieren
  const bookingsByChild = new Map();
  demandBookings.forEach((booking) => {
    if (!isBasisBooking(booking) || !isBookingActiveOnDate(booking, referenceDate)) return;
    const childKey = String(booking?.itemId ?? '');
    if (!childKey) return;
    if (!bookingsByChild.has(childKey)) bookingsByChild.set(childKey, []);
    bookingsByChild.get(childKey).push(booking);
  });

  const groupDefById = new Map(groupDefs.map((groupDef) => [String(groupDef.id), groupDef]));
  const perChild = [];
  const simulatedBookings = [];
  const familiesMap = new Map();
  let skippedNoZone = 0;
  let deltaMonthlyBayKiBiG = 0;
  let deltaParentFees = 0;
  let deltaWeeklyDemandHours = 0;

  bookingsByChild.forEach((childBookings, childKey) => {
    const child = dataItems?.[childKey] || null;
    const groupId = String(childBookings[0]?.groupId || '');
    const groupDef = groupDefById.get(groupId) || null;
    const weight = getBayKiBiGWeightForChild(child, groupDef, referenceDate, weightFactors);

    let amountBefore = 0;
    let amountAfter = 0;
    let hoursBefore = 0;
    let hoursAfter = 0;
    let fromZone = null;
    let toZone = null;
    let changed = false;
    const childSimulated = [];

    childBookings.forEach((booking) => {
      hoursBefore += sumWeightedBookingHours(booking);

      const zoneBefore = String(booking?.rawdata?.ZEITKAT || '').trim();
      const zoneAfter = computeUpgradeTarget(zoneBefore, upgrade);
      if (!zoneBefore || getZeitkatZoneIndex(zoneBefore) < 0) {
        skippedNoZone += 1;
        hoursAfter += sumWeightedBookingHours(booking);
        return;
      }
      if (!zoneAfter) {
        hoursAfter += sumWeightedBookingHours(booking);
        return;
      }

      const bounds = getZeitkatZoneBounds(zoneAfter);
      const targetDailyMinutes = (bounds?.maxHours ?? 0) * 60;
      const factorBefore = getZeitkatFactor(zoneBefore) ?? 1;
      const factorAfter = getZeitkatFactor(zoneAfter) ?? 1;

      amountBefore += baseValue * weight * factorBefore;
      amountAfter += baseValue * weight * factorAfter;
      fromZone = fromZone || zoneBefore;
      toZone = zoneAfter;
      changed = changed || factorAfter !== factorBefore;

      const simulatedBooking = {
        ...booking,
        times: scaleTimesToDailyMinutes(booking.times, targetDailyMinutes, utilizationPercent),
        rawdata: (() => {
          // BETRSTD entfernen: nach Segment-Umstellung ist die Segment-Summe die Wahrheit
          const { BETRSTD: _betrstd, betrstd: _betrstdLower, ...rest } = booking?.rawdata || {};
          return { ...rest, ZEITKAT: zoneAfter };
        })(),
      };
      hoursAfter += sumWeightedBookingHours(simulatedBooking);
      childSimulated.push(simulatedBooking);
      simulatedBookings.push(simulatedBooking);
    });

    if (!changed) {
      // Nicht betroffen (Zone bereits am Ziel oder Zielzone ≤ Ist) – trotzdem für
      // Wochenstunden-Vergleich melden? Nur betroffene Kinder in perChild aufnehmen.
      return;
    }

    // Elternbeitragsband (FeeCatalog) vor/nachher
    const feeCatalog = groupFeeCatalogs?.[groupId] || [];
    const feeEntryBefore = findFeeEntryForHours(feeCatalog, hoursBefore, referenceDate);
    const feeEntryAfter = findFeeEntryForHours(feeCatalog, hoursAfter, referenceDate);
    const parentFeeBefore = Number(feeEntryBefore?.monthlyAmount) || 0;
    const parentFeeAfter = Number(feeEntryAfter?.monthlyAmount) || 0;
    const feeBandChange = Boolean(feeEntryBefore && feeEntryAfter && feeEntryBefore.id !== feeEntryAfter.id);

    const deltaMonthly = amountAfter - amountBefore;
    const deltaWeeklyHours = hoursAfter - hoursBefore;
    deltaMonthlyBayKiBiG += deltaMonthly;
    deltaParentFees += parentFeeAfter - parentFeeBefore;
    deltaWeeklyDemandHours += deltaWeeklyHours;

    const row = {
      itemId: childKey,
      name: child?.name || childKey,
      familyId: child?.familyId || '',
      familyLabel: child?.familyLabel || '',
      groupId,
      groupName: groupDef?.name || '',
      fromZone,
      toZone,
      weight,
      factorBefore: getZeitkatFactor(fromZone) ?? 1,
      factorAfter: getZeitkatFactor(toZone) ?? 1,
      amountBefore,
      amountAfter,
      deltaMonthly,
      deltaYearly: deltaMonthly * 12,
      weeklyHoursBefore: Math.round(hoursBefore * 100) / 100,
      weeklyHoursAfter: Math.round(hoursAfter * 100) / 100,
      deltaWeeklyHours: Math.round(deltaWeeklyHours * 100) / 100,
      parentFeeBefore,
      parentFeeAfter,
      feeBandChange,
    };
    perChild.push(row);

    if (row.familyId) {
      if (!familiesMap.has(row.familyId)) {
        familiesMap.set(row.familyId, {
          id: row.familyId,
          label: row.familyLabel || row.familyId,
          affectedChildren: 0,
          deltaMonthly: 0,
          deltaYearly: 0,
          deltaWeeklyHours: 0,
        });
      }
      const family = familiesMap.get(row.familyId);
      family.affectedChildren += 1;
      family.deltaMonthly += deltaMonthly;
      family.deltaYearly += deltaMonthly * 12;
      family.deltaWeeklyHours += deltaWeeklyHours;
    }
  });

  const families = Array.from(familiesMap.values())
    .map((family) => ({
      ...family,
      deltaMonthly: Math.round(family.deltaMonthly * 100) / 100,
      deltaYearly: Math.round(family.deltaYearly * 100) / 100,
      deltaWeeklyHours: Math.round(family.deltaWeeklyHours * 100) / 100,
    }))
    .sort((left, right) => Math.abs(right.deltaMonthly) - Math.abs(left.deltaMonthly));

  const sortedPerChild = perChild
    .map((row) => ({
      ...row,
      amountBefore: Math.round(row.amountBefore * 100) / 100,
      amountAfter: Math.round(row.amountAfter * 100) / 100,
    }))
    .sort((left, right) => Math.abs(right.deltaMonthly) - Math.abs(left.deltaMonthly));

  return {
    perChild: sortedPerChild,
    families,
    totals: {
      deltaMonthlyBayKiBiG: Math.round(deltaMonthlyBayKiBiG * 100) / 100,
      deltaYearlyBayKiBiG: Math.round(deltaMonthlyBayKiBiG * 12 * 100) / 100,
      deltaParentFees: Math.round(deltaParentFees * 100) / 100,
      deltaWeeklyDemandHours: Math.round(deltaWeeklyDemandHours * 100) / 100,
      affectedChildren: sortedPerChild.length,
      affectedFamilies: families.length,
    },
    simulatedBookings,
    skippedNoZone,
    rule,
  };
}
