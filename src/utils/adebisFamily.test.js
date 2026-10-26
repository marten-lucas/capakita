import { describe, expect, it } from 'vitest';
import {
  attachFamilyInfo,
  buildFamilyRelations,
  findFamilyMembers,
  getHouseholdKey,
  normalizeAddressText,
} from './adebisFamily';

const kind = (kindnr, overrides = {}) => ({
  KINDNR: String(kindnr),
  NAME: 'Reuter',
  STRASSE: 'Tröstgasse 85-57',
  PLZ: '77515',
  WOHNORT: 'Hofgeismar',
  ...overrides,
});

describe('adebisFamily – erzber-basierte Familienlogik', () => {
  it('gruppiert Kinder, die eine Erziehungsberechtigten-Adresse teilen', () => {
    const relations = buildFamilyRelations({
      kidsRaw: [kind(56), kind(82), kind(94)],
      erzberRaw: [
        { ADRNR: '10', KINDNR: '56', ERZBER: '.T.' },
        { ADRNR: '10', KINDNR: '82', ERZBER: '.T.' },
        { ADRNR: '11', KINDNR: '94', ERZBER: '.T.' },
      ],
      adressenRaw: [
        { ADRNR: '10', NAME: 'Reuter' },
        { ADRNR: '11', NAME: 'Berger' },
      ],
    });

    expect(relations.source).toBe('erzber');
    expect(relations.kindnrToFamilyId['56']).toBe(relations.kindnrToFamilyId['82']);
    expect(relations.kindnrToFamilyId['94']).not.toBe(relations.kindnrToFamilyId['56']);
    const sharedFamily = relations.families.find((f) => f.id === relations.kindnrToFamilyId['56']);
    expect(sharedFamily.label).toBe('Familie Reuter');
    expect(sharedFamily.adrnr).toEqual(['10']);
    expect(sharedFamily.kindnrs).toEqual(['56', '82']);
  });

  it('verschmilzt getrennte Elternadressen zu einer Familie (Union-Find)', () => {
    const relations = buildFamilyRelations({
      kidsRaw: [kind(1), kind(2), kind(3)],
      erzberRaw: [
        { ADRNR: '1', KINDNR: '1', ERZBER: '.T.' },
        { ADRNR: '2', KINDNR: '1', ERZBER: '.T.' },
        { ADRNR: '2', KINDNR: '2', ERZBER: '.T.' },
        { ADRNR: '1', KINDNR: '3', ERZBER: '.T.' },
      ],
    });

    expect(relations.kindnrToFamilyId['1']).toBe(relations.kindnrToFamilyId['2']);
    expect(relations.kindnrToFamilyId['1']).toBe(relations.kindnrToFamilyId['3']);
    const family = relations.families[0];
    expect(family.adrnr).toEqual(['1', '2']);
    expect(family.kindnrs).toEqual(['1', '2', '3']);
  });

  it('filtert Nicht-Erziehungsberechtigte (nur Abholer/Beitragszahler) heraus', () => {
    const relations = buildFamilyRelations({
      kidsRaw: [kind(1), kind(2)],
      erzberRaw: [
        { ADRNR: '10', KINDNR: '1', ERZBER: '.T.' },
        // Kind 2 ist über dieselbe Adresse nur Abholer/Beitragszahler, nicht EB
        { ADRNR: '10', KINDNR: '2', ERZBER: '.F.' },
      ],
    });

    expect(relations.kindnrToFamilyId['1']).toBeTruthy();
    expect(relations.kindnrToFamilyId['2']).toBeUndefined();
  });

  it('wertet Legacy-Bestände ohne ERZBER-Flag als EB-Beziehung', () => {
    const relations = buildFamilyRelations({
      kidsRaw: [kind(1), kind(2)],
      erzberRaw: [
        { ADRNR: '10', KINDNR: '1' },
        { ADRNR: '10', KINDNR: '2' },
      ],
    });

    expect(relations.kindnrToFamilyId['1']).toBe(relations.kindnrToFamilyId['2']);
  });
});

