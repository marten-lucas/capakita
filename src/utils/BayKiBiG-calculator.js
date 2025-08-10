// Dynamically import all BayKiBiG JSONs in the BayKiBiG-data folder (Vite syntax)
const baykibigDataModules = import.meta.glob('../assets/BayKiBiG-data/*.json', { eager: true });
const baykibigDataArray = Object.values(baykibigDataModules).map(mod => mod.default);

// Select the valid config for today
function getValidBayKiBiGConfig() {
  const today = new Date().toISOString().slice(0, 10);
  // Find config where valid_from <= today and (valid_to is empty or today <= valid_to)
  return baykibigDataArray.find(cfg => {
    const from = cfg.valid_from || '';
    const to = cfg.valid_to || '';
    return from <= today && (to === '' || today <= to);
  }) || { weighting_factors: [] };
}

const baykibigConfig = getValidBayKiBiGConfig();

/**
 * Berechnet den BayKiBiG-Gewichtungsfaktor für ein Kind anhand der JSON-Konfiguration.
 * @param {Object} child - Das Kind-Objekt (simDataItem).
 * @param {Object} groupDef - Die zugeordnete Gruppen-Definition.
 * @returns {number} Gewichtungsfaktor
 */
export function getBayKiBiGWeightForChild(child, groupDef) {
  const factors = baykibigConfig.weighting_factors || [];
  // Hilfsfunktionen für Kriterien
  function getAgeAtStichtag(dateofbirth) {
    if (!dateofbirth) return null;
    const dob = new Date(dateofbirth);
    const now = new Date();
    const year = now.getFullYear();
    const stichtag = new Date(`${year}-12-31`);
    let age = stichtag.getFullYear() - dob.getFullYear();
    if (
      stichtag.getMonth() < dob.getMonth() ||
      (stichtag.getMonth() === dob.getMonth() && stichtag.getDate() < dob.getDate())
    ) {
      age -= 1;
    }
    return age;
  }

  // Sortiere nach eval_order
  const sortedFactors = [...factors].sort((a, b) => (a.eval_order || 0) - (b.eval_order || 0));

  for (const factorObj of sortedFactors) {
    const { criteria, factor } = factorObj;
    if (!criteria) continue;
    if (criteria.method === 'max_age') {
      const age = getAgeAtStichtag(child.dateofbirth);
      if (age !== null && age < criteria.value) return factor;
    }
    if (criteria.method === 'min_age') {
      const age = getAgeAtStichtag(child.dateofbirth);
      if (age !== null && age >= criteria.value) return factor;
    }
    if (criteria.method === 'groupflag') {
      if (groupDef && groupDef[criteria.value]) return factor;
    }
    // Weitere Methoden können ergänzt werden
  }
  // Default: 1.0
  return 1.0;
}

/**
 * Holt die aktuelle BayKiBiG-Konfiguration (inkl. Faktoren, Parameter etc.)
 */
export function getCurrentBayKiBiGConfig() {
  return baykibigConfig;
}

/**
 * Holt den Buchungszeitfaktor für eine gegebene Stundenanzahl.
 * @param {number} hours - tägliche Buchungszeit in Stunden
 * @param {object} config - BayKiBiG-Konfiguration
 * @returns {number}
 */
export function getBayKiBiGBuchungszeitFaktor(hours, config = baykibigConfig) {
  // Nutze booking_factors aus config.funding, fallback auf config.buchungszeit_faktoren
  const table =
    (config.funding && Array.isArray(config.funding.booking_factors))
      ? config.funding.booking_factors
      : (config.buchungszeit_faktoren || []);
  for (const entry of table) {
    if (hours >= entry.min_hours && hours < entry.max_hours) return entry.factor;
  }
  // Fallback: niedrigster Faktor
  return table.length > 0 ? table[0].factor : 1.0;
}

/**
 * Prüft, ob das Kind U3 ist (unter 3 Jahre am 31.12. des Jahres)
 * @param {object} child - simDataItem
 * @param {string} periodStart - ISO Datum
 * @returns {boolean}
 */
export function isU3(child, periodStart) {
  if (!child?.dateofbirth) return false;
  const year = new Date(periodStart).getFullYear();
  const stichtag = new Date(`${year}-12-31`);
  const dob = new Date(child.dateofbirth);
  let age = stichtag.getFullYear() - dob.getFullYear();
  if (
    stichtag.getMonth() < dob.getMonth() ||
    (stichtag.getMonth() === dob.getMonth() && stichtag.getDate() < dob.getDate())
  ) {
    age -= 1;
  }
  return age < 3;
}

/**
 * Hauptberechnung für BayKiBiG-Förderung pro Periode.
 * @param {object} params
 *   - child: simDataItem
 *   - groupDef: Gruppen-Definition
 *   - hours: tägliche Buchungszeit
 *   - config: BayKiBiG-Konfiguration
 * @returns {object} { staatlich, kommunal }
 */
export function calcBayKiBiGFoerderung({ child, groupDef, hours, config, periodStart }) {
  // Werte aus funding-Objekt holen, fallback auf alte Felder
  const funding = config.funding || {};
  const basiswert = funding.basevalue ?? config.basiswert ?? 0;
  const qualitaetsbonus = funding.qualitybonus ?? config.qualitaetsbonus ?? 0;
  const u3_bonus = funding.u3_bonus ?? config.u3_bonus ?? 0;
  const buchungszeitfaktor = getBayKiBiGBuchungszeitFaktor(hours, config);
  const gewichtungsfaktor = getBayKiBiGWeightForChild(child, groupDef);

  // U3-Bonus nur wenn U3
  const u3BonusValue = isU3(child, periodStart) ? u3_bonus : 0;

  // Staatlicher Anteil
  const staatlich = (basiswert + qualitaetsbonus) * (buchungszeitfaktor + u3BonusValue) * gewichtungsfaktor;

  // Kommunaler Anteil (nur Basiswert, kein Qualitätsbonus, kein U3-Bonus)
  const kommunal = basiswert * buchungszeitfaktor * gewichtungsfaktor;

  return { staatlich, kommunal };
}
