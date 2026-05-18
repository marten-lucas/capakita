import { describe, expect, it } from 'vitest';

import { shouldShowDataItemInEditor } from './dataVisibility';

describe('shouldShowDataItemInEditor', () => {
  it('hides inactive imported items but keeps current imported items visible', () => {
    expect(
      shouldShowDataItemInEditor(
        {
          source: 'adebis export',
          startdate: '2024-01-01',
          enddate: '2025-12-31',
        },
        '2026-05-18'
      )
    ).toBe(false);

    expect(
      shouldShowDataItemInEditor(
        {
          source: 'adebis export',
          startdate: '2024-01-01',
          enddate: '',
        },
        '2026-05-18'
      )
    ).toBe(true);
  });

  it('keeps non-imported items visible regardless of validity window', () => {
    expect(
      shouldShowDataItemInEditor(
        {
          source: 'manual entry',
          startdate: '2027-01-01',
          enddate: '',
        },
        '2026-05-18'
      )
    ).toBe(true);
  });
});