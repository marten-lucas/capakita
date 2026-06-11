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

function normalizeString(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeImportedFeeBand(entry = {}, { preferNonMember = true } = {}) {
  const amount = entry.monthlyAmount
    ?? (preferNonMember ? entry.monthlyAmountNonMembers : undefined)
    ?? entry.monthlyAmountMembers
    ?? entry.amount
    ?? '';

  return {
    id: entry.id,
    label: entry.label || '',
    minHours: entry.minHours ?? entry.hoursFrom ?? '',
    maxHours: entry.maxHours ?? entry.hoursTo ?? '',
    monthlyAmount: amount,
    validFrom: entry.validFrom || '',
    validUntil: entry.validUntil || '',
  };
}

function toCatalogDescriptor({ key, groupId, groupName, entries = [] }, options) {
  const normalizeEntries = options?.normalizeEntries !== false;
  return {
    key: String(key),
    groupId: groupId == null ? null : String(groupId),
    groupName: groupName || '',
    entries: Array.isArray(entries)
      ? (normalizeEntries
        ? entries.map((entry) => normalizeImportedFeeBand(entry, options))
        : entries)
      : [],
  };
}

function extractCatalogDescriptors(obj, options = {}) {
  if (!obj || typeof obj !== 'object') return null;

  if (obj.groupFeeCatalogs && typeof obj.groupFeeCatalogs === 'object') {
    return Object.entries(obj.groupFeeCatalogs).map(([key, entries]) => toCatalogDescriptor({
      key,
      groupId: key,
      groupName: '',
      entries,
    }, options));
  }

  if (obj.groupFeeCatalog && typeof obj.groupFeeCatalog === 'object') {
    return Object.entries(obj.groupFeeCatalog).map(([key, val]) => toCatalogDescriptor({
      key,
      groupId: val?.groupId ?? null,
      groupName: val?.groupName || val?.groupType || key,
      entries: Array.isArray(val?.feeBands) ? val.feeBands : (Array.isArray(val?.entries) ? val.entries : []),
    }, options));
  }

  if (Array.isArray(obj.catalogs)) {
    return obj.catalogs
      .filter((entry) => entry && (entry.groupId || entry.groupId === 0))
      .map((entry) => toCatalogDescriptor({
        key: String(entry.groupId),
        groupId: entry.groupId,
        groupName: entry.groupName || '',
        entries: Array.isArray(entry.entries) ? entry.entries : [],
      }, options));
  }

  if (options.allowFeeStructures !== false && obj.feeStructures && typeof obj.feeStructures === 'object') {
    return Object.entries(obj.feeStructures).map(([key, val]) => toCatalogDescriptor({
      key,
      groupId: null,
      groupName: val?.description || val?.ageRange || key,
      entries: Array.isArray(val?.bands) ? val.bands : [],
    }, options));
  }

  return null;
}

export function extractFeeCatalogImportData(parsed, options = {}) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Ungueltiges JSON-Format.');
  }

  const descriptorsToMap = (descriptors) => {
    const byKey = {};
    descriptors.forEach((descriptor) => {
      byKey[descriptor.key] = descriptor.entries;
      if (descriptor.groupId && !(descriptor.groupId in byKey)) {
        byKey[descriptor.groupId] = descriptor.entries;
      }
    });
    return {
      catalogsByKey: byKey,
      catalogDescriptors: descriptors,
    };
  };

  const searchNested = (obj, depth = 3, extractionOptions = options) => {
    if (depth < 0 || !obj || typeof obj !== 'object') return null;
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (!child || typeof child !== 'object') continue;
      const found = extractCatalogDescriptors(child, extractionOptions);
      if (found) return found;
      const deeper = searchNested(child, depth - 1, extractionOptions);
      if (deeper) return deeper;
    }
    return null;
  };

  const tryExtract = (extractionOptions) => {
    let descriptors = extractCatalogDescriptors(parsed, extractionOptions);
    if (descriptors) return descriptorsToMap(descriptors);

    for (const key of Object.keys(parsed)) {
      const child = parsed[key];
      if (child && typeof child === 'object') {
        descriptors = extractCatalogDescriptors(child, extractionOptions);
        if (descriptors) return descriptorsToMap(descriptors);
      }
    }

    descriptors = searchNested(parsed, 3, extractionOptions);
    if (descriptors) return descriptorsToMap(descriptors);
    return null;
  };

  const primary = tryExtract({ ...options, allowFeeStructures: false });
  if (primary) return primary;

  const fallback = tryExtract({ ...options, allowFeeStructures: true });
  if (fallback) return fallback;

  throw new Error('JSON enthaelt keine groupFeeCatalogs oder catalogs.');
}

