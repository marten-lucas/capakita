import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import store from '../store/store';
import VisuView from './VisuView';

describe('VisuView album flow', () => {
  it('switches active story card on click', async () => {
    render(
      <Provider store={store}>
        <MantineProvider>
          <VisuView />
        </MantineProvider>
      </Provider>
    );

    expect(await screen.findAllByTestId(/story-card-/)).toHaveLength(7);
    expect(screen.getByTestId('story-card-quality')).toHaveAttribute('data-active', 'true');

    fireEvent.click(screen.getByTestId('story-card-status'));

    await waitFor(() => {
      expect(screen.getByTestId('story-card-status')).toHaveAttribute('data-active', 'true');
    }, { timeout: 15000 });

    expect(screen.getByTestId('story-card-quality')).toHaveAttribute('data-active', 'false');
  }, 20000);
});
