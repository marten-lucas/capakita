import { describe, expect, it } from 'vitest';
import {
  buildHistogramDataFromBookings,
  generateSharedHistogramBins,
  trimTrailingEmptyCategories,
} from './chartUtilsHistogram';

const makeDemand = ({ dailyHours = 4, days = 2, betrstd = null } = {}) => ({
  times: Array.from({ length: days }, () => ({
    segments: [{
      booking_start: '07:00',
      booking_end: `${String(7 + dailyHours).padStart(2, '0')}:00`,
      category: 'pedagogical',
    }],
  })),
  rawdata: betrstd != null ? { BETRSTD: betrstd } : {},
});

const makeCapacity = ({ dailyHours = 8, days = 5 } = {}) => ({
  times: Array.from({ length: days }, () => ({
    segments: [{ booking_start: '07:00', booking_end: `${7 + dailyHours}:00`, category: 'pedagogical' }],
  })),
});

describe('generateSharedHistogramBins', () => {
  it('deckt Demand- und Kapazitäts-Maximum ab (Minimum 12 h)', () => {
    const bins = generateSharedHistogramBins(
      [makeDemand({ dailyHours: 4, days: 2 })],
      [makeCapacity({ dailyHours: 8, days: 5 })]
    );
    // Personal: 5 × 8 h = 40 h → Bins bis 37-40
    expect(bins[bins.length - 1]).toBe('37-40');
    expect(bins[0]).toBe('0');
  });

  it('BETRSTD wird für das Demand-Maximum berücksichtigt', () => {
    const bins = generateSharedHistogramBins(
      [makeDemand({ betrstd: '25,5' })],
      []
    );
    expect(bins[bins.length - 1]).toBe('25-28');
  });
});

describe('buildHistogramDataFromBookings mit geteilten Kategorien', () => {
  it('liefert identische Kategorien für Gruppen unterschiedlicher Größe', () => {
    const shared = ['0', '1-4', '5-8', '9-12'];
    const big = buildHistogramDataFromBookings(
      [makeDemand({ dailyHours: 4, days: 2 }), makeDemand({ dailyHours: 2, days: 1 })],
      [],
      shared
    );
    const small = buildHistogramDataFromBookings(
      [makeDemand({ dailyHours: 2, days: 1 })],
      [],
      shared
    );
    expect(big.categories).toEqual(shared);
    expect(small.categories).toEqual(shared);
    // 2 Tage × 4 h = 8 h → Bin '5-8'; 1 Tag × 2 h = 2 h → Bin '1-4'
    expect(big.demand).toEqual([0, 1, 1, 0]);
    expect(small.demand).toEqual([0, 1, 0, 0]);
  });

  it('ohne geteilte Kategorien wird der Bereich aus den Buchungen abgeleitet', () => {
    const data = buildHistogramDataFromBookings([makeDemand({ dailyHours: 4, days: 2 })], []);
    expect(data.categories).toEqual(['0', '1-4', '5-8', '9-12']);
  });
});

describe('trimTrailingEmptyCategories', () => {
  it('entfernt leere Kategorien am Ende über alle Serien', () => {
    const result = trimTrailingEmptyCategories(
      ['a', 'b', 'c', 'd'],
      [
        { name: 'G1', data: [1, 0, 2, 0] },
        { name: 'G2', data: [0, 1, 0, 0] },
      ]
    );
    expect(result.categories).toEqual(['a', 'b', 'c']);
    expect(result.series[0].data).toEqual([1, 0, 2]);
    expect(result.count).toBe(3);
  });

  it('behält innere Nullen (sinnvolle Lücken)', () => {
    const result = trimTrailingEmptyCategories(
      ['a', 'b', 'c', 'd'],
      [{ name: 'G1', data: [1, 0, 0, 2] }]
    );
    expect(result.categories).toEqual(['a', 'b', 'c', 'd']);
  });

  it('trimmt nichts, wenn die letzte Kategorie Daten hat', () => {
    const result = trimTrailingEmptyCategories(
      ['a', 'b'],
      [{ name: 'G1', data: [0, 3] }]
    );
    expect(result.categories).toEqual(['a', 'b']);
  });

  it('alles leer: Achse bleibt unverändert', () => {
    const result = trimTrailingEmptyCategories(
      ['a', 'b', 'c'],
      [{ name: 'G1', data: [0, 0, 0] }]
    );
    expect(result.categories).toEqual(['a', 'b', 'c']);
    expect(result.count).toBe(3);
  });

  it('kürzt Serien auf die getrimmte Länge', () => {
    const result = trimTrailingEmptyCategories(
      ['a', 'b', 'c', 'd', 'e'],
      [{ name: 'G1', data: [2, 0, 0, 0, 0] }]
    );
    expect(result.count).toBe(1);
    expect(result.series[0].data).toEqual([2]);
  });
});