export function parseFeeCatalogImportPayload(parsed) {
  return extractFeeCatalogImportData(parsed, { normalizeEntries: false }).catalogsByKey;
}

export function proposeFeeCatalogMappings({ groupDefs, catalogDescriptors }) {
  const groups = Array.isArray(groupDefs) ? groupDefs : [];
  const sources = Array.isArray(catalogDescriptors) ? catalogDescriptors : [];
  const usedSourceKeys = new Set();
  const mappingsByGroupId = {};

  const sourceCandidates = sources.map((source) => {
    const sourceKey = String(source.key);
    const sourceGroupId = source.groupId ? String(source.groupId) : '';
    const sourceName = source.groupName || source.key;
    return {
      sourceKey,
      sourceGroupId,
      sourceName,
      keyNorm: normalizeString(sourceKey),
      groupIdNorm: normalizeString(sourceGroupId),
      nameNorm: normalizeString(sourceName),
    };
  });

  const scoreCandidate = (group, candidate) => {
    const groupId = String(group.id);
    const groupName = String(group.name || '');
    const gidNorm = normalizeString(groupId);
    const gnameNorm = normalizeString(groupName);

    if (candidate.sourceKey === groupId || candidate.sourceGroupId === groupId) return 100;
    if (gnameNorm && candidate.nameNorm && candidate.nameNorm === gnameNorm) return 95;
    if (gnameNorm && candidate.keyNorm && candidate.keyNorm === gnameNorm) return 90;
    if (gidNorm && candidate.groupIdNorm && candidate.groupIdNorm === gidNorm) return 85;
    if (gnameNorm && candidate.nameNorm && (candidate.nameNorm.includes(gnameNorm) || gnameNorm.includes(candidate.nameNorm))) return 70;
    if (gnameNorm && candidate.keyNorm && (candidate.keyNorm.includes(gnameNorm) || gnameNorm.includes(candidate.keyNorm))) return 65;
    return 0;
  };

  groups.forEach((group) => {
    let best = null;
    sourceCandidates.forEach((candidate) => {
      if (usedSourceKeys.has(candidate.sourceKey)) return;
      const score = scoreCandidate(group, candidate);
      if (!best || score > best.score) {
        best = { ...candidate, score };
      }
    });

    if (best && best.score > 0) {
      mappingsByGroupId[String(group.id)] = {
        sourceKey: best.sourceKey,
        score: best.score,
      };
      usedSourceKeys.add(best.sourceKey);
      return;
    }

    mappingsByGroupId[String(group.id)] = {
      sourceKey: null,
      score: 0,
    };
  });

  return {
    mappingsByGroupId,
    unmatchedSourceKeys: sources
      .map((source) => String(source.key))
      .filter((key) => !usedSourceKeys.has(key)),
  };
}

export function applyFeeCatalogMappings({ mappingsByGroupId, catalogsByKey }) {
  const result = {};
  Object.entries(mappingsByGroupId || {}).forEach(([groupId, mapping]) => {
    const sourceKey = mapping?.sourceKey;
    if (!sourceKey || !(sourceKey in (catalogsByKey || {}))) return;
    result[String(groupId)] = Array.isArray(catalogsByKey[sourceKey])
      ? catalogsByKey[sourceKey]
      : [];
  });
  return result;
}
