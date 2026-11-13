import { describe, expect, it } from 'vitest';
import gramschatzData from '../../tests/testdata/gramschatz-fees-2025.json';
import { findFeeEntryForZeitkat } from './financeUtils';
import simFinanceReducer, { mergeGroupFeeCatalogs, setGroupFeeCatalogs } from '../store/simFinanceSlice';
import {
  buildFeeCatalogExportPayload,
  parseFeeCatalogImportPayload,
  extractFeeCatalogImportData,
  proposeFeeCatalogMappings,
  applyFeeCatalogMappings,
} from './feeCatalogTransfer';

describe('feeCatalogTransfer roundtrip with PDF data', () => {
  it('übernimmt den Gültigkeitszeitraum der Gramschatz-Staffeln und beachtet ihn bei der Tarifwahl', () => {
    const { catalogsByKey } = extractFeeCatalogImportData(gramschatzData);
    const catalog = catalogsByKey.childrenUnder3;
    expect(catalog).toHaveLength(7);
    expect(findFeeEntryForZeitkat(catalog, '04', '2024-12-31')).toBeNull();
    expect(findFeeEntryForZeitkat(catalog, '04', '2025-01-01')).toMatchObject({ monthlyAmount: 170 });
    expect(findFeeEntryForZeitkat(catalog, '04', '2026-12-31')).toMatchObject({ monthlyAmount: 170 });
    expect(findFeeEntryForZeitkat(catalog, '04', '2027-01-01')).toBeNull();
  });

  it('exports and re-imports the Gramschatz fee catalogs without loss', () => {
    const scenario = gramschatzData.testScenarios.baykibig_weights_gramschatz_2025;

    const groupDefs = [
      { id: scenario.groupFeeCatalog.krippe.groupId, name: 'Krippe', type: 'Krippe' },
      { id: scenario.groupFeeCatalog.kindergarten.groupId, name: 'Kindergarten', type: 'Kindergarten' },
      { id: scenario.groupFeeCatalog.schulkind.groupId, name: 'Schulkind', type: 'Schulkind' },
    ];

    const groupFeeCatalogs = {
      [scenario.groupFeeCatalog.krippe.groupId]: scenario.groupFeeCatalog.krippe.feeBands,
      [scenario.groupFeeCatalog.kindergarten.groupId]: scenario.groupFeeCatalog.kindergarten.feeBands,
      [scenario.groupFeeCatalog.schulkind.groupId]: scenario.groupFeeCatalog.schulkind.feeBands,
    };
    const parentFeeSubsidiesByGroup = {
      [scenario.groupFeeCatalog.krippe.groupId]: scenario.groupFeeCatalog.krippe.parentFeeSubsidy,
      [scenario.groupFeeCatalog.kindergarten.groupId]: scenario.groupFeeCatalog.kindergarten.parentFeeSubsidy,
      [scenario.groupFeeCatalog.schulkind.groupId]: scenario.groupFeeCatalog.schulkind.parentFeeSubsidy,
    };

    const exported = buildFeeCatalogExportPayload({
      scenarioId: 'scenario-roundtrip',
      groupDefs,
      groupFeeCatalogs,
      parentFeeSubsidiesByGroup,
    });

    const importedMetadata = extractFeeCatalogImportData(exported);
    expect(importedMetadata.parentFeeSubsidiesByKey).toEqual(parentFeeSubsidiesByGroup);
    const importedFromMainShape = parseFeeCatalogImportPayload(exported);
    expect(importedFromMainShape).toEqual(groupFeeCatalogs);

    const importedFromLegacyShape = parseFeeCatalogImportPayload({
      catalogs: exported.catalogs,
    });
    expect(importedFromLegacyShape).toEqual(groupFeeCatalogs);
  });

  it('migrates earlier automatic-import IDs to ZEITKAT during fee JSON transfer', () => {
    const imported = extractFeeCatalogImportData({
      groupFeeCatalogs: {
        g1: [{ id: 'bart4-z05-2026-01-01', label: 'Elternbeitrag (>4-5)', maxHours: 5, monthlyAmount: 120 }],
      },
    });
    expect(imported.catalogsByKey.g1[0]).toMatchObject({ zeitkatId: '05', monthlyAmount: 120 });
  });

  it('preserves ZEITKAT-specific imported fee entries through JSON transfer', () => {
    const payload = buildFeeCatalogExportPayload({
      scenarioId: 'zeitkat-roundtrip',
      groupDefs: [{ id: 'g1', name: 'Gruppe 1' }],
      groupFeeCatalogs: {
        g1: [{ id: 'fee-z05', label: 'Elternbeitrag (>4-5)', zeitkatId: '05', monthlyAmount: 123, validFrom: '2026-01-01' }],
      },
    });

    const imported = extractFeeCatalogImportData(payload);
    expect(imported.catalogsByKey.g1[0]).toMatchObject({
      zeitkatId: '05',
      monthlyAmount: 123,
      validFrom: '2026-01-01',
    });
  });

  it('rejects invalid payloads', () => {
    expect(() => parseFeeCatalogImportPayload(null)).toThrow('Ungueltiges JSON-Format.');
    expect(() => parseFeeCatalogImportPayload({ foo: 'bar' })).toThrow('JSON enthaelt keine groupFeeCatalogs oder catalogs.');
  });

  it('bewahrt Altbestand bei einer unvollständigen Zuordnung auch beim direkten Schreibvorgang', () => {
    const extracted = extractFeeCatalogImportData(gramschatzData, { preferNonMember: true });
    const groupDefs = [
      { id: 'krippe', name: 'Bärchen', type: 'Krippe' },
      { id: 'regel', name: 'Sonne', type: 'Regelgruppe' },
      { id: 'schule', name: 'Fuchs', type: 'Schulkind' },
    ];
    const proposal = proposeFeeCatalogMappings({ groupDefs, catalogDescriptors: extracted.catalogDescriptors });
    expect(proposal.mappingsByGroupId.krippe.sourceKey).toBe('childrenUnder3');
    expect(proposal.mappingsByGroupId.regel.sourceKey).toBeNull();
    expect(proposal.mappingsByGroupId.schule.sourceKey).toBe('schoolChildren');
    let state = simFinanceReducer(undefined, setGroupFeeCatalogs({ scenarioId: 's', catalogs: {
      regel: [{ id: 'bestand', zeitkatId: '04', monthlyAmount: 42 }],
      archiv: [{ id: 'archiv', zeitkatId: '05', monthlyAmount: 43 }],
    } }));
    const before = state.financeByScenario.s.groupFeeCatalogs;
    const catalogs = applyFeeCatalogMappings({ mappingsByGroupId: proposal.mappingsByGroupId, catalogsByKey: extracted.catalogsByKey });
    state = simFinanceReducer(state, mergeGroupFeeCatalogs({ scenarioId: 's', catalogs }));
    const after = state.financeByScenario.s.groupFeeCatalogs;
    expect(after.regel).toEqual(before.regel);
    expect(after.archiv).toEqual(before.archiv);
    expect(after.krippe[0]).toMatchObject({ monthlyAmount: 170, validFrom: '2025-01-01', validUntil: '2026-12-31' });
    expect(after.schule[0]).toMatchObject({ monthlyAmount: 110, validFrom: '2025-01-01', validUntil: '2026-12-31' });
  });

  it('maps catalogs to target groups even with different IDs via wizard proposal', () => {
    const extracted = extractFeeCatalogImportData({
      groupFeeCatalog: gramschatzData.testScenarios.baykibig_weights_gramschatz_2025.groupFeeCatalog,
    }, { preferNonMember: true });

    const groupDefs = [
      { id: 'g-target-1', name: 'Krippe Sonnen' },
      { id: 'g-target-2', name: 'Kindergarten Wald' },
      { id: 'g-target-3', name: 'Schulkind' },
    ];

    const proposal = proposeFeeCatalogMappings({
      groupDefs,
      catalogDescriptors: extracted.catalogDescriptors,
    });

    expect(proposal.mappingsByGroupId['g-target-1'].sourceKey).toBeTruthy();
    expect(proposal.mappingsByGroupId['g-target-2'].sourceKey).toBeTruthy();
    expect(proposal.mappingsByGroupId['g-target-3'].sourceKey).toBeTruthy();

    const mapped = applyFeeCatalogMappings({
      mappingsByGroupId: proposal.mappingsByGroupId,
      catalogsByKey: extracted.catalogsByKey,
    });

    expect(mapped['g-target-1']).toBeTruthy();
    expect(mapped['g-target-2']).toBeTruthy();
    expect(mapped['g-target-3']).toBeTruthy();
  });

  it('pre-fills generic Gramschatz age-band catalogs from group type and reuses class-wide tariffs', () => {
    const extracted = extractFeeCatalogImportData(gramschatzData, { preferNonMember: true });
    const groupDefs = [
      { id: 'g-blue-krippe', name: 'Bärchengruppe', type: 'Krippe' },
      { id: 'g-yellow-krippe', name: 'Sonnengruppe', type: 'Krippe' },
      { id: 'g-kindergarten', name: 'Waldgruppe', type: 'Kindergarten' },
      { id: 'g-hort', name: 'Hort Rot', type: 'Schulkind' },
    ];

    const proposal = proposeFeeCatalogMappings({
      groupDefs,
      catalogDescriptors: extracted.catalogDescriptors,
    });

    expect(proposal.mappingsByGroupId['g-blue-krippe']).toMatchObject({ sourceKey: 'childrenUnder3', score: expect.any(Number) });
    expect(proposal.mappingsByGroupId['g-yellow-krippe'].sourceKey).toBe('childrenUnder3');
    expect(proposal.mappingsByGroupId['g-kindergarten'].sourceKey).toBe('childrenOver3');
    expect(proposal.mappingsByGroupId['g-hort'].sourceKey).toBe('schoolChildren');

    const mapped = applyFeeCatalogMappings({
      mappingsByGroupId: proposal.mappingsByGroupId,
      catalogsByKey: extracted.catalogsByKey,
    });
    expect(mapped['g-yellow-krippe']).toEqual(mapped['g-blue-krippe']);
    expect(mapped['g-kindergarten'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 150 });
    expect(mapped['g-hort'][0]).toMatchObject({ zeitkatId: '01', monthlyAmount: 110 });
  });

  it('pre-fills Gramschatz fee structures from group type and reuses class-wide catalogs', () => {
    const extracted = extractFeeCatalogImportData(gramschatzData, { preferNonMember: true });
    const groupDefs = [
      { id: 'g-blue-krippe', name: 'Bärchengruppe', type: 'Krippe' },
      { id: 'g-yellow-krippe', name: 'Sonnengruppe', type: 'Krippe' },
      { id: 'g-kindergarten', name: 'Waldgruppe', type: 'Kindergarten' },
      { id: 'g-hort', name: 'Hort Rot', type: 'Schulkind' },
    ];
    const proposal = proposeFeeCatalogMappings({ groupDefs, catalogDescriptors: extracted.catalogDescriptors });

    expect(proposal.mappingsByGroupId['g-blue-krippe']).toMatchObject({ sourceKey: 'childrenUnder3', score: 90 });
    expect(proposal.mappingsByGroupId['g-yellow-krippe'].sourceKey).toBe('childrenUnder3');
    expect(proposal.mappingsByGroupId['g-kindergarten'].sourceKey).toBe('childrenOver3');
    expect(proposal.mappingsByGroupId['g-hort'].sourceKey).toBe('schoolChildren');

    const mapped = applyFeeCatalogMappings({ mappingsByGroupId: proposal.mappingsByGroupId, catalogsByKey: extracted.catalogsByKey });
    expect(mapped['g-yellow-krippe']).toEqual(mapped['g-blue-krippe']);
    expect(mapped['g-kindergarten'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 150 });
    expect(mapped['g-hort'][0]).toMatchObject({ zeitkatId: '01', monthlyAmount: 110 });
  });

  it('imports the Gramschatz monthly parent-fee subsidy with the tariff schedule', () => {
    const scenario = gramschatzData.testScenarios.baykibig_weights_gramschatz_2025;
    const extracted = extractFeeCatalogImportData({ groupFeeCatalog: scenario.groupFeeCatalog });

    expect(extracted.parentFeeSubsidiesByKey.kindergarten).toMatchObject({
      enabled: true,
      monthlyAmount: 100,
      minimumAgeYears: 3,
      maximumAgeYears: 7,
      endDate: '2025-12-31',
    });
    expect(extracted.parentFeeSubsidiesByKey.schulkind.enabled).toBe(false);
  });

  it('imports Gramschatz hour bands as ZEITKAT categories and prefers non-member amounts', () => {
    const extracted = extractFeeCatalogImportData(gramschatzData, { preferNonMember: true });
    const under3Catalog = extracted.catalogsByKey.childrenUnder3;

    expect(Array.isArray(under3Catalog)).toBe(true);
    expect(under3Catalog.map((entry) => entry.zeitkatId)).toEqual(['04', '05', '06', '07', '08', '09', '10']);
    expect(under3Catalog[0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 170 });
    expect(under3Catalog[1]).toMatchObject({ zeitkatId: '05', monthlyAmount: 200 });
    expect(under3Catalog.every((entry) => !Object.hasOwn(entry, 'maxHours'))).toBe(true);
    expect(extracted.catalogsByKey.childrenOver3[0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 150 });
    expect(extracted.catalogsByKey.schoolChildren[0]).toMatchObject({ zeitkatId: '01', monthlyAmount: 110 });
    expect(extracted.parentFeeSubsidiesByKey.childrenOver3).toMatchObject({ monthlyAmount: 100, endDate: '2026-12-31' });
  });
});
