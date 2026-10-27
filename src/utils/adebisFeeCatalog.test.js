import { describe, expect, it } from 'vitest';
import { adebis2FeeCatalogs } from './adebisFeeCatalog';

const BEITRART = [
  { BARTNR: '1', BEZ: 'Elternbeitrag Regelgruppe' },
  { BARTNR: '2', BEZ: 'Essensbeitrag' },
];

const BARTBETR = [
  {
    BARTNR: '1',
    GUELTIGVON: '01.01.2026',
    GUELTIGBIS: '',
    BETRAG: '100',
    BETRAGZ1: '80',
    BETRAGZ2: '90',
    BETRAGZ4: '110,50',
    BETRAGZ5: '120',
    BETRAGZ13: '150',
  },
  {
    BARTNR: '2',
    GUELTIGVON: '01.01.2026',
    GUELTIGBIS: '31.12.2026',
    BETRAGZ1: '30',
  },
];

describe('adebis2FeeCatalogs – automatischer Beitragssatz-Import (RE §3)', () => {
  it('mappt BETRAGZn direkt auf ZEITKAT-IDs (nicht auf Wochenstunden-Grenzen)', () => {
    const { catalogs, sources, primaryBartnr } = adebis2FeeCatalogs({
      beitrartRaw: BEITRART,
      bartbetrRaw: BARTBETR,
      groupsRaw: [{ GRUNR: '1', BEZ: 'Fuchs' }],
    });

    expect(primaryBartnr).toBe(1); // „Eltern…"-Heuristik
    expect(sources).toHaveLength(2);
    const bands = catalogs['1'];
    expect(bands).toHaveLength(5); // Z1, Z2, Z4, Z5, Z13 (Z3 historisch übersprungen)

    expect(bands[0]).toMatchObject({
      zeitkatId: '01',
      monthlyAmount: 80,
      label: 'Elternbeitrag Regelgruppe (>1-2)',
      validFrom: '2026-01-01',
    });
    expect(bands[0].maxHours).toBeUndefined();
    expect(bands.find((band) => band.zeitkatId === '04').monthlyAmount).toBe(110.5);
    expect(bands.find((band) => band.zeitkatId === '13').monthlyAmount).toBe(150);
  });

  it('Gültigkeitsende wird nach ISO konvertiert', () => {
    const { catalogs } = adebis2FeeCatalogs({
      beitrartRaw: BEITRART,
      bartbetrRaw: BARTBETR,
      groupsRaw: [{ GRUNR: '1', BEZ: 'Fuchs' }],
    });
    // Primär = BARTNR 1 (ohne Gültigkeitsende); Prüfung über Quelle BARTNR 2 via alternativer Auswahl:
    const second = adebis2FeeCatalogs({
      beitrartRaw: [{ BARTNR: '9', BEZ: 'Elternbeitrag' }],
      bartbetrRaw: [{ BARTNR: '9', GUELTIGVON: '01.08.2025', GUELTIGBIS: '31.07.2026', BETRAGZ2: '95' }],
      groupsRaw: [],
    });
    expect(second.catalogs.__DEFAULT__[0].validFrom).toBe('2025-08-01');
    expect(second.catalogs.__DEFAULT__[0].validUntil).toBe('2026-07-31');
    expect(catalogs).toBeTruthy();
  });

  it('repliziert die einrichtungsweite Staffel auf alle Gruppen', () => {
    const { catalogs } = adebis2FeeCatalogs({
      beitrartRaw: BEITRART,
      bartbetrRaw: BARTBETR,
      groupsRaw: [{ GRUNR: '1' }, { GRUNR: '2' }, { GRUNR: '3' }],
    });
    expect(Object.keys(catalogs).sort()).toEqual(['1', '2', '3']);
    expect(catalogs['2']).toEqual(catalogs['1']);
  });

  it('ohne Gruppen → __DEFAULT__-Katalog', () => {
    const { catalogs } = adebis2FeeCatalogs({
      beitrartRaw: BEITRART,
      bartbetrRaw: BARTBETR,
      groupsRaw: [],
    });
    expect(Object.keys(catalogs)).toEqual(['__DEFAULT__']);
  });

  it('leere/ungültige Beträge erzeugen keine Bänder; ohne Daten kein Katalog', () => {
    const empty = adebis2FeeCatalogs({ beitrartRaw: BEITRART, bartbetrRaw: [], groupsRaw: [{ GRUNR: '1' }] });
    expect(empty.catalogs).toEqual({});

    const partial = adebis2FeeCatalogs({
      beitrartRaw: BEITRART,
      bartbetrRaw: [{ BARTNR: '1', BETRAGZ1: '', BETRAGZ2: 'abc', BETRAGZ4: '0' }],
      groupsRaw: [{ GRUNR: '1' }],
    });
    // Ohne verwertbare Bänder entsteht kein Katalog-Eintrag (kein Leeren bestehender Daten)
    expect(partial.catalogs['1']).toBeUndefined();
    expect(partial.catalogs).toEqual({});
  });

  it('priorisiert expliziten Elternbeitrag vor Essensbeitrag unabhängig von XML-Reihenfolge', () => {
    const { primaryBartnr } = adebis2FeeCatalogs({
      beitrartRaw: [
        { BARTNR: '2', BEZ: 'Essensbeitrag' },
        { BARTNR: '1', BEZ: 'Elternbeitrag' },
      ],
      bartbetrRaw: [
        { BARTNR: '2', BETRAGZ1: '30' },
        { BARTNR: '1', BETRAGZ1: '80' },
      ],
      groupsRaw: [{ GRUNR: '1' }],
    });
    expect(primaryBartnr).toBe(1);
  });

  it('Fallback auf erste Beitragsart, wenn keine „Eltern…"-Bezeichnung existiert', () => {
    const { primaryBartnr } = adebis2FeeCatalogs({
      beitrartRaw: [{ BARTNR: '5', BEZ: 'Geschwisterbonus' }],
      bartbetrRaw: [{ BARTNR: '5', BETRAGZ1: '60' }],
      groupsRaw: [{ GRUNR: '1' }],
    });
    expect(primaryBartnr).toBe(5);
  });
});
