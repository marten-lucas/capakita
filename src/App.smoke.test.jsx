import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import WelcomePage from './pages/WelcomePage';
import store from './store/store';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

describe('App smoke test', () => {
  it('renders the initial welcome actions', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <MantineProvider>
            <WelcomePage />
          </MantineProvider>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText(/Leeres Szenario/i)).toBeInTheDocument();
    expect(screen.getByText(/Daten importieren/i)).toBeInTheDocument();
  });
});
