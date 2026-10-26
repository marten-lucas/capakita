import { describe, expect, it } from 'vitest';
import { calculateZeitkatDistribution } from './chartUtilsZeitkat';

const booking = ({ itemId = 'child-1', zone = '06', art = '0', withBuchungsart = true } = {}) => {
  const b = {
    itemId,
    rawdata: { ZEITKAT: zone, ART: art },
  };
  if (withBuchungsart) {
    const artMap = {
      '0': { basis: true },
      K: { basis: true },
      A: { basis: false },
      F: { basis: false },
    };
    b.buchungsart = { code: art, ...(artMap[art] || artMap['0']) };
  }
  return b;
};

describe('calculateZeitkatDistribution', () => {
  it('zählt nur Basisbuchungen (art 0/K), nicht Alternativ/Ferien', () => {
    const result = calculateZeitkatDistribution([
      booking({ zone: '06', art: '0' }),
      booking({ itemId: 'child-2', zone: '06', art: '0' }),
      booking({ itemId: 'child-3', zone: '07', art: 'A' }),
      booking({ itemId: 'child-4', zone: '04', art: 'F' }),
    ], { mode: 'bookings' });

    const zone06 = result.zones.find((z) => z.id === '06');
    const zone07 = result.zones.find((z) => z.id === '07');
    expect(zone06.count).toBe(2);
    expect(zone07.count).toBe(0);
    expect(result.total).toBe(2);
  });

  it('Kinder-Modus: distinct je Kind, mehrere Zonen je Kind möglich', () => {
    const result = calculateZeitkatDistribution([
      booking({ zone: '06' }),
      booking({ itemId: 'child-1', zone: '06' }), // zweite Buchung desselben Kindes, gleiche Zone
      booking({ itemId: 'child-2', zone: '08' }),
    ], { mode: 'children' });

    expect(result.zones.find((z) => z.id === '06').count).toBe(1);
    expect(result.zones.find((z) => z.id === '08').count).toBe(1);
    expect(result.mode).toBe('children');
  });

  it('Buchungen ohne ZEITKAT landen im „ohne Kategorie"-Bucket', () => {
    const result = calculateZeitkatDistribution([
      booking({ zone: '' }),
      booking({ itemId: 'child-2', zone: '05' }),
    ], { mode: 'bookings' });

    const unknown = result.zones[result.zones.length - 1];
    expect(unknown.id).toBe('');
    expect(unknown.count).toBe(1);
    expect(result.zones.find((z) => z.id === '05').count).toBe(1);
  });

  it('liefert alle Katalogzonen stabil (12 Zonen + Bucket) inkl. Faktor', () => {
    const result = calculateZeitkatDistribution([], { mode: 'bookings' });
    expect(result.zones).toHaveLength(13);
    expect(result.zones[0]).toMatchObject({ id: '01', label: '>1-2', factor: 0.5 });
    expect(result.total).toBe(0);
    expect(result.series.every((value) => value === 0)).toBe(true);
  });
});
