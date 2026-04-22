import { describe, expect, it } from 'vitest';
import { formatWeeklyAxisLabel, generateTimeSegments } from './chartUtilsWeekly';

describe('chartUtilsWeekly', () => {
  it('generates a full 30-minute grid from Monday to Friday', () => {
    const segments = generateTimeSegments();

    expect(segments).toHaveLength(105);
    expect(segments[0]).toBe('Mo 7:00');
    expect(segments[1]).toBe('Mo 7:30');
    expect(segments[20]).toBe('Mo 17:00');
    expect(segments[21]).toBe('Di 7:00');
    expect(segments[104]).toBe('Fr 17:00');
  });

  it('shows weekly axis labels only for 8, 12, and 16 oclock', () => {
    expect(formatWeeklyAxisLabel('Mo 7:00')).toBe('');
    expect(formatWeeklyAxisLabel('Mo 7:30')).toBe('');
    expect(formatWeeklyAxisLabel('Mo 8:00')).toBe('8:00');
    expect(formatWeeklyAxisLabel('Di 12:00')).toBe('12:00');
    expect(formatWeeklyAxisLabel('Fr 16:00')).toBe('16:00');
    expect(formatWeeklyAxisLabel('Fr 17:00')).toBe('');
  });
});