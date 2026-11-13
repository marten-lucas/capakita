import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FeeStaircaseEditor from './FeeStaircaseEditor';

const referenceDate = '2026-03-15';

function StatefulFeeStaircaseEditor({ initialEntries, onChange = () => {}, simulation = false }) {
  const [entries, setEntries] = React.useState(initialEntries);
  return (
    <FeeStaircaseEditor
      entries={entries}
      referenceDate={referenceDate}
      simulation={simulation}
      onChangeEntries={(nextEntries) => { setEntries(nextEntries); onChange(nextEntries); }}
    />
  );
}

describe('FeeStaircaseEditor', () => {
  it('bearbeitet im Simulationsmodus nur die ausgewählte Gültigkeitsversion', () => {
    const onChange = vi.fn();
    const entries = [
      { id: '2026', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-12-31' },
      { id: '2027', zeitkatId: '04', monthlyAmount: 200, validFrom: '2027-01-01' },
    ];
    render(<MantineProvider><StatefulFeeStaircaseEditor initialEntries={entries} onChange={onChange} simulation /></MantineProvider>);
    fireEvent.change(screen.getByLabelText('Betrag ZEITKAT 04'), { target: { value: '150' } });
    fireEvent.blur(screen.getByLabelText('Betrag ZEITKAT 04'));
    expect(onChange.mock.lastCall[0]).toEqual(expect.arrayContaining([{ ...entries[0], monthlyAmount: 150, enabled: true }, entries[1]]));
    fireEvent.click(screen.getByRole('combobox', { name: 'Gültigkeitsversion' }));
    fireEvent.click(screen.getByRole('option', { name: /2027-01-01/ }));
    expect(screen.getByLabelText('Betrag ZEITKAT 04').value).toBe('200 €');
  });

  it('retains a conflicting end date as a draft and commits both dates after correction', () => {
    const onChange = vi.fn();
    const entries = [
      { id: 'a', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-01-10' },
      { id: 'b', zeitkatId: '04', monthlyAmount: 200, validFrom: '2026-01-01', validUntil: '2026-01-11' },
      { id: 'unmapped', monthlyAmount: 50 },
    ];
    render(<MantineProvider env="test"><StatefulFeeStaircaseEditor initialEntries={entries} onChange={onChange} /></MantineProvider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Gültigkeitsversion' }));
    fireEvent.click(screen.getByRole('option', { name: /2026-01-10/ }));
    fireEvent.click(screen.getByLabelText('Tarif gültig bis'));
    fireEvent.click(screen.getByLabelText('11 January 2026'));
    expect(screen.getByRole('alert').textContent).toContain('ZEITKAT 04');
    expect(screen.getByLabelText('Tarif gültig bis').textContent).toBe('11.01.2026');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Tarif gültig von'));
    fireEvent.click(screen.getByLabelText('2 January 2026'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onChange.mock.lastCall[0]).toEqual(expect.arrayContaining([
      { ...entries[0], validFrom: '2026-01-02', validUntil: '2026-01-11' }, entries[1], entries[2],
    ]));
    expect(onChange.mock.lastCall[0]).toHaveLength(3);
  });

  it('activates a missing ZEITKAT from its checkbox and preserves category order', () => {
    const onChangeEntries = vi.fn();
    render(
      <MantineProvider>
        <FeeStaircaseEditor
          entries={[
            { id: 'zone-01', zeitkatId: '01', monthlyAmount: 100, validFrom: '2026-01-01' },
            { id: 'zone-04', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' },
          ]}
          referenceDate={referenceDate}
          onChangeEntries={onChangeEntries}
        />
      </MantineProvider>
    );

    expect(screen.getByTestId('fee-staircase-zeitkat')).toBeTruthy();
    expect(screen.getByTestId('fee-staircase-compliance-warning')).toBeTruthy();
    expect(screen.getByTestId('fee-staircase-slider-02').querySelector('[role="slider"]').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByLabelText('Betrag ZEITKAT 02').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Tarif gültig von')).toBeTruthy();
    expect(screen.getByLabelText('Tarif gültig bis')).toBeTruthy();
    expect(screen.getByLabelText('Aktiviere Beitrag ZEITKAT 02').checked).toBe(false);
    fireEvent.click(screen.getByLabelText('Aktiviere Beitrag ZEITKAT 02'));
    const changedEntries = onChangeEntries.mock.calls.at(-1)[0];
    expect(changedEntries.map((entry) => entry.zeitkatId)).toEqual(['01', '02', '04']);
    expect(changedEntries[1]).toMatchObject({ zeitkatId: '02', monthlyAmount: 115, enabled: true });
    expect(changedEntries.every((entry) => !Object.hasOwn(entry, 'maxHours'))).toBe(true);
  });

  it('shows monthly contribution labels under simulation sliders', () => {
    render(
      <MantineProvider>
        <FeeStaircaseEditor
          entries={[
            { id: 'fee-05', zeitkatId: '05', monthlyAmount: 150, validFrom: '2026-01-01' },
            { id: 'fee-09', zeitkatId: '09', monthlyAmount: 250, validFrom: '2026-01-01' },
            { id: 'fee-10', zeitkatId: '10', monthlyAmount: 270, validFrom: '2026-01-01' },
          ]}
          originalEntries={[{ id: 'fee-05', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' }]}
          referenceDate={referenceDate}
          simulation
          onChangeEntries={() => {}}
        />
      </MantineProvider>
    );

    expect(screen.getByTestId('fee-staircase-slider-05')).toBeTruthy();
    expect(screen.getByTestId('fee-staircase-compliance-warning')).toBeTruthy();
    expect(screen.getByTestId('fee-staircase-slider-09')).toBeTruthy();
    expect(screen.getByTestId('fee-staircase-slider-10')).toBeTruthy();
    expect(screen.queryByTestId('zeitkat-slider-toggles')).toBeNull();
    expect(screen.queryByLabelText('Tarif gültig von')).toBeNull();
    expect(screen.queryByLabelText('Tarif gültig bis')).toBeNull();
    expect(screen.queryByTestId('fee-staircase-period')).toBeNull();
    expect(screen.queryByLabelText('Aktiviere Beitrag ZEITKAT 09')).toBeNull();
    expect(screen.queryByLabelText('Aktiviere Beitrag ZEITKAT 10')).toBeNull();
    expect(screen.getByText('5h')).toBeTruthy();
    expect(screen.getByText('Kat. 4')).toBeTruthy();
    expect(screen.queryByText('Direkte Eingabe')).toBeNull();
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 €');
    expect(screen.getByTestId('fee-staircase-amount-05').textContent).toBe('150,00 €');
    expect(screen.getByTestId('fee-staircase-hourly-equivalent-05').textContent).toBe('30,00 €/h');
    expect(screen.getByTestId('fee-staircase-original-05').textContent).toContain('20,00 €/h');
    expect(screen.getByTestId('fee-staircase-hourly-equivalent-05').getAttribute('title')).toContain('5 Stunden pro Tag');
  });

  it('deactivates an active category with its checkbox and restores its previous amount', () => {
    render(
      <MantineProvider>
        <StatefulFeeStaircaseEditor
          initialEntries={[{ id: 'fee-04', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' }]}
        />
      </MantineProvider>
    );

    const activationCheckbox = screen.getByLabelText('Deaktiviere Beitrag ZEITKAT 04');
    expect(activationCheckbox.checked).toBe(true);
    fireEvent.click(activationCheckbox);
    expect(screen.getByTestId('fee-staircase-slider-04').querySelector('[role="slider"]').getAttribute('aria-disabled')).toBe('true');

    const inactiveCheckbox = screen.getByLabelText('Aktiviere Beitrag ZEITKAT 04');
    expect(inactiveCheckbox.checked).toBe(false);
    fireEvent.click(inactiveCheckbox);

    expect(screen.getByLabelText('Betrag ZEITKAT 04').value).toBe('150 €');
    expect(screen.getByTestId('fee-staircase-hourly-04').textContent).toBe('37,50 €/h');
    fireEvent.change(screen.getByLabelText('Betrag ZEITKAT 04'), { target: { value: '200' } });
    fireEvent.blur(screen.getByLabelText('Betrag ZEITKAT 04'));
    expect(screen.getByTestId('fee-staircase-hourly-04').textContent).toBe('50,00 €/h');
  });

  it('marks gap sliders and insufficient adjacent steps red', () => {
    render(
      <MantineProvider>
        <FeeStaircaseEditor
          entries={[
            { id: 'fee-04', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01' },
            { id: 'fee-05', zeitkatId: '05', monthlyAmount: 105, validFrom: '2026-01-01' },
            { id: 'fee-07', zeitkatId: '07', monthlyAmount: 150, validFrom: '2026-01-01' },
          ]}
          referenceDate={referenceDate}
          onChangeEntries={() => {}}
        />
      </MantineProvider>
    );

    ['04', '05'].forEach((zoneId) => {
      expect(screen.getByTestId(`fee-staircase-slider-${zoneId}`).getAttribute('data-invalid')).toBe('true');
    });
    expect(screen.getByTestId('activate-fee-zeitkat-06').getAttribute('data-invalid')).toBe('true');
    expect(screen.getByTestId('fee-staircase-slider-07').getAttribute('data-invalid')).toBeNull();
    expect(screen.getByTestId('fee-staircase-slider-06').querySelector('[role="slider"]').getAttribute('aria-disabled')).toBe('true');
  });

  it('adjusts active amounts immediately in 5 euro steps and keeps inactive controls disabled', () => {
    const onChange = vi.fn();
    render(
      <MantineProvider>
        <StatefulFeeStaircaseEditor initialEntries={[
          { id: 'fee-04', zeitkatId: '04', monthlyAmount: 102.5, validFrom: '2026-01-01' },
        ]} onChange={onChange} />
      </MantineProvider>
    );

    expect(screen.getByLabelText('Betrag ZEITKAT 05 um 5 € erhöhen').disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Betrag ZEITKAT 04 um 5 € erhöhen'));
    expect(onChange.mock.lastCall[0][0].monthlyAmount).toBe(107.5);
    fireEvent.click(screen.getByLabelText('Betrag ZEITKAT 04 um 5 € senken'));
    expect(onChange.mock.lastCall[0][0].monthlyAmount).toBe(102.5);
  });

  it('previews and applies a fixed change only to active entries in the selected period, then undoes it', () => {
    const onChange = vi.fn();
    const initialEntries = [
      { id: 'a', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01' },
      { id: 'b', zeitkatId: '05', monthlyAmount: 120, validFrom: '2026-01-01' },
      { id: 'inactive', zeitkatId: '06', monthlyAmount: 140, enabled: false, validFrom: '2026-01-01' },
      { id: 'future', zeitkatId: '04', monthlyAmount: 200, validFrom: '2027-01-01' },
      { id: 'other', monthlyAmount: 30 },
    ];
    render(<MantineProvider><StatefulFeeStaircaseEditor initialEntries={initialEntries} onChange={onChange} /></MantineProvider>);
    fireEvent.change(screen.getByLabelText('Änderung in €'), { target: { value: '10' } });
    expect(screen.getByLabelText('Vorschau Sammeländerung').textContent).toContain('ZEITKAT 04: 100,00 € → 110,00 €');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sammeländerung anwenden' }));
    expect(onChange.mock.lastCall[0]).toEqual(expect.arrayContaining([
      { ...initialEntries[0], monthlyAmount: 110 },
      { ...initialEntries[1], monthlyAmount: 130 },
      initialEntries[2], initialEntries[3], initialEntries[4],
    ]));
    fireEvent.click(screen.getByRole('button', { name: 'Sammeländerung rückgängig' }));
    expect(onChange.mock.lastCall[0]).toEqual(expect.arrayContaining(initialEntries));
  });

  it('supports percentage and per-category staircase previews, including gaps', () => {
    const onChange = vi.fn();
    render(<MantineProvider><StatefulFeeStaircaseEditor initialEntries={[
      { id: 'a', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01' },
      { id: 'b', zeitkatId: '06', monthlyAmount: 135, validFrom: '2026-01-01' },
    ]} onChange={onChange} /></MantineProvider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Art der Sammeländerung' }));
    fireEvent.click(screen.getByRole('option', { name: 'Prozent ändern (%)' }));
    fireEvent.change(screen.getByLabelText('Änderung in %'), { target: { value: '12.5' } });
    expect(screen.getByLabelText('Vorschau Sammeländerung').textContent).toContain('135,00 € → 151,88 €');
    fireEvent.click(screen.getByRole('combobox', { name: 'Art der Sammeländerung' }));
    fireEvent.click(screen.getByRole('option', { name: 'Staffel je Kategorie (€)' }));
    fireEvent.change(screen.getByLabelText('Schritt je Kategorie in €'), { target: { value: '10' } });
    expect(screen.getByLabelText('Vorschau Sammeländerung').textContent).toContain('135,00 € → 120,00 €');
    expect(screen.getByLabelText('Vorschau Sammeländerung').textContent).toContain('erfüllt die Staffelungsregeln nicht');
    fireEvent.click(screen.getByRole('button', { name: 'Sammeländerung anwenden' }));
    expect(onChange.mock.lastCall[0][1].monthlyAmount).toBe(120);
    expect(screen.getByTestId('fee-staircase-compliance-warning')).toBeTruthy();
  });

  it('rejects invalid bulk results and disables undo after a subsequent edit', () => {
    const onChange = vi.fn();
    render(<MantineProvider><StatefulFeeStaircaseEditor initialEntries={[
      { id: 'a', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01' },
    ]} onChange={onChange} simulation /></MantineProvider>);
    fireEvent.change(screen.getByLabelText('Änderung in €'), { target: { value: '-100' } });
    expect(screen.getByRole('button', { name: 'Sammeländerung anwenden' }).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('0,01 €');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Änderung in €'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sammeländerung anwenden' }));
    expect(screen.getByRole('button', { name: 'Sammeländerung rückgängig' }).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText('Betrag ZEITKAT 04 um 5 € erhöhen'));
    expect(screen.getByRole('button', { name: 'Sammeländerung rückgängig' }).disabled).toBe(true);
  });

  it('uses the selected step for buttons and clamps at the upper limit', () => {
    const onChange = vi.fn();
    render(<MantineProvider><StatefulFeeStaircaseEditor initialEntries={[
      { id: 'a', zeitkatId: '04', monthlyAmount: 99995, validFrom: '2026-01-01' },
    ]} onChange={onChange} /></MantineProvider>);

    fireEvent.click(screen.getByRole('combobox', { name: 'Schrittweite für ±' }));
    fireEvent.click(screen.getByRole('option', { name: '10 €' }));
    expect(screen.getByLabelText('Betrag ZEITKAT 05 um 10 € erhöhen').disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Betrag ZEITKAT 04 um 10 € erhöhen'));
    expect(onChange.mock.lastCall[0][0].monthlyAmount).toBe(100000);
    fireEvent.click(screen.getByLabelText('Betrag ZEITKAT 04 um 10 € senken'));
    expect(onChange.mock.lastCall[0][0].monthlyAmount).toBe(99990);
  });

  it('uses an explicit staircase start and counts missing categories without modifying them', () => {
    const onChange = vi.fn();
    const entries = [
      { id: 'a', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01', custom: 'kept' },
      { id: 'b', zeitkatId: '06', monthlyAmount: 135, validFrom: '2026-01-01' },
    ];
    render(<MantineProvider><StatefulFeeStaircaseEditor initialEntries={entries} onChange={onChange} /></MantineProvider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Art der Sammeländerung' }));
    fireEvent.click(screen.getByRole('option', { name: 'Staffel je Kategorie (€)' }));
    fireEvent.change(screen.getByLabelText('Startbetrag in €'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Schritt je Kategorie in €'), { target: { value: '15' } });
    expect(screen.getByLabelText('Vorschau Sammeländerung').textContent).toContain('ZEITKAT 04: 100,00 € → 80,00 €');
    expect(screen.getByLabelText('Vorschau Sammeländerung').textContent).toContain('ZEITKAT 06: 135,00 € → 110,00 €');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sammeländerung anwenden' }));
    expect(onChange.mock.lastCall[0]).toEqual([
      { ...entries[0], monthlyAmount: 80 }, { ...entries[1], monthlyAmount: 110 },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Sammeländerung rückgängig' }));
    expect(onChange.mock.lastCall[0]).toEqual(entries);
  });

  it('keeps undo available after an unchanged field blur, but not after a later edit even if reverted', () => {
    render(<MantineProvider><StatefulFeeStaircaseEditor initialEntries={[
      { id: 'a', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01' },
    ]} /></MantineProvider>);
    fireEvent.change(screen.getByLabelText('Änderung in €'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sammeländerung anwenden' }));
    fireEvent.blur(screen.getByLabelText('Betrag ZEITKAT 04'));
    expect(screen.getByRole('button', { name: 'Sammeländerung rückgängig' }).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText('Betrag ZEITKAT 04 um 5 € erhöhen'));
    fireEvent.click(screen.getByLabelText('Betrag ZEITKAT 04 um 5 € senken'));
    expect(screen.getByRole('button', { name: 'Sammeländerung rückgängig' }).disabled).toBe(true);
  });

  it('updates the selected ZEITKAT only when imported entries reuse an ID', () => {
    const onChangeEntries = vi.fn();
    render(
      <MantineProvider>
        <FeeStaircaseEditor
          entries={[
            { id: 'duplicate-id', zeitkatId: '01', monthlyAmount: 100, validFrom: '2026-01-01' },
            { id: 'duplicate-id', zeitkatId: '02', monthlyAmount: 200, validFrom: '2026-01-01' },
          ]}
          referenceDate={referenceDate}
          onChangeEntries={onChangeEntries}
        />
      </MantineProvider>
    );

    const amountInput = screen.getByLabelText('Betrag ZEITKAT 02');
    fireEvent.change(amountInput, { target: { value: '250' } });
    fireEvent.blur(amountInput);

    const changedEntries = onChangeEntries.mock.calls.at(-1)[0];
    expect(changedEntries).toMatchObject([
      { id: 'duplicate-id', zeitkatId: '01', monthlyAmount: 100 },
      { id: 'duplicate-id', zeitkatId: '02', monthlyAmount: 250 },
    ]);
  });
});
