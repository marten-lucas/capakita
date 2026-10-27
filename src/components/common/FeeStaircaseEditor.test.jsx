import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FeeStaircaseEditor from './FeeStaircaseEditor';

const referenceDate = '2026-03-15';

describe('FeeStaircaseEditor', () => {
  it('fills a missing ZEITKAT position and keeps the category sequence gap-free', () => {
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
    expect(screen.getByTestId('fee-staircase-slider-02')).toBeTruthy();
    const amountInput = screen.getByLabelText('Betrag ZEITKAT 02');
    fireEvent.change(amountInput, { target: { value: '125' } });
    fireEvent.blur(amountInput);

    const changedEntries = onChangeEntries.mock.calls.at(-1)[0];
    expect(changedEntries.map((entry) => entry.zeitkatId)).toEqual(['01', '02', '04']);
    expect(changedEntries[1]).toMatchObject({ zeitkatId: '02', monthlyAmount: 125 });
    expect(changedEntries.every((entry) => !Object.hasOwn(entry, 'maxHours'))).toBe(true);
  });

  it('places the direct amount input below each slider and shows the original marker in simulation', () => {
    render(
      <MantineProvider>
        <FeeStaircaseEditor
          entries={[{ id: 'fee-05', zeitkatId: '05', monthlyAmount: 150, validFrom: '2026-01-01' }]}
          originalEntries={[{ id: 'fee-05', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' }]}
          referenceDate={referenceDate}
          simulation
          onChangeEntries={() => {}}
        />
      </MantineProvider>
    );

    expect(screen.getByTestId('fee-staircase-slider-05')).toBeTruthy();
    expect(screen.queryByTestId('fee-staircase-slider-09')).toBeNull();
    expect(screen.queryByText('Direkte Eingabe')).toBeNull();
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 EUR');
    expect(screen.getByText('Original 100,00 €')).toBeTruthy();
  });
});
