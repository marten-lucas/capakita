import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import OrgaTabFinance from './orgaTabFinance';
import simScenarioReducer from '../../store/simScenarioSlice';
import simDataReducer from '../../store/simDataSlice';
import simBookingReducer from '../../store/simBookingSlice';
import simGroupReducer from '../../store/simGroupSlice';
import simQualificationReducer from '../../store/simQualificationSlice';
import simOverlayReducer from '../../store/simOverlaySlice';
import simFinanceReducer, { addBayKiBiGRule, setGroupFeeCatalogs } from '../../store/simFinanceSlice';
import chartReducer from '../../store/chartSlice';
import gramschatzData from '../../../tests/testdata/gramschatz-fees-2025.json';

function createTestStore() {
  return configureStore({
    reducer: {
      simScenario: simScenarioReducer,
      simData: simDataReducer,
      simBooking: simBookingReducer,
      simGroup: simGroupReducer,
      simQualification: simQualificationReducer,
      simOverlay: simOverlayReducer,
      simFinance: simFinanceReducer,
      chart: chartReducer,
    },
    preloadedState: {
      simScenario: {
        scenarios: [{ id: 'scenario-1', name: 'Szenario 1' }],
        selectedScenarioId: 'scenario-1',
        selectedItems: { 'scenario-1': null },
        saveDialogOpen: false,
        loadDialogOpen: false,
      },
      simData: {
        dataByScenario: {
          'scenario-1': {},
        },
      },
      simBooking: {
        bookingsByScenario: {
          'scenario-1': {},
        },
      },
      simGroup: {
        groupDefsByScenario: {
          'scenario-1': [
            { id: 'group-1', name: 'Krippe Sonnen', type: 'Krippe' },
            { id: 'group-2', name: 'Kindergarten Wald', type: 'Kindergarten' },
          ],
        },
        groupsByScenario: {
          'scenario-1': {},
        },
      },
      simQualification: {
        qualificationDefsByScenario: {},
        qualificationAssignmentsByScenario: {},
      },
      simOverlay: {
        overlaysByScenario: {},
      },
      simFinance: {
        financeByScenario: {
          'scenario-1': {
            settings: {
              partialAbsenceThresholdDays: 42,
              partialAbsenceEmployerSharePercent: 0,
            },
            bayKiBiGRules: [
              {
                id: 'rule-1',
                label: 'BayKiBiG 2025',
                validFrom: '2025-01-01',
                validUntil: '2025-12-31',
                baseValue: 120,
                weightFactors: {
                  regelkind_3to6: 1.0,
                  schulkind: 1.2,
                  migration: 1.3,
                  under3: 2.0,
                  disabled: 4.5,
                },
              },
            ],
            groupFeeCatalogs: {
              'group-1': [
                {
                  id: 'fee-1',
                  validFrom: '2025-01-01',
                  zeitkatId: '06',
                  monthlyAmount: 200,
                },
              ],
              'group-2': [
                {
                  id: 'fee-2',
                  validFrom: '2025-01-01',
                  zeitkatId: '06',
                  monthlyAmount: 150,
                },
              ],
            },
            itemFinances: {},
          },
        },
      },
      chart: {
        'scenario-1': {
          referenceDate: '2026-04-15',
        },
      },
    },
  });
}

