import { describe, expect, it } from 'vitest';
import { applyTariffOverlay, updateTariffOverlayGroup } from './simulationTariffOverlay';

const first = { id: 'a', zeitkatId: '05', validFrom: '2026-01-01', validUntil: '2026-12-31', monthlyAmount: 100 };
const second = { id: 'b', zeitkatId: '05', validFrom: '2027-01-01', monthlyAmount: 200 };
const overlay = (operations) => ({ version: 1, groups: { g: operations } });

describe('versioniertes Tarif-Overlay', () => {
  it('speichert nur bearbeitete Felder und übernimmt andere und neue Tarifversionen aktuell', () => {
    const operations = updateTariffOverlayGroup([first, second], [{ ...first, monthlyAmount: 150 }, second]);
    expect(operations).toHaveLength(1);
    expect(operations[0].changes).toEqual({ monthlyAmount: 150 });
    const later = { id: 'c', zeitkatId: '05', validFrom: '2028-01-01', monthlyAmount: 300 };
    const current = [{ ...first, monthlyAmount: 110 }, { ...second, monthlyAmount: 250, validUntil: '2027-12-31' }, later];
    expect(applyTariffOverlay({ g: current }, overlay(operations))).toEqual({ catalogs: { g: [{ ...current[0], monthlyAmount: 150 }, current[1], later] }, conflicts: [] });
  });

  it('sperrt entfernte, umdatierte und mehrdeutige Ziele sowie unbekannte Versionen', () => {
    const ops = updateTariffOverlayGroup([first, second], [{ ...first, monthlyAmount: 150 }, second]);
    for (const entries of [[second], [{ ...first, validUntil: '2026-11-30' }, second], [first, first, second]]) {
      const result = applyTariffOverlay({ g: entries }, overlay(ops));
      expect(result.conflicts).toEqual(['g']);
      expect(result.catalogs.g).toEqual(entries);
    }
    const overlapping = { id: 'new-version', zeitkatId: '05', validFrom: '2026-06-01', monthlyAmount: 300 };
    expect(applyTariffOverlay({ g: [first, second, overlapping] }, overlay(ops)).conflicts).toEqual(['g']);
    expect(applyTariffOverlay({ g: [first] }, { version: 2, groups: {} }).conflicts).toHaveLength(1);
  });

  it('behandelt Hinzufügen, Deaktivieren und Gültigkeitsänderungen ohne andere Positionen einzufrieren', () => {
    const added = { id: 'new', zeitkatId: '06', validFrom: '2026-01-01', validUntil: '2026-12-31', monthlyAmount: 170, enabled: true, secret: 'nicht speichern' };
    const changed = { ...first, enabled: false, validUntil: '2026-11-30' };
    const ops = updateTariffOverlayGroup([first, second], [changed, second, added]);
    expect(JSON.stringify(ops)).not.toContain('secret');
    const result = applyTariffOverlay({ g: [first, { ...second, monthlyAmount: 250 }] }, overlay(ops));
    expect(result.conflicts).toEqual([]);
    expect(result.catalogs.g).toEqual([changed, { ...second, monthlyAmount: 250 }, expect.not.objectContaining({ secret: expect.anything() })]);
    const colliding = { ...added, id: 'workspace' };
    expect(applyTariffOverlay({ g: [first, second, colliding] }, overlay(ops)).conflicts).toEqual(['g']);
  });

  it('unterstützt Gültigkeitsänderungen bei alten Tarifen ohne ID und mit abgeleiteter ZEITKAT', () => {
    const old = { maxHours: 5, validFrom: '2026-01-01', validUntil: '2026-12-31', monthlyAmount: 100 };
    const changed = { ...old, validUntil: '2026-11-30' };
    const ops = updateTariffOverlayGroup([old], [changed]);
    const result = applyTariffOverlay({ g: [old] }, overlay(ops));
    expect(result.conflicts).toEqual([]);
    expect(result.catalogs.g).toEqual([expect.objectContaining({ zeitkatId: '05', validUntil: '2026-11-30', monthlyAmount: 100 })]);
  });

  it('behält Identitätsprüfung über weitere Bearbeitungen und verwirft Änderungen beim Zurücksetzen', () => {
    const one = updateTariffOverlayGroup([first], [{ ...first, monthlyAmount: 150 }]);
    const two = updateTariffOverlayGroup([first], [{ ...first, monthlyAmount: 175 }], one);
    expect(two[0].base).toEqual(one[0].base);
    expect(updateTariffOverlayGroup([first], [first], two)).toEqual([]);
  });

  it('weist unbekannte Felder und ungültige Werte zurück', () => {
    const ops = updateTariffOverlayGroup([first], [{ ...first, monthlyAmount: 150 }]);
    expect(applyTariffOverlay({ g: [first] }, overlay([{ ...ops[0], changes: { monthlyAmount: -1 } }])).conflicts).toEqual(['g']);
    expect(applyTariffOverlay({ g: [first] }, overlay([{ ...ops[0], changes: { personalData: 'x' } }])).conflicts).toEqual(['g']);
    const malformed = { ...first, id: { personalData: 'x' } };
    const unsafe = updateTariffOverlayGroup([malformed], [{ ...malformed, monthlyAmount: 150 }]);
    expect(JSON.stringify(unsafe)).not.toContain('personalData');
    expect(applyTariffOverlay({ g: [malformed] }, overlay(unsafe)).conflicts).toEqual(['g']);
  });
});
