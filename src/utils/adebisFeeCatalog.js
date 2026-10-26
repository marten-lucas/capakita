/**
 * Automatischer Import von Beitragssätzen aus dem adebisKITA-Export.
 *
 * Reverse-Engineering-Basis (adebisKITA 7.5, adebis-re/docs/fachdomaene.md §3):
 * - `bartbetr` enthält pro Beitragsart (BARTNR) und Gültigkeitszeitraum die
 *   **Beträge je Zeitkategorie** (BETRAGZ1..Z13, Currency) – das ist die
 *   „Staffeltabelle Beitragsart × Zeitkategorie" aus dem adebis-Handbuch
 *   (dbeitraege.xlsx). BETRAG = Basisbetrag ohne Zonenzuordnung.
 * - `beitrart` liefert Bezeichnung/Klassifikation (bez/kurzbez, typ, barttyp,
 *   bbereich, abrart).
 * - Die Staffel gilt einrichtungsweit (keine Gruppenzuordnung in bartbetr) →
 *   Capakita repliziert die Bänder auf alle importierten Gruppen; feinere
 *   Gruppen-Unterschiede bleiben manuell pflegbar (Settings → Beitragssätze).
 *
 * Mapping auf das Capakita-Datenmodell (groupFeeCatalogs):
 *   FeeBand { id, label, maxHours, monthlyAmount, validFrom, validUntil }
 *   - BETRAGZn → ZEITKAT-Zone `String(n).padStart(2,'0')`; Zonen, die im
 *     aktuellen Katalog nicht existieren (historisch '03'), werden übersprungen
 *   - maxHours = Zonen-Obergrenze (Capakita wählt das engste Band ≤ Stunden)
 *   - Gültigkeit GUELTIGVON/GUELTIGBIS (dd.mm.yyyy) → ISO validFrom/validUntil
 */

import { convertDDMMYYYYtoYYYYMMDD } from './dateUtils';
import { ZEITKAT_CATALOG } from './adebisConstants';

function parseAdebisAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Beitragsart als Elternbeitrags-Kandidat erkennen (heuristisch, dokumentiert). */
function isLikelyParentFee(beitrart) {
  const bez = String(beitrart?.BEZ || beitrart?.KURZBEZ || '').toLowerCase();
  return bez.includes('eltern') || bez.includes('beitrag');
}

/**
 * Baut Gruppen-Beitragskataloge aus beitrart.xml + bartbetr.xml.
 *
 * @param {Object} params
 * @param {Array} [params.beitrartRaw] - Beitragsarten (bartnr, bez, …)
 * @param {Array} [params.bartbetrRaw] - Beitragssätze mit BETRAGZ1..13
 * @param {Array} [params.groupsRaw] - Gruppen (GRUNR, BEZ) für die Replikation
 * @returns {{
 *   catalogs: Object,           // { [groupId]: [feeBand, …] }
 *   sources: Array,             // { bartnr, bez, bandCount } – Transparenz
 *   primaryBartnr: number|null  // automatisch gewählte Beitragsart
 * }}
 */
export function adebis2FeeCatalogs({ beitrartRaw = [], bartbetrRaw = [], groupsRaw = [] } = {}) {
  const beitrartByBartnr = new Map();
  (beitrartRaw || []).forEach((record) => {
    const bartnr = String(record?.BARTNR || '').trim();
    if (bartnr && !beitrartByBartnr.has(bartnr)) beitrartByBartnr.set(bartnr, record);
  });

  // bartbetr-Sätze je Beitragsart nach Gültigkeitszeitraum gruppieren
  const rowsByBartnr = new Map();
  (bartbetrRaw || []).forEach((record) => {
    const bartnr = String(record?.BARTNR || '').trim();
    if (!bartnr) return;
    if (!rowsByBartnr.has(bartnr)) rowsByBartnr.set(bartnr, []);
    rowsByBartnr.get(bartnr).push(record);
  });

  const sources = [];
  const candidates = [];

  Array.from(rowsByBartnr.entries()).forEach(([bartnr, rows]) => {
    const beitrart = beitrartByBartnr.get(bartnr) || {};
    const bez = String(beitrart?.BEZ || `Beitragsart ${bartnr}`).trim();
    let bandCount = 0;

    const bands = rows
      .map((row) => {
        const validFrom = convertDDMMYYYYtoYYYYMMDD(row?.GUELTIGVON) || '';
        const validUntil = convertDDMMYYYYtoYYYYMMDD(row?.GUELTIGBIS) || '';
        return { row, validFrom, validUntil };
      })
      .flatMap(({ row, validFrom, validUntil }) => (
        ZEITKAT_CATALOG.map((zone) => {
          // Iteration über den aktuellen Katalog: historische Zonen (z. B. '03')
          // existieren dort nicht und werden dadurch automatisch übersprungen.
          const amount = parseAdebisAmount(row?.[`BETRAGZ${Number(zone.id)}`]);
          if (amount == null) return null;
          return {
            id: `bart${bartnr}-z${zone.id}-${validFrom || 'offen'}`,
            label: `${bez} (${zone.kurzbez})`,
            maxHours: zone.maxHours,
            monthlyAmount: amount,
            validFrom,
            validUntil,
          };
        }).filter(Boolean)
      ));

    bandCount = bands.length;
    if (bandCount > 0) {
      sources.push({ bartnr: Number(bartnr) || bartnr, bez, bandCount });
      candidates.push({
        bartnr,
        bez,
        bands: bands.sort((left, right) => Number(left.maxHours) - Number(right.maxHours)),
        isParentFee: isLikelyParentFee(beitrart),
      });
    }
  });

  // Primäre Beitragsart: bevorzugt Elternbeitrag (bez-Heuristik), sonst die erste
  const primary = candidates.find((candidate) => candidate.isParentFee) || candidates[0] || null;

  const catalogs = {};
  if (primary) {
    const groupIds = (groupsRaw || [])
      .map((group) => String(group?.GRUNR || '').trim())
      .filter(Boolean);
    const targetIds = groupIds.length > 0 ? groupIds : ['__DEFAULT__'];
    targetIds.forEach((groupId) => {
      catalogs[groupId] = primary.bands.map((band) => ({ ...band }));
    });
  }

  return {
    catalogs,
    sources,
    primaryBartnr: primary ? (Number(primary.bartnr) || primary.bartnr) : null,
  };
}