describe('OrgaTabFinance', () => {
  it('importiert die Gramschatz-Datei über die Beitragsoberfläche in einen isolierten Store', async () => {
    const store = createTestStore();
    store.dispatch({ type: 'simGroup/addGroupDef', payload: { scenarioId: 'scenario-1', groupDef: { id: 'group-3', name: 'Schulkind', type: 'Schulkind' } } });
    const { container } = render(<MantineProvider><Provider store={store}><OrgaTabFinance /></Provider></MantineProvider>);
    const file = new File([JSON.stringify(gramschatzData)], 'gramschatz-fees-2025.json', { type: 'application/json' });
    file.text = async () => JSON.stringify(gramschatzData);
    fireEvent.change(container.querySelector('input[type="file"][accept="application/json,.json"]'), { target: { files: [file] } });
    expect(store.getState().simGroup.groupDefsByScenario['scenario-1']).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Kataloge importieren' }).at(-1)).toBeEnabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Kataloge importieren' }).at(-1));
    await waitFor(() => expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs['group-3']).toHaveLength(3));
    const finance = store.getState().simFinance.financeByScenario['scenario-1'];
    expect(finance.groupFeeCatalogs['group-1'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 170, validFrom: '2025-01-01', validUntil: '2026-12-31' });
    expect(finance.groupFeeCatalogs['group-2'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 150 });
    expect(finance.groupFeeCatalogs['group-3'][0]).toMatchObject({ zeitkatId: '01', monthlyAmount: 110 });
    expect(finance.parentFeeSubsidiesByGroup['group-1'].enabled).toBe(false);
    expect(finance.parentFeeSubsidiesByGroup['group-2'].enabled).toBe(true);
    expect(finance.parentFeeSubsidiesByGroup['group-3'].enabled).toBe(false);
    expect(store.getState().simData.dataByScenario['scenario-1']).toEqual({});
  });

  it('verlangt die Zuordnung der Regelgruppe und erhält nicht importierte Kataloge', async () => {
    const store = createTestStore();
    store.dispatch({ type: 'simGroup/updateGroupDef', payload: { scenarioId: 'scenario-1', groupId: 'group-2', updates: { name: 'Sonnengruppe', type: 'Regelgruppe' } } });
    store.dispatch({ type: 'simGroup/addGroupDef', payload: { scenarioId: 'scenario-1', groupDef: { id: 'group-3', name: 'Schulkind', type: 'Schulkind' } } });
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: {
      'group-1': [{ id: 'alt-krippe', zeitkatId: '04', monthlyAmount: 10 }],
      'group-2': [{ id: 'alt-regel', zeitkatId: '04', monthlyAmount: 20 }],
      'group-3': [{ id: 'alt-schule', zeitkatId: '01', monthlyAmount: 30 }],
      archiv: [{ id: 'alt-archiv', zeitkatId: '05', monthlyAmount: 40 }],
    } }));
    const before = store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs;
    const { container } = render(<MantineProvider env="test"><Provider store={store}><OrgaTabFinance section="fees" /></Provider></MantineProvider>);
    const file = new File([JSON.stringify(gramschatzData)], 'gramschatz-fees-2025.json', { type: 'application/json' });
    file.text = async () => JSON.stringify(gramschatzData);
    fireEvent.change(container.querySelector('input[type="file"][accept="application/json,.json"]'), { target: { files: [file] } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Kataloge importieren' }).at(-1));

    const dialog = await screen.findByRole('dialog', { name: 'Import-Wizard: Beitragskataloge zuordnen' });
    expect(within(dialog).getByText(/Für folgende Gruppen fehlt eine Import-Quelle: Sonnengruppe/)).toBeTruthy();
    const apply = within(dialog).getByRole('button', { name: 'Import anwenden' });
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs).toEqual(before);

    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Sonnengruppe' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Beiträge für Kinder über 3 Jahren (vor Schuleintritt) (7 Staffeln)' }));
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Import-Wizard: Beitragskataloge zuordnen' })).toBeNull());
    const catalogs = store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs;
    expect(catalogs.archiv).toEqual(before.archiv);
    expect(catalogs['group-1'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 170 });
    expect(catalogs['group-2'][0]).toMatchObject({ zeitkatId: '04', monthlyAmount: 150 });
    expect(catalogs['group-3'][0]).toMatchObject({ zeitkatId: '01', monthlyAmount: 110 });
    for (const groupId of ['group-1', 'group-2', 'group-3']) {
      expect(catalogs[groupId].every((entry) => entry.validFrom === '2025-01-01' && entry.validUntil === '2026-12-31')).toBe(true);
    }
  });

  it('verweigert einen Import ohne Zielgruppen und bewahrt vorhandene Kataloge', async () => {
    const store = createTestStore();
    for (const groupId of ['group-1', 'group-2']) {
      store.dispatch({ type: 'simGroup/deleteGroupDef', payload: { scenarioId: 'scenario-1', groupId } });
    }
    const before = store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs;
    const notify = vi.spyOn(notifications, 'show');
    try {
      const { container } = render(<MantineProvider env="test"><Provider store={store}><OrgaTabFinance section="fees" /></Provider></MantineProvider>);
      const file = new File([JSON.stringify(gramschatzData)], 'gramschatz-fees-2025.json', { type: 'application/json' });
      file.text = async () => JSON.stringify(gramschatzData);
      fireEvent.change(container.querySelector('input[type="file"][accept="application/json,.json"]'), { target: { files: [file] } });
      fireEvent.click(screen.getAllByRole('button', { name: 'Kataloge importieren' }).at(-1));
      await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Import nicht möglich' })));
      expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs).toEqual(before);
    } finally {
      notify.mockRestore();
    }
  });

  it('renders finance sections and existing finance data', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabFinance />
        </Provider>
      </MantineProvider>
    );

    expect(screen.getByText('BayKiBiG-Rahmen')).toBeTruthy();
    expect(screen.getByText('Teilweise Bezahlte Abwesenheit')).toBeTruthy();
    expect(screen.getByText('Beitragskataloge pro Gruppe')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2025')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2026')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2027')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2028')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2029')).toBeTruthy();
    expect(screen.getByText('Krippe Sonnen')).toBeTruthy();
    expect(screen.getByText('Kindergarten Wald')).toBeTruthy();
  });

  it('keeps both tariff versions when a validity change conflicts and accepts a correction', () => {
    const store = createTestStore();
    const entries = [
      { id: 'first', zeitkatId: '06', validFrom: '2026-01-01', monthlyAmount: 100 },
      { id: 'second', zeitkatId: '06', validFrom: '2026-01-02', monthlyAmount: 200 },
    ];
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { 'group-1': entries } }));
    const original = store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs['group-1'];
    render(<MantineProvider env="test"><Provider store={store}><OrgaTabFinance /></Provider></MantineProvider>);
    fireEvent.click(screen.getByText('Krippe Sonnen'));
    const editor = within(screen.getAllByTestId('fee-staircase-editor')[0]);
    fireEvent.click(editor.getByLabelText('Tarif gültig von'));
    fireEvent.click(screen.getByLabelText('2 January 2026'));
    expect(editor.getByRole('alert', { hidden: true }).textContent).toContain('ZEITKAT 06');
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs['group-1']).toEqual(original);
    fireEvent.click(editor.getByLabelText('Tarif gültig von'));
    fireEvent.click(screen.getByLabelText('3 January 2026'));
    expect(editor.queryByRole('alert', { hidden: true })).toBeNull();
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs['group-1']).toEqual(expect.arrayContaining([
      expect.objectContaining({ ...entries[0], validFrom: '2026-01-03' }),
      expect.objectContaining(entries[1]),
    ]));
  });

  it('edits the monthly parent-fee subsidy as part of each fee catalog', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabFinance />
        </Provider>
      </MantineProvider>
    );

    fireEvent.click(screen.getByText('Krippe Sonnen'));
    const subsidyPanel = screen.getByTestId('fee-catalog-parent-subsidy-group-1');
    expect(within(subsidyPanel).getByText('Elternbeitragszuschuss dieser Beitragsordnung')).toBeTruthy();
    expect(within(subsidyPanel).getByLabelText('Zuschuss gilt bis einschließlich')).toBeTruthy();
    const enabledCheckbox = within(subsidyPanel).getByTestId('fee-catalog-parent-subsidy-enabled-group-1');
    const checkboxInput = enabledCheckbox.tagName === 'INPUT' ? enabledCheckbox : enabledCheckbox.querySelector('input');
    expect(checkboxInput.checked).toBe(true);
    fireEvent.click(checkboxInput);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup['group-1'].enabled).toBe(false);
    fireEvent.click(checkboxInput);
    const amountInput = within(subsidyPanel).getByTestId('fee-catalog-parent-subsidy-amount-group-1');
    fireEvent.change(amountInput, { target: { value: '125' } });
    fireEvent.blur(amountInput);

    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup['group-1'].monthlyAmount).toBe(125);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup['group-2']).toBeUndefined();
  });

  it('edits team-grant rates on the yearly BayKiBiG master rule', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabFinance />
        </Provider>
      </MantineProvider>
    );

    fireEvent.click(screen.getByText('BayKiBiG 2027'));
    const firstTierInput = screen.getAllByLabelText('Platz 1–50')[0];
    fireEvent.change(firstTierInput, { target: { value: '650' } });
    fireEvent.blur(firstTierInput);

    const rule = store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules
      .find((entry) => entry.validFrom === '2027-01-01');
    expect(rule.teamGrantRates).toEqual({ first50: 650, remaining100: 167.61 });
  });

  it.each([
    ['Platz 1–50', 'first50', 500, 'remaining100', 167.61],
    ['Platz 51–150', 'remaining100', 167.61, 'first50', 500],
  ])('rejects an empty %s rate but accepts zero and corrections', (label, key, original, otherKey, otherValue) => {
    const store = createTestStore();
    render(<MantineProvider env="test"><Provider store={store}><OrgaTabFinance /></Provider></MantineProvider>);
    fireEvent.click(screen.getByText('BayKiBiG 2027'));
    const getPanel = () => within(screen.getByText('BayKiBiG 2027').closest('.mantine-Accordion-item'));
    const getRate = () => store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules
      .find((entry) => entry.validFrom === '2027-01-01').teamGrantRates;

    let input = getPanel().getByLabelText(label);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(getPanel().getByText('Bitte einen gültigen Betrag ab 0 eingeben.')).toBeTruthy();
    fireEvent.blur(input);
    expect(getRate()).toEqual({ [key]: original, [otherKey]: otherValue });

    fireEvent.change(input, { target: { value: '0' } });
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    fireEvent.blur(input);
    expect(getRate()).toEqual({ [key]: 0, [otherKey]: otherValue });

    input = getPanel().getByLabelText(label);
    fireEvent.change(input, { target: { value: '123,45' } });
    fireEvent.blur(input);
    expect(getRate()).toEqual({ [key]: 123.45, [otherKey]: otherValue });
  });

  it('shows missing team-grant rates as invalid without writing zero', () => {
    const store = createTestStore();
    store.dispatch(addBayKiBiGRule({
      scenarioId: 'scenario-1',
      rule: { id: 'rule-2030', label: 'BayKiBiG 2030', validFrom: '2030-01-01', teamGrantRates: {} },
    }));
    render(<MantineProvider env="test"><Provider store={store}><OrgaTabFinance /></Provider></MantineProvider>);
    fireEvent.click(screen.getByText('BayKiBiG 2030'));
    const panel = within(screen.getByText('BayKiBiG 2030').closest('.mantine-Accordion-item'));
    const first = panel.getByLabelText('Platz 1–50');
    const remaining = panel.getByLabelText('Platz 51–150');
    expect(first.value).toBe('');
    expect(remaining.value).toBe('');
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(remaining.getAttribute('aria-invalid')).toBe('true');
    fireEvent.blur(first);
    fireEvent.blur(remaining);
    const getRates = () => store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules
      .find((entry) => entry.id === 'rule-2030').teamGrantRates;
    expect(getRates()).toEqual({});

    fireEvent.change(first, { target: { value: '0' } });
    fireEvent.blur(first);
    expect(getRates()).toEqual({ first50: 0 });
    expect(within(screen.getByText('BayKiBiG 2030').closest('.mantine-Accordion-item'))
      .getByLabelText('Platz 51–150').getAttribute('aria-invalid')).toBe('true');
  });

  it('adds a new BayKiBiG rule via the add button', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabFinance />
        </Provider>
      </MantineProvider>
    );

    const addButton = screen.getByRole('button', { name: 'BayKiBiG-Regel hinzufuegen' });
    fireEvent.click(addButton);

    const rules = store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules;
    expect(rules).toHaveLength(6);
    expect(rules.map((rule) => rule.validFrom)).toEqual([
      '2025-01-01',
      '2026-01-01',
      '2027-01-01',
      '2028-01-01',
      '2029-01-01',
      '',
    ]);
  });
});
