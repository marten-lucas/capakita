import { useMemo, useCallback } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';


export default function WeeklyChart({ scenario }) {
  const chartSelectedScenarioId = useSelector(state => state.chart.weeklySelectedScenarioId);
  const scenarios = useSelector(state => state.simScenario.scenarios);

  // Get effective simulationData for selected scenario (overlay-aware)
  const simulationData = useMemo(() => {
    let scenarioToUse = scenario;
    if (!scenarioToUse) {
      scenarioToUse = scenarios.find(s => s.id === chartSelectedScenarioId);
    }
    if (!scenarioToUse) return [];
    if (!scenarioToUse.baseScenarioId) {
      return scenarioToUse.simulationData ?? [];
    }
    // If you have a selector or utility for overlay data, use it here
    // return computeOverlayData(scenarioToUse);
    return scenarioToUse.simulationData ?? [];
  }, [scenario, scenarios, chartSelectedScenarioId]);

  // Get current filters from chartSlice
  const stichtag = useSelector(state => state.chart.stichtag);
  const selectedGroups = useSelector(state => state.chart.selectedGroups);
  const selectedQualifications = useSelector(state => state.chart.selectedQualifications);
  const categories = useSelector(state => state.chart.categories);
  // If you have selectors for calculateChartData and getNamesForSegment, use them here
  // For now, assume they are utility functions or props

  // Stable reference for chart data calculation
  const getChartData = useCallback((stichtag, selectedGroups, selectedQualifications) => {
    return calculateChartData(simulationData, stichtag, selectedGroups, selectedQualifications);
  }, [simulationData, calculateChartData]);

  // Chart data recalculates when filters change
  const chartData = useMemo(() =>
    getChartData(stichtag, selectedGroups, selectedQualifications),
    [getChartData, stichtag, selectedGroups, selectedQualifications]
  );

  // Optimized: Only recalculate when chartData changes
  const weeklyOptions = useMemo(() => ({
    chart: { type: 'line' },
    title: { text: 'Weekly Simulation' },
    xAxis: {
      categories,
      title: { text: 'Zeit' },
      labels: { 
        step: 1,
        formatter: function() {
          const [, time] = this.value.split(' ');
          // Zeige nur Labels für 7:00, 9:00, 11:00, 13:00, 15:00
          if (time === '7:00' || time === '9:00' || time === '11:00' || time === '13:00' || time === '15:00') {
            return time;
          }
          return '';
        }
      },
      plotBands: [
        // Bereiche für die Wochentage
        {
          from: 0,
          to: 20.99, // 21 Segmente pro Tag (7:00-17:00)
          color: 'rgba(120,144,156,0.1)', // Blaugrau
          label: { text: 'Mo', style: { color: '#666' } }
        },
        {
          from: 21,
          to: 41.99,
          color: 'rgba(158,158,158,0.1)', // Grau
          label: { text: 'Di', style: { color: '#666' } }
        },
        {
          from: 42,
          to: 62.99,
          color: 'rgba(120,144,156,0.1)', // Blaugrau
          label: { text: 'Mi', style: { color: '#666' } }
        },
        {
          from: 63,
          to: 83.99,
          color: 'rgba(158,158,158,0.1)', // Grau
          label: { text: 'Do', style: { color: '#666' } }
        },
        {
          from: 84,
          to: 104.99,
          color: 'rgba(120,144,156,0.1)', // Blaugrau
          label: { text: 'Fr', style: { color: '#666' } }
        }
      ]
    },
    yAxis: [
      { // Sekundär 1: Bedarf
        title: { text: 'Bedarf (Kinder)' },
        min: 0,
        max: null, // automatisch skalieren
        tickInterval: 5,
        opposite: false,
        gridLineWidth: 1 // Guides für Bedarf
      },
      { // Sekundär 2: Kapazität
        title: { text: 'Kapazität (Mitarbeiter)' },
        min: 0,
        max: chartData.maxKapazitaet,
        tickInterval: 1, // Guides wie Bedarf, aber Faktor 1
        opposite: false,
        gridLineWidth: 1 // Guides wie Bedarf
      },
      { // Sekundär 3: BayKiBig Anstellungsschlüssel
        title: { text: 'BayKiBig Anstellungsschlüssel (Nenner)' },
        min: 0,
        max: chartData.maxAnstellungsschluessel,
        tickInterval: null, // automatisch skalieren
        opposite: true,
        gridLineWidth: 0
      },
      { // Sekundär 4: Fachkraftquote in Prozent
        title: { text: 'Fachkraftquote (%)' },
        min: 0,
        max: chartData.maxFachkraftquote,
        tickInterval: 10,
        opposite: true,
        gridLineWidth: 0
      }
    ],
    series: [
      {
        name: 'Bedarf',
        type: 'area',
        data: chartData.bedarf,
        yAxis: 0,
        color: 'rgba(124,181,236,0.5)',
        fillOpacity: 0.3,
        marker: { enabled: false }
      },
      {
        name: 'Kapazität',
        type: 'column',
        data: chartData.kapazitaet,
        yAxis: 1,
        color: '#90ed7d'
      },
      {
        name: 'BayKiBig Anstellungsschlüssel',
        type: 'line',
        data: chartData.baykibigAnstellungsschluessel?.map(item => {
          if (!item || item.totalBookingHours === 0) return 0;
          // Berechne den Nenner: totalBookingHours / totalStaffHours
          return item.totalStaffHours > 0 ? item.totalBookingHours / item.totalStaffHours : 0;
        }),
        yAxis: 2,
        color: '#f45b5b',
        marker: { enabled: false }
      },
      {
        name: 'BayKiBig Fachkraftquote',
        type: 'line',
        data: chartData.baykibigAnstellungsschluessel?.map(item => {
          return item?.fachkraftQuotePercent || 0;
        }),
        yAxis: 3,
        color: '#ff9800',
        marker: { enabled: false }
      }
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () {
        let s = `<b>${this.x}</b><br/>`;
        this.points.forEach(point => {
          if (point.series.name.includes('BayKiBig')) {
            const baykibigData = chartData.baykibigAnstellungsschluessel[point.point.index];
            if (baykibigData) {
              if (point.series.name.includes('Anstellungsschlüssel')) {
                const schluessel = baykibigData.totalStaffHours > 0 ? baykibigData.totalBookingHours / baykibigData.totalStaffHours : 0;
                s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> 1:${schluessel.toFixed(1)}<br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Buchungsstunden: ${baykibigData.totalBookingHours.toFixed(1)}h, Personalstunden: ${baykibigData.totalStaffHours.toFixed(1)}h</span><br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Erforderlich: 1:11 oder besser</span><br/>`;
              }
              if (point.series.name.includes('Fachkraftquote')) {
                s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${baykibigData.fachkraftQuotePercent.toFixed(1)}%<br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Fachkräfte: ${baykibigData.fachkraftCount}, Gesamt: ${baykibigData.totalStaffCount}</span><br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Erforderlich: 50% oder mehr</span><br/>`;
              }
            }
          } else {
            let names = getNamesForSegment(simulationData, point.point.index, point.series.name);
            if (names.length > 0) {
              s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
              s += `<span style="margin-left:16px;font-size:0.95em;">${names.join(', ')}</span><br/>`;
            } else {
              s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
            }
          }
        });
        return s;
      }
    }
  }), [chartData, categories, simulationData, getNamesForSegment]);

  // Material UI Filterformular
  return (
    <Box sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* ChartFilterForm removed; now rendered in DataPage */}
      {/* Chart */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <HighchartsReact highcharts={Highcharts} options={weeklyOptions} />
      </Box>
    </Box>
  );
}