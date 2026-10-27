import { describe, expect, it } from 'vitest';
import { hasZeitkatFeeCatalog, mergeImportedZeitkatFeeCatalogs } from './scenarioFinanceImport';

describe('ADEBIS-Beitragsstaffeln für bestehende Szenarien', () => {
  it('erkennt alte Stundenobergrenzen als migrierte ZEITKAT-Kategorien', () => {
    expect(hasZeitkatFeeCatalog({
      '1': [{ id: 'legacy-max-10', maxHours: 10, monthlyAmount: 100 }],
    })).toBe(true);
    expect(hasZeitkatFeeCatalog({
      '1': [{ id: 'bart7-z04-2026-01-01', zeitkatId: '04', monthlyAmount: 100 }],
    })).toBe(true);
  });

  it('ergänzt ADEBIS-Kategorien ohne vorhandene ZEITKAT-Sätze zu ersetzen', () => {
    const existing = {
      '1': [
        { id: 'manual-12', zeitkatId: '12', monthlyAmount: 100 },
        { id: 'manual-13', zeitkatId: '13', monthlyAmount: 150 },
      ],
    };
    const incoming = {
      '1': [
        { id: 'bart7-z04-2026-01-01', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01' },
        { id: 'bart7-z05-2026-01-01', zeitkatId: '05', monthlyAmount: 150, validFrom: '2026-01-01' },
      ],
      '2': [{ id: 'bart7-z04-2026-01-01', zeitkatId: '04', monthlyAmount: 95, validFrom: '2026-01-01' }],
    };

    const merged = mergeImportedZeitkatFeeCatalogs(existing, incoming);

    expect(merged['1']).toHaveLength(4);
    expect(merged['1'].slice(0, 2)).toEqual(existing['1']);
    expect(merged['1'].slice(2)).toEqual(incoming['1']);
    expect(merged['2']).toEqual(incoming['2']);
    expect(existing['1']).toHaveLength(2);
  });

  it('macht ADEBIS-Reimport idempotent nach Zeitkategorie und Gültigkeit', () => {
    const importedBand = {
      id: 'bart7-z04-2026-01-01',
      zeitkatId: '04',
      monthlyAmount: 100,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    };
    const existing = { '1': [{ ...importedBand, maxHours: '' }] };

    expect(mergeImportedZeitkatFeeCatalogs(existing, { '1': [importedBand] })['1']).toHaveLength(1);
  });
});
