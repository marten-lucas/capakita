import { getFeeBandZeitkatId } from './adebisConstants';

export function hasZeitkatFeeCatalog(catalogs = {}) {
  return Object.values(catalogs || {}).some((entries) => (
    Array.isArray(entries) && entries.some((entry) => Boolean(getFeeBandZeitkatId(entry)))
  ));
}

function feeBandIdentity(entry) {
  const zeitkatId = getFeeBandZeitkatId(entry);
  if (zeitkatId) {
    return `zeitkat:${zeitkatId}:${entry.validFrom || ''}:${entry.validUntil || ''}`;
  }
  return entry?.id ? `id:${entry.id}` : null;
}

/**
 * Add ADEBIS category rates to existing scenario catalogs without replacing
 * manually maintained weekly-hour bands or other finance settings.
 */
export function mergeImportedZeitkatFeeCatalogs(existingCatalogs = {}, incomingCatalogs = {}) {
  const merged = Object.fromEntries(
    Object.entries(existingCatalogs || {}).map(([groupId, entries]) => [
      String(groupId),
      Array.isArray(entries) ? entries.slice() : [],
    ])
  );

  Object.entries(incomingCatalogs || {}).forEach(([groupId, incomingEntries]) => {
    if (!Array.isArray(incomingEntries)) return;
    const key = String(groupId);
    const currentEntries = merged[key] || [];
    const knownBands = new Set(currentEntries.map(feeBandIdentity).filter(Boolean));

    incomingEntries.forEach((entry) => {
      if (!getFeeBandZeitkatId(entry)) return;
      const identity = feeBandIdentity(entry);
      if (knownBands.has(identity)) return;
      currentEntries.push(entry);
      knownBands.add(identity);
    });

    if (currentEntries.length > 0) merged[key] = currentEntries;
  });

  return merged;
}
