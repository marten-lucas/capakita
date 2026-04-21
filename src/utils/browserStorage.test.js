import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadBrowserAutoSaveEnabled,
  loadBrowserAutoSaveState,
  saveBrowserAutoSaveEnabled,
  saveBrowserAutoSaveState,
} from './browserStorage';

describe('browserStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists the browser autosave flag', () => {
    expect(loadBrowserAutoSaveEnabled()).toBe(false);

    saveBrowserAutoSaveEnabled(true);

    expect(loadBrowserAutoSaveEnabled()).toBe(true);
  });

  it('persists the browser autosave state snapshot', () => {
    const snapshot = {
      scenarios: [{ id: '1', name: 'Test' }],
      selectedScenarioId: '1',
    };

    saveBrowserAutoSaveState(snapshot);

    expect(loadBrowserAutoSaveState()).toEqual(snapshot);
  });
});