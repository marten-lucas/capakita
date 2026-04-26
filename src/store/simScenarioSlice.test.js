import { describe, expect, it } from 'vitest';
import { selectSelectedScenarioHasAdebisImport } from './simScenarioSlice';

describe('simScenario selectors', () => {
  it('returns false when no scenario is selected', () => {
    const state = {
      simScenario: {
        selectedScenarioId: null,
        scenarios: [],
      },
    };

    expect(selectSelectedScenarioHasAdebisImport(state)).toBe(false);
  });

  it('returns false for selected manual scenario', () => {
    const state = {
      simScenario: {
        selectedScenarioId: 's1',
        scenarios: [
          { id: 's1', imported: false },
          { id: 's2', imported: true },
        ],
      },
    };

    expect(selectSelectedScenarioHasAdebisImport(state)).toBe(false);
  });

  it('returns true for selected imported scenario', () => {
    const state = {
      simScenario: {
        selectedScenarioId: 's2',
        scenarios: [
          { id: 's1', imported: false },
          { id: 's2', imported: true },
        ],
      },
    };

    expect(selectSelectedScenarioHasAdebisImport(state)).toBe(true);
  });
});
