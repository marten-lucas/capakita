import React from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Group,
  HoverCard,
  Modal,
  Paper,
  RingProgress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import Highcharts from 'highcharts';
import HighchartsHeatmap from 'highcharts/modules/heatmap';
import HighchartsSankey from 'highcharts/modules/sankey';
import HighchartsReact from 'highcharts-react-official';
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm';
import WeeklyChart from '../components/SimDataCharts/WeeklyChart';
import { useDispatch, useSelector } from 'react-redux';
import { setActivePage } from '../store/uiSlice';
import { setSelectedItem, setSelectedItems } from '../store/simScenarioSlice';
import { ensureScenario } from '../store/chartSlice';
import { useOverlayData } from '../hooks/useOverlayData';
import { calculateScenarioMonthlyFinance, isRecordActiveOnDate, resolveGroupIdAtDate } from '../utils/financeUtils';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { filterBookings } from '../utils/chartUtils/chartUtils';
import { generateBookingDataSeries, generateTimeSegments, formatWeeklyAxisLabel } from '../utils/chartUtils/chartUtilsWeekly';
import {
  IconChevronLeft,
  IconChevronRight,
  IconInfoCircle,
  IconCircleCheck,
  IconAlertTriangle,
  IconAlertOctagon,
  IconArrowsSplit,
  IconChartHistogram,
  IconClockHour4,
  IconPlayerPause,
  IconPlayerPlay,
  IconRoute,
} from '@tabler/icons-react';
import './VisuView.css';

const EMPTY_LIST = [];

const ANALYSIS_LOADING_STAGES = [
  {
    key: 'base',
    title: 'Datenbasis',
    message: 'Lade Szenario, Overlays und Stammdaten.',
    weight: 24,
  },
  {
    key: 'coverage',
    title: 'Deckung',
    message: 'Berechne Bedarfs- und Kapazitätsverlauf pro Zeitslot.',
    weight: 26,
  },
  {
    key: 'resilience',
    title: 'Resilienz',
    message: 'Simuliere Ausfälle, Kritikalität und Monte-Carlo-Verteilung.',
    weight: 30,
  },
  {
    key: 'finance',
    title: 'Finanzen',
    message: 'Aggregiere Monatswerte und KPI-Übersicht.',
    weight: 20,
  },
];

function parseIsoDateSafe(dateValue) {
  if (!dateValue) return null;
  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getAgeInMonthsAtDate(dateOfBirth, isoDate) {
  const dob = parseIsoDateSafe(dateOfBirth);
  const at = parseIsoDateSafe(isoDate);
  if (!dob || !at) return null;

  const yearDiff = at.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - dob.getUTCMonth();
  let months = (yearDiff * 12) + monthDiff;
  if (at.getUTCDate() < dob.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function getMedian(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

if (typeof HighchartsHeatmap === 'function') {
  HighchartsHeatmap(Highcharts);
}
if (typeof HighchartsSankey === 'function') {
  HighchartsSankey(Highcharts);
}

const STORY_STEPS = [
  {
    id: 'quality',
    category: '01',
    title: 'Datenqualität',
    subtitle: 'Datenvollständigkeit & Validierung',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
    accent: '#1d4ed8',
    icon: IconAlertTriangle,
    rating: 'warn',
    diagramType: 'Donut-Charts',
  },
  {
    id: 'status',
    category: '02',
    title: 'Bedarfsdeckung',
    subtitle: 'Alltagsdeckung & Akute Engpässe',
    gradient: 'linear-gradient(135deg, #052e16 0%, #0f766e 100%)',
    accent: '#0f766e',
    icon: IconChartHistogram,
    rating: 'good',
    diagramType: '2-Panel Wochenanalyse',
  },
  {
    id: 'transitions',
    category: '03',
    title: 'Resilienz',
    subtitle: 'Personalausfälle & Engpassanalyse',
    gradient: 'linear-gradient(135deg, #312e81 0%, #6d28d9 100%)',
    accent: '#6d28d9',
    icon: IconRoute,
    rating: 'warn',
    diagramType: 'Heatmap + Kritikalitätsranking',
  },
  {
    id: 'cohort',
    category: '04',
    title: 'Finanzen',
    subtitle: 'Monatsverlauf Einnahmen & Ausgaben',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
    accent: '#ea580c',
    icon: IconClockHour4,
    rating: 'good',
    diagramType: 'Monatsverlauf-Chart',
  },
  {
    id: 'compare',
    category: '05',
    title: 'Vorschau',
    subtitle: 'Bevorstehende Personal- & Strukturwechsel',
    gradient: 'linear-gradient(135deg, #4a044e 0%, #be185d 100%)',
    accent: '#be185d',
    icon: IconArrowsSplit,
    rating: 'problem',
    diagramType: 'Gantt-Chart',
  },
  {
    id: 'demography',
    category: '06',
    title: 'Demografie',
    subtitle: 'Kinderstruktur & Belegungs-Prognose',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #2563eb 100%)',
    accent: '#2563eb',
    icon: IconChartHistogram,
    rating: 'warn',
    diagramType: 'Stacked Bar Chart',
  },
  {
    id: 'options',
    category: '07',
    title: 'Optionen-Check',
    subtitle: 'Szenarien-Ranking & Entscheidungshilfe',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)',
    accent: '#7c3aed',
    icon: IconArrowsSplit,
    rating: 'good',
    diagramType: 'Scatter Plot',
  },
  {
    id: 'trends',
    category: '08',
    title: 'Trend-Radar',
    subtitle: 'Historischer Vergleich & Entwicklung',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%)',
    accent: '#0ea5e9',
    icon: IconCircleCheck,
    rating: 'good',
    diagramType: 'Line-Chart',
  },
];

const RATING_ICON_BY_KEY = {
  good: IconCircleCheck,
  warn: IconAlertTriangle,
  problem: IconAlertOctagon,
};

const STAGE_RECOMMENDATIONS_BY_STORY = {
  quality: [
    { title: 'KPI 1', value: '--', text: 'Platzhalter für Fundament-KPI.', tone: 'warn' },
    { title: 'KPI 2', value: '--', text: 'Platzhalter für Vollständigkeit.', tone: 'good' },
    { title: 'KPI 3', value: '--', text: 'Platzhalter für Validierung.', tone: 'warn' },
  ],
  status: [
    { title: 'KPI 1', value: '--', text: 'Platzhalter für Alltagsdeckung.', tone: 'good' },
    { title: 'KPI 2', value: '--', text: 'Platzhalter für Engpass-Signal.', tone: 'warn' },
    { title: 'KPI 3', value: '--', text: 'Platzhalter für Effizienz.', tone: 'good' },
  ],
  transitions: [
    { title: 'KPI 1', value: '--', text: 'Platzhalter für Krisenlimit.', tone: 'warn' },
    { title: 'KPI 2', value: '--', text: 'Platzhalter für Urlaubsregel.', tone: 'warn' },
    { title: 'KPI 3', value: '--', text: 'Platzhalter für Fachkraftquote.', tone: 'problem' },
  ],
  cohort: [
    { title: 'KPI 1', value: '--', text: 'Platzhalter für Rentabilität.', tone: 'warn' },
    { title: 'KPI 2', value: '--', text: 'Platzhalter für Förderpotenzial.', tone: 'good' },
    { title: 'KPI 3', value: '--', text: 'Platzhalter für Leerkosten.', tone: 'warn' },
  ],
  compare: [
    { title: 'KPI 1', value: '--', text: 'Platzhalter für Recruiting-Fokus.', tone: 'good' },
    { title: 'KPI 2', value: '--', text: 'Platzhalter für Überbrückung.', tone: 'warn' },
    { title: 'KPI 3', value: '--', text: 'Platzhalter für Aufnahmestopp.', tone: 'warn' },
  ],
  demography: [
    { title: 'KPI 1', value: '--', text: 'Platzhalter für Nachrücker-Strategie.', tone: 'good' },
    { title: 'KPI 2', value: '--', text: 'Platzhalter für Team-Rotation.', tone: 'warn' },
    { title: 'KPI 3', value: '--', text: 'Platzhalter für Leerstand.', tone: 'warn' },
  ],
  options: [
    { title: 'KPI 1', value: '--', text: 'Platzhalter für Best-Practice.', tone: 'good' },
    { title: 'KPI 2', value: '--', text: 'Platzhalter für Risiko-Warnung.', tone: 'problem' },
    { title: 'KPI 3', value: '--', text: 'Platzhalter für CapaKita-Empfehlung.', tone: 'good' },
  ],
  trends: [
    { title: 'KPI 1', value: '--', text: 'Platzhalter für Buchungstrend.', tone: 'good' },
    { title: 'KPI 2', value: '--', text: 'Platzhalter für Krankheitsquote.', tone: 'warn' },
    { title: 'KPI 3', value: '--', text: 'Platzhalter für Finanz-Trend.', tone: 'problem' },
  ],
};

function DiagramPlaceholder({ story }) {
  return (
    <Paper className="analysis-diagram-placeholder" withBorder p="lg">
      <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
        <Badge variant="light" size="lg" className="analysis-diagram-placeholder-badge">
          {story.diagramType}
        </Badge>
        <Title order={2} className="analysis-diagram-placeholder-title">
          {story.subtitle}
        </Title>
        <Text size="sm" c="dimmed" ta="center" className="analysis-diagram-placeholder-text">
          Diagramm-Platzhalter für {story.title}.
        </Text>
      </Stack>
    </Paper>
  );
}

function QualityDonutChart({ data }) {
  const options = React.useMemo(
    () => ({
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
        spacing: [8, 8, 8, 8],
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        align: 'center',
        verticalAlign: 'bottom',
        itemStyle: { fontSize: '12px' },
      },
      tooltip: {
        pointFormat: '<b>{point.y}</b> ({point.percentage:.1f}%)',
      },
      plotOptions: {
        pie: {
          innerSize: '62%',
          borderRadius: 4,
          dataLabels: {
            enabled: true,
            format: '{point.name}: {point.y}',
            style: { fontSize: '11px' },
          },
        },
        series: {
          animation: false,
        },
      },
      series: [
        {
          type: 'pie',
          name: 'Datensätze',
          data,
        },
      ],
    }),
    [data]
  );

  return (
    <Paper className="analysis-diagram-placeholder analysis-quality-chart" withBorder p="xs">
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
    </Paper>
  );
}

function CoverageHeatmap({ categories, groups, heatValues, accent }) {
  const slotsPerDay = React.useMemo(() => Math.max(Math.floor(categories.length / 5), 0), [categories.length]);
  const dayBands = React.useMemo(() => {
    if (!slotsPerDay) return [];
    return ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((label, idx) => ({
      from: idx * slotsPerDay - 0.5,
      to: ((idx + 1) * slotsPerDay) - 0.5,
      color: idx % 2 === 0 ? 'rgba(241,245,249,0.55)' : 'rgba(226,232,240,0.48)',
      label: { text: label, y: -6, style: { color: '#334155', fontSize: '10px' } },
    }));
  }, [slotsPerDay]);

  const maxAbs = React.useMemo(
    () => Math.max(1, ...heatValues.map(([, , value]) => Math.abs(Number(value) || 0))),
    [heatValues]
  );

  const options = React.useMemo(
    () => ({
      chart: {
        type: 'heatmap',
        backgroundColor: 'transparent',
        spacing: [10, 10, 10, 10],
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        align: 'right',
        verticalAlign: 'middle',
        layout: 'vertical',
        symbolHeight: 120,
      },
      xAxis: {
        categories,
        tickInterval: 2,
        labels: {
          formatter() {
            return formatWeeklyAxisLabel(this.value, categories);
          },
          style: { fontSize: '10px' },
        },
        plotBands: dayBands,
      },
      yAxis: {
        categories: groups.map((group) => group.name),
        title: { text: null },
        reversed: true,
      },
      colorAxis: {
        min: -maxAbs,
        max: maxAbs,
        stops: [
          [0, '#ef4444'],
          [0.5, '#f59e0b'],
          [1, '#7c3aed'],
        ],
      },
      tooltip: {
        formatter() {
          const slot = categories[this.point.x] || '';
          const groupName = groups[this.point.y]?.name || 'Gruppe';
          const delta = Number(this.point.value || 0);
          const state = delta < 0 ? 'Unterdeckung' : delta > 0 ? 'Überdeckung' : 'ausgeglichen';
          return `<b>${groupName}</b><br/>${slot}<br/>Delta: <b>${delta.toFixed(1)}</b> (${state})`;
        },
      },
      series: [
        {
          type: 'heatmap',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.6)',
          data: heatValues,
          nullColor: 'rgba(226,232,240,0.5)',
          states: {
            hover: {
              borderColor: accent,
              borderWidth: 1.5,
            },
          },
        },
      ],
    }),
    [accent, categories, dayBands, groups, heatValues, maxAbs]
  );

  return (
    <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel">
      <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>
        Gruppen-Heatmap (Unterdeckung bis Überdeckung)
      </Text>
      <Box h={220}>
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Paper>
  );
}

