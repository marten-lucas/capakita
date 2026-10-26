import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ZeitkatHistogramSlide from './ZeitkatHistogramSlide';

const ZONES = [
  { id: '01', label: '>1-2', bez: 'über 1 bis incl. 2 Stunden', factor: 0.5, count: 2 },
  { id: '02', label: '>2-3', bez: 'über 2 bis incl. 3 Stunden', factor: 0.75, count: 1 },
  { id: '04', label: '>3-4', bez: 'über 3 bis incl. 4 Stunden', factor: 1, count: 0 },
];

const distribution = {
  all: { zones: ZONES, series: [2, 1, 0], total: 3, mode: 'children' },
  byGroup: {
    g1: { zones: ZONES, series: [1, 1, 0], total: 2 },
    g2: { zones: ZONES, series: [1, 0, 0], total: 1 },
  },
};

const groups = [
  { id: 'g1', name: 'Fuchs' },
  { id: 'g2', name: 'Bär' },
];

describe('ZeitkatHistogramSlide (gestapelt, MultiSelect, Trimming)', () => {
  it('rendert MultiSelect und Chart bei vorhandenen Daten', () => {
    render(
      <MantineProvider>
        <ZeitkatHistogramSlide distribution={distribution} groups={groups} accent="#0f766e" />
      </MantineProvider>
    );
    expect(screen.getAllByLabelText('Gruppenfilter Buchungskategorien').length).toBeGreaterThan(0);
    expect(document.querySelector('.highcharts-container')).toBeTruthy();
  });

  it('Mehrfachauswahl im Gruppenfilter funktioniert ohne Absturz', () => {
    render(
      <MantineProvider>
        <ZeitkatHistogramSlide distribution={distribution} groups={groups} accent="#0f766e" />
      </MantineProvider>
    );
    const filter = screen.getAllByLabelText('Gruppenfilter Buchungskategorien')[0];
    fireEvent.click(filter);
    const fuchs = screen.queryAllByText('Fuchs');
    if (fuchs.length > 0) fireEvent.click(fuchs[0]);
    const baer = screen.queryAllByText('Bär');
    if (baer.length > 0) fireEvent.click(baer[0]);
    expect(document.querySelector('.highcharts-container')).toBeTruthy();
  });

  it('ohne Daten zeigt den Hinweistext', () => {
    render(
      <MantineProvider>
        <ZeitkatHistogramSlide
          distribution={{ all: { zones: [], series: [], total: 0 }, byGroup: {} }}
          groups={groups}
          accent="#0f766e"
        />
      </MantineProvider>
    );
    expect(screen.getByText('Keine Buchungskategorien für diese Auswahl.')).toBeTruthy();
  });
});
