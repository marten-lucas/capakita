import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import HoursHistogramSlide from './HoursHistogramSlide';

const CATEGORIES = ['0', '1-4', '5-8', '9-12'];

const histogram = {
  all: {
    categories: CATEGORIES,
    demand: [0, 2, 1, 0],
    capacity_pedagogical: [0, 1, 1, 0],
    capacity_administrative: [0, 0, 0, 0],
  },
  byGroup: {
    g1: { categories: CATEGORIES, demand: [0, 1, 1, 0], capacity_pedagogical: [0, 1, 0, 0], capacity_administrative: [0, 0, 0, 0] },
    g2: { categories: CATEGORIES, demand: [0, 1, 0, 0], capacity_pedagogical: [0, 0, 1, 0], capacity_administrative: [0, 0, 0, 0] },
  },
};

const groups = [
  { id: 'g1', name: 'Fuchs' },
  { id: 'g2', name: 'Bär' },
];

function renderSlide() {
  return render(
    <MantineProvider>
      <HoursHistogramSlide histogram={histogram} groups={groups} accent="#0f766e" />
    </MantineProvider>
  );
}

describe('HoursHistogramSlide (gestapelt, MultiSelect)', () => {
  it('rendert MultiSelect mit allen Gruppen und Umschalter', () => {
    renderSlide();
    expect(screen.getAllByLabelText('Gruppenfilter Buchungsstunden').length).toBeGreaterThan(0);
    expect(screen.getByText('Kinder')).toBeTruthy();
    expect(screen.getByText('Mitarbeiter (päd.)')).toBeTruthy();
  });

  it('Gruppen-Multiselect erlaubt Mehrfachauswahl ohne Absturz', () => {
    renderSlide();
    const filter = screen.getAllByLabelText('Gruppenfilter Buchungsstunden')[0];
    fireEvent.click(filter);
    const fuchs = screen.queryAllByText('Fuchs');
    if (fuchs.length > 0) fireEvent.click(fuchs[0]);
    const baer = screen.queryAllByText('Bär');
    if (baer.length > 0) fireEvent.click(baer[0]);
    // Auswahl geändert → Chart bleibt gerendert (Highcharts-Container vorhanden)
    expect(document.querySelector('.highcharts-container')).toBeTruthy();
  });

  it('Umschalter auf Mitarbeiter wechselt die Serie ohne Absturz', () => {
    renderSlide();
    fireEvent.click(screen.getByText('Mitarbeiter (päd.)'));
    expect(document.querySelector('.highcharts-container')).toBeTruthy();
  });
});
