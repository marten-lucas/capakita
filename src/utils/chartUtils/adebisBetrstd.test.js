import { describe, it, expect } from 'vitest';
import {
  generateCareRatioSeries,
  generateCareRatioTimeDimension,
  getBookingBetrstdHours,
  sumWeightedBookingHours,
} from './chartUtils';

function makeBooking({ segments = [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' }], rawdata = {} } = {}) {
  return {
    itemId: 'child-1',
    groupId: 'g1',
    times: [
      { day: 1, day_name: 'Mo', segments: [...segments] },
      { day: 2, day_name: 'Di', segments: [...segments] },
    ],
    rawdata,
  };
}

describe('adebisBetrstd – getBookingBetrstdHours', () => {
  it('parst dezimale Strings mit Komma und Punkt', () => {
    expect(getBookingBetrstdHours({ rawdata: { BETRSTD: '27,5' } })).toBe(27.5);
    expect(getBookingBetrstdHours({ rawdata: { BETRSTD: '32.25' } })).toBe(32.25);
    expect(getBookingBetrstdHours({ rawdata: { BETRSTD: 40 } })).toBe(40);
  });

  it('liefert null bei fehlenden oder ungültigen Werten', () => {
    expect(getBookingBetrstdHours({ rawdata: {} })).toBeNull();
    expect(getBookingBetrstdHours({ rawdata: { BETRSTD: '' } })).toBeNull();
    expect(getBookingBetrstdHours({ rawdata: { BETRSTD: 'abc' } })).toBeNull();
    expect(getBookingBetrstdHours({ rawdata: { BETRSTD: '0' } })).toBeNull();
    expect(getBookingBetrstdHours({ rawdata: { BETRSTD: '-5' } })).toBeNull();
    expect(getBookingBetrstdHours({})).toBeNull();
  });
});

describe('adebisBetrstd – sumWeightedBookingHours', () => {
  it('verwendet BETRSTD statt der Segment-Summe (autoritative adebis-Wochenstunden)', () => {
    // Segmente: 2 Tage × 6 h = 12 h laut ZEITEN; adebis sagt 25,5
    const booking = makeBooking({ rawdata: { BETRSTD: '25,5' } });
    expect(sumWeightedBookingHours(booking)).toBe(25.5);
  });

  it('fällt auf die Segment-Summe zurück, wenn BETRSTD fehlt', () => {
    const booking = makeBooking({});
    expect(sumWeightedBookingHours(booking)).toBe(12);
  });

  it('respektiert explizite Segmentaufteilung vor BETRSTD', () => {
    const booking = makeBooking({
      segments: [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical', allocationSharePercent: 50 }],
      rawdata: { BETRSTD: '25,5' },
    });
    expect(sumWeightedBookingHours(booking)).toBe(6);
  });

  it('im pedagogical-Modus bleibt es bei der Segment-Summe (BETRSTD kennt keine Modustrennung)', () => {
    const booking = makeBooking({ rawdata: { BETRSTD: '25,5' } });
    expect(sumWeightedBookingHours(booking, { mode: 'pedagogical' })).toBe(12);
  });

  it('preferBetrstd:false erzwingt die Segment-Summe', () => {
    const booking = makeBooking({ rawdata: { BETRSTD: '25,5' } });
    expect(sumWeightedBookingHours(booking, { preferBetrstd: false })).toBe(12);
  });
});

describe('adebisBetrstd – Integration in Auswertungen', () => {
  it('generateCareRatioTimeDimension gewichtet mit BETRSTD-Stunden', () => {
    const demand = [{ ...makeBooking({ rawdata: { BETRSTD: '10' } }), startdate: '2024-01-01', enddate: '' }];
    const capacity = [{ ...makeBooking({}), startdate: '2024-01-01', enddate: '' }];
    const ratios = generateCareRatioTimeDimension(
      ['2024-01'],
      'month',
      demand,
      capacity,
      { 'child-1': { age: 4 } },
      [{ id: 'g1', type: 'Regelgruppe' }]
    );
    // 10 gewichtete Bedarfsstunden ÷ 12 Kapazitätsstunden = 0,833… → gerundet 0,8
    expect(ratios[0]).toBe(0.8);
  });

  it('generateCareRatioSeries (Zeitschlitz) bleibt prsenzbasiert und skaliert nicht mit BETRSTD', () => {
    const demand = [makeBooking({ rawdata: { BETRSTD: '40' } })];
    const capacity = [makeBooking({})];
    const ratios = generateCareRatioSeries(
      ['Mo 08:00'],
      demand,
      capacity,
      { 'child-1': { age: 4 } },
      [{ id: 'g1', type: 'Regelgruppe' }]
    );
    // 1 Kind im Slot ÷ 1 Personal – unabhängig von der Wochenstundenzahl
    expect(ratios[0]).toBe(1);
  });
});
