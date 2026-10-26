/**
 * Verteilung der Demand-Buchungen über die Buchungszeitkategorien (ZEITKAT).
 *
 * Reverse-Engineering-Basis (adebisKITA 7.5):
 * - ZEITKAT = Stundenzonenauswahl der Buchung (tagesbezogen), förderrelevant
 *   nach § 19 AVBayKiBiG; Katalog/Labels/Faktoren in adebisConstants.
 * - Nur Basisbuchungen zählen (art 0/K bzw. buchungsart.basis) – Alternativ- (A/B)
 *   und Ferienbuchungen (F/G/H) dürfen die Verteilung nicht doppelt zählen
 *   (RE-Befund FRX-Decoder/Statistik-SQL `art IN ('0','K')`).
 *
 * Erwartung: die übergebenen Buchungen sind bereits vorfiltert
 * (filterBookings: Stichtag, Gruppe, Sichtbarkeit).
 */

import { ZEITKAT_CATALOG } from '../adebisConstants';

/**
 * @param {Array} demandBookings - gefilterte Demand-Buchungen (mit itemId)
 * @param {Object} [options]
 * @param {'children'|'bookings'} [options.mode='children']
 *   - 'children': distinct Kinder je Zone (Kind kann in mehreren Zonen auftauchen,
 *     wenn es mehrere Basisbuchungen mit unterschiedlichen Zonen hat)
 *   - 'bookings': Buchungen je Zone
 * @returns {{ zones: Array, series: Array, total: number, mode: string }}
 */
export function calculateZeitkatDistribution(demandBookings, options = {}) {
  const mode = options.mode === 'bookings' ? 'bookings' : 'children';

  const zones = ZEITKAT_CATALOG.map((zone) => ({
    id: zone.id,
    label: zone.kurzbez,
    bez: zone.bez,
    factor: zone.faktor,
    count: 0,
  }));
  const unknownZone = {
    id: '',
    label: 'ohne Kategorie',
    bez: 'Buchung ohne ZEITKAT-Angabe (Legacy/Fremddaten)',
    factor: null,
    count: 0,
  };

  const countZone = (zoneId) => {
    const index = zones.findIndex((zone) => zone.id === zoneId);
    if (index >= 0) zones[index].count += 1;
    else unknownZone.count += 1;
  };

  if (mode === 'bookings') {
    (demandBookings || []).forEach((booking) => {
      const art = booking?.buchungsart;
      if (art && art.basis === false) return;
      countZone(String(booking?.rawdata?.ZEITKAT || '').trim());
    });
  } else {
    const zonesByChild = new Map();
    (demandBookings || []).forEach((booking) => {
      const art = booking?.buchungsart;
      if (art && art.basis === false) return;
      const childKey = String(booking?.itemId ?? booking?.id ?? '');
      if (!childKey) return;
      if (!zonesByChild.has(childKey)) zonesByChild.set(childKey, new Set());
      zonesByChild.get(childKey).add(String(booking?.rawdata?.ZEITKAT || '').trim());
    });
    zonesByChild.forEach((zoneIds) => {
      zoneIds.forEach((zoneId) => countZone(zoneId));
    });
  }

  const allZones = [...zones, unknownZone];
  const series = allZones.map((zone) => zone.count);
  const total = series.reduce((sum, value) => sum + value, 0);

  return { zones: allZones, series, total, mode };
}
