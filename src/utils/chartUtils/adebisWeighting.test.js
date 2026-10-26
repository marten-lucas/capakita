import { describe, it, expect } from 'vitest';
import { generateCareRatioSeries, generateExpertRatioSeries, isAdebisTrue } from './chartUtils';

const CATEGORIES = ['Mo 08:00', 'Mo 09:30'];

// decodeBuchungsart-Äquivalent, wie es der adebis-Import anlegt (RE: FRX-Decoder)
const ART_META = {
  '': { code: '', label: 'R', name: 'Standard-/Regelbuchung', gruppe: 'regel', basis: true },
  0: { code: '0', label: 'R', name: 'Standard-/Regelbuchung', gruppe: 'regel', basis: true },
  A: { code: 'A', label: 'A', name: 'Alternativbuchung 1', gruppe: 'alternativ', basis: false },
  F: { code: 'F', label: 'F', name: 'Ferienbuchung 1', gruppe: 'ferien', basis: false },
  K: { code: 'K', label: 'K', name: 'Kurzzeitbuchung', gruppe: 'kurzzeit', basis: true },
};

function makeDemandBooking({ rawdata = {}, art = '', withBuchungsart = true, itemId = 'child-1' } = {}) {
  const booking = {
    itemId,
    groupId: 'g1',
    times: [
      {
        day: 1,
        day_name: 'Mo',
        segments: [
          { booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' },
        ],
      },
    ],
    rawdata,
  };
  if (withBuchungsart) {
    booking.buchungsart = { ...(ART_META[art] ?? ART_META['']) };
  }
  return booking;
}

describe('adebisWeighting – BayKiBiG-Gewichtung im Anstellungsschlüssel', () => {
  const groupDefs = [{ id: 'g1', type: 'Regelgruppe' }];

  it('gewichtet behinderte Kinder mit 4,5 (BEHINDERT-Flag, VFP ".T.")', () => {
    const demand = [makeDemandBooking({ rawdata: { BEHINDERT: '.T.' } })];
    const capacity = [{ times: demand[0].times, itemId: 'staff-1', groupId: 'g1' }];
    const dataByScenario = { 'child-1': { age: 4 } };
    const ratios = generateCareRatioSeries(CATEGORIES, demand, capacity, dataByScenario, groupDefs);
    // Slot-Belegung: gewichtetes Kind (4,5) ÷ 1 Personal im Slot
    expect(ratios[0]).toBe(4.5);
  });

  it('gewichtet Krippenkinder mit 2,0 (KRIPPENK-Flag)', () => {
    const demand = [makeDemandBooking({ rawdata: { KRIPPENK: '.T.' } })];
    const capacity = [{ times: demand[0].times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(CATEGORIES, demand, capacity, { 'child-1': {} }, groupDefs);
    expect(ratios[0]).toBe(2);
  });

  it('gewichtet Migrationskinder mit 1,3 – auch vor Schulkindern (KA/SA = 1,3 > K/S = 1,2)', () => {
    const demand = [makeDemandBooking({ rawdata: { MIGRATION: '.T.', SCHULKIND: '.T.' } })];
    const capacity = [{ times: demand[0].times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(CATEGORIES, demand, capacity, { 'child-1': {} }, groupDefs);
    expect(ratios[0]).toBe(1.3);
  });

  it('nutzt GEWKAT der Buchung als autoritative Quelle, falls vorhanden', () => {
    const demand = [makeDemandBooking({ rawdata: { GEWKAT: 'B' } })];
    const capacity = [{ times: demand[0].times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(CATEGORIES, demand, capacity, { 'child-1': {} }, groupDefs);
    expect(ratios[0]).toBe(4.5);
  });

  it('behandelt Legacy-Buchungen ohne ART-Metadaten als Regel (kein Verhaltensbruch)', () => {
    const demand = [makeDemandBooking({ withBuchungsart: false })];
    const capacity = [{ times: demand[0].times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(CATEGORIES, demand, capacity, { 'child-1': { age: 4 } }, groupDefs);
    expect(ratios[0]).toBe(1);
  });

  it('bevorzugt SCHULKIND-Flag vor der Gruppenheuristik (1,2)', () => {
    const demand = [makeDemandBooking({ rawdata: { SCHULKIND: '.T.' } })];
    const capacity = [{ times: demand[0].times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(CATEGORIES, demand, capacity, { 'child-1': {} }, groupDefs);
    expect(ratios[0]).toBe(1.2);
  });
});

describe('adebisWeighting – Buchungsarten im Bedarf (RE: Buchungsarten adebisKITA)', () => {
  const groupDefs = [{ id: 'g1', type: 'Regelgruppe' }];

  it('zählt Ferienbuchungen (ART=F) NICHT zur Regelbelegung (Doppelzählung-Fix)', () => {
    const ferien = makeDemandBooking({ art: 'F' });
    const capacity = [{ times: ferien.times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(CATEGORIES, [ferien], capacity, { 'child-1': { age: 4 } }, groupDefs);
    expect(ratios[0]).toBe(0);
  });

  it('zählt Alternativbuchungen (ART=A) nicht zusätzlich zur Regelbelegung', () => {
    const alternativ = makeDemandBooking({ art: 'A' });
    const capacity = [{ times: alternativ.times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(CATEGORIES, [alternativ], capacity, { 'child-1': { age: 4 } }, groupDefs);
    expect(ratios[0]).toBe(0);
  });

  it('zählt Kurzzeitbuchungen (ART=K) als bedarfsrelevant (wie adebis art IN (0,K))', () => {
    const kurzzeit = makeDemandBooking({ art: 'K' });
    const capacity = [{ times: kurzzeit.times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(CATEGORIES, [kurzzeit], capacity, { 'child-1': { age: 4 } }, groupDefs);
    expect(ratios[0]).toBe(1);
  });

  it('Ferienbuchungen können auf Wunsch eingerechnet werden (Analyse-Option)', () => {
    const ferien = makeDemandBooking({ art: 'F' });
    const capacity = [{ times: ferien.times, itemId: 'staff-1', groupId: 'g1' }];
    const ratios = generateCareRatioSeries(
      CATEGORIES,
      [ferien],
      capacity,
      { 'child-1': { age: 4 } },
      groupDefs,
      { includeNonBasisBookings: true },
    );
    expect(ratios[0]).toBe(1);
  });
});

describe('adebisWeighting – Fachkraftquote (RE: qualifik.dbf, Fachkraft vs. Ergänzungskraft)', () => {
  it('zählt Kinderpfleger (K = Ergänzungskraft) NICHT als Fachkraft', () => {
    const capacity = [
      {
        itemId: 'staff-1',
        groupId: 'g1',
        qualifications: ['K'],
        times: [
          { day: 1, day_name: 'Mo', segments: [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' }] },
        ],
      },
    ];
    const qualiDefs = [
      { key: 'K', name: 'Kinderpfleger/in - Ergänzungskraft', IsExpert: false },
      { key: 'E', name: 'Erzieher/in - Fachkraft', IsExpert: true },
    ];
    const ratios = generateExpertRatioSeries(CATEGORIES, capacity, qualiDefs);
    expect(ratios[0]).toBe(0);
  });

  it('zählt Erzieher (E = Fachkraft) vollständig als Fachkraft', () => {
    const capacity = [
      {
        itemId: 'staff-1',
        groupId: 'g1',
        qualifications: ['E'],
        times: [
          { day: 1, day_name: 'Mo', segments: [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' }] },
        ],
      },
    ];
    const qualiDefs = [{ key: 'E', name: 'Erzieher/in - Fachkraft', IsExpert: true }];
    const ratios = generateExpertRatioSeries(CATEGORIES, capacity, qualiDefs);
    expect(ratios[0]).toBe(100);
  });
});

describe('adebisWeighting – isAdebisTrue (VFP-Logikflags ".T.")', () => {
  it('erkennt alle Export-Varianten', () => {
    expect(isAdebisTrue('.T.')).toBe(true);
    expect(isAdebisTrue('T')).toBe(true);
    expect(isAdebisTrue('true')).toBe(true);
    expect(isAdebisTrue(true)).toBe(true);
    expect(isAdebisTrue('.F.')).toBe(false);
    expect(isAdebisTrue('F')).toBe(false);
    expect(isAdebisTrue('')).toBe(false);
    expect(isAdebisTrue(undefined)).toBe(false);
  });
});