describe('adebisFamily – Haushalts-Fallback', () => {
  it('gruppiert Kinder desselben Haushalts, wenn erzber.xml fehlt', () => {
    const relations = buildFamilyRelations({
      kidsRaw: [
        kind(1),
        kind(2, { NAME: 'reuter ', STRASSE: '  tröstgasse 85-57 ' }),
        kind(3, { NAME: 'Berger', STRASSE: 'Heinzweg 706', PLZ: '15991' }),
      ],
    });

    expect(relations.source).toBe('haushalt');
    expect(relations.kindnrToFamilyId['1']).toBe(relations.kindnrToFamilyId['2']);
    expect(relations.kindnrToFamilyId['3']).not.toBe(relations.kindnrToFamilyId['1']);
  });

  it('verweigert die Zuordnung bei unvollständigen Adressdaten', () => {
    expect(getHouseholdKey({ NAME: 'Reuter', STRASSE: 'Tröstgasse 85-57' })).toBeNull();
    expect(getHouseholdKey({ NAME: 'Reuter', PLZ: '77515' })).toBeNull();
    expect(getHouseholdKey({ NAME: '', STRASSE: 'x', PLZ: 'y' })).toBeNull();
  });

  it('normalisiert Case und Whitespace', () => {
    expect(normalizeAddressText('  Hofgeismar ')).toBe('hofgeismar');
    expect(getHouseholdKey(kind(1))).toBe(getHouseholdKey(kind(2, { WOHNORT: 'hofgeismar' })));
  });

  it('liefert source "none" ohne Daten', () => {
    expect(buildFamilyRelations({}).source).toBe('none');
    expect(buildFamilyRelations({ kidsRaw: [], erzberRaw: [] }).families).toEqual([]);
  });
});

describe('adebisFamily – Item-Anbindung', () => {
  it('hängt familyId/familyLabel an demand-Items und lässt capacity unberührt', () => {
    const relations = buildFamilyRelations({
      kidsRaw: [kind(56), kind(82)],
      erzberRaw: [
        { ADRNR: '10', KINDNR: '56', ERZBER: '.T.' },
        { ADRNR: '10', KINDNR: '82', ERZBER: '.T.' },
      ],
      adressenRaw: [{ ADRNR: '10', NAME: 'Reuter' }],
    });

    const simDataList = [
      { id: 'a', type: 'demand', rawdata: { KINDNR: '56' } },
      { id: 'b', type: 'demand', rawdata: { KINDNR: '82' } },
      { id: 'c', type: 'capacity', rawdata: { IDNR: '7' } },
      { id: 'd', type: 'demand', rawdata: { KINDNR: '999' } },
    ];
    attachFamilyInfo(simDataList, relations);

    expect(simDataList[0].familyId).toBe(simDataList[1].familyId);
    expect(simDataList[0].familyLabel).toBe('Familie Reuter');
    expect(simDataList[0].familySource).toBe('erzber');
    expect(simDataList[2].familyId).toBe('');
    expect(simDataList[3].familyId).toBe('');
  });

  it('findFamilyMembers sortiert nach Geburtsdatum und schließt das Item selbst aus', () => {
    const dataItems = {
      'child-1': { id: 'child-1', type: 'demand', familyId: 'fam-1', dateofbirth: '2019-05-01', name: 'A' },
      'child-2': { id: 'child-2', type: 'demand', familyId: 'fam-1', dateofbirth: '2017-01-01', name: 'B' },
      'child-3': { id: 'child-3', type: 'demand', familyId: 'fam-1', dateofbirth: '2020-01-01', name: 'C' },
      'child-4': { id: 'child-4', type: 'demand', familyId: 'fam-2', name: 'D' },
      'staff-1': { id: 'staff-1', type: 'capacity', familyId: 'fam-1', name: 'E' },
    };

    const members = findFamilyMembers(dataItems, 'child-1');
    expect(members.map((m) => m.id)).toEqual(['child-2', 'child-3']);
    expect(findFamilyMembers(dataItems, 'staff-1')).toEqual([]);
    expect(findFamilyMembers(dataItems, 'child-4')).toEqual([]);
    expect(findFamilyMembers(dataItems, 'unknown')).toEqual([]);
  });
});
