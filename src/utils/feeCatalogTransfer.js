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

  if (parsed.groupFeeCatalogs && typeof parsed.groupFeeCatalogs === 'object') {
    return parsed.groupFeeCatalogs;
  }

  if (Array.isArray(parsed.catalogs)) {
    return Object.fromEntries(
      parsed.catalogs
        .filter((entry) => entry && entry.groupId)
        .map((entry) => [String(entry.groupId), Array.isArray(entry.entries) ? entry.entries : []])
    );
  }

  throw new Error('JSON enthaelt keine groupFeeCatalogs oder catalogs.');
}
