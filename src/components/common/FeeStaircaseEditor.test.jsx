import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FeeStaircaseEditor from './FeeStaircaseEditor';

const referenceDate = '2026-03-15';

function StatefulFeeStaircaseEditor({ initialEntries }) {
  const [entries, setEntries] = React.useState(initialEntries);
  return (
    <FeeStaircaseEditor
      entries={entries}
      referenceDate={referenceDate}
      onChangeEntries={setEntries}
    />
  );
}

describe('FeeStaircaseEditor', () => {
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
    expect(screen.queryByTestId('fee-staircase-slider-02')).toBeNull();
    expect(screen.queryByLabelText('Betrag ZEITKAT 02')).toBeNull();
    expect(screen.getByLabelText('Tarif gültig von')).toBeTruthy();
    expect(screen.getByLabelText('Tarif gültig bis')).toBeTruthy();
    expect(screen.getByLabelText('Aktiviere Beitrag ZEITKAT 02').checked).toBe(false);
    fireEvent.click(screen.getByLabelText('Aktiviere Beitrag ZEITKAT 02'));
    const changedEntries = onChangeEntries.mock.calls.at(-1)[0];
    expect(changedEntries.map((entry) => entry.zeitkatId)).toEqual(['01', '02', '04']);
    expect(changedEntries[1]).toMatchObject({ zeitkatId: '02', monthlyAmount: 115, enabled: true });
    expect(changedEntries.every((entry) => !Object.hasOwn(entry, 'maxHours'))).toBe(true);
  });

  it('shows direct amount inputs and original markers for active categories in simulation', () => {
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
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 EUR');
    expect(screen.getByTestId('fee-staircase-hourly-05').textContent).toBe('30,00 €/h');
    expect(screen.getByText('Original 100,00 €')).toBeTruthy();
  });

  it('deactivates a category at zero and restores its previous amount with the checkbox', () => {
    render(
      <MantineProvider>
        <StatefulFeeStaircaseEditor
          initialEntries={[{ id: 'fee-04', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' }]}
        />
      </MantineProvider>
    );

    const amountInput = screen.getByLabelText('Betrag ZEITKAT 04');
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.blur(amountInput);

    const activationCheckbox = screen.getByLabelText('Aktiviere Beitrag ZEITKAT 04');
    expect(activationCheckbox.checked).toBe(false);
    fireEvent.click(activationCheckbox);

    expect(screen.getByLabelText('Betrag ZEITKAT 04').value).toBe('150 EUR');
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
    expect(screen.queryByTestId('fee-staircase-slider-06')).toBeNull();
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
