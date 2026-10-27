import { describe, expect, it } from 'vitest';
import { hasZeitkatFeeCatalog, mergeImportedZeitkatFeeCatalogs } from './scenarioFinanceImport';

describe('ADEBIS-Beitragsstaffeln für bestehende Szenarien', () => {
  it('erkennt ZEITKAT-Kataloge und ignoriert manuelle Wochenstunden-Bänder', () => {
    expect(hasZeitkatFeeCatalog({
      '1': [{ id: 'manual-1', maxHours: 20, monthlyAmount: 100 }],
    })).toBe(false);
    expect(hasZeitkatFeeCatalog({
      '1': [{ id: 'bart7-z04-2026-01-01', zeitkatId: '04', monthlyAmount: 100 }],
    })).toBe(true);
  });

  it('ergänzt automatisch importierte ZEITKAT-Sätze ohne bestehende Wochenstunden-Bänder zu löschen', () => {
    const existing = {
      '1': [
        { id: 'manual-20h', maxHours: 20, monthlyAmount: 100 },
        { id: 'manual-30h', maxHours: 30, monthlyAmount: 150 },
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