function CriticalityRankingChart({ ranking, accent }) {
  const categories = ranking.map((entry) => entry.name);
  const seriesData = ranking.map((entry) => Number(entry.impactMinutes || 0));

  const options = React.useMemo(
    () => ({
      chart: {
        type: 'bar',
        backgroundColor: 'transparent',
        spacing: [8, 8, 8, 8],
      },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        categories,
        title: { text: null },
        labels: { style: { fontSize: '10px' } },
      },
      yAxis: {
        min: 0,
        title: { text: 'Zusätzliche Unterdeckung (Min.)', style: { fontSize: '11px' } },
      },
      tooltip: {
        formatter() {
          const row = ranking[this.point.index];
          if (!row) return '';
          return `<b>${row.name}</b><br/>Zusätzliche Unterdeckung: <b>${row.impactMinutes.toFixed(1)} Min.</b><br/>Angebotsverlust: <b>${row.offerLossPct.toFixed(1)}%</b>`;
        },
      },
      legend: { enabled: false },
      plotOptions: {
        series: {
          animation: false,
          borderRadius: 3,
          color: accent,
        },
      },
      series: [
        {
          type: 'bar',
          name: 'Kritikalität',
          data: seriesData,
        },
      ],
    }),
    [accent, categories, ranking, seriesData]
  );

  if (!ranking.length) {
    return (
      <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel">
        <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>
          Kritikalitäts-Ranking
        </Text>
        <Text size="sm" c="dimmed">
          Keine Kapazitätseinträge für Ausfallsimulation vorhanden.
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel">
      <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>
        Kritikalitäts-Ranking (Top-Ausfälle)
      </Text>
      <Box h={220}>
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Paper>
  );
}

function MonteCarloResultPanel({ monteCarlo }) {
  const distribution = monteCarlo?.undercoverageMinutes || [];
  const hasData = distribution.length > 0;

  return (
    <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel">
      <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>
        Monte-Carlo-Ergebnis
      </Text>
      {!hasData ? (
        <Text size="sm" c="dimmed">Keine Simulationsergebnisse verfügbar.</Text>
      ) : (
        <Stack gap={4}>
          <Text size="sm">Läufe: <b>{monteCarlo.runs}</b></Text>
          <Text size="sm">Wahrscheinlichkeit Angebotsreduktion: <b>{monteCarlo.reductionProbabilityPct.toFixed(1)}%</b></Text>
          <Text size="sm">Ø Unterdeckung: <b>{monteCarlo.meanUndercoverageMinutes.toFixed(0)} Min.</b></Text>
          <Text size="sm">P95 Unterdeckung: <b>{monteCarlo.p95UndercoverageMinutes.toFixed(0)} Min.</b></Text>
          <Text size="xs" c="dimmed">
            Parameter: {monteCarlo.absenceRatePct}% Ausfallrate, max. {monteCarlo.maxConcurrentOutages} gleichzeitige Ausfälle
          </Text>
        </Stack>
      )}
    </Paper>
  );
}

function ResilienceCompositeChart({ categories, groups, heatValues, ranking, accent, monteCarlo }) {
  return (
    <Box className="analysis-resilience-chart-wrap">
      <CoverageHeatmap categories={categories} groups={groups} heatValues={heatValues} accent={accent} />
      <Stack gap="xs" className="analysis-resilience-right-column">
        <CriticalityRankingChart ranking={ranking} accent={accent} />
        <MonteCarloResultPanel monteCarlo={monteCarlo} />
      </Stack>
    </Box>
  );
}

function FinanceTrendChart({ financeTrend, accent }) {
  const options = React.useMemo(
    () => {
      const categories = financeTrend?.categories || [];
      const incomeSeries = financeTrend?.income || [];
      const expenseSeries = financeTrend?.expenses || [];
      const netSeries = financeTrend?.net || [];

      return {
        chart: {
          backgroundColor: 'transparent',
          spacing: [8, 8, 8, 8],
        },
        title: { text: null },
        credits: { enabled: false },
        xAxis: {
          categories,
          labels: { style: { fontSize: '10px' } },
        },
        yAxis: {
          title: { text: 'EUR / Monat', style: { fontSize: '11px' } },
          labels: {
            formatter() {
              return `${Math.round(Number(this.value || 0))} EUR`;
            },
          },
        },
        tooltip: {
          shared: true,
          valueDecimals: 0,
          valueSuffix: ' EUR',
        },
        legend: {
          align: 'center',
          verticalAlign: 'bottom',
        },
        plotOptions: {
          series: {
            animation: false,
          },
        },
        series: [
          {
            type: 'column',
            name: 'Einnahmen',
            data: incomeSeries,
            color: '#16a34a',
          },
          {
            type: 'column',
            name: 'Ausgaben',
            data: expenseSeries,
            color: '#dc2626',
          },
          {
            type: 'line',
            name: 'Saldo',
            data: netSeries,
            color: accent,
            marker: { enabled: false },
            lineWidth: 2,
          },
        ],
      };
    },
    [accent, financeTrend]
  );

  return (
    <Paper className="analysis-diagram-placeholder analysis-finance-chart" withBorder p="xs">
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
    </Paper>
  );
}

