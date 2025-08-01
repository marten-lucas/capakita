/**
 * Berechnet den BayKiBiG-Gewichtungsfaktor für ein Kind.
 * @param {Object} child - Das Kind-Objekt (simDataItem).
 * @param {Object} groupDef - Die zugeordnete Gruppen-Definition.
 * @returns {number} Gewichtungsfaktor (2.0, 1.2, 1.0)
 */
export function getBayKiBiGWeightForChild(child, groupDef) {
  // Unter 3 Jahre: 2.0
  if (child.dateofbirth) {
    const dob = new Date(child.dateofbirth);
    // Stichtag: 31.12. des laufenden Jahres
    const now = new Date();
    const year = now.getFullYear();
    const stichtag = new Date(`${year}-12-31`);
    const age = stichtag.getFullYear() - dob.getFullYear() - (stichtag < new Date(dob.setFullYear(stichtag.getFullYear())) ? 1 : 0);
    if (age < 3) return 2.0;
  }
  // Schulkind: 1.2
  if (groupDef?.IsSchool) return 1.2;
  // Standard: 1.0
  return 1.0;
}
