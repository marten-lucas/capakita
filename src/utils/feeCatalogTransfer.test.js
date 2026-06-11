import { describe, expect, it } from 'vitest';
import gramschatzData from '../../tests/testdata/gramschatz-fees-2025.json';
import {
  buildFeeCatalogExportPayload,
  parseFeeCatalogImportPayload,
  extractFeeCatalogImportData,
  proposeFeeCatalogMappings,
  applyFeeCatalogMappings,
} from './feeCatalogTransfer';

describe('feeCatalogTransfer roundtrip with PDF data', () => {
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

    const exported = buildFeeCatalogExportPayload({
      scenarioId: 'scenario-roundtrip',
      groupDefs,
      groupFeeCatalogs,
    });

    const importedFromMainShape = parseFeeCatalogImportPayload(exported);
    expect(importedFromMainShape).toEqual(groupFeeCatalogs);

    const importedFromLegacyShape = parseFeeCatalogImportPayload({
      catalogs: exported.catalogs,
    });
    expect(importedFromLegacyShape).toEqual(groupFeeCatalogs);
  });

  it('rejects invalid payloads', () => {
    expect(() => parseFeeCatalogImportPayload(null)).toThrow('Ungueltiges JSON-Format.');
    expect(() => parseFeeCatalogImportPayload({ foo: 'bar' })).toThrow('JSON enthaelt keine groupFeeCatalogs oder catalogs.');
  });

  it('maps catalogs to target groups even with different IDs via wizard proposal', () => {
    const extracted = extractFeeCatalogImportData(gramschatzData, { preferNonMember: true });

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

  it('prefers non-member amounts when source contains members/non-members split', () => {
    const extracted = extractFeeCatalogImportData({ feeStructures: gramschatzData.feeStructures }, { preferNonMember: true });
    const under3Catalog = extracted.catalogsByKey.childrenUnder3;

    expect(Array.isArray(under3Catalog)).toBe(true);
    expect(under3Catalog[0].monthlyAmount).toBe(170);
    expect(under3Catalog[1].monthlyAmount).toBe(200);
  });
});
