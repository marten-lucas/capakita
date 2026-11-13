import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import Highcharts from 'highcharts';
import store, { createAppStore } from '../store/store';
import { setFilterGroups, setFilterQualifications, setReferenceDate } from '../store/chartSlice';
import { setSelectedScenarioId } from '../store/simScenarioSlice';
import { setPrivacyMode } from '../store/uiSlice';
import { setDataItemOverlay } from '../store/simOverlaySlice';
import { importQualificationAssignments } from '../store/simQualificationSlice';
import { updateBayKiBiGRule, updateGroupFeeEntry, updatePersonnelCostEntry } from '../store/simFinanceSlice';
import * as forecastUtils from '../utils/forecastUtils';
import VisuView, { CoverageHeatmap } from './VisuView';

const carouselTest = vi.hoisted(() => ({ enabled: false }));
vi.mock('@mantine/carousel', async (importOriginal) => {
  const original = await importOriginal();
  const ReactModule = await import('react');
  function TestCarousel({ children, getEmblaApi }) {
    const api = ReactModule.useMemo(() => {
      let index = 0;
      const listeners = new Set();
      return {
        selectedScrollSnap: () => index,
        canScrollPrev: () => index > 0,
        canScrollNext: () => index < ReactModule.Children.count(children) - 1,
        on: (_event, callback) => listeners.add(callback),
        off: (_event, callback) => listeners.delete(callback),
        scrollPrev: () => { index = Math.max(0, index - 1); listeners.forEach((callback) => callback()); },
        scrollNext: () => { index = Math.min(ReactModule.Children.count(children) - 1, index + 1); listeners.forEach((callback) => callback()); },
      };
    }, [ReactModule.Children.count(children)]);
    ReactModule.useEffect(() => { getEmblaApi(api); }, [api, getEmblaApi]);
    return <div>{children}</div>;
  }
  function Carousel(props) {
    return carouselTest.enabled ? <TestCarousel {...props} /> : <original.Carousel {...props} />;
  }
  Carousel.Slide = function Slide(props) {
    return carouselTest.enabled ? <div>{props.children}</div> : <original.Carousel.Slide {...props} />;
  };
  return { ...original, Carousel };
});

afterEach(() => { carouselTest.enabled = false; });

function createFinanceTestStore() {
  const testStore = createAppStore({ preloadedState: {
    simScenario: { scenarios: [{ id: 'base' }], selectedScenarioId: 'base', selectedItems: {} },
    simData: { dataByScenario: { base: {
      a: { id: 'a', type: 'demand', groupId: 'g', dateofbirth: '2024-01-01', startdate: '2026-01-01' },
      b: { id: 'b', type: 'demand', groupId: 'h', dateofbirth: '2022-01-01', startdate: '2026-07-10' },
      staff: { id: 'staff', type: 'capacity', startdate: '2026-01-01' },
      archived: { id: 'archived', type: 'demand', archived: true },
    } } },
    simBooking: { bookingsByScenario: { base: {
      a: { a1: { id: 'a1', rawdata: { ART: '0', ZEITKAT: '06', GEWKAT: 'D', BETRSTD: '20' } } },
      b: { b1: { id: 'b1', rawdata: { ART: '0', ZEITKAT: '06', GEWKAT: 'A', BETRSTD: '25' } } },
    } } },
    simGroup: { groupDefsByScenario: { base: [{ id: 'g', name: 'G', type: 'Krippe' }, { id: 'h', name: 'H', type: 'Kindergarten' }] }, groupsByScenario: {} },
    simFinance: { financeByScenario: { base: {
      settings: {},
      bayKiBiGRules: [
        { id: 'first', validFrom: '2026-01-01', validUntil: '2026-06-30', baseValue: 1200 },
        { id: 'second', validFrom: '2026-07-01', baseValue: 2400 },
      ],
      groupFeeCatalogs: {
        g: [{ id: 'g-fee', zeitkatId: '06', monthlyAmount: 100 }],
        h: [{ id: 'h-fee', zeitkatId: '06', monthlyAmount: 200 }],
      },
      itemFinances: { staff: { personnelCostHistory: [{ id: 'cost', annualGrossSalary: 12000, employerOnCostPercent: 0 }] } },
    } } },
  } });
  testStore.dispatch(setReferenceDate({ scenarioId: 'base', date: '2026-12-15' }));
  return testStore;
}

function financeChart() {
  const container = screen.getByTestId('analysis-finance-chart');
  return Highcharts.charts.find((chart) => chart && container.contains(chart.renderTo));
}

function financeKpi(title) {
  return screen.getByText(title).closest('.analysis-stage-recommendation-box');
}

