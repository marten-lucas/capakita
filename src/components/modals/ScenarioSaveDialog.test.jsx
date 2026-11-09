import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import ScenarioSaveDialog from './ScenarioSaveDialog';
import simScenarioReducer, { setSaveDialogOpen } from '../../store/simScenarioSlice';

const saveDataMock = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useSaveLoad', () => ({
  useSaveLoad: () => ({ saveData: saveDataMock }),
}));

function renderSaveDialog() {
  const store = configureStore({
    reducer: { simScenario: simScenarioReducer },
    preloadedState: {
      simScenario: {
        scenarios: [{
          id: 'scenario-1',
          name: 'Importiertes Szenario',
          imported: true,
          importedAnonymized: false,
        }],
        selectedScenarioId: 'scenario-1',
        selectedItems: {},
        saveDialogOpen: false,
        loadDialogOpen: false,
      },
    },
  });
  store.dispatch(setSaveDialogOpen(true));
  render(
    <MantineProvider>
      <Provider store={store}>
        <ScenarioSaveDialog />
      </Provider>
    </MantineProvider>
  );
  return store;
}

async function submitExport(password = '') {
  if (password) {
    const passwordLabel = screen.getByLabelText(/Passwortschutz \(optional\)|Passwort$/);
    fireEvent.change(passwordLabel, { target: { value: password } });
    fireEvent.change(screen.getByLabelText(/Passwort bestätigen/), { target: { value: password } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(() => expect(saveDataMock).toHaveBeenCalled());
}

describe('ScenarioSaveDialog anonymized export', () => {
  beforeEach(() => {
    saveDataMock.mockReset().mockResolvedValue({ success: true });
  });

  it('anonymizes exports by default', async () => {
    renderSaveDialog();
    const toggle = screen.getByRole('checkbox', { name: 'Daten im Export anonymisieren' });

    expect(toggle.checked).toBe(true);
    expect(screen.getByText(/Geburtsdaten und Betreuungszeiträume bleiben/)).toBeTruthy();
    expect(screen.getByText(/Ohne Passwort ist die Datei unverschlüsselt/)).toBeTruthy();
    await submitExport();

    expect(saveDataMock).toHaveBeenCalledWith('', { anonymize: true });
  });

  it('requires an explicit opt-out to save the source data unchanged', async () => {
    renderSaveDialog();
    const toggle = screen.getByRole('checkbox', { name: 'Daten im Export anonymisieren' });
    fireEvent.click(toggle);

    expect(toggle.checked).toBe(false);
    expect(screen.getByText(/kann personenbezogene Daten aus allen Szenarien enthalten/)).toBeTruthy();
    await submitExport('Abcdef1!');

    expect(saveDataMock).toHaveBeenCalledWith('Abcdef1!', { anonymize: false });
  });

  it('allows an anonymized export to keep optional password protection', async () => {
    renderSaveDialog();
    await submitExport('Abcdef1!');

    expect(saveDataMock).toHaveBeenCalledWith('Abcdef1!', { anonymize: true });
  });
});
