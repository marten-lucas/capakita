import { getFeeBandSimulationPriceKey } from './foerderSimulation';
import { getFeeBandZeitkatId } from './adebisConstants';

// Only tariff editor fields are persisted; workspace records may contain other data.
const fields = ['id', 'zeitkatId', 'label', 'validFrom', 'validUntil', 'monthlyAmount', 'enabled', 'lastNonZeroAmount'];
const editableFields = ['validFrom', 'validUntil', 'monthlyAmount', 'enabled', 'lastNonZeroAmount'];
const identity = (entry) => {
  const id = entry?.id;
  if (id != null && typeof id !== 'string' && !(typeof id === 'number' && Number.isFinite(id))) return false;
  if ([entry?.validFrom, entry?.validUntil].some((value) => value != null && typeof value !== 'string')) return false;
  return [id ?? null, getFeeBandZeitkatId(entry) || null, entry?.validFrom ?? null, entry?.validUntil ?? null];
};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pick = (entry, keys) => Object.fromEntries(keys.filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]));
const validValues = (values) => Object.entries(values).every(([field, value]) => {
  if (field === 'monthlyAmount') return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (field === 'lastNonZeroAmount') return value == null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
  if (field === 'enabled') return value == null || typeof value === 'boolean';
  return value == null || typeof value === 'string' || (field === 'id' && typeof value === 'number');
});
const overlaps = (left, right) => getFeeBandZeitkatId(left) === getFeeBandZeitkatId(right)
  && String(left.validFrom || '') <= String(right.validUntil || '9999-12-31')
  && String(right.validFrom || '') <= String(left.validUntil || '9999-12-31');

/** Build a sparse overlay against the current catalog, retaining the original identity guards. */
export function updateTariffOverlayGroup(baseEntries, nextEntries, previous = []) {
  const base = new Map(baseEntries.map((entry) => [getFeeBandSimulationPriceKey(entry), entry]));
  const next = new Map(nextEntries.map((entry) => [getFeeBandSimulationPriceKey(entry), entry]));
  const previousByKey = new Map(previous.map((entry) => [entry.key, entry]));
  const operations = [];
  for (const key of new Set([...base.keys(), ...next.keys()])) {
    const original = base.get(key);
    const edited = next.get(key);
    const old = previousByKey.get(key);
    if (!original && edited) {
      const added = pick(edited, fields);
      if (!getFeeBandZeitkatId(added) && getFeeBandZeitkatId(edited)) added.zeitkatId = getFeeBandZeitkatId(edited);
      operations.push({ key, base: null, added });
    } else if (original && !edited) {
      operations.push({ key, base: old?.base || identity(original), deleted: true });
    } else if (original && edited) {
      const changes = Object.fromEntries(editableFields.filter((field) => !equal(original[field], edited[field]))
        .map((field) => [field, edited[field] ?? null]));
      if (Object.keys(changes).length) operations.push({ key, base: old?.base || identity(original), changes });
    }
  }
  return operations;
}

/** Fail closed on unknown formats, ambiguous identities, or a changed/removed target. */
export function applyTariffOverlay(catalogs, overlay) {
  if (overlay == null) return { catalogs, conflicts: [] };
  if (overlay.version !== 1 || !overlay.groups || typeof overlay.groups !== 'object' || Array.isArray(overlay.groups)) {
    return { catalogs, conflicts: ['Unbekanntes oder ungültiges Tarif-Overlay'] };
  }
  const result = { ...catalogs };
  const conflicts = [];
  for (const [groupId, operations] of Object.entries(overlay.groups)) {
    const source = catalogs[groupId];
    if (!Array.isArray(source) || !Array.isArray(operations)) {
      conflicts.push(groupId);
      continue;
    }
    let entries = [...source];
    const seen = new Set();
    const touched = [];
    let invalid = false;
    for (const operation of operations) {
      if (!operation || typeof operation.key !== 'string' || seen.has(operation.key)) { invalid = true; break; }
      seen.add(operation.key);
      const matches = entries.filter((entry) => getFeeBandSimulationPriceKey(entry) === operation.key);
      if (operation.base === null && operation.added && matches.length === 0
        && getFeeBandSimulationPriceKey(operation.added) === operation.key
        && Object.keys(operation.added).every((field) => fields.includes(field)) && validValues(operation.added)
        && !entries.some((entry) => overlaps(entry, operation.added))) {
        const added = { ...operation.added };
        entries.push(added);
        touched.push(added);
      } else if (Array.isArray(operation.base) && matches.length === 1 && equal(identity(matches[0]), operation.base)
        && (operation.deleted === true || (operation.changes && typeof operation.changes === 'object'
          && !Array.isArray(operation.changes) && Object.keys(operation.changes).every((field) => editableFields.includes(field))
          && validValues(operation.changes)))) {
        const replacement = operation.deleted ? null : { ...matches[0], ...operation.changes };
        entries = entries.flatMap((entry) => entry !== matches[0] ? [entry] : replacement ? [replacement] : []);
        if (replacement) touched.push(replacement);
      } else { invalid = true; break; }
    }
    if (!invalid && touched.some((entry) => entries.some((other) => other !== entry && overlaps(entry, other)))) invalid = true;
    if (invalid) conflicts.push(groupId);
    else Object.defineProperty(result, groupId, { value: entries, enumerable: true, writable: true, configurable: true });
  }
  return { catalogs: result, conflicts };
}
