import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FeeStaircaseEditor from './FeeStaircaseEditor';

const referenceDate = '2026-03-15';

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
    expect(screen.getByTestId('fee-staircase-slider-02')).toBeTruthy();
    expect(screen.getByLabelText('ZEITKAT 02').checked).toBe(false);
    fireEvent.click(screen.getByLabelText('ZEITKAT 02'));
    const changedEntries = onChangeEntries.mock.calls.at(-1)[0];
    expect(changedEntries.map((entry) => entry.zeitkatId)).toEqual(['01', '02', '04']);
    expect(changedEntries[1]).toMatchObject({ zeitkatId: '02', monthlyAmount: 100, enabled: true });
    expect(changedEntries.every((entry) => !Object.hasOwn(entry, 'maxHours'))).toBe(true);
  });

  it('places the direct amount input below each slider and shows the original marker in simulation', () => {
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
    expect(screen.getByLabelText('ZEITKAT 09').checked).toBe(true);
    expect(screen.getByLabelText('ZEITKAT 10').checked).toBe(true);
    expect(screen.getByText('>4-5h')).toBeTruthy();
    expect(screen.getByText('Kategorie 4')).toBeTruthy();
    expect(screen.queryByText('Direkte Eingabe')).toBeNull();
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 EUR');
    expect(screen.getByText('Original 100,00 €')).toBeTruthy();
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
