import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FeeStaircaseEditor from './FeeStaircaseEditor';

const weeklyEntries = [
  { id: 'tier-10', maxHours: 10, monthlyAmount: 100 },
  { id: 'tier-20', maxHours: 20, monthlyAmount: 200 },
  { id: 'tier-open', maxHours: '', monthlyAmount: 300 },
];

describe('FeeStaircaseEditor', () => {
  it('keeps weekly slider tiers contiguous and adds a new tier before the open-ended band', () => {
    const onChangeEntries = vi.fn();
    render(
      <MantineProvider>
        <FeeStaircaseEditor
          entries={weeklyEntries}
          referenceDate="2026-03-15"
          onChangeEntries={onChangeEntries}
        />
      </MantineProvider>
    );

    expect(screen.getByTestId('fee-staircase-weekly')).toBeTruthy();
    const amountSlider = screen.getByRole('slider', { name: 'Beitrag 0–10 h' });
    fireEvent.keyDown(amountSlider, { key: 'ArrowUp', code: 'ArrowUp' });
    expect(onChangeEntries).toHaveBeenCalledTimes(1);
    expect(onChangeEntries.mock.calls[0][0][0].monthlyAmount).toBe(105);

    onChangeEntries.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Staffel hinzufügen' }));
    expect(onChangeEntries).toHaveBeenCalledTimes(1);
    const result = onChangeEntries.mock.calls[0][0];
    const finiteLimits = result.filter((entry) => entry.maxHours !== '').map((entry) => Number(entry.maxHours));
    expect(finiteLimits).toEqual([10, 20, 30]);
    expect(result.at(-1).maxHours).toBe('');
  });

  it('shows direct amount fields below the ZEITKAT sliders and a faint original in simulation', () => {
    render(
      <MantineProvider>
        <FeeStaircaseEditor
          entries={[{ id: 'fee-05', zeitkatId: '05', monthlyAmount: 150, validFrom: '2026-01-01' }]}
          originalEntries={[{ id: 'fee-05', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' }]}
          referenceDate="2026-03-15"
          simulation
          onChangeEntries={() => {}}
        />
      </MantineProvider>
    );

    expect(screen.getByTestId('fee-staircase-zeitkat')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Simulierter Beitrag ZEITKAT 05' })).toBeTruthy();
    expect(screen.getByText('Direkte Eingabe')).toBeTruthy();
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 EUR');
    expect(screen.getByText('Original 100,00 €')).toBeTruthy();
  });
});
