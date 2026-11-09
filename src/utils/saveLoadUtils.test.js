import { describe, expect, it } from 'vitest';
import { anonymizeSaveData } from './saveLoadUtils';

describe('anonymizeSaveData', () => {
  it('redacts personal identifiers in every scenario while preserving calculation inputs', () => {
    const source = {
      scenarios: [{
        id: 'scenario-1',
        name: 'Kita Fuchsbau',
        remark: 'Standort Innenstadt',
        imported: true,
        importedAnonymized: false,
      }],
      selectedScenarioId: 'scenario-1',
      dataByScenario: {
        'scenario-1': {
          'child-1': {
            id: 'child-1',
            type: 'demand',
            name: 'Erkan Reuter',
            remark: 'Allergiehinweis',
            familyId: 'family-reuter',
            familyLabel: 'Familie Reuter',
            dateofbirth: '2022-01-15',
            adebisId: { id: 'KIND-123', source: 'kind' },
            rawdata: {
              KINDNR: 'KIND-123',
              FNAME: 'Erkan',
              NAME: 'Reuter',
              VORNAME: 'Erkan',
              STRASSE: 'Musterstraße 1',
              PLZ: '12345',
              GEBDATUM: '15.01.2022',
              KRIPPENK: '.T.',
            },
            originalData: { name: 'Erkan Reuter', familyLabel: 'Familie Reuter' },
          },
          'child-2': {
            id: 'child-2',
            type: 'demand',
            name: 'Ingrid Reuter',
            familyId: 'family-reuter',
            familyLabel: 'Familie Reuter',
            rawdata: { KINDNR: 'KIND-456', NAME: 'Reuter', VORNAME: 'Ingrid' },
          },
          'staff-1': {
            id: 'staff-1',
            type: 'capacity',
            name: 'Mitarbeiter 9981',
            rawdata: { IDNR: '9981', ARBZEIT: '30', QUALIFIK: 'E' },
          },
        },
      },
      bookingsByScenario: {
        'scenario-1': {
          'child-1': {
            'booking-1': {
              id: 'booking-1',
              startdate: '2026-01-01',
              rawdata: { KINDNR: 'KIND-123', ZEITKAT: '05', BETRSTD: '25' },
            },
          },
        },
      },
      groupDefsByScenario: {
        'scenario-1': [{ id: '17', name: 'Fuchsgruppe', rawdata: { GRUNR: '17', BEZ: 'Fuchsgruppe' } }],
      },
      financeByScenario: {
        'scenario-1': {
          itemFinances: { 'staff-1': { salaryHistory: [{ monthlyAmount: 4200 }] } },
          bayKiBiGRules: [{ id: 'rule-2026', baseValue: 1563.88 }],
        },
      },
    };

    const anonymized = anonymizeSaveData(source);
    const children = anonymized.dataByScenario['scenario-1'];

    expect(anonymized.scenarios[0]).toMatchObject({
      name: 'Szenario 1',
      remark: '',
      importedAnonymized: true,
    });
    expect(children['child-1']).toMatchObject({
      name: 'Kind 1',
      remark: '',
      familyId: 'family-1',
      familyLabel: 'Familie 1',
      dateofbirth: '2022-01-15',
    });
    expect(children['child-2']).toMatchObject({ name: 'Kind 2', familyId: 'family-1', familyLabel: 'Familie 1' });
    expect(children['child-1'].adebisId).toBeUndefined();
    expect(children['child-1'].rawdata).toEqual({ GEBDATUM: '15.01.2022', KRIPPENK: '.T.' });
    expect(children['child-1'].originalData).toMatchObject({ name: 'Kind 1', familyLabel: 'Familie 1' });
    expect(anonymized.dataByScenario['scenario-1']['staff-1'].name).toBe('Mitarbeiter 1');
    expect(anonymized.bookingsByScenario['scenario-1']['child-1']['booking-1'].rawdata)
      .toEqual({ ZEITKAT: '05', BETRSTD: '25' });
    expect(anonymized.groupDefsByScenario['scenario-1'][0]).toMatchObject({
      name: 'Gruppe 1',
      rawdata: {},
    });
    expect(anonymized.financeByScenario['scenario-1'].itemFinances).toEqual({});
    expect(anonymized.financeByScenario['scenario-1'].bayKiBiGRules[0].baseValue).toBe(1563.88);
    expect(source.dataByScenario['scenario-1']['child-1'].name).toBe('Erkan Reuter');
    expect(source.financeByScenario['scenario-1'].itemFinances['staff-1'].salaryHistory[0].monthlyAmount).toBe(4200);
  });
});
