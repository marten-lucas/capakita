import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import store from '../store/store';
import VisuView from './VisuView';

describe('VisuView analysis stepper', () => {
  it('switches analysis sections with the stepper', async () => {
    render(
      <Provider store={store}>
        <MantineProvider>
          <VisuView />
        </MantineProvider>
      </Provider>
    );

    expect(await screen.findAllByTestId(/story-step-/)).toHaveLength(7);
    expect(screen.getByTestId('analysis-story-navigation')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('story-step-status'));
    await screen.findByText('Kapazität & Bedarf');

    fireEvent.click(screen.getByTestId('story-step-options'));
    await waitFor(() => {
      expect(screen.getByTestId('analysis-stage-content')).toHaveClass('analysis-stage-content--options');
    }, { timeout: 15000 });
    expect(screen.getByTestId('analysis-stage-content')).toHaveClass('analysis-stage-content--options');
    await waitFor(() => {
      expect(screen.getByTestId('simulation-results-panel')).toBeInTheDocument();
    }, { timeout: 15000 });
  }, 30000);
});