describe('VisuView analysis stepper', () => {
  it('bereinigt Prognose-Chartdaten beim Datenschutzwechsel einschließlich SVG-Export', async () => {
    carouselTest.enabled = true;
    const fixture = forecastUtils.buildForecastModel({
      referenceDate: '2026-01-01',
      children: [
        { id: 'child-a', type: 'demand', name: 'Testkind <Alpha & Beta>', groupId: 'g', enddate: '2026-02-01' },
        { id: 'child-b', type: 'demand', name: 'Testkind Gamma', groupId: 'g', enddate: '2026-02-01' },
      ],
      groups: [{ id: 'g', type: 'Krippe' }],
      events: [{ id: 'event-Testkind-Gamma', entityId: 'child-a', entityType: 'demand', type: 'booking_start', effectiveDate: '2026-01-15', entityName: 'Testkind <Alpha & Beta>', description: 'Testkind Gamma', metadata: { targetStage: 'Stufe <X & Y>' } }],
    });
    fixture.nodes[0].name = 'Stufe <X & Y>';
    fixture.nodes[0].extraPerson = 'Geheime Knoteninfo';
    fixture.links[0].stepLabel = 'Termin <X & Y>';
    fixture.links[0].extraPerson = 'Geheime Linkinfo';
    fixture.links.push({ ...fixture.links[0], children: [fixture.links[0].children[1]], weight: 1 });
    fixture.groupTimeline.timelinePoints[0].extraPerson = 'Geheime Punktinfo';
    fixture.groupTimeline.timelinePoints[0].eventList.push({ id: 'event-child-b', type: '<img src=x>', entityName: 'Testkind Gamma' });
    fixture.groupTimeline.timelinePoints[0].count = 2;
    const spy = vi.spyOn(forecastUtils, 'buildForecastModel').mockReturnValue(fixture);
    const createObjectURL = vi.fn(() => 'blob:synthetic');
    const OriginalURL = globalThis.URL;
    vi.stubGlobal('URL', class extends OriginalURL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      const testStore = createAppStore({ preloadedState: {
        simScenario: { scenarios: [{ id: 'base' }], selectedScenarioId: 'base', selectedItems: {} },
      } });
      testStore.dispatch(setReferenceDate({ scenarioId: 'base', date: '2026-01-01' }));
      testStore.dispatch(setPrivacyMode(true));
      const view = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
      fireEvent.click(screen.getByTestId('story-step-compare'));
      const sankeyContainer = await screen.findByTestId('forecast-sankey-chart', {}, { timeout: 15000 });
      const getSankey = () => Highcharts.charts.find((entry) => entry && sankeyContainer.contains(entry.renderTo) && entry.series[0]?.type === 'sankey');
      let chart = getSankey();
      expect(JSON.stringify(chart.userOptions)).not.toMatch(/Testkind|child-a|child-b|Geheime/);
      act(() => testStore.dispatch(setPrivacyMode(false)));
      chart = getSankey();
      expect(chart.userOptions.series[0].data[0].children[0].name).toContain('Testkind');
      const linkTooltip = () => chart.options.tooltip.pointFormatter.call(chart.series[0].points[0]);
      expect(linkTooltip()).toContain('Stufe &lt;X &amp; Y&gt;');
      expect(linkTooltip()).toContain('Termin &lt;X &amp; Y&gt;');
      act(() => chart.tooltip.refresh(chart.series[0].points[0]));
      expect(chart.renderTo.querySelector('.highcharts-tooltip').textContent).toContain('Stufe <X & Y>');
      act(() => chart.options.plotOptions.sankey.point.events.mouseOver.call(chart.series[0].points[0]));
      expect(within(sankeyContainer).getByText(/Testkind <Alpha & Beta>/)).toBeInTheDocument();

      act(() => testStore.dispatch(setPrivacyMode(true)));
      chart = getSankey();
      expect(chart.userOptions.series[0].data[0].children).toEqual([{ id: 'Kind 1', name: 'Kind 1' }, { id: 'Kind 2', name: 'Kind 2' }]);
      expect(JSON.stringify(chart.userOptions)).not.toContain('Testkind');
      expect(JSON.stringify(chart.options)).not.toContain('Testkind');
      expect(JSON.stringify(chart.series[0].points.map((point) => point.options))).not.toContain('Testkind');
      for (const secret of ['child-a', 'child-b', 'Geheime Knoteninfo', 'Geheime Linkinfo']) {
        expect(JSON.stringify(chart.userOptions)).not.toContain(secret);
        expect(JSON.stringify(chart.options)).not.toContain(secret);
      }
      expect(sankeyContainer.innerHTML).not.toContain('Testkind');
      expect(sankeyContainer).toHaveTextContent('Sankey-Link oder Knoten berühren');
      expect(linkTooltip()).toContain('Termin &lt;X &amp; Y&gt;');
      act(() => chart.options.plotOptions.sankey.point.events.mouseOver.call(chart.series[0].points[0]));
      expect(sankeyContainer).toHaveTextContent('Kind 1, Kind 2');
      act(() => chart.options.plotOptions.sankey.point.events.mouseOver.call(chart.series[0].points[1]));
      expect(sankeyContainer).toHaveTextContent('Kind 2');
      expect(sankeyContainer).not.toHaveTextContent('Kind 1');
      const node = chart.series[0].nodes.find((entry) => entry.id === chart.series[0].points[0].from);
      act(() => chart.options.plotOptions.sankey.point.events.mouseOver.call(node));
      expect(sankeyContainer).toHaveTextContent('Kind 1, Kind 2');
      fireEvent.click(screen.getByTestId('forecast-sankey-export-menu'));
      fireEvent.click(await screen.findByTestId('forecast-sankey-export-svg'));
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
      const svg = await act(async () => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(createObjectURL.mock.calls[0][0]);
      }));
      expect(svg).toContain('<svg');
      expect(svg).not.toContain('Testkind');
      act(() => testStore.dispatch(setPrivacyMode(false)));
      chart = getSankey();
      expect(chart.userOptions.series[0].data[0].children[0].name).toContain('Testkind');

      fireEvent.click(screen.getByRole('button', { name: 'Nächstes Diagramm' }));
      await screen.findByTestId('forecast-event-timeline');
      const getTimeline = () => Highcharts.charts.find((entry) => entry && screen.getByTestId('forecast-event-timeline').contains(entry.renderTo) && entry.series[0]?.type === 'timeline');
      chart = getTimeline();
      const eventTooltip = () => chart.options.tooltip.pointFormatter.call(chart.series[0].points[0]);
      expect(eventTooltip()).toContain('Testkind &lt;Alpha &amp; Beta&gt;');
      expect(eventTooltip()).toContain('Stufe &lt;X &amp; Y&gt;');
      expect(eventTooltip()).toContain('&lt;img src=x&gt;');
      act(() => chart.tooltip.refresh(chart.series[0].points[0]));
      const tooltipContent = document.createElement('div');
      tooltipContent.innerHTML = eventTooltip();
      expect(tooltipContent.textContent).toContain('Testkind <Alpha & Beta>');
      expect(tooltipContent.querySelector('alpha')).toBeNull();
      act(() => testStore.dispatch(setPrivacyMode(true)));
      chart = getTimeline();
      expect(chart.userOptions.series[0].data[0].eventList).toEqual([
        { type: 'booking_start', targetStage: 'Stufe <X & Y>', entityName: 'Kind' },
        { type: '<img src=x>', targetStage: undefined, entityName: 'Kind' },
      ]);
      expect(JSON.stringify(chart.userOptions)).not.toContain('Testkind');
      expect(JSON.stringify(chart.options)).not.toContain('Testkind');
      expect(JSON.stringify(chart.series[0].points.map((point) => point.options))).not.toContain('Testkind');
      for (const secret of ['child-a', 'event-Testkind-Gamma', 'Geheime Punktinfo']) {
        expect(JSON.stringify(chart.userOptions)).not.toContain(secret);
        expect(JSON.stringify(chart.options)).not.toContain(secret);
      }
      expect(view.container.innerHTML).not.toContain('Testkind');
      expect(eventTooltip()).toContain('Kind (→ Stufe &lt;X &amp; Y&gt;)');
      expect(eventTooltip()).not.toContain('Testkind');
      act(() => chart.tooltip.refresh(chart.series[0].points[0]));
      tooltipContent.innerHTML = eventTooltip();
      expect(tooltipContent.textContent).toContain('Kind (→ Stufe <X & Y>)');
      expect(tooltipContent.querySelector('x')).toBeNull();
      expect(tooltipContent.querySelector('img')).toBeNull();
      expect(chart.renderTo.innerHTML).not.toContain('Testkind');
      act(() => testStore.dispatch(setPrivacyMode(false)));
      chart = getTimeline();
      expect(eventTooltip()).toContain('Testkind &lt;Alpha &amp; Beta&gt;');
      expect(chart.userOptions.series[0].data[0].eventList[0].id).toBe('event-Testkind-Gamma');
      view.unmount();
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
    } finally {
      clickSpy.mockRestore();
      vi.unstubAllGlobals();
      spy.mockRestore();
    }
  }, 30000);

  it('schaltet Trendfilter je Diagramm um und erhält die Auswahl auch im Datenschutzmodus', async () => {
    carouselTest.enabled = true;
    const testStore = createFinanceTestStore();
    testStore.dispatch(setFilterGroups({ scenarioId: 'base', groups: ['g'] }));
    testStore.dispatch(setFilterQualifications({ scenarioId: 'base', qualifications: ['__NO_QUALI__'] }));
    testStore.dispatch(setDataItemOverlay({ scenarioId: 'base', itemId: 'a', overlayData: { id: 'a', type: 'demand', groupId: 'h', dateofbirth: '2024-01-01', startdate: '2026-01-01' } }));
    testStore.dispatch(setDataItemOverlay({ scenarioId: 'base', itemId: 'staff', overlayData: { id: 'staff', type: 'capacity', groupId: 'g', startdate: '2026-01-01' } }));
    testStore.dispatch(importQualificationAssignments({ scenarioId: 'base', assignments: [
      { id: 'old', dataItemId: 'staff', qualification: 'other', start: '2026-01-01', end: '2026-06-30' },
      { id: 'new', dataItemId: 'staff', qualification: 'expert', start: '2026-07-01' },
    ] }));
    render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    fireEvent.click(screen.getByTestId('story-step-trends'));
    expect(await screen.findByTestId('trend-filter-scope')).toHaveTextContent('nur für Mitarbeiter');
    const seriesValue = (name) => {
      const container = screen.getByTestId('trend-history-chart');
      const chart = Highcharts.charts.find((entry) => entry && container.contains(entry.renderTo));
      return chart.series.find((series) => series.name === name).options.data.at(-1);
    };
    await waitFor(() => expect(seriesValue('Kinder')).toBe(0));
    expect(seriesValue('Mitarbeiter')).toBe(0);
    act(() => testStore.dispatch(setFilterQualifications({ scenarioId: 'base', qualifications: ['expert'] })));
    await waitFor(() => expect(seriesValue('Mitarbeiter')).toBe(1));
    expect(seriesValue('Kinder')).toBe(0);
    act(() => testStore.dispatch(setFilterQualifications({ scenarioId: 'base', qualifications: ['other'] })));
    await waitFor(() => expect(seriesValue('Mitarbeiter')).toBe(0));
    act(() => testStore.dispatch(setFilterGroups({ scenarioId: 'base', groups: ['h'] })));
    await waitFor(() => expect(seriesValue('Kinder')).toBe(2));
    act(() => {
      testStore.dispatch(setFilterGroups({ scenarioId: 'base', groups: ['g'] }));
      testStore.dispatch(setFilterQualifications({ scenarioId: 'base', qualifications: ['__NO_QUALI__'] }));
    });
    await waitFor(() => expect(seriesValue('Kinder')).toBe(0));
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    expect(await screen.findByRole('combobox', { name: 'Gruppen' })).not.toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Qualifikationen' })).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Trend-Diagramm' }));
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    expect(await screen.findByRole('combobox', { name: 'Gruppen' })).not.toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Qualifikationen' })).toBeDisabled();
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    for (let index = 0; index < 4; index += 1) fireEvent.click(screen.getByRole('button', { name: 'Nächstes Trend-Diagramm' }));
    expect(screen.getByTestId('trend-filter-scope')).toHaveTextContent('gesamte Einrichtung');
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    expect(await screen.findByRole('combobox', { name: 'Gruppen' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Qualifikationen' })).toBeDisabled();
    expect(screen.getByText(/Für dieses Übergangsdiagramm nicht anwendbar/)).toBeInTheDocument();
    expect(screen.getByText(/Für dieses Diagramm nicht anwendbar/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Trend-Diagramm' }));
    expect(screen.getByTestId('trend-filter-scope')).toHaveTextContent('gesamte Einrichtung');
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    expect(await screen.findByRole('combobox', { name: 'Gruppen' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Qualifikationen' })).toBeDisabled();
    act(() => testStore.dispatch(setPrivacyMode(true)));
    expect(testStore.getState().chart.base.filter.Groups).toEqual(['g']);
    expect(testStore.getState().chart.base.filter.Qualifications).toEqual(['__NO_QUALI__']);
  }, 20000);

  it('pseudonymisiert lückenhafte Datensätze und den Dienstplan beim Umschalten', async () => {
    carouselTest.enabled = true;
    const testStore = createAppStore({ preloadedState: {
      simScenario: { scenarios: [{ id: 'base' }], selectedScenarioId: 'base', selectedItems: {} },
      simData: { dataByScenario: { base: {
        s1: { id: 's1', type: 'capacity', name: 'Testperson <A & B>', groupId: 'g' },
        s2: { id: 's2', type: 'capacity', name: 'Testperson Z', groupId: 'h' },
        c1: { id: 'c1', type: 'demand', name: 'Testkind X', groupId: 'g' },
      } } },
      simGroup: { groupDefsByScenario: { base: [{ id: 'g', name: 'Gruppe <Test & Co>' }, { id: 'h', name: 'Gruppe Z' }] }, groupsByScenario: {} },
    } });
    testStore.dispatch(setReferenceDate({ scenarioId: 'base', date: '2026-01-01' }));
    const view = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    expect(await screen.findByText(/Testperson <A & B>/)).toBeInTheDocument();
    expect(screen.getByText(/Testkind X/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nachstes Diagramm' }));
    await waitFor(() => expect(screen.getByText('Wochen-Dienstplan (Stichtag)')).toBeInTheDocument());
    const getChart = () => Highcharts.charts.find((chart) => chart && view.container.contains(chart.renderTo) && chart.options.chart.type === 'heatmap');
    await waitFor(() => expect(getChart()).toBeTruthy());
    let chart = getChart();
    expect(chart.yAxis[0].categories).toEqual(['Testperson <A & B>', 'Testperson Z']);
    expect(chart.renderTo.querySelector('.highcharts-yaxis-labels').textContent).toContain('Testperson <A & B>');
    const tooltip = () => chart.options.tooltip.formatter.call({ point: chart.series[0].points[0] });
    expect(tooltip()).toContain('Testperson &lt;A &amp; B&gt;');
    expect(tooltip()).toContain('Gruppe &lt;Test &amp; Co&gt;');

    act(() => testStore.dispatch(setPrivacyMode(true)));
    chart = getChart();
    expect(chart.yAxis[0].categories).toEqual(['Mitarbeiter 1', 'Mitarbeiter 2']);
    expect(tooltip()).toContain('Mitarbeiter 1');
    expect(tooltip()).not.toContain('Testperson');
    expect(JSON.stringify(chart.userOptions)).not.toContain('Testperson');
    expect(chart.renderTo.innerHTML).not.toContain('Testperson');
    expect(view.container.textContent).not.toContain('Testperson');
    expect(view.container.textContent).not.toContain('Testkind X');
    expect(screen.getByText(/Mitarbeiter 1 \(keine Buchung, keine Finanzen\)/)).toBeInTheDocument();
    expect(screen.getByText(/Kind 1 \(keine Buchung\)/)).toBeInTheDocument();

    act(() => testStore.dispatch(setFilterGroups({ scenarioId: 'base', groups: ['h'] })));
    chart = getChart();
    expect(chart.yAxis[0].categories).toEqual(['Mitarbeiter 2']);
    expect(screen.getByText(/Mitarbeiter 2 \(keine Buchung, keine Finanzen\)/)).toBeInTheDocument();
    act(() => testStore.dispatch(setFilterGroups({ scenarioId: 'base', groups: [] })));
    chart = getChart();
    expect(chart.yAxis[0].categories).toEqual(['Mitarbeiter 1', 'Mitarbeiter 2']);

    act(() => testStore.dispatch(setPrivacyMode(false)));
    chart = getChart();
    expect(chart.yAxis[0].categories).toEqual(['Testperson <A & B>', 'Testperson Z']);
    expect(screen.getByText(/Testkind X/)).toBeInTheDocument();
    act(() => testStore.dispatch(setPrivacyMode(true)));
    chart = getChart();
    expect(chart.yAxis[0].categories).toEqual(['Mitarbeiter 1', 'Mitarbeiter 2']);
    expect(screen.getByText(/Kind 1 \(keine Buchung\)/)).toBeInTheDocument();
    view.unmount();
  }, 45000);

  it('zeichnet Null-Personal in der Heatmap als nicht definiert und meldet die Gruppenquote', () => {
    const hover = vi.fn();
    const groups = [{ id: 'g', name: 'G' }, { id: '__NO_GROUP__', name: 'Keine Gruppe' }];
    const points = [
      { x: 0, y: 0, value: 1, demand: 1, capacityPedagogical: 1, careRatio: 1, expertRatio: 100 },
      { x: 0, y: 1, value: null, demand: 2, capacityPedagogical: 0, careRatio: null, expertRatio: null },
    ];
    const view = render(<MantineProvider><CoverageHeatmap categories={['Mo 8:00']} groups={groups} heatValues={points} mode="unweightedQuotient" onHoverChange={hover} /></MantineProvider>);
    const container = screen.getByTestId('coverage-heatmap');
    const chart = Highcharts.charts.find((entry) => entry && container.contains(entry.renderTo));
    expect(chart.yAxis[0].categories).toEqual(['G', 'Keine Gruppe']);
    const noStaff = chart.series[0].points.find((point) => point.y === 1);
    expect(noStaff.value).toBeNull();
    expect(chart.options.tooltip.formatter.call({ point: noStaff })).toContain('Nicht definiert');
    chart.options.series[0].point.events.mouseOver.call(noStaff);
    expect(hover).toHaveBeenLastCalledWith(expect.objectContaining({ demand: 2, careRatio: null, expertRatio: null }));
    chart.options.series[0].point.events.mouseOver.call(chart.series[0].points.find((point) => point.y === 0));
    expect(hover).toHaveBeenLastCalledWith(expect.objectContaining({ expertRatio: 100 }));
    view.unmount();
  });
  it('zeigt Kinderstunden getrennt und berechnet Personalbedarf nur mit Modellannahme', async () => {
    const times = [{ day_name: 'Mo', segments: [
      { booking_start: '06:30', booking_end: '07:00', category: 'pedagogical' },
      { booking_start: '08:00', booking_end: '09:00', category: 'pedagogical' },
      { booking_start: '17:00', booking_end: '18:00', category: 'pedagogical' },
    ] }];
    const testStore = createAppStore({ preloadedState: {
      simScenario: { scenarios: [{ id: 'base' }], selectedScenarioId: 'base', selectedItems: {} },
      simData: { dataByScenario: { base: { child: { id: 'child', type: 'demand', groupId: 'g' }, staff: { id: 'staff', type: 'capacity', groupId: 'g' } } } },
      simBooking: { bookingsByScenario: { base: { child: { b: { id: 'b', times } }, staff: { b: { id: 'b', times } } } } },
      simGroup: { groupDefsByScenario: { base: [{ id: 'g', name: 'G' }] }, groupsByScenario: {} },
    } });
    testStore.dispatch(setReferenceDate({ scenarioId: 'base', date: '2026-12-15' }));
    const view = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    fireEvent.click(screen.getByTestId('story-step-status'));
    await waitFor(() => expect(financeKpi('Pädagogische Kapazität (Modell-FTE)')).toHaveTextContent('1.0 Kinderstunden/Woche'), { timeout: 15000 });
    const card = financeKpi('Pädagogische Kapazität (Modell-FTE)');
    expect(card).toHaveAttribute('data-tone', 'neutral');
    expect(card).toHaveTextContent('1.0 päd. Personalstunden/Woche');
    expect(card).toHaveTextContent('Kein Modell-Personalbedarf ohne Schlüssel');
    expect(screen.getByTestId('coverage-model-basis')).toHaveTextContent('keine Rechtsvorgabe oder Rechtsprüfung');
    expect(screen.getByTestId('coverage-model-basis')).toHaveTextContent('7:00 bis 17:00 Uhr (Ende ausgeschlossen)');
    expect(screen.getByTestId('coverage-model-basis')).toHaveTextContent('Belegungsstand am Slotbeginn');
    fireEvent.change(screen.getByLabelText('Modell-Betreuungsschlüssel (Kinder je päd. Kraft)'), { target: { value: '2' } });
    await waitFor(() => expect(card).toHaveTextContent('Modell-Personalbedarf 0.01 FTE'), { timeout: 15000 });
    fireEvent.change(screen.getByLabelText('Modell-Betreuungsschlüssel (Kinder je päd. Kraft)'), { target: { value: '' } });
    await waitFor(() => expect(card).toHaveTextContent('Kein Modell-Personalbedarf ohne Schlüssel'), { timeout: 15000 });
    view.unmount();
  }, 30000);

  it('berechnet die Resilienz mit 100 Läufen und zeigt die Modellgrenzen', async () => {
    const times = [{ day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '09:00', category: 'pedagogical' }] }];
    const testStore = createAppStore({ preloadedState: {
      simScenario: { scenarios: [{ id: 'base' }], selectedScenarioId: 'base', selectedItems: {} },
      simData: { dataByScenario: { base: {
        child: { id: 'child', type: 'demand', groupId: 'g' },
        staff: { id: 'staff', type: 'capacity', groupId: 'g' },
      } } },
      simBooking: { bookingsByScenario: { base: {
        child: { b: { id: 'b', times } }, staff: { b: { id: 'b', times } },
      } } },
      simGroup: { groupDefsByScenario: { base: [{ id: 'g', name: 'G' }] }, groupsByScenario: {} },
    } });
    testStore.dispatch(setReferenceDate({ scenarioId: 'base', date: '2026-12-15' }));
    const view = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    fireEvent.click(screen.getByTestId('story-step-transitions'));
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    fireEvent.change(await screen.findByLabelText('Läufe'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Simulationswochen'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Basis-Ausfallwahrscheinlichkeit pro Person und Betriebstag (%)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Mindest-Fachkräftequote (%)'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    await waitFor(() => expect(screen.getByText('100 Läufe')).toBeInTheDocument(), { timeout: 30000 });
    expect(screen.getByTestId('analysis-resilience-basis')).toHaveTextContent('keine Prognose oder Rechtsprüfung');
    expect(screen.getByTestId('analysis-resilience-basis')).toHaveTextContent('7:00 bis 17:00 Uhr (Ende ausgeschlossen)');
    expect(screen.getByText(/Basis-Ausfall 0\.0%/)).toBeInTheDocument();
    expect(within(financeKpi('Schließungsrate')).getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText(/Bedarfs- oder pädagogische Personalbuchungen fehlen/)).not.toBeInTheDocument();
    view.unmount();
  }, 40000);

  it('wertet Buchungen ab 17 Uhr nicht als Resilienz-Daten im Modellzeitfenster', async () => {
    const times = [{ day_name: 'Mo', segments: [{ booking_start: '17:00', booking_end: '18:00', category: 'pedagogical' }] }];
    const testStore = createAppStore({ preloadedState: {
      simScenario: { scenarios: [{ id: 'base' }], selectedScenarioId: 'base', selectedItems: {} },
      simData: { dataByScenario: { base: { child: { id: 'child', type: 'demand', groupId: 'g' }, staff: { id: 'staff', type: 'capacity', groupId: 'g' } } } },
      simBooking: { bookingsByScenario: { base: { child: { b: { id: 'b', times } }, staff: { b: { id: 'b', times } } } } },
      simGroup: { groupDefsByScenario: { base: [{ id: 'g', name: 'G' }] }, groupsByScenario: {} },
    } });
    testStore.dispatch(setReferenceDate({ scenarioId: 'base', date: '2026-12-15' }));
    const view = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    fireEvent.click(screen.getByTestId('story-step-transitions'));
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    fireEvent.change(await screen.findByLabelText('Läufe'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Simulationswochen'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    await waitFor(() => expect(screen.getByTestId('analysis-resilience-basis')).toHaveTextContent('Im betrachteten Zeitfenster fehlen Bedarfs- oder pädagogische Personalbuchungen'), { timeout: 30000 });
    expect(financeKpi('Resilienz-Score')).toHaveTextContent('Keine Daten');
    view.unmount();
  }, 40000);

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

    fireEvent.click(screen.getByTestId('story-step-compare'));
    expect(await screen.findByLabelText('Stichtagszählung')).toBeInTheDocument();
    expect(screen.getByText(/Einschulung ohne Zuordnung bleibt ungeklärt/)).toBeInTheDocument();
    expect(screen.getByText(/Sankey und Stufenverlauf zeigen den Stichtagsbestand, bekannte spätere Aufnahmen/)).toBeInTheDocument();
    expect(screen.getByText(/Auffüllen berücksichtigt alle bekannten Kinder der gesamten Einrichtung/)).toBeInTheDocument();
    expect(screen.getByText(/Unbekannte Änderungen werden nicht prognostiziert/)).toBeInTheDocument();
    expect(screen.getByText(/Kinder am Stichtag; spätere Aufnahmen erscheinen im Sankey/)).toBeInTheDocument();
    expect(screen.queryByText(/spätere Aufnahmen sind nur im Stufenverlauf enthalten/)).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Zulauf im Stufenverlauf simulieren' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'Zulauf im Stufenverlauf simulieren' }));
    expect(screen.getByRole('switch', { name: 'Zulauf im Stufenverlauf simulieren' })).toBeChecked();

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

  it('zeigt ADEBIS-Monatsanfänge und summiert den Finanzverlauf über die gesamte Einrichtung', async () => {
    const testStore = createFinanceTestStore();
    testStore.dispatch(setFilterGroups({ scenarioId: 'base', groups: ['g'] }));
    const { unmount } = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    fireEvent.click(screen.getByTestId('story-step-cohort'));
    await waitFor(() => expect(financeChart()?.series[0]?.options.data).toHaveLength(12), { timeout: 15000 });
    const chart = financeChart();
    expect(chart.series[0].options.data).toEqual([500, 500, 500, 500, 500, 500, 900, 1750, 1750, 1750, 1750, 1750]);
    expect(chart.series[1].options.data).toEqual(Array(12).fill(1000));
    expect(chart.series[2].options.data).toEqual([-500, -500, -500, -500, -500, -500, -100, 750, 750, 750, 750, 750]);
    expect(within(financeKpi('Saldo 12 Monate')).getByText('650 EUR')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-finance-basis')).toHaveTextContent('Gruppen- und Qualifikationsfilter gelten hier nicht');
    expect(screen.getByTestId('analysis-finance-basis')).toHaveTextContent('ohne Sachkosten');
    fireEvent.click(screen.getByTestId('analysis-filter-toggle'));
    expect(await screen.findByText(/Der Finanzverlauf zeigt die gesamte Einrichtung/)).toBeInTheDocument();
    unmount();
  }, 20000);

  it('unterdrückt die 12-Monats-Summe auch bei einer Lücke nur in früheren Monaten', async () => {
    const testStore = createFinanceTestStore();
    testStore.dispatch(updateBayKiBiGRule({ scenarioId: 'base', ruleId: 'first', updates: { baseValue: '' } }));
    const { unmount } = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    fireEvent.click(screen.getByTestId('story-step-cohort'));
    await waitFor(() => expect(financeChart()?.series[0]?.options.data).toHaveLength(12), { timeout: 15000 });
    expect(financeChart().series[2].options.data).toEqual([null, null, null, null, null, null, -100, 750, 750, 750, 750, 750]);
    expect(within(financeKpi('Saldo 12 Monate')).getByText('Ungeklärt')).toBeInTheDocument();
    expect(within(financeKpi('Kostendeckungsgrad')).getByText('175.0%')).toBeInTheDocument();
    unmount();
  }, 20000);

  it('zeigt ausdrücklich erfasste Nullwerte und vermeidet Division durch null', async () => {
    const testStore = createFinanceTestStore();
    testStore.dispatch(updatePersonnelCostEntry({ scenarioId: 'base', itemId: 'staff', entryId: 'cost', updates: { annualGrossSalary: 0 } }));
    testStore.dispatch(updateGroupFeeEntry({ scenarioId: 'base', groupId: 'g', entryId: 'g-fee', updates: { monthlyAmount: 0 } }));
    testStore.dispatch(updateGroupFeeEntry({ scenarioId: 'base', groupId: 'h', entryId: 'h-fee', updates: { monthlyAmount: 0 } }));
    const { unmount } = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    fireEvent.click(screen.getByTestId('story-step-cohort'));
    await waitFor(() => expect(financeChart()?.series[0]?.options.data).toHaveLength(12), { timeout: 15000 });
    expect(financeChart().series[1].options.data).toEqual(Array(12).fill(0));
    expect(within(financeKpi('Saldo 12 Monate')).getByText('10450 EUR')).toBeInTheDocument();
    expect(within(financeKpi('Kostendeckungsgrad')).getByText('Nicht berechenbar')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-finance-basis')).not.toHaveTextContent('Ungeklärt: Einnahmen');
    unmount();
  }, 20000);

  it.each([
    ['Förderregel', updateBayKiBiGRule({ scenarioId: 'base', ruleId: 'second', updates: { baseValue: '' } }), 6, 0],
    ['Tarif', updateGroupFeeEntry({ scenarioId: 'base', groupId: 'g', entryId: 'g-fee', updates: { enabled: false } }), 12, 0],
    ['Personalkosten', updatePersonnelCostEntry({ scenarioId: 'base', itemId: 'staff', entryId: 'cost', updates: { employerOnCostPercent: '' } }), 0, 12],
  ])('kennzeichnet fehlende %s im Diagramm und im 12-Monats-Saldo', async (_label, action, missingIncome, missingExpenses) => {
    const testStore = createFinanceTestStore();
    testStore.dispatch(action);
    const { unmount } = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
    fireEvent.click(screen.getByTestId('story-step-cohort'));
    await waitFor(() => expect(financeChart()?.series[0]?.options.data).toHaveLength(12), { timeout: 15000 });
    const chart = financeChart();
    expect(chart.series[0].options.data.filter((value) => value == null)).toHaveLength(missingIncome);
    expect(chart.series[1].options.data.filter((value) => value == null)).toHaveLength(missingExpenses);
    expect(chart.series[2].options.data.filter((value) => value == null)).toHaveLength(Math.max(missingIncome, missingExpenses));
    expect(within(financeKpi('Saldo 12 Monate')).getByText('Ungeklärt')).toBeInTheDocument();
    expect(within(financeKpi('Kostendeckungsgrad')).getByText('Ungeklärt')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-finance-basis')).toHaveTextContent(`Einnahmen in ${missingIncome} und Personalkosten in ${missingExpenses} Monaten`);
    unmount();
  }, 20000);

  it('beschreibt die tatsächliche Zulaufstichprobe und den Gruppenfilter', async () => {
    const inflowSpy = vi.spyOn(forecastUtils, 'buildForecastModel');
    try {
      const testStore = createAppStore({ preloadedState: {
        simScenario: { scenarios: [{ id: 'base' }], selectedScenarioId: 'base', selectedItems: {} },
        simData: { dataByScenario: { base: {
          a: { id: 'a', type: 'demand', startdate: '2024-01-01', enddate: '2024-12-31' },
          b: { id: 'b', type: 'demand', startdate: '2026-01-01' },
          archived: { id: 'archived', type: 'demand', startdate: '2023-01-01', archived: true },
          cancelled: { id: 'cancelled', type: 'demand', startdate: '2022-01-01', rawdata: { STATUS: '-' } },
          future: { id: 'future', type: 'demand', startdate: '2027-01-01' },
          undated: { id: 'undated', type: 'demand' },
        } } },
      } });
      testStore.dispatch(setReferenceDate({ scenarioId: 'base', date: '2026-03-15' }));
      testStore.dispatch(setFilterGroups({ scenarioId: 'base', groups: ['__NO_GROUP__'] }));
      const { unmount } = render(<Provider store={testStore}><MantineProvider><VisuView /></MantineProvider></Provider>);
      fireEvent.click(screen.getByTestId('story-step-compare'));
      const basis = await screen.findByTestId('forecast-inflow-basis');
      expect(basis).toHaveTextContent('2 Aufnahmedatensätze in 2 Jahren; gerundetes Mittel 1 pro Jahr');
      expect(basis).toHaveTextContent('archivierte und andere Status sind ausgeschlossen');
      expect(basis).toHaveTextContent('Jahre ohne berücksichtigte Aufnahmen zählen nicht');
      expect(basis).toHaveTextContent('Datensätze werden nicht auf doppelte Aufnahmen geprüft');
      fireEvent.click(screen.getByRole('switch', { name: 'Zulauf im Stufenverlauf simulieren' }));
      expect(basis).toHaveTextContent('Bei aktivem Gruppenfilter wird kein Zulauf simuliert');
      expect(inflowSpy.mock.lastCall[0].inflow).toEqual([]);
      fireEvent.click(screen.getByRole('button', { name: 'Gruppenfilter leeren' }));
      expect(testStore.getState().chart.base.filter.Groups).toEqual([]);
      expect(screen.getByTestId('forecast-group-filter-status')).toHaveTextContent('Alle Gruppen (kein Filter)');
      expect(basis).toHaveTextContent('Zulaufschätzung eingeschaltet');
      expect(inflowSpy.mock.lastCall[0].inflow).toHaveLength(5);
      expect(inflowSpy.mock.lastCall[0].inflow[0].startdate).toBe('2028-09-01');
      act(() => testStore.dispatch(setFilterGroups({ scenarioId: 'base', groups: ['__NO_GROUP__'] })));
      expect(basis).toHaveTextContent('Bei aktivem Gruppenfilter wird kein Zulauf simuliert');
      expect(inflowSpy.mock.lastCall[0].inflow).toEqual([]);
      fireEvent.click(screen.getByRole('button', { name: 'Gruppenfilter leeren' }));
      fireEvent.click(screen.getByRole('switch', { name: 'Zulauf im Stufenverlauf simulieren' }));
      expect(inflowSpy.mock.lastCall[0].inflow).toEqual([]);
      expect(basis).toHaveTextContent('Zulaufschätzung ausgeschaltet');
      fireEvent.click(screen.getByTestId('story-step-status'));
      expect(testStore.getState().chart.base.filter.Groups).toEqual([]);
      fireEvent.click(screen.getByTestId('story-step-compare'));
      expect(testStore.getState().chart.base.filter.Groups).toEqual([]);
      act(() => testStore.dispatch(setReferenceDate({ scenarioId: 'base', date: '2021-01-01' })));
      expect(await screen.findByTestId('forecast-inflow-basis')).toHaveTextContent('keine berücksichtigten Aufnahmedatensätze; kein Mittel berechenbar');
      unmount();
    } finally {
      inflowSpy.mockRestore();
    }
  });

  it('passes effective overlay bookings to the forecast and warns when overlay semantics differ', async () => {
    const buildSpy = vi.spyOn(forecastUtils, 'buildForecastModel');
    try {
      const testStore = createAppStore({ preloadedState: {
        simScenario: { scenarios: [{ id: 'base' }, { id: 'scenario', baseScenarioId: 'base' }], selectedScenarioId: 'scenario', selectedItems: {} },
        simData: { dataByScenario: { base: { a: { id: 'a', name: 'Anna', type: 'demand', groupId: 'g' } } } },
        simGroup: { groupDefsByScenario: { base: [{ id: 'g', type: 'Krippe' }] }, groupsByScenario: {} },
        simBooking: { bookingsByScenario: { base: { a: { old: { id: 'old', rawdata: { BETRSTD: '10' } } } } } },
        simOverlay: { overlaysByScenario: { scenario: { bookings: { a: {
          current: { id: 'current', enddate: '2026-02-28', rawdata: { BETRSTD: '25,5' } },
          next: { id: 'next', startdate: '2026-03-01', rawdata: { BETRSTD: '30' } },
          alternative: { id: 'alternative', rawdata: { ART: 'A', BETRSTD: '80' } },
        } } } } },
      } });
      testStore.dispatch(setReferenceDate({ scenarioId: 'scenario', date: '2026-01-01' }));
      await Promise.resolve();
      const { unmount } = render(
        <Provider store={testStore}>
          <MantineProvider><VisuView /></MantineProvider>
        </Provider>
      );
      const result = buildSpy.mock.results.at(-1).value;
      const krippe = result.groupTimeline.seriesByGroup.find((row) => row.groupId === 'krippe');
      expect(result.groupTimeline.dates).toEqual(['2026-01-01', '2026-03-01']);
      expect(krippe.hoursData).toEqual([25.5, 30]);
      fireEvent.click(screen.getByTestId('story-step-compare'));
      expect(screen.getByTestId('forecast-events-unavailable')).toHaveTextContent('Abweichende Overlay-Auflösung');
      act(() => testStore.dispatch(setSelectedScenarioId('base')));
      expect(screen.queryByTestId('forecast-events-unavailable')).not.toBeInTheDocument();
      act(() => testStore.dispatch(setSelectedScenarioId('scenario')));
      expect(screen.getByTestId('forecast-events-unavailable')).toHaveTextContent('Abweichende Overlay-Auflösung');
      unmount();
    } finally {
      buildSpy.mockRestore();
    }
  });
});