function PreviewSankeyChart({ previewFlow, accent }) {
  const hasData = (previewFlow?.links || []).length > 0;

  const options = React.useMemo(
    () => {
      const links = previewFlow?.links || [];
      return {
        chart: {
          backgroundColor: 'transparent',
          spacing: [8, 8, 8, 8],
        },
        title: { text: null },
        credits: { enabled: false },
        tooltip: {
          pointFormat: '<b>{point.fromNode.name}</b> -> <b>{point.toNode.name}</b>: <b>{point.weight}</b>',
        },
        plotOptions: {
          series: {
            animation: false,
          },
          sankey: {
            nodePadding: 14,
            nodeWidth: 18,
            curveFactor: 0.45,
            states: {
              inactive: {
                opacity: 0.35,
              },
            },
          },
        },
        series: [
          {
            type: 'sankey',
            name: 'Absehbare Verschiebungen',
            data: links,
            colorByPoint: false,
            colors: [accent],
            dataLabels: {
              enabled: true,
              nodeFormatter() {
                return this.name;
              },
              style: { fontSize: '10px', textOutline: 'none' },
            },
          },
        ],
      };
    },
    [accent, previewFlow]
  );

  if (!hasData) {
    return (
      <Paper className="analysis-diagram-placeholder" withBorder p="lg">
        <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
          <Badge variant="light" size="lg" className="analysis-diagram-placeholder-badge">
            Sankey-Chart
          </Badge>
          <Title order={3} className="analysis-diagram-placeholder-title">
            Vorschau Gruppenverschiebungen
          </Title>
          <Text size="sm" c="dimmed" ta="center" className="analysis-diagram-placeholder-text">
            Für den gewählten Zeitraum sind keine absehbaren Verschiebungen vorhanden.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="analysis-diagram-placeholder" withBorder p="xs">
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
    </Paper>
  );
}

function DemographyAgeChart({ demographyData, accent }) {
  const snapshots = demographyData?.snapshots || [];
  const [frameIndex, setFrameIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const hasData = snapshots.length > 0;

  React.useEffect(() => {
    setFrameIndex(0);
    setIsPlaying(false);
  }, [demographyData]);

  React.useEffect(() => {
    if (!isPlaying || snapshots.length <= 1) return undefined;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % snapshots.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, snapshots.length]);

  const activeSnapshot = snapshots[frameIndex] || null;

  const options = React.useMemo(
    () => {
      const categories = demographyData?.categories || [];
      return {
        chart: {
          type: 'column',
          backgroundColor: 'transparent',
          spacing: [8, 8, 8, 8],
        },
        title: { text: null },
        credits: { enabled: false },
        xAxis: {
          categories,
          title: { text: null },
        },
        yAxis: {
          min: 0,
          allowDecimals: false,
          title: { text: 'Kinder', style: { fontSize: '11px' } },
        },
        tooltip: {
          pointFormat: '<b>{point.y}</b> Kinder',
        },
        legend: { enabled: false },
        plotOptions: {
          series: {
            animation: false,
            borderRadius: 3,
          },
        },
        series: [
          {
            type: 'column',
            name: 'Altersverteilung',
            data: activeSnapshot?.counts || categories.map(() => 0),
            color: accent,
          },
        ],
      };
    },
    [accent, activeSnapshot?.counts, demographyData]
  );

  if (!hasData) {
    return (
      <Paper className="analysis-diagram-placeholder" withBorder p="lg">
        <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
          <Badge variant="light" size="lg" className="analysis-diagram-placeholder-badge">
            Altersverteilung
          </Badge>
          <Title order={3} className="analysis-diagram-placeholder-title">
            Keine demografischen Daten
          </Title>
          <Text size="sm" c="dimmed" ta="center" className="analysis-diagram-placeholder-text">
            Für den gewählten Kontext sind keine aktiven Kinder vorhanden.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="analysis-diagram-placeholder analysis-demography-chart" withBorder p="xs">
      <Group justify="space-between" align="center" className="analysis-demography-controls" mb={4}>
        <Group gap={6}>
          <ActionIcon
            variant="light"
            size="sm"
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex((prev) => (prev - 1 + snapshots.length) % snapshots.length);
            }}
            aria-label="Vorheriger Monat"
          >
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            size="sm"
            onClick={() => setIsPlaying((prev) => !prev)}
            aria-label={isPlaying ? 'Animation pausieren' : 'Animation starten'}
          >
            {isPlaying ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
          </ActionIcon>
          <ActionIcon
            variant="light"
            size="sm"
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex((prev) => (prev + 1) % snapshots.length);
            }}
            aria-label="Nächster Monat"
          >
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>

        <Badge variant="light" size="sm">
          {activeSnapshot?.label || '-'}
        </Badge>
      </Group>

      <Box h="calc(100% - 2rem)">
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Paper>
  );
}

function StoryCard({ story, isActive, onSelect }) {
  const StoryIcon = story.icon;
  const RatingIcon = RATING_ICON_BY_KEY[story.rating] || IconAlertTriangle;

  return (
    <Paper
      shadow="none"
      p="sm"
      radius="md"
      onClick={onSelect}
      className={`analysis-story-card ${isActive ? 'is-active' : ''}`}
      data-active={isActive ? 'true' : 'false'}
      data-testid={`story-card-${story.id}`}
      style={{ background: story.gradient }}
    >
      <div className="analysis-story-icon-wrap" aria-hidden>
        <StoryIcon size={86} stroke={1} />
      </div>

      <div className="analysis-story-content">
        <div className="analysis-story-header">
          <Text className="analysis-story-category" size="sm">
            {story.category}
          </Text>
          <Title order={3} className="analysis-story-title">
            {story.title}
          </Title>
        </div>
        <div className="analysis-story-rating" aria-label={`Gesamtbewertung ${story.rating}`}>
          <RatingIcon size={24} stroke={2} />
        </div>
      </div>
    </Paper>
  );
}

function AnalysisProgressPanel({ stageIndex, isLoading }) {
  const safeIndex = Math.min(Math.max(stageIndex, 0), ANALYSIS_LOADING_STAGES.length - 1);
  const activeStage = ANALYSIS_LOADING_STAGES[safeIndex] || ANALYSIS_LOADING_STAGES[0];
  const completed = ANALYSIS_LOADING_STAGES
    .slice(0, safeIndex)
    .reduce((sum, stage) => sum + Number(stage.weight || 0), 0);
  const activeWeight = Number(activeStage?.weight || 0);
  const activeValue = isLoading ? Math.max(2, activeWeight - 2) : activeWeight;
  const progressValue = Math.min(100, completed + activeValue);

  return (
    <Modal
      opened={isLoading}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      centered
      size="sm"
      overlayProps={{ opacity: 0.45, blur: 3 }}
      title="Analyse wird aktualisiert"
    >
      <Stack gap="md" align="center" className="analysis-loading-modal-content">
        <RingProgress
          size={180}
          thickness={18}
          roundCaps
          label={<Text ta="center" fw={800} size="xl">{Math.round(progressValue)}%</Text>}
          sections={[{ value: progressValue, color: 'blue' }]}
        />

        <Badge variant="light" className="analysis-loading-stage-badge">
          {activeStage.title}
        </Badge>

        <Text size="sm" ta="center" className="analysis-loading-message">
          {activeStage.message}
        </Text>

        <Stack gap={4} w="100%" className="analysis-loading-stage-list">
          {ANALYSIS_LOADING_STAGES.map((stage, index) => (
            <Text
              key={stage.key}
              size="xs"
              c={index <= safeIndex ? 'dark' : 'dimmed'}
              fw={index === safeIndex ? 700 : 500}
            >
              {index <= safeIndex ? '•' : '○'} {stage.title}
            </Text>
          ))}
        </Stack>
      </Stack>
    </Modal>
  );
}

function VisuView() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const chartState = useSelector((state) => (selectedScenarioId ? state.chart?.[selectedScenarioId] : null));
  const scenarios = useSelector((state) => state.simScenario.scenarios || EMPTY_LIST);
  const overlaysByScenario = useSelector((state) => state.simOverlay?.overlaysByScenario || {});
  const dataByScenario = useSelector((state) => state.simData?.dataByScenario || {});
  const bookingsByScenario = useSelector((state) => state.simBooking?.bookingsByScenario || {});
  const groupsByScenario = useSelector((state) => state.simGroup?.groupsByScenario || {});
  const groupDefsByScenario = useSelector((state) => state.simGroup?.groupDefsByScenario || {});
  const qualificationAssignmentsByScenario = useSelector(
    (state) => state.simQualification?.qualificationAssignmentsByScenario || {}
  );
  const qualificationDefsByScenario = useSelector((state) => state.simQualification?.qualificationDefsByScenario || {});
  const events = useSelector((state) => (selectedScenarioId ? state.events?.eventsByScenario?.[selectedScenarioId] || EMPTY_LIST : EMPTY_LIST));
  const qualificationDefs = useSelector(
    (state) =>
      selectedScenarioId
        ? state.simQualification?.qualificationDefsByScenario?.[selectedScenarioId] || EMPTY_LIST
        : EMPTY_LIST
  );
  const financeScenario = useSelector(
    (state) => (selectedScenarioId ? state.simFinance?.financeByScenario?.[selectedScenarioId] || null : null)
  );
  const [activeStep, setActiveStep] = React.useState(0);
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);
  const [monteCarloConfig, setMonteCarloConfig] = React.useState({
    runs: 800,
    absenceRatePct: 14,
    maxConcurrentOutages: 3,
  });
  const [monteCarloRunId, setMonteCarloRunId] = React.useState(0);
  const todayIso = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { getEffectiveDataItems, getEffectiveBookings, getEffectiveGroupAssignments, getEffectiveGroupDefs } = useOverlayData();
  const activeStory = STORY_STEPS[activeStep] || STORY_STEPS[0];
  const effectiveDataItems = React.useMemo(() => getEffectiveDataItems(), [getEffectiveDataItems]);
  const groupDefs = React.useMemo(() => getEffectiveGroupDefs(), [getEffectiveGroupDefs]);
  const selectedGroups = React.useMemo(() => chartState?.filter?.Groups || EMPTY_LIST, [chartState?.filter?.Groups]);
  const selectedQualifications = React.useMemo(
    () => chartState?.filter?.Qualifications || EMPTY_LIST,
    [chartState?.filter?.Qualifications]
  );

  const [coverageData, setCoverageData] = React.useState(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = React.useState(false);
  const [analysisLoadingStage, setAnalysisLoadingStage] = React.useState(0);

  const computeCoverageData = React.useCallback(() => {
    if (!selectedScenarioId) return null;

    const overlayAware = buildOverlayAwareData(selectedScenarioId, {
      simScenario: { scenarios },
      simOverlay: { overlaysByScenario },
      simData: { dataByScenario },
      simBooking: { bookingsByScenario },
      simGroup: { groupsByScenario, groupDefsByScenario },
      simQualification: {
        qualificationAssignmentsByScenario,
        qualificationDefsByScenario,
      },
    });
    const referenceDate = chartState?.referenceDate || new Date().toISOString().slice(0, 10);
    const categories = generateTimeSegments();

    const weeklyData = chartState?.chartData?.weekly || {
      categories,
      demand: [],
      capacity_pedagogical: [],
      capacity_administrative: [],
      care_ratio: [],
      expert_ratio: [],
    };

    const availableGroups = (overlayAware.effectiveGroupDefs || [])
      .filter((group) => group && group.id)
      .map((group) => ({ id: String(group.id), name: group.name || 'Gruppe' }));

    const filteredGroups = selectedGroups.length
      ? availableGroups.filter((group) => selectedGroups.includes(group.id))
      : availableGroups;

    const groupsForHeatmap = filteredGroups.length ? filteredGroups : [{ id: '__NO_GROUP__', name: 'Keine Gruppe' }];

    const rawDataItems = overlayAware.effectiveDataItems || {};
    const rawBookings = overlayAware.effectiveBookingsByItem || {};
    const rawGroupAssignments = overlayAware.effectiveGroupAssignmentsByItem || {};
    const rawQualificationAssignments = overlayAware.effectiveQualificationAssignmentsByItem || {};

    const buildSnapshot = (excludedCapacityIds = []) => {
      const excludedSet = new Set((excludedCapacityIds || []).map((id) => String(id)));
      const scopedDataItems = excludedSet.size
        ? Object.fromEntries(
          Object.entries(rawDataItems).filter(([itemId, item]) => !(item?.type === 'capacity' && excludedSet.has(String(itemId))))
        )
        : rawDataItems;

      const scopedBookings = excludedSet.size
        ? Object.fromEntries(Object.entries(rawBookings).filter(([itemId]) => !excludedSet.has(String(itemId))))
        : rawBookings;

      const scopedGroupAssignments = excludedSet.size
        ? Object.fromEntries(Object.entries(rawGroupAssignments).filter(([itemId]) => !excludedSet.has(String(itemId))))
        : rawGroupAssignments;

      const scopedQualificationAssignments = excludedSet.size
        ? Object.fromEntries(Object.entries(rawQualificationAssignments).filter(([itemId]) => !excludedSet.has(String(itemId))))
        : rawQualificationAssignments;

      const baseInput = {
        bookingsByScenario: { [selectedScenarioId]: scopedBookings },
        dataByScenario: { [selectedScenarioId]: scopedDataItems },
        qualificationAssignmentsByScenario: {
          [selectedScenarioId]: scopedQualificationAssignments,
        },
        overlaysByScenario: {},
        scenarioId: selectedScenarioId,
        referenceDate,
        selectedQualifications,
        groupsByScenario: { [selectedScenarioId]: scopedGroupAssignments },
      };

      const baseSelection = selectedGroups.length ? selectedGroups : EMPTY_LIST;
      const { demand, capacity } = filterBookings({
        ...baseInput,
        selectedGroups: baseSelection,
      });

      const demandSeries = generateBookingDataSeries(referenceDate, demand, categories);
      const capacitySeries = generateBookingDataSeries(referenceDate, capacity, categories, 'all');
      const deficits = demandSeries.map((demandValue, index) => Number(demandValue || 0) - Number(capacitySeries[index] || 0));
      const undercoverageMinutes = deficits.reduce((sum, value) => sum + (value > 0 ? value * 30 : 0), 0);

      const heatValues = [];
      const groupUndercoverageMinutes = [];

      groupsForHeatmap.forEach((group, groupIndex) => {
        const groupFilter = group.id === '__NO_GROUP__' ? ['__NO_GROUP__'] : [group.id];
        const { demand: groupDemand, capacity: groupCapacity } = filterBookings({
          ...baseInput,
          selectedGroups: groupFilter,
        });

        const groupDemandSeries = generateBookingDataSeries(referenceDate, groupDemand, categories);
        const groupCapacitySeries = generateBookingDataSeries(referenceDate, groupCapacity, categories, 'all');
        let groupMinutes = 0;

        categories.forEach((_, slotIndex) => {
          const delta = Number(groupCapacitySeries[slotIndex] || 0) - Number(groupDemandSeries[slotIndex] || 0);
          if (delta < 0) groupMinutes += Math.abs(delta) * 30;
          heatValues.push([slotIndex, groupIndex, delta]);
        });

        groupUndercoverageMinutes.push({
          id: group.id,
          name: group.name,
          minutes: groupMinutes,
        });
      });

      return {
        demandSeries,
        capacitySeries,
        deficits,
        deficitSlots: deficits.filter((value) => value > 0).length,
        worstDeficit: deficits.length ? Math.max(0, ...deficits) : 0,
        undercoverageMinutes,
        totalDemand: demandSeries.reduce((sum, value) => sum + Number(value || 0), 0),
        totalCapacity: capacitySeries.reduce((sum, value) => sum + Number(value || 0), 0),
        heatValues,
        groupUndercoverageMinutes,
      };
    };

    const baselineSnapshot = buildSnapshot([]);

    const activeCapacityItems = Object.values(rawDataItems)
      .filter(
        (item) =>
          item
          && !item.archived
          && item.type === 'capacity'
          && isRecordActiveOnDate(item, referenceDate)
      )
      .filter((item) => {
        if (!selectedGroups.length) return true;
        const groupId = resolveGroupIdAtDate(rawGroupAssignments?.[String(item.id)] || {}, referenceDate, item.groupId || null);
        if (!groupId && selectedGroups.includes('__NO_GROUP__')) return true;
        return Boolean(groupId && selectedGroups.includes(String(groupId)));
      });

    const criticalityRanking = activeCapacityItems
      .map((item) => {
        const itemId = String(item.id);
        const snapshot = buildSnapshot([itemId]);
        const impactMinutes = Math.max(0, snapshot.undercoverageMinutes - baselineSnapshot.undercoverageMinutes);
        const offerLossPct = baselineSnapshot.totalCapacity > 0
          ? ((baselineSnapshot.totalCapacity - snapshot.totalCapacity) / baselineSnapshot.totalCapacity) * 100
          : 0;
        return {
          id: itemId,
          name: item.name || 'Mitarbeiter',
          impactMinutes,
          offerLossPct,
          snapshot,
        };
      })
      .sort((a, b) => b.impactMinutes - a.impactMinutes)
      .slice(0, 8);

    const topCritical = criticalityRanking[0] || null;
    const top1GroupMinutes = (topCritical?.snapshot?.groupUndercoverageMinutes || []).map((entry) => Number(entry.minutes || 0));
    const groupResilienceSpread = top1GroupMinutes.length
      ? Math.max(...top1GroupMinutes) - Math.min(...top1GroupMinutes)
      : 0;

    const totalImpact = criticalityRanking.reduce((sum, entry) => sum + Number(entry.impactMinutes || 0), 0);
    const top3Impact = criticalityRanking.slice(0, 3).reduce((sum, entry) => sum + Number(entry.impactMinutes || 0), 0);
    const bottleneckConcentration = totalImpact > 0 ? (top3Impact / totalImpact) * 100 : 0;

    let busFactor = 0;
    if (baselineSnapshot.deficitSlots > 0) {
      busFactor = 0;
    } else if (!criticalityRanking.length) {
      busFactor = 0;
    } else {
      const rankedIds = criticalityRanking.map((entry) => entry.id);
      busFactor = rankedIds.length + 1;
      for (let count = 1; count <= rankedIds.length; count += 1) {
        const snapshot = buildSnapshot(rankedIds.slice(0, count));
        if (snapshot.deficitSlots > 0) {
          busFactor = count;
          break;
        }
      }
    }

    const capacityIds = activeCapacityItems.map((item) => String(item.id));
    const runs = Math.max(100, Math.min(10000, Number(monteCarloConfig?.runs || 800)));
    const absenceRate = Math.max(0.01, Math.min(0.8, Number(monteCarloConfig?.absenceRatePct || 14) / 100));
    const maxConcurrentOutages = Math.max(1, Math.min(12, Number(monteCarloConfig?.maxConcurrentOutages || 3)));

    const scenarioSeed = String(selectedScenarioId || '')
      .split('')
      .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 0);

    let seed = (scenarioSeed ^ ((monteCarloRunId + 1) * 2654435761)) >>> 0;
    const nextRandom = () => {
      seed += 0x6D2B79F5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const monteCarloUndercoverage = [];
    const monteCarloOfferLoss = [];
    let reductionCount = 0;

    for (let run = 0; run < runs; run += 1) {
      const selectedOutages = [];
      const shuffledIds = [...capacityIds];

      for (let i = shuffledIds.length - 1; i > 0; i -= 1) {
        const j = Math.floor(nextRandom() * (i + 1));
        [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
      }

      for (let idx = 0; idx < shuffledIds.length; idx += 1) {
        if (selectedOutages.length >= maxConcurrentOutages) break;
        if (nextRandom() < absenceRate) {
          selectedOutages.push(shuffledIds[idx]);
        }
      }

      const snapshot = buildSnapshot(selectedOutages);
      const additionalUndercoverage = Math.max(0, snapshot.undercoverageMinutes - baselineSnapshot.undercoverageMinutes);
      const offerLossPct = baselineSnapshot.totalCapacity > 0
        ? ((baselineSnapshot.totalCapacity - snapshot.totalCapacity) / baselineSnapshot.totalCapacity) * 100
        : 0;

      if (additionalUndercoverage > 0) reductionCount += 1;
      monteCarloUndercoverage.push(additionalUndercoverage);
      monteCarloOfferLoss.push(Math.max(0, offerLossPct));
    }

    const sortedUndercoverage = [...monteCarloUndercoverage].sort((a, b) => a - b);
    const p95Index = sortedUndercoverage.length > 0 ? Math.min(sortedUndercoverage.length - 1, Math.floor(sortedUndercoverage.length * 0.95)) : 0;
    const meanUndercoverageMinutes = monteCarloUndercoverage.length
      ? monteCarloUndercoverage.reduce((sum, value) => sum + value, 0) / monteCarloUndercoverage.length
      : 0;
    const meanOfferLossPct = monteCarloOfferLoss.length
      ? monteCarloOfferLoss.reduce((sum, value) => sum + value, 0) / monteCarloOfferLoss.length
      : 0;
    const reductionProbabilityPct = runs > 0 ? (reductionCount / runs) * 100 : 0;

    const careValues = (weeklyData?.care_ratio || []).map((value) => Number(value || 0)).filter((value) => value > 0);
    const expertValues = (weeklyData?.expert_ratio || []).map((value) => Number(value || 0)).filter((value) => value >= 0);
    const demandSeries = (weeklyData?.demand || []).map((value) => Number(value || 0));
    const capacitySeries = (weeklyData?.capacity || []).map((value) => Number(value || 0));

    const avgCareRatio = careValues.length ? careValues.reduce((sum, value) => sum + value, 0) / careValues.length : 0;
    const minCareRatio = careValues.length ? Math.min(...careValues) : 0;
    const maxCareRatio = careValues.length ? Math.max(...careValues) : 0;

    const avgExpertRatio = expertValues.length ? expertValues.reduce((sum, value) => sum + value, 0) / expertValues.length : 0;

    const deficits = demandSeries.map((demandValue, index) => demandValue - Number(capacitySeries[index] || 0));
    const deficitSlots = deficits.filter((value) => value > 0).length;
    const worstDeficit = deficits.length ? Math.max(0, ...deficits) : 0;

    const monthFormatter = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });
    const baseDate = new Date(referenceDate);
    const shiftMonth = (date, offsetMonths) => {
      const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 15));
      return shifted;
    };

    const financeRows = Array.from({ length: 12 }, (_, idx) => {
      const monthDate = shiftMonth(baseDate, idx - 11);
      const monthRef = monthDate.toISOString().slice(0, 10);
      const monthlyFinance = calculateScenarioMonthlyFinance({
        referenceDate: monthRef,
        effectiveDataItems: rawDataItems,
        effectiveBookingsByItem: rawBookings,
        effectiveGroupAssignmentsByItem: rawGroupAssignments,
        effectiveGroupDefs: overlayAware.effectiveGroupDefs || [],
        financeScenario,
      });

      const carePoints = (monthlyFinance.childRows || []).reduce(
        (sum, row) => sum + Number(row.bayKiBiGWeight || 0),
        0
      );

      return {
        label: monthFormatter.format(monthDate),
        income: Number(monthlyFinance.summary?.incomeTotal || 0),
        expenses: Number(monthlyFinance.summary?.expensesTotal || 0),
        net: Number(monthlyFinance.summary?.net || 0),
        carePoints,
      };
    });

    const latestFinance = financeRows[financeRows.length - 1] || {
      income: 0,
      expenses: 0,
      net: 0,
      carePoints: 0,
    };

    const costPerCarePoint = latestFinance.carePoints > 0
      ? latestFinance.expenses / latestFinance.carePoints
      : 0;
    const costCoveragePct = latestFinance.expenses > 0
      ? (latestFinance.income / latestFinance.expenses) * 100
      : 0;
    const rollingNet = financeRows.reduce((sum, row) => sum + Number(row.net || 0), 0);

    return {
      categories,
      weeklyData: {
        ...weeklyData,
        categories: weeklyData?.categories?.length ? weeklyData.categories : categories,
      },
      groupsForHeatmap,
      heatValues: baselineSnapshot.heatValues,
      kpis: {
        avgCareRatio,
        minCareRatio,
        maxCareRatio,
        avgExpertRatio,
        deficitSlots,
        worstDeficit,
      },
      resilience: {
        heatValues: topCritical?.snapshot?.heatValues || baselineSnapshot.heatValues,
        criticalityRanking,
        busFactor,
        top1OfferLossPct: topCritical?.offerLossPct || 0,
        bottleneckConcentration,
        groupResilienceSpread,
        monteCarlo: {
          runs,
          absenceRatePct: absenceRate * 100,
          maxConcurrentOutages,
          reductionProbabilityPct,
          meanUndercoverageMinutes,
          p95UndercoverageMinutes: sortedUndercoverage[p95Index] || 0,
          meanOfferLossPct,
          undercoverageMinutes: monteCarloUndercoverage,
        },
      },
      financeTrend: {
        categories: financeRows.map((row) => row.label),
        income: financeRows.map((row) => row.income),
        expenses: financeRows.map((row) => row.expenses),
        net: financeRows.map((row) => row.net),
        kpis: {
          costPerCarePoint,
          costCoveragePct,
          rollingNet,
        },
      },
    };
  }, [
    bookingsByScenario,
    chartState,
    dataByScenario,
    groupDefsByScenario,
    groupsByScenario,
    overlaysByScenario,
    financeScenario,
    qualificationAssignmentsByScenario,
    qualificationDefsByScenario,
    scenarios,
    monteCarloConfig,
    monteCarloRunId,
    selectedGroups,
    selectedQualifications,
    selectedScenarioId,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    let stageIntervalId = null;
    let runTimerId = null;
    let hideTimerId = null;
    let idleCallbackId = null;

    const runtime = typeof window !== 'undefined' ? window : null;
    setIsAnalysisLoading(true);
    setAnalysisLoadingStage(0);

    stageIntervalId = setInterval(() => {
      setAnalysisLoadingStage((prev) => Math.min(prev + 1, ANALYSIS_LOADING_STAGES.length - 2));
    }, 520);

    const finishLoading = (nextData) => {
      if (cancelled) return;
      setCoverageData(nextData);
      setAnalysisLoadingStage(ANALYSIS_LOADING_STAGES.length - 1);
      hideTimerId = setTimeout(() => {
        if (!cancelled) {
          setIsAnalysisLoading(false);
        }
      }, 180);
    };

    const runComputation = () => {
      const result = computeCoverageData();
      finishLoading(result);
    };

    runTimerId = setTimeout(() => {
      if (cancelled) return;

      if (runtime && typeof runtime.requestIdleCallback === 'function') {
        idleCallbackId = runtime.requestIdleCallback(runComputation, { timeout: 220 });
      } else {
        runComputation();
      }
    }, 0);

    return () => {
      cancelled = true;
      if (stageIntervalId) clearInterval(stageIntervalId);
      if (runTimerId) clearTimeout(runTimerId);
      if (hideTimerId) clearTimeout(hideTimerId);
      if (runtime && idleCallbackId && typeof runtime.cancelIdleCallback === 'function') {
        runtime.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [computeCoverageData]);

  const qualityMetrics = React.useMemo(() => {
    const activeItems = Object.values(effectiveDataItems || {}).filter(
      (item) =>
        item &&
        !item.archived &&
        (item.type === 'demand' || item.type === 'capacity') &&
        isRecordActiveOnDate(item, todayIso)
    );

    const hasGroupFilter = Array.isArray(selectedGroups) && selectedGroups.length > 0;
    const groupFilterSet = new Set((selectedGroups || []).map((groupId) => String(groupId)));

    const applyGroupFilter = (groupId) => {
      if (!hasGroupFilter) return true;
      if (!groupId && groupFilterSet.has('__NO_GROUP__')) return true;
      if (!groupId) return false;
      return groupFilterSet.has(String(groupId));
    };

    const itemAnalyses = activeItems
      .map((item) => {
        const itemId = String(item.id);
        const itemType = item.type;
        const currentGroupId = resolveGroupIdAtDate(getEffectiveGroupAssignments(itemId), todayIso, item.groupId || null);
        const hasBooking = Object.values(getEffectiveBookings(itemId) || {}).some((booking) => isRecordActiveOnDate(booking, todayIso));
        const hasGroup = Boolean(currentGroupId);

        let hasFinance = false;
        if (itemType === 'capacity') {
          const personnelHistory = financeScenario?.itemFinances?.[itemId]?.personnelCostHistory || [];
          hasFinance = personnelHistory.some((entry) => isRecordActiveOnDate(entry, todayIso));
        } else {
          const feeEntries = financeScenario?.groupFeeCatalogs?.[String(currentGroupId)] || [];
          hasFinance = feeEntries.some((entry) => isRecordActiveOnDate(entry, todayIso));
        }

        const missingReasons = [];
        if (!hasBooking) missingReasons.push('keine Buchung');
        if (!hasFinance) missingReasons.push('keine Finanzen');
        if (!hasGroup) missingReasons.push('keine Gruppe');

        return {
          id: itemId,
          name: item.name || (itemType === 'demand' ? 'Kind' : 'Mitarbeiter'),
          type: itemType,
          groupId: currentGroupId ? String(currentGroupId) : null,
          isComplete: missingReasons.length === 0,
          missingReasons,
        };
      })
      .filter((entry) => applyGroupFilter(entry.groupId));

    const completeChildren = itemAnalyses.filter((entry) => entry.type === 'demand' && entry.isComplete).length;
    const completeEmployees = itemAnalyses.filter((entry) => entry.type === 'capacity' && entry.isComplete).length;
    const totalChildren = itemAnalyses.filter((entry) => entry.type === 'demand').length;
    const totalEmployees = itemAnalyses.filter((entry) => entry.type === 'capacity').length;
    const incompleteRecords = itemAnalyses.filter((entry) => !entry.isComplete);

    const enabledEvents = (events || []).filter((event) => event.enabled !== false);
    const autoEvents = enabledEvents.filter(
      (event) => event?.metadata?.autoGenerated || event?.category === 'auto_transition' || event?.type === 'auto_group_transition'
    );

    const groupFeeCatalogs = financeScenario?.groupFeeCatalogs || {};
    const hasAnyFeeCatalog = Object.values(groupFeeCatalogs).some((entries) => Array.isArray(entries) && entries.length > 0);

    const alerts = [];
    if (!hasAnyFeeCatalog) alerts.push('Kein Gebührenkatalog vorhanden.');
    if (!financeScenario?.bayKiBiGRules?.length) alerts.push('Keine Förderungsdaten vorhanden.');
    if (!qualificationDefs?.length) alerts.push('Keine Qualifikationen vorhanden.');
    if (!groupDefs?.length) alerts.push('Keine Gruppen angelegt.');

    return {
      totalChildren,
      totalEmployees,
      completeChildren,
      completeEmployees,
      incompleteRecords,
      autoEventShare: enabledEvents.length > 0 ? (autoEvents.length / enabledEvents.length) * 100 : 0,
      alerts,
    };
  }, [
    effectiveDataItems,
    events,
    financeScenario,
    getEffectiveBookings,
    getEffectiveGroupAssignments,
    groupDefs,
    qualificationDefs,
    selectedGroups,
    todayIso,
  ]);

  const previewFlow = React.useMemo(() => {
    const referenceDate = chartState?.referenceDate || todayIso;
    const horizonDateObj = new Date(referenceDate);
    horizonDateObj.setUTCMonth(horizonDateObj.getUTCMonth() + 3);
    const horizonDate = horizonDateObj.toISOString().slice(0, 10);

    const externalIn = 'Zugang extern';
    const externalOut = 'Abgang extern';
    const noGroup = 'Ohne Gruppe';

    const groupsById = new Map((groupDefs || []).map((group) => [String(group.id), group.name || 'Gruppe']));
    const flowCounter = new Map();

    const addFlow = (from, to, weight = 1) => {
      if (!from || !to || from === to || weight <= 0) return;
      const key = `${from}__${to}`;
      flowCounter.set(key, (flowCounter.get(key) || 0) + weight);
    };

    const demandItems = Object.values(effectiveDataItems || {}).filter(
      (item) => item && item.type === 'demand' && !item.archived
    );

    let activeNowCount = 0;

    demandItems.forEach((item) => {
      const itemId = String(item.id);
      const assignments = getEffectiveGroupAssignments(itemId);
      const currentGroupId = resolveGroupIdAtDate(assignments, referenceDate, item.groupId || null);
      const futureGroupId = resolveGroupIdAtDate(assignments, horizonDate, item.groupId || null);
      const currentLabel = currentGroupId ? (groupsById.get(String(currentGroupId)) || noGroup) : noGroup;
      const futureLabel = futureGroupId ? (groupsById.get(String(futureGroupId)) || noGroup) : noGroup;

      const isActiveNow = isRecordActiveOnDate(item, referenceDate);
      const isActiveFuture = isRecordActiveOnDate(item, horizonDate);
      if (isActiveNow) activeNowCount += 1;

      if (!isActiveNow && isActiveFuture) {
        addFlow(externalIn, futureLabel, 1);
        return;
      }

      if (isActiveNow && !isActiveFuture) {
        addFlow(currentLabel, externalOut, 1);
        return;
      }

      if (isActiveNow && isActiveFuture && currentLabel !== futureLabel) {
        addFlow(currentLabel, futureLabel, 1);
      }
    });

    const links = Array.from(flowCounter.entries()).map(([key, value]) => {
      const [from, to] = key.split('__');
      return [from, to, value];
    });

    const isExternalNode = (value) => value === externalIn || value === externalOut;
    const isGroupNode = (value) => !isExternalNode(value);

    const externalEntries = links
      .filter(([from, to]) => from === externalIn && isGroupNode(to))
      .reduce((sum, [, , value]) => sum + Number(value || 0), 0);
    const internalShifts = links
      .filter(([from, to]) => isGroupNode(from) && isGroupNode(to) && from !== to)
      .reduce((sum, [, , value]) => sum + Number(value || 0), 0);
    const externalExits = links
      .filter(([, to]) => to === externalOut)
      .reduce((sum, [, , value]) => sum + Number(value || 0), 0);

    const inflowTotal = externalEntries + internalShifts;
    const externalEntryRatioPct = inflowTotal > 0 ? (externalEntries / inflowTotal) * 100 : 0;
    const exitRatioPct = activeNowCount > 0 ? (externalExits / activeNowCount) * 100 : 0;

    const linkVolumes = links.map(([, , value]) => Number(value || 0));
    const totalVolume = linkVolumes.reduce((sum, value) => sum + value, 0);
    const top3Volume = [...linkVolumes].sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
    const concentrationPct = totalVolume > 0 ? (top3Volume / totalVolume) * 100 : 0;

    const groupNet = new Map();
    links.forEach(([from, to, value]) => {
      const numeric = Number(value || 0);
      if (isGroupNode(from)) groupNet.set(from, (groupNet.get(from) || 0) - numeric);
      if (isGroupNode(to)) groupNet.set(to, (groupNet.get(to) || 0) + numeric);
    });

    const groupNetEntries = Array.from(groupNet.entries()).map(([name, net]) => ({ name, net }));
    const minNetEntry = groupNetEntries.length
      ? groupNetEntries.reduce((min, current) => (current.net < min.net ? current : min), groupNetEntries[0])
      : null;
    const maxNetEntry = groupNetEntries.length
      ? groupNetEntries.reduce((max, current) => (current.net > max.net ? current : max), groupNetEntries[0])
      : null;

    return {
      referenceDate,
      horizonDate,
      links,
      kpis: {
        externalEntryRatioPct,
        exitRatioPct,
        concentrationPct,
        minNetEntry,
        maxNetEntry,
      },
    };
  }, [chartState?.referenceDate, effectiveDataItems, getEffectiveGroupAssignments, groupDefs, todayIso]);

  const demographyData = React.useMemo(() => {
    const referenceDate = chartState?.referenceDate || todayIso;
    const formatter = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });
    const ageBands = ['0-2', '3', '4', '5', '6+'];

    const hasGroupFilter = Array.isArray(selectedGroups) && selectedGroups.length > 0;
    const groupFilterSet = new Set((selectedGroups || []).map((value) => String(value)));

    const isGroupSelected = (item, dateIso) => {
      if (!hasGroupFilter) return true;
      const groupId = resolveGroupIdAtDate(getEffectiveGroupAssignments(String(item.id)), dateIso, item.groupId || null);
      if (!groupId) return groupFilterSet.has('__NO_GROUP__');
      return groupFilterSet.has(String(groupId));
    };

    const snapshots = Array.from({ length: 12 }, (_, idx) => {
      const monthDate = new Date(referenceDate);
      monthDate.setUTCDate(15);
      monthDate.setUTCMonth(monthDate.getUTCMonth() + idx);
      const monthIso = monthDate.toISOString().slice(0, 10);

      const ageValues = Object.values(effectiveDataItems || {})
        .filter((item) => item && item.type === 'demand' && !item.archived && isRecordActiveOnDate(item, monthIso))
        .filter((item) => isGroupSelected(item, monthIso))
        .map((item) => getAgeInMonthsAtDate(item.dateofbirth, monthIso))
        .filter((age) => Number.isFinite(age));

      const counts = {
        '0-2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
        '6+': 0,
      };

      ageValues.forEach((ageMonths) => {
        const ageYears = ageMonths / 12;
        if (ageYears < 3) counts['0-2'] += 1;
        else if (ageYears < 4) counts['3'] += 1;
        else if (ageYears < 5) counts['4'] += 1;
        else if (ageYears < 6) counts['5'] += 1;
        else counts['6+'] += 1;
      });

      const total = ageValues.length;
      const peakEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ['0-2', 0];

      return {
        label: formatter.format(monthDate),
        monthIso,
        categories: ageBands,
        counts: ageBands.map((band) => counts[band]),
        total,
        medianAgeMonths: getMedian(ageValues),
        u3SharePct: total > 0 ? (counts['0-2'] / total) * 100 : 0,
        peakBand: peakEntry[0],
        peakSharePct: total > 0 ? (Number(peakEntry[1] || 0) / total) * 100 : 0,
      };
    });

    const currentSnapshot = snapshots[0] || null;
    const horizonDate = new Date(referenceDate);
    horizonDate.setUTCMonth(horizonDate.getUTCMonth() + 12);
    const horizonIso = horizonDate.toISOString().slice(0, 10);

    const schoolStarters12M = Object.values(effectiveDataItems || {})
      .filter((item) => item && item.type === 'demand' && !item.archived)
      .filter((item) => isRecordActiveOnDate(item, referenceDate))
      .filter((item) => isGroupSelected(item, referenceDate))
      .reduce((sum, item) => {
        const ageNow = getAgeInMonthsAtDate(item.dateofbirth, referenceDate);
        const ageFuture = getAgeInMonthsAtDate(item.dateofbirth, horizonIso);
        if (!Number.isFinite(ageNow) || !Number.isFinite(ageFuture)) return sum;
        if (ageNow < 72 && ageFuture >= 72) return sum + 1;
        return sum;
      }, 0);

    return {
      categories: ageBands,
      snapshots,
      kpis: {
        medianAgeYears: (currentSnapshot?.medianAgeMonths || 0) / 12,
        u3SharePct: currentSnapshot?.u3SharePct || 0,
        schoolStarters12M,
        peakBand: currentSnapshot?.peakBand || '-',
        peakBandSharePct: currentSnapshot?.peakSharePct || 0,
      },
    };
  }, [chartState?.referenceDate, effectiveDataItems, getEffectiveGroupAssignments, selectedGroups, todayIso]);

  const stageRecommendations =
    activeStory.id === 'quality'
      ? [
          {
            key: 'kpi-children',
            title: 'Kinder (aktiv)',
            value: `${qualityMetrics.totalChildren}`,
            text: 'Aktuelle Bedarfseinträge.',
            tone: 'good',
          },
          {
            key: 'kpi-employees',
            title: 'Mitarbeiter (aktiv)',
            value: `${qualityMetrics.totalEmployees}`,
            text: 'Aktuelle Kapazitätseinträge.',
            tone: 'good',
          },
          {
            key: 'kpi-incomplete',
            title: 'Lückenhafte Datensätze',
            value: `${qualityMetrics.incompleteRecords.length}`,
            text: 'Fehlende Buchung, Finanzen oder Gruppe.',
            tone: qualityMetrics.incompleteRecords.length > 0 ? 'warn' : 'good',
            records: qualityMetrics.incompleteRecords,
          },
          {
            key: 'kpi-auto-events',
            title: 'Autogenerierte Events',
            value: `${qualityMetrics.autoEventShare.toFixed(1)}%`,
            text: 'Anteil an allen aktuell aktiven Events.',
            tone: 'good',
          },
        ]
      : activeStory.id === 'status'
        ? [
            {
              key: 'kpi-care-ratio',
              title: 'Ø Betreuungsschlüssel',
              value: `${coverageData?.kpis?.avgCareRatio?.toFixed(1) || '0.0'} (Min ${coverageData?.kpis?.minCareRatio?.toFixed(1) || '0.0'} / Max ${coverageData?.kpis?.maxCareRatio?.toFixed(1) || '0.0'})`,
              text: 'Mittelwert über alle 30-Minuten-Slots.',
              tone: 'good',
            },
            {
              key: 'kpi-expert-ratio',
              title: 'Ø Fachkraftquote',
              value: `${coverageData?.kpis?.avgExpertRatio?.toFixed(1) || '0.0'}%`,
              text: 'Durchschnitt über alle Slots.',
              tone: 'good',
            },
            {
              key: 'kpi-deficit-slots',
              title: 'Unterdeckte Slots',
              value: `${coverageData?.kpis?.deficitSlots || 0}`,
              text: `Größte Unterdeckung: ${coverageData?.kpis?.worstDeficit?.toFixed(1) || '0.0'} Kinder`,
              tone: (coverageData?.kpis?.deficitSlots || 0) > 0 ? 'warn' : 'good',
            },
          ]
      : activeStory.id === 'transitions'
        ? [
            {
              key: 'kpi-bus-factor',
              title: 'Bus-Faktor',
              value: `${coverageData?.resilience?.busFactor ?? 0}`,
              text: 'Kleinste Anzahl kritischer Ausfälle bis zur Unterdeckung.',
              tone: (coverageData?.resilience?.busFactor ?? 0) <= 1 ? 'warn' : 'good',
            },
            {
              key: 'kpi-offer-loss',
              title: 'Angebotsverlust (Top-1)',
              value: `${(coverageData?.resilience?.top1OfferLossPct || 0).toFixed(1)}%`,
              text: 'Kapazitätsverlust beim kritischsten Einzelausfall.',
              tone: (coverageData?.resilience?.top1OfferLossPct || 0) > 15 ? 'warn' : 'good',
            },
            {
              key: 'kpi-bottleneck-concentration',
              title: 'Engpasskonzentration',
              value: `${(coverageData?.resilience?.bottleneckConcentration || 0).toFixed(1)}%`,
              text: 'Risikanteil der Top-3-Ausfälle an der Gesamt-Kritikalität.',
              tone: (coverageData?.resilience?.bottleneckConcentration || 0) > 70 ? 'warn' : 'good',
            },
            {
              key: 'kpi-group-spread',
              title: 'Resilienz-Spreizung Gruppen',
              value: `${(coverageData?.resilience?.groupResilienceSpread || 0).toFixed(0)} Min`,
              text: 'Differenz schwächste vs. stärkste Gruppe (Top-1-Ausfall).',
              tone: (coverageData?.resilience?.groupResilienceSpread || 0) > 180 ? 'warn' : 'good',
            },
          ]
      : activeStory.id === 'cohort'
        ? [
            {
              key: 'kpi-cost-per-care-point',
              title: 'Kosten pro Betreuungspunkt',
              value: `${(coverageData?.financeTrend?.kpis?.costPerCarePoint || 0).toFixed(0)} EUR`,
              text: 'Monatsausgaben je BayKiBiG-Betreuungspunkt.',
              tone: 'warn',
            },
            {
              key: 'kpi-coverage',
              title: 'Kostendeckungsgrad',
              value: `${(coverageData?.financeTrend?.kpis?.costCoveragePct || 0).toFixed(1)}%`,
              text: 'Monatseinnahmen im Verhältnis zu Monatsausgaben.',
              tone: (coverageData?.financeTrend?.kpis?.costCoveragePct || 0) >= 100 ? 'good' : 'warn',
            },
            {
              key: 'kpi-rolling-net',
              title: 'Saldo 12 Monate',
              value: `${(coverageData?.financeTrend?.kpis?.rollingNet || 0).toFixed(0)} EUR`,
              text: 'Kumuliertes Ergebnis über den 12-Monatsverlauf.',
              tone: (coverageData?.financeTrend?.kpis?.rollingNet || 0) >= 0 ? 'good' : 'problem',
            },
          ]
      : activeStory.id === 'compare'
        ? [
            {
              key: 'kpi-net-occupancy',
              title: 'Netto-Belegung je Gruppe',
              value: previewFlow?.kpis?.minNetEntry && previewFlow?.kpis?.maxNetEntry
                ? `Min ${previewFlow.kpis.minNetEntry.net > 0 ? '+' : ''}${previewFlow.kpis.minNetEntry.net} (${previewFlow.kpis.minNetEntry.name}) / Max ${previewFlow.kpis.maxNetEntry.net > 0 ? '+' : ''}${previewFlow.kpis.maxNetEntry.net} (${previewFlow.kpis.maxNetEntry.name})`
                : 'Keine Verschiebung',
              text: '3-Monatsvorschau: Nettoveränderung pro Gruppe.',
              tone: 'good',
            },
            {
              key: 'kpi-external-entry-ratio',
              title: 'Externe Zugangsquote',
              value: `${(previewFlow?.kpis?.externalEntryRatioPct || 0).toFixed(1)}%`,
              text: 'Anteil externer Zugänge am gesamten Gruppenzufluss.',
              tone: 'good',
            },
            {
              key: 'kpi-exit-ratio',
              title: 'Abgangsquote',
              value: `${(previewFlow?.kpis?.exitRatioPct || 0).toFixed(1)}%`,
              text: 'Anteil externer Abgänge an aktuell aktiven Kindern.',
              tone: (previewFlow?.kpis?.exitRatioPct || 0) > 12 ? 'warn' : 'good',
            },
            {
              key: 'kpi-flow-concentration',
              title: 'Konzentrationsindex (Top-3)',
              value: `${(previewFlow?.kpis?.concentrationPct || 0).toFixed(1)}%`,
              text: 'Anteil der drei größten Flüsse am Gesamtvolumen.',
              tone: (previewFlow?.kpis?.concentrationPct || 0) > 70 ? 'warn' : 'good',
            },
          ]
      : activeStory.id === 'demography'
        ? [
            {
              key: 'kpi-demography-median',
              title: 'Medianalter',
              value: `${(demographyData?.kpis?.medianAgeYears || 0).toFixed(1)} Jahre`,
              text: 'Median der aktuell aktiven Kinder.',
              tone: 'good',
            },
            {
              key: 'kpi-demography-u3',
              title: 'U3-Anteil',
              value: `${(demographyData?.kpis?.u3SharePct || 0).toFixed(1)}%`,
              text: 'Anteil 0-2 Jahre in der aktuellen Belegung.',
              tone: (demographyData?.kpis?.u3SharePct || 0) > 45 ? 'warn' : 'good',
            },
            {
              key: 'kpi-demography-school',
              title: 'Schulstarter (12M)',
              value: `${demographyData?.kpis?.schoolStarters12M || 0}`,
              text: 'Kinder, die binnen 12 Monaten 6 Jahre erreichen.',
              tone: 'warn',
            },
            {
              key: 'kpi-demography-peak',
              title: 'Größtes Alterscluster',
              value: `${demographyData?.kpis?.peakBand || '-'} (${(demographyData?.kpis?.peakBandSharePct || 0).toFixed(1)}%)`,
              text: 'Dominantes Altersband im aktuellen Monat.',
              tone: 'good',
            },
          ]
      : STAGE_RECOMMENDATIONS_BY_STORY[activeStory.id] || STAGE_RECOMMENDATIONS_BY_STORY.quality;

  const qualityDonutData = React.useMemo(
    () => [
      {
        name: 'Vollständige Kinder',
        y: qualityMetrics.completeChildren,
        color: '#16a34a',
      },
      {
        name: 'Vollständige Mitarbeiter',
        y: qualityMetrics.completeEmployees,
        color: '#2563eb',
      },
      {
        name: 'Lückenhafte Datensätze',
        y: qualityMetrics.incompleteRecords.length,
        color: '#f59e0b',
      },
    ],
    [qualityMetrics.completeChildren, qualityMetrics.completeEmployees, qualityMetrics.incompleteRecords.length]
  );

  const openDataItem = React.useCallback(
    (itemId) => {
      dispatch(setActivePage('data'));
      dispatch(setSelectedItems([itemId]));
      dispatch(setSelectedItem(itemId));
    },
    [dispatch]
  );

  React.useEffect(() => {
    if (!selectedScenarioId) return;
    dispatch(ensureScenario(selectedScenarioId));
  }, [dispatch, selectedScenarioId]);

  React.useEffect(() => {
    if (!emblaApi) return;

    const updateScrollState = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };

    updateScrollState();
    emblaApi.on('select', updateScrollState);
    emblaApi.on('reInit', updateScrollState);

    return () => {
      emblaApi.off('select', updateScrollState);
      emblaApi.off('reInit', updateScrollState);
    };
  }, [emblaApi]);

  const slides = STORY_STEPS.map((story, index) => (
    <Carousel.Slide key={story.id} className="analysis-story-slide">
      <StoryCard
        story={story}
        isActive={index === activeStep}
        onSelect={() => {
          setActiveStep(index);
          emblaApi?.scrollTo(index);
        }}
      />
    </Carousel.Slide>
  ));

  return (
    <Box
      data-testid="analysis-clean-sheet"
      className="analysis-view-root"
      style={{ '--analysis-link-accent': activeStory.accent }}
    >
      <Box className="analysis-album-flow-root">
        <Paper p="xs" className="analysis-album-flow-shell">
          <Carousel
            withIndicators
            getEmblaApi={setEmblaApi}
            onSlideChange={setActiveStep}
            slideSize={{ base: '86%', sm: '52%', lg: '42%' }}
            slideGap="md"
            emblaOptions={{ align: 'center', slidesToScroll: 1, loop: false, containScroll: false }}
            nextControlProps={{
              'aria-label': 'Next slide',
              style: {
                visibility: canScrollNext ? 'visible' : 'hidden',
                pointerEvents: canScrollNext ? 'auto' : 'none',
              },
            }}
            previousControlProps={{
              'aria-label': 'Previous slide',
              style: {
                visibility: canScrollPrev ? 'visible' : 'hidden',
                pointerEvents: canScrollPrev ? 'auto' : 'none',
              },
            }}
            className="analysis-album-flow-carousel"
          >
            {slides}
          </Carousel>
        </Paper>
      </Box>

      <Paper className="analysis-stage-shell" p="xs" withBorder>
        <Group grow align="stretch" gap="xs" className="analysis-stage-recommendations" data-testid="analysis-stage-recommendations">
          {stageRecommendations.map((item) => (
            <Paper key={`${activeStory.id}-${item.key || item.title}`} className="analysis-stage-recommendation-box" withBorder p="xs" data-tone={item.tone}>
              <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
                <Text size="xs" fw={700} className="analysis-stage-recommendation-title">
                  {item.title}
                </Text>
                {Array.isArray(item.records) && item.records.length > 0 && (
                  <HoverCard width={320} shadow="md" openDelay={100} closeDelay={120} withinPortal>
                    <HoverCard.Target>
                      <ActionIcon variant="subtle" size="sm" className="analysis-kpi-info-btn" aria-label="Lückenhafte Datensätze anzeigen">
                        <IconInfoCircle size={16} />
                      </ActionIcon>
                    </HoverCard.Target>
                    <HoverCard.Dropdown>
                      <Stack gap={4} className="analysis-kpi-tooltip-list">
                        {item.records.map((record) => (
                          <Anchor
                            key={record.id}
                            size="xs"
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              openDataItem(record.id);
                            }}
                          >
                            {record.name} ({record.missingReasons.join(', ')})
                          </Anchor>
                        ))}
                      </Stack>
                    </HoverCard.Dropdown>
                  </HoverCard>
                )}
              </Group>
              <Text size="lg" fw={800} className="analysis-stage-recommendation-value">
                {item.value}
              </Text>
              <Text size="xs" className="analysis-stage-recommendation-text">
                {item.text}
              </Text>
            </Paper>
          ))}
        </Group>

        <Box className="analysis-stage-content" data-testid="analysis-stage-content">
          {activeStory.id === 'quality' ? (
            <QualityDonutChart data={qualityDonutData} />
          ) : activeStory.id === 'status' ? (
            <WeeklyChart
              weeklyData={coverageData?.weeklyData || { categories: coverageData?.categories || [] }}
              showRatioChart
              syncGroupKey="analysis-step-2"
            />
          ) : activeStory.id === 'transitions' ? (
            <ResilienceCompositeChart
              categories={coverageData?.categories || []}
              groups={coverageData?.groupsForHeatmap || []}
              heatValues={coverageData?.resilience?.heatValues || []}
              ranking={coverageData?.resilience?.criticalityRanking || []}
              monteCarlo={coverageData?.resilience?.monteCarlo || null}
              accent={activeStory.accent}
            />
          ) : activeStory.id === 'cohort' ? (
            <FinanceTrendChart financeTrend={coverageData?.financeTrend || null} accent={activeStory.accent} />
          ) : activeStory.id === 'compare' ? (
            <PreviewSankeyChart previewFlow={previewFlow} accent={activeStory.accent} />
          ) : activeStory.id === 'demography' ? (
            <DemographyAgeChart demographyData={demographyData} accent={activeStory.accent} />
          ) : (
            <DiagramPlaceholder story={activeStory} />
          )}
        </Box>

        {activeStory.id === 'quality' && qualityMetrics.alerts.length > 0 && (
          <Box className="analysis-stage-alerts" data-testid="analysis-stage-alerts">
            <Stack gap={6}>
              {qualityMetrics.alerts.map((alert) => (
                <Alert key={alert} variant="light" color="orange" title="Hinweis" py={6}>
                  <Text size="xs">{alert}</Text>
                </Alert>
              ))}
            </Stack>
          </Box>
        )}

        <Box className="analysis-stage-filterbar" data-testid="analysis-stage-filterbar">
          <ChartFilterForm
            showStichtag={activeStory.id !== 'quality'}
            scenarioId={selectedScenarioId}
            compactBar
            groupsOnly={activeStory.id === 'quality'}
            showMonteCarloControls={activeStory.id === 'transitions'}
            monteCarloParams={monteCarloConfig}
            onMonteCarloParamsChange={setMonteCarloConfig}
            onRerunMonteCarlo={() => setMonteCarloRunId((prev) => prev + 1)}
          />
        </Box>
      </Paper>

      <AnalysisProgressPanel stageIndex={analysisLoadingStage} isLoading={isAnalysisLoading} />
    </Box>
  );
}

export default VisuView;
