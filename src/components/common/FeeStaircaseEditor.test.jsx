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
  it('draws a new weekly rectangle by splitting a tier without creating gaps or overlaps', () => {
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

    const chart = screen.getByTestId('fee-staircase-weekly');
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 820,
      height: 310,
      right: 820,
      bottom: 310,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const xForHours = (hours) => 62 + (hours / 40) * 742;
    const yForPrice = (price) => 18 + 250 - (price / 500) * 250;
    fireEvent.pointerDown(chart, {
      button: 0,
      pointerId: 1,
      clientX: xForHours(2),
      clientY: yForPrice(100),
    });
    fireEvent.pointerUp(chart, {
      button: 0,
      pointerId: 1,
      clientX: xForHours(6),
      clientY: yForPrice(250),
    });

    expect(onChangeEntries).toHaveBeenCalledTimes(1);
    const result = onChangeEntries.mock.calls[0][0];
    const finiteLimits = result.filter((entry) => entry.maxHours !== '').map((entry) => Number(entry.maxHours)).filter(Number.isFinite);
    expect(finiteLimits).toEqual([2, 6, 10, 20]);
    expect(result.map((entry) => entry.monthlyAmount)).toEqual([100, 250, 100, 200, 300]);
    expect(result.at(-1).maxHours).toBe('');
  });

  it('shows the numeric alternative and keeps the original scale visible in simulation mode', () => {
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
    expect(screen.getByText('Direkte Eingabe')).toBeTruthy();
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 EUR');
    expect(screen.getByText('100,00 €')).toBeTruthy();
  });
});
