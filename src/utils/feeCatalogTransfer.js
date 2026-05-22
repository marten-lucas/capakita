export function buildFeeCatalogExportPayload({ scenarioId, groupDefs, groupFeeCatalogs }) {
  return {
    type: 'kiga-simulator.groupFeeCatalogs',
    version: 1,
    exportedAt: new Date().toISOString(),
    scenarioId,
    groupFeeCatalogs: groupFeeCatalogs || {},
    catalogs: (groupDefs || []).map((group) => ({
      groupId: group.id,
      groupName: group.name || '',
      entries: groupFeeCatalogs?.[group.id] || [],
    })),
  };
}

export function parseFeeCatalogImportPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Ungueltiges JSON-Format.');
  }

  const extractFromCandidate = (obj) => {
    if (!obj || typeof obj !== 'object') return null;

    if (obj.groupFeeCatalogs && typeof obj.groupFeeCatalogs === 'object') {
      return obj.groupFeeCatalogs;
    }

    if (obj.groupFeeCatalog && typeof obj.groupFeeCatalog === 'object') {
      // Convert legacy/grouped shape into normalized mapping
      return Object.fromEntries(
        Object.entries(obj.groupFeeCatalog).map(([key, val]) => {
          const id = String(val?.groupId || key);
          const entries = Array.isArray(val?.feeBands) ? val.feeBands : (Array.isArray(val?.entries) ? val.entries : []);
          return [id, entries];
        })
      );
    }

    if (Array.isArray(obj.catalogs)) {
      return Object.fromEntries(
        obj.catalogs
          .filter((entry) => entry && (entry.groupId || entry.groupId === 0))
          .map((entry) => [String(entry.groupId), Array.isArray(entry.entries) ? entry.entries : []])
      );
    }

    return null;
  };

  // 1) Try root
  let result = extractFromCandidate(parsed);
  if (result) return result;

  // 2) Try first-level children
  for (const k of Object.keys(parsed)) {
    const child = parsed[k];
    if (child && typeof child === 'object') {
      result = extractFromCandidate(child);
      if (result) return result;
    }
  }

  // 3) Recursive search up to depth 3 for nested shapes (e.g. testScenarios.*.groupFeeCatalog)
  const searchNested = (obj, depth = 3) => {
    if (depth < 0 || !obj || typeof obj !== 'object') return null;
    for (const k of Object.keys(obj)) {
      const child = obj[k];
      if (child && typeof child === 'object') {
        const found = extractFromCandidate(child);
        if (found) return found;
        const deeper = searchNested(child, depth - 1);
        if (deeper) return deeper;
      }
    }
    return null;
  };

  result = searchNested(parsed, 3);
  if (result) return result;

  throw new Error('JSON enthaelt keine groupFeeCatalogs oder catalogs.');
}
