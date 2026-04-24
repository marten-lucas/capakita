import { describe, expect, it } from 'vitest';
import gramschatzData from '../../tests/testdata/gramschatz-fees-2025.json';
import {
  buildFeeCatalogExportPayload,
  parseFeeCatalogImportPayload,
} from './feeCatalogTransfer';

describe('feeCatalogTransfer roundtrip with PDF data', () => {
  it('exports and re-imports the Gramschatz fee catalogs without loss', () => {
    const scenario = gramschatzData.testScenarios.baykibig_weights_gramschatz_2025;

    const groupDefs = [
      { id: scenario.groupFeeCatalog.krippe.groupId, name: 'Krippe', type: 'Krippe' },
      { id: scenario.groupFeeCatalog.kindergarten.groupId, name: 'Kindergarten', type: 'Kindergarten' },
    ];

    const groupFeeCatalogs = {
      [scenario.groupFeeCatalog.krippe.groupId]: scenario.groupFeeCatalog.krippe.feeBands,
      [scenario.groupFeeCatalog.kindergarten.groupId]: scenario.groupFeeCatalog.kindergarten.feeBands,
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
});
