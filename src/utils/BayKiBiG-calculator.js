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
