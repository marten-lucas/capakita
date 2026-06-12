import React from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  RingProgress,
  Select,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { MonthPickerInput } from '@mantine/dates';
import Highcharts from 'highcharts';
import HighchartsHeatmap from 'highcharts/modules/heatmap';
import HighchartsSankey from 'highcharts/modules/sankey';
import HighchartsReact from 'highcharts-react-official';
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm';
import WeeklyChart from '../components/SimDataCharts/WeeklyChart';
import GroupIcon from '../components/common/GroupIcon';
import { useDispatch, useSelector } from 'react-redux';
import { setActivePage, setAnalysisSubPage } from '../store/uiSlice';
import { setSelectedItem, setSelectedItems } from '../store/simScenarioSlice';
import { ensureScenario } from '../store/chartSlice';
import { selectWeeklyChartData } from '../store/chartSelectors';
import { selectHistoricalStatistics, selectGroupTransitionStatistics } from '../store/statisticsSelectors';
import { useOverlayData } from '../hooks/useOverlayData';
import { calculateScenarioMonthlyFinance, isDateWithinRange, isRecordActiveOnDate, resolveGroupIdAtDate } from '../utils/financeUtils';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { isArchivedDataItem, shouldIncludeDataItemInAnalysis, getActiveDemandChildrenAtDate } from '../utils/dataVisibility';
import { filterBookings, generateCareRatioSeries } from '../utils/chartUtils/chartUtils';
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

const ANALYSIS_LOADING_STAGES_BY_STORY = {
  status: [ANALYSIS_LOADING_STAGES[0], ANALYSIS_LOADING_STAGES[1]],
  transitions: [ANALYSIS_LOADING_STAGES[0], ANALYSIS_LOADING_STAGES[2]],
  cohort: [ANALYSIS_LOADING_STAGES[0], ANALYSIS_LOADING_STAGES[3]],
};

const LEGAL_EXPERT_RATIO_MIN_PCT = 50;
const SLOT_HOURS = 0.5;
const MONTHS_PER_WEEK = 4.33;
const MONTHLY_HOURS_PER_FTE = 160;

const HEATMAP_MODES = {
  UNWEIGHTED_QUOTIENT: 'unweightedQuotient',
  CARE_KEY: 'careKey',
  PRESENT_STAFF: 'presentStaff',
};

const QUALITY_GROUP_COLOR_PALETTE = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be123c', '#4d7c0f'];
const QUALITY_ADMIN_TIME_COLOR = '#8b5cf6';
const FORECAST_GROUP_COLOR_PALETTE = ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#6366f1', '#84cc16'];
const DEMOGRAPHY_RESOLUTION_MONTHS = {
  quarter: 3,
  halfyear: 6,
  year: 12,
};
const AGE_HISTOGRAM_MAX_MONTHS = 96;

const RESILIENCE_CASCADE_STAGES = [
  'Regelbetrieb',
  'Mehrarbeit',
  'Zeiteinschränkung',
  'Notbetreuung',
  'Schließung',
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
    diagramType: 'Diagramm-Karussell',
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
    diagramType: 'Diagramm-Karussell',
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
    diagramType: 'Kritikalität + Monte-Carlo',
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
    title: 'Ausblick',
    subtitle: 'Strukturwechsel und Altersprognose',
    gradient: 'linear-gradient(135deg, #4a044e 0%, #be185d 100%)',
    accent: '#be185d',
    icon: IconArrowsSplit,
    rating: 'problem',
    diagramType: 'Diagramm-Karussell',
  },
  {
    id: 'options',
    category: '06',
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
    category: '07',
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

const ANALYSIS_SUBPAGE_ALIASES = {
  demography: 'compare',
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

function QualityStaffScheduleChart({ scheduleData, accent }) {
  const categories = React.useMemo(() => scheduleData?.categories || [], [scheduleData?.categories]);
  const employees = React.useMemo(() => scheduleData?.employees || [], [scheduleData?.employees]);
  const heatValues = React.useMemo(() => scheduleData?.heatValues || [], [scheduleData?.heatValues]);
  const groupLegend = React.useMemo(() => scheduleData?.groupLegend || [], [scheduleData?.groupLegend]);

  const slotsPerDay = React.useMemo(() => Math.max(Math.floor(categories.length / 5), 0), [categories.length]);

  const majorTickPositions = React.useMemo(() => {
    if (slotsPerDay === 0) return [];

    const positions = [];
    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      for (let slotIndex = 0; slotIndex < slotsPerDay; slotIndex += 1) {
        positions.push((dayIndex * slotsPerDay) + slotIndex);
      }
    }

    return positions;
  }, [slotsPerDay]);

  const dayBands = React.useMemo(() => {
    if (!slotsPerDay) return [];
    return ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((label, idx) => ({
      from: idx * slotsPerDay - 0.5,
      to: ((idx + 1) * slotsPerDay) - 0.5,
      color: idx % 2 === 0 ? 'rgba(241,245,249,0.55)' : 'rgba(226,232,240,0.48)',
      label: { text: label, y: -6, style: { color: '#334155', fontSize: '10px' } },
    }));
  }, [slotsPerDay]);

  const daySeparatorLines = React.useMemo(() => {
    if (slotsPerDay === 0) return [];

    const separators = [];
    for (let dayIndex = 1; dayIndex < 5; dayIndex += 1) {
      separators.push({
        color: 'rgba(255,255,255,0.95)',
        width: 8,
        zIndex: 4,
        value: (dayIndex * slotsPerDay) - 0.5,
      });
    }

    return separators;
  }, [slotsPerDay]);

  const options = React.useMemo(
    () => ({
      chart: {
        type: 'heatmap',
        backgroundColor: 'transparent',
        spacingTop: 20,
        spacingBottom: 28,
        spacingRight: 96,
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories,
        min: 0,
        max: Math.max(categories.length - 1, 0),
        tickPositions: majorTickPositions,
        minorTickInterval: 1,
        minorTicks: true,
        tickLength: 8,
        tickWidth: 1,
        tickColor: '#0f172a',
        minorTickLength: 5,
        minorTickWidth: 1,
        minorTickColor: '#94a3b8',
        startOnTick: false,
        endOnTick: false,
        title: { text: null },
        labels: {
          autoRotation: false,
          allowOverlap: true,
          crop: false,
          overflow: 'allow',
          formatter() {
            return formatWeeklyAxisLabel(this.value, categories);
          },
          style: { fontSize: '10px', whiteSpace: 'nowrap' },
        },
        plotLines: daySeparatorLines,
        plotBands: dayBands,
      },
      yAxis: {
        categories: employees.map((employee) => employee.name),
        title: { text: null },
        reversed: true,
        labels: { style: { fontSize: '10px' } },
      },
      tooltip: {
        formatter() {
          const slot = categories[this.point.x] || '';
          const employeeName = employees[this.point.y]?.name || 'Mitarbeiter';
          const roleLabel = this.point.options?.roleLabel || '';
          const planned = Number(this.point.value || 0) > 0 ? 'Ja' : 'Nein';
          const groupName = this.point.options?.groupName || employees[this.point.y]?.groupName || 'Gruppe';
          return `<b>${employeeName}</b><br/>Typ: <b>${roleLabel}</b><br/>Gruppe: <b>${groupName}</b><br/>${slot}<br/>Geplant: <b>${planned}</b>`;
        },
      },
      series: [
        {
          type: 'heatmap',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.6)',
          data: heatValues,
          nullColor: '#e2e8f0',
          states: {
            hover: {
              borderColor: accent,
              borderWidth: 1.5,
            },
          },
        },
      ],
    }),
    [accent, categories, dayBands, daySeparatorLines, employees, heatValues, majorTickPositions]
  );

  if (!employees.length || !categories.length) {
    return (
      <Paper className="analysis-diagram-placeholder" withBorder p="lg">
        <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
          <Badge variant="light" size="lg" className="analysis-diagram-placeholder-badge">
            Wochen-Dienstplan
          </Badge>
          <Title order={3} className="analysis-diagram-placeholder-title">
            Keine aktiven Mitarbeiter am Stichtag
          </Title>
          <Text size="sm" c="dimmed" ta="center" className="analysis-diagram-placeholder-text">
            Prufe Gruppenfilter und Stichtag in der Filterleiste.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="analysis-diagram-placeholder analysis-quality-chart" withBorder p="xs">
      {groupLegend.length > 0 && (
        <Group gap={10} wrap="wrap" mb={6}>
          {groupLegend.map((entry) => (
            <Group key={entry.id} gap={6} wrap="nowrap">
              <Box w={10} h={10} style={{ borderRadius: 999, background: entry.color, border: '1px solid rgba(15,23,42,0.2)' }} />
              <Text size="xs" c="dimmed">{entry.name}</Text>
            </Group>
          ))}
          <Group gap={6} wrap="nowrap">
            <Box w={10} h={10} style={{ borderRadius: 999, background: QUALITY_ADMIN_TIME_COLOR, border: '1px solid rgba(15,23,42,0.2)' }} />
            <Text size="xs" c="dimmed">Administrative Zeit</Text>
          </Group>
        </Group>
      )}
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
    </Paper>
  );
}

const QUALITY_CHART_SLIDES = [
  { id: 'quality-donut', title: 'Datenvollstandigkeit' },
  { id: 'quality-plan', title: 'Wochen-Dienstplan (Stichtag)' },
];

function QualityStageCarousel({ qualityDonutData, qualityStaffScheduleData, accent }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canGoPrev, setCanGoPrev] = React.useState(false);
  const [canGoNext, setCanGoNext] = React.useState(true);

  React.useEffect(() => {
    if (!emblaApi) return undefined;

    const updateState = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
      setCanGoPrev(emblaApi.canScrollPrev());
      setCanGoNext(emblaApi.canScrollNext());
    };

    updateState();
    emblaApi.on('select', updateState);
    emblaApi.on('reInit', updateState);

    return () => {
      emblaApi.off('select', updateState);
      emblaApi.off('reInit', updateState);
    };
  }, [emblaApi]);

  const goPrev = React.useCallback(() => {
    if (!canGoPrev) return;
    emblaApi?.scrollPrev();
  }, [canGoPrev, emblaApi]);

  const goNext = React.useCallback(() => {
    if (!canGoNext) return;
    emblaApi?.scrollNext();
  }, [canGoNext, emblaApi]);

  return (
    <Box className="analysis-coverage-carousel-wrap">
      <Group className="analysis-coverage-carousel-header" justify="space-between" wrap="nowrap">
        <Text size="xs" fw={700} className="analysis-stage-recommendation-title">
          {QUALITY_CHART_SLIDES[activeIndex]?.title || 'Diagramm'}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge variant="filled" size="md" className="analysis-coverage-carousel-counter">
            {activeIndex + 1}/{QUALITY_CHART_SLIDES.length}
          </Badge>
          <ActionIcon
            variant="filled"
            size="md"
            className="analysis-coverage-carousel-nav"
            aria-label="Vorheriges Diagramm"
            onClick={goPrev}
            disabled={!canGoPrev}
          >
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon
            variant="filled"
            size="md"
            className="analysis-coverage-carousel-nav"
            aria-label="Nachstes Diagramm"
            onClick={goNext}
            disabled={!canGoNext}
          >
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Carousel
        withIndicators
        getEmblaApi={setEmblaApi}
        onSlideChange={setActiveIndex}
        slideSize="100%"
        slideGap={0}
        emblaOptions={{ loop: false, align: 'start', dragFree: false }}
        className="analysis-coverage-carousel"
      >
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 0 ? <QualityDonutChart data={qualityDonutData} /> : null}
          </Box>
        </Carousel.Slide>

        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 1 ? <QualityStaffScheduleChart scheduleData={qualityStaffScheduleData} accent={accent} /> : null}
          </Box>
        </Carousel.Slide>
      </Carousel>
    </Box>
  );
}

function CoverageHeatmap({ categories, groups, heatValues, accent, mode, onHoverChange }) {
  const slotsPerDay = React.useMemo(() => Math.max(Math.floor(categories.length / 5), 0), [categories.length]);
  const majorTickPositions = React.useMemo(() => {
    if (slotsPerDay === 0) return [];

    const positions = [];
    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      for (let slotIndex = 0; slotIndex < slotsPerDay; slotIndex += 2) {
        positions.push((dayIndex * slotsPerDay) + slotIndex);
      }
    }

    return positions;
  }, [slotsPerDay]);

  const dayBands = React.useMemo(() => {
    if (!slotsPerDay) return [];
    return ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((label, idx) => ({
      from: idx * slotsPerDay - 0.5,
      to: ((idx + 1) * slotsPerDay) - 0.5,
      color: idx % 2 === 0 ? 'rgba(241,245,249,0.55)' : 'rgba(226,232,240,0.48)',
      label: { text: label, y: -6, style: { color: '#334155', fontSize: '10px' } },
    }));
  }, [slotsPerDay]);

  const metricRange = React.useMemo(() => {
    const values = heatValues.map((entry) => {
      if (Array.isArray(entry)) return Number(entry[2] || 0);
      return Number(entry?.value || 0);
    });
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    if (min === max) {
      return { min: min - 0.5, max: max + 0.5 };
    }
    return { min, max };
  }, [heatValues]);

  const colorStops = React.useMemo(() => {
    if (mode === HEATMAP_MODES.PRESENT_STAFF) {
      return [
        [0, '#ef4444'],
        [0.5, '#f59e0b'],
        [1, '#0ea5e9'],
      ];
    }

    return [
      [0, '#0ea5e9'],
      [0.5, '#f59e0b'],
      [1, '#ef4444'],
    ];
  }, [mode]);

  const metricLabel = React.useMemo(() => {
    if (mode === HEATMAP_MODES.UNWEIGHTED_QUOTIENT) return 'Quotient (Kinder pro päd. MA)';
    if (mode === HEATMAP_MODES.CARE_KEY) return 'Betreuungsschlüssel';
    return 'Päd. Mitarbeiter';
  }, [mode]);

  const legendDescription = React.useMemo(() => {
    if (mode === HEATMAP_MODES.PRESENT_STAFF) {
      return 'Je mehr pädagogische Mitarbeitende anwesend sind, desto kälter (blauer) die Zelle.';
    }
    if (mode === HEATMAP_MODES.CARE_KEY) {
      return 'Betreuungsschlüssel = Kinder pro pädagogischer Mitarbeiter. Niedriger Schlüssel bedeutet mehr Mitarbeitende pro Kind (kalt).';
    }
    return 'Quotient = Kinder pro pädagogischer Mitarbeiter. Niedriger Quotient bedeutet mehr Mitarbeitende pro Kind (kalt), hoher Quotient bedeutet weniger Mitarbeitende pro Kind (rot).';
  }, [mode]);

  const daySeparatorLines = React.useMemo(() => {
    if (slotsPerDay === 0) return [];

    const separators = [];
    for (let dayIndex = 1; dayIndex < 5; dayIndex += 1) {
      separators.push({
        color: 'rgba(255,255,255,0.95)',
        width: 8,
        zIndex: 4,
        value: (dayIndex * slotsPerDay) - 0.5,
      });
    }

    return separators;
  }, [slotsPerDay]);

  const options = React.useMemo(
    () => ({
      chart: {
        type: 'heatmap',
        zoomType: 'xy',
        backgroundColor: 'transparent',
        spacingTop: 20,
        spacingBottom: 28,
        spacingRight: 96,
        resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' },
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        type: 'linear',
        categories,
        min: 0,
        max: Math.max(categories.length - 1, 0),
        tickPositions: majorTickPositions,
        minorTickInterval: 1,
        minorTicks: true,
        tickLength: 8,
        tickWidth: 1,
        tickColor: '#0f172a',
        minorTickLength: 5,
        minorTickWidth: 1,
        minorTickColor: '#94a3b8',
        startOnTick: false,
        endOnTick: false,
        title: { text: null },
        labels: {
          autoRotation: false,
          allowOverlap: true,
          crop: false,
          overflow: 'allow',
          formatter() {
            return formatWeeklyAxisLabel(this.value, categories);
          },
          style: { fontSize: '10px', whiteSpace: 'nowrap' },
        },
        plotLines: daySeparatorLines,
        plotBands: dayBands,
      },
      yAxis: {
        categories: groups.map((group) => group.name),
        title: { text: null },
        reversed: true,
      },
      colorAxis: {
        min: metricRange.min,
        max: metricRange.max,
        stops: colorStops,
      },
      tooltip: {
        formatter() {
          const slot = categories[this.point.x] || '';
          const groupName = groups[this.point.y]?.name || 'Gruppe';
          const value = Number(this.point.value || 0);
          return `<b>${groupName}</b><br/>${slot}<br/>${metricLabel}: <b>${value.toFixed(2)}</b>`;
        },
      },
      series: [
        {
          type: 'heatmap',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.6)',
          data: heatValues,
          nullColor: 'rgba(226,232,240,0.5)',
          point: {
            events: {
              mouseOver() {
                if (!onHoverChange) return;
                const options = this.options || {};
                onHoverChange({
                  label: options.kpiLabel || `${groups[this.y]?.name || 'Gruppe'} · ${categories[this.x] || '-'}`,
                  demand: Number(options.demand || 0),
                  capacityPedagogical: Number(options.capacityPedagogical || 0),
                  capacityAdministrative: Number(options.capacityAdministrative || 0),
                  careRatio: Number(options.careRatio || 0),
                  expertRatio: Number(options.expertRatio || 0),
                });
              },
            },
          },
          states: {
            hover: {
              borderColor: accent,
              borderWidth: 1.5,
            },
          },
        },
      ],
    }),
    [accent, categories, colorStops, dayBands, daySeparatorLines, groups, heatValues, majorTickPositions, metricLabel, metricRange.max, metricRange.min, onHoverChange]
  );

  const legendEntries = React.useMemo(() => {
    if (mode === HEATMAP_MODES.PRESENT_STAFF) {
      return [
        { color: '#0ea5e9', label: 'Kalt: viele Mitarbeiter anwesend' },
        { color: '#f59e0b', label: 'Mittel: normale Besetzung' },
        { color: '#ef4444', label: 'Heiß: wenige Mitarbeiter anwesend' },
      ];
    }

    if (mode === HEATMAP_MODES.CARE_KEY) {
      return [
        { color: '#0ea5e9', label: 'Kalt: niedriger Schlüssel (mehr MA pro Kind)' },
        { color: '#f59e0b', label: 'Mittel: mittlerer Schlüssel' },
        { color: '#ef4444', label: 'Heiß: hoher Schlüssel (weniger MA pro Kind)' },
      ];
    }

    return [
      { color: '#0ea5e9', label: 'Kalt: niedriger Quotient (mehr MA pro Kind)' },
      { color: '#f59e0b', label: 'Mittel: mittlerer Quotient' },
      { color: '#ef4444', label: 'Heiß: hoher Quotient (weniger MA pro Kind)' },
    ];
  }, [mode]);

  return (
    <Stack style={{ height: '100%', minHeight: 0 }} gap={4}>
      <Text size="xs" c="dimmed" ta="center">{legendDescription}</Text>
      <Group gap={10} wrap="nowrap" justify="center">
        {legendEntries.map((entry) => (
          <Group key={entry.label} gap={6} wrap="nowrap">
            <Box w={10} h={10} style={{ borderRadius: 999, background: entry.color, border: '1px solid rgba(15,23,42,0.18)' }} />
            <Text size="xs" c="dimmed">{entry.label}</Text>
          </Group>
        ))}
      </Group>

      <Box style={{ flex: '1 1 auto', minHeight: 0, overflow: 'visible' }}>
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Stack>
  );
}

const STATUS_CHART_SLIDES = [
  { id: 'demand', title: 'Kapazität & Bedarf' },
  { id: 'ratio', title: 'Schlüssel' },
  { id: 'heatmap', title: 'Heatmap (alle Gruppen)' },
];

function CoverageStageCarousel({ weeklyData, categories, groups, heatValues, accent, onHoverChange, heatmapMode }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canGoPrev, setCanGoPrev] = React.useState(false);
  const [canGoNext, setCanGoNext] = React.useState(true);

  React.useEffect(() => {
    if (!emblaApi) return undefined;

    const updateState = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
      setCanGoPrev(emblaApi.canScrollPrev());
      setCanGoNext(emblaApi.canScrollNext());
    };

    updateState();
    emblaApi.on('select', updateState);
    emblaApi.on('reInit', updateState);

    return () => {
      emblaApi.off('select', updateState);
      emblaApi.off('reInit', updateState);
    };
  }, [emblaApi]);

  const goPrev = React.useCallback(() => {
    if (!canGoPrev) return;
    emblaApi?.scrollPrev();
  }, [canGoPrev, emblaApi]);

  const goNext = React.useCallback(() => {
    if (!canGoNext) return;
    emblaApi?.scrollNext();
  }, [canGoNext, emblaApi]);

  return (
    <Box className="analysis-coverage-carousel-wrap">
      <Group className="analysis-coverage-carousel-header" justify="space-between" wrap="nowrap">
        <Text size="xs" fw={700} className="analysis-stage-recommendation-title">
          {STATUS_CHART_SLIDES[activeIndex]?.title || 'Diagramm'}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge variant="filled" size="md" className="analysis-coverage-carousel-counter">
            {activeIndex + 1}/{STATUS_CHART_SLIDES.length}
          </Badge>
          <ActionIcon
            variant="filled"
            size="md"
            className="analysis-coverage-carousel-nav"
            aria-label="Vorheriges Diagramm"
            onClick={goPrev}
            disabled={!canGoPrev}
          >
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon
            variant="filled"
            size="md"
            className="analysis-coverage-carousel-nav"
            aria-label="Nächstes Diagramm"
            onClick={goNext}
            disabled={!canGoNext}
          >
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Carousel
        withIndicators
        withControls={false}
        getEmblaApi={setEmblaApi}
        className="analysis-coverage-carousel"
        slideSize="100%"
        slideGap={0}
        emblaOptions={{ loop: false, align: 'start', dragFree: false }}
      >
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 0 ? (
              <WeeklyChart
                chartData={weeklyData}
                chartMode="demand"
                showRatioChart={false}
                syncGroupKey="analysis-step-2"
                onHoverChange={onHoverChange}
              />
            ) : null}
          </Box>
        </Carousel.Slide>

        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 1 ? (
              <WeeklyChart
                chartData={weeklyData}
                chartMode="ratio"
                showRatioChart
                syncGroupKey="analysis-step-2"
                onHoverChange={onHoverChange}
              />
            ) : null}
          </Box>
        </Carousel.Slide>

        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 2 ? (
              <CoverageHeatmap
                categories={categories}
                groups={groups}
                heatValues={heatValues}
                accent={accent}
                mode={heatmapMode}
                onHoverChange={onHoverChange}
              />
            ) : null}
          </Box>
        </Carousel.Slide>
      </Carousel>
    </Box>
  );
}

function ResilienceScorePanel({ monteCarlo }) {
  const resilienceScore = Number(monteCarlo?.resilienceScorePct || 0);
  const regularDaysPct = Number(monteCarlo?.regularDaysPct || 0);
  const closurePct = Number(monteCarlo?.closurePct || 0);

  return (
    <Paper withBorder p="md" className="analysis-coverage-heatmap-panel" style={{ height: '100%' }}>
      <Stack gap="md" align="center" justify="center" style={{ height: '100%' }}>
        <RingProgress
          size={180}
          thickness={16}
          roundCaps
          sections={[{ value: resilienceScore, color: resilienceScore >= 75 ? 'teal' : resilienceScore >= 55 ? 'yellow' : 'red' }]}
          label={<Text ta="center" fw={800} size="xl">{resilienceScore.toFixed(1)}%</Text>}
        />
        <Text fw={700}>Resilienz-Score</Text>
        <Text size="xs" c="dimmed" ta="center">
          Toleranzgewichtet: Tage mit wenig Schließung senken den Score nur anteilig.
        </Text>
        <Group gap="xl">
          <Text size="sm">Toleranz-Tage: <b>{regularDaysPct.toFixed(1)}%</b></Text>
          <Text size="sm">Schließung: <b>{closurePct.toFixed(1)}%</b></Text>
        </Group>
      </Stack>
    </Paper>
  );
}

function ResilienceCascadeChart({ monteCarlo, accent }) {
  const counts = monteCarlo?.cascadeCounts || [];
  const total = counts.reduce((sum, value) => sum + Number(value || 0), 0);
  const data = RESILIENCE_CASCADE_STAGES.map((label, index) => {
    const absolute = Number(counts[index] || 0);
    const pct = total > 0 ? (absolute / total) * 100 : 0;
    return { name: label, y: pct, absolute };
  });

  const options = {
    chart: { type: 'column', backgroundColor: 'transparent', spacing: [8, 8, 8, 8] },
    title: { text: null },
    credits: { enabled: false },
    xAxis: {
      categories: RESILIENCE_CASCADE_STAGES,
      labels: { style: { fontSize: '10px' } },
    },
    yAxis: {
      min: 0,
      max: 100,
      title: { text: 'Anteil (%)', style: { fontSize: '11px' } },
    },
    legend: { enabled: false },
    tooltip: {
      pointFormatter() {
        return `Anteil: <b>${this.y.toFixed(1)}%</b><br/>Treffer: <b>${this.absolute}</b>`;
      },
    },
    plotOptions: {
      series: {
        animation: false,
        borderRadius: 3,
      },
    },
    series: [{
      type: 'column',
      data: data.map((entry, index) => ({ ...entry, color: index === 4 ? '#dc2626' : index === 3 ? '#f59e0b' : accent })),
    }],
  };

  return (
    <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel" style={{ height: '100%' }}>
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
    </Paper>
  );
}

function ResilienceHeatmapChart({ xCategories, yCategories, values, accent, title }) {
  const max = Math.max(0.01, ...values.map(([, , value]) => Number(value || 0)));
  const options = {
    chart: { type: 'heatmap', backgroundColor: 'transparent', spacing: [8, 8, 8, 8] },
    title: { text: null },
    credits: { enabled: false },
    xAxis: {
      categories: xCategories,
      labels: { style: { fontSize: '10px' } },
    },
    yAxis: {
      categories: yCategories,
      title: { text: null },
      reversed: true,
    },
    colorAxis: {
      min: 0,
      max,
      stops: [
        [0, '#e2e8f0'],
        [0.45, '#f59e0b'],
        [1, '#dc2626'],
      ],
    },
    legend: { enabled: false },
    tooltip: {
      formatter() {
        const x = xCategories[this.point.x] || '';
        const y = yCategories[this.point.y] || '';
        return `<b>${y}</b><br/>${x}<br/>Risiko: <b>${(Number(this.point.value || 0) * 100).toFixed(1)}%</b>`;
      },
    },
    series: [{
      type: 'heatmap',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.6)',
      data: values,
      states: { hover: { borderColor: accent, borderWidth: 1.5 } },
    }],
  };

  return (
    <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel" style={{ height: '100%' }}>
      <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>{title}</Text>
      <Box h="calc(100% - 1.2rem)">
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Paper>
  );
}

function ResilienceClosurePatternsChart({ monteCarlo, accent }) {
  const closurePatterns = monteCarlo?.closurePatterns || [];
  const topPatterns = closurePatterns.slice(0, 8);

  if (!topPatterns.length) {
    return (
      <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel" style={{ height: '100%' }}>
        <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>
          Schließungs-Muster
        </Text>
        <Text size="sm" c="dimmed">Keine Schließungsereignisse in der Simulation.</Text>
      </Paper>
    );
  }

  const options = {
    chart: { type: 'bar', backgroundColor: 'transparent', spacing: [8, 8, 8, 8] },
    title: { text: null },
    credits: { enabled: false },
    xAxis: {
      categories: topPatterns.map((pattern) => pattern.label),
      labels: { style: { fontSize: '10px' } },
      title: { text: null },
    },
    yAxis: {
      min: 0,
      title: { text: 'Anzahl Schließungsereignisse', style: { fontSize: '11px' } },
    },
    legend: { enabled: false },
    tooltip: {
      formatter() {
        const pattern = topPatterns[this.point.index];
        if (!pattern) return '';
        return `Muster: <b>${pattern.label}</b><br/>Ereignisse: <b>${pattern.count}</b><br/>Ø Dauer: <b>${pattern.avgDurationMinutes.toFixed(0)} Min.</b><br/>Max Dauer: <b>${pattern.maxDurationMinutes.toFixed(0)} Min.</b>`;
      },
    },
    plotOptions: {
      series: {
        animation: false,
        borderRadius: 3,
      },
    },
    series: [{
      type: 'bar',
      data: topPatterns.map((pattern) => ({
        y: Number(pattern.count || 0),
        color: accent,
      })),
    }],
  };

  return (
    <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel" style={{ height: '100%' }}>
      <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>
        Schließungs-Muster und Dauer
      </Text>
      <Box h="calc(100% - 1.2rem)">
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Paper>
  );
}

function ResilienceClosureDurationChart({ monteCarlo, accent }) {
  const durationDistribution = monteCarlo?.closureDurationDistribution || [];
  const stats = monteCarlo?.closureDurationStats || null;

  if (!durationDistribution.length) {
    return (
      <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel" style={{ height: '100%' }}>
        <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>
          Schließungsdauer
        </Text>
        <Text size="sm" c="dimmed">Keine Schließungsereignisse in der Simulation.</Text>
      </Paper>
    );
  }

  const options = {
    chart: { type: 'column', backgroundColor: 'transparent', spacing: [8, 8, 8, 8] },
    title: { text: null },
    credits: { enabled: false },
    xAxis: {
      categories: durationDistribution.map((entry) => entry.label),
      labels: { style: { fontSize: '10px' } },
      title: { text: 'Dauer-Klasse' },
    },
    yAxis: {
      min: 0,
      title: { text: 'Ereignisse', style: { fontSize: '11px' } },
    },
    legend: { enabled: false },
    tooltip: {
      formatter() {
        const row = durationDistribution[this.point.index];
        if (!row) return '';
        return `Dauer: <b>${row.label}</b><br/>Ereignisse: <b>${row.count}</b><br/>Anteil: <b>${row.sharePct.toFixed(1)}%</b>`;
      },
    },
    plotOptions: {
      series: {
        animation: false,
        borderRadius: 3,
      },
    },
    series: [{
      type: 'column',
      data: durationDistribution.map((entry, index) => ({
        y: Number(entry.count || 0),
        color: index >= 3 ? '#dc2626' : accent,
      })),
    }],
  };

  return (
    <Paper withBorder p="xs" className="analysis-coverage-heatmap-panel" style={{ height: '100%' }}>
      <Text size="xs" fw={700} className="analysis-stage-recommendation-title" mb={4}>
        Schließungsdauer-Verteilung
      </Text>
      <Group gap={12} mb={6}>
        <Text size="xs" c="dimmed">Ø {Number(stats?.avgMinutes || 0).toFixed(0)} Min.</Text>
        <Text size="xs" c="dimmed">P95 {Number(stats?.p95Minutes || 0).toFixed(0)} Min.</Text>
        <Text size="xs" c="dimmed">Max {Number(stats?.maxMinutes || 0).toFixed(0)} Min.</Text>
      </Group>
      <Box h="calc(100% - 2.4rem)">
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Paper>
  );
}

const RESILIENCE_CHART_SLIDES = [
  { id: 'score', title: 'Resilienz-Score' },
  { id: 'cascade', title: 'Kompensations-Kaskade' },
  { id: 'closures', title: 'Schließungs-Muster' },
  { id: 'duration', title: 'Schließungsdauer' },
  { id: 'weekday', title: 'Heatmap Wochentage' },
  { id: 'period', title: 'Heatmap Zeitraum' },
];

function ResilienceMonteCarloCarousel({ monteCarlo, categories, accent }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canGoPrev, setCanGoPrev] = React.useState(false);
  const [canGoNext, setCanGoNext] = React.useState(true);

  React.useEffect(() => {
    if (!emblaApi) return undefined;
    const updateState = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
      setCanGoPrev(emblaApi.canScrollPrev());
      setCanGoNext(emblaApi.canScrollNext());
    };
    updateState();
    emblaApi.on('select', updateState);
    emblaApi.on('reInit', updateState);
    return () => {
      emblaApi.off('select', updateState);
      emblaApi.off('reInit', updateState);
    };
  }, [emblaApi]);

  return (
    <Box className="analysis-coverage-carousel-wrap">
      <Group className="analysis-coverage-carousel-header" justify="space-between" wrap="nowrap">
        <Text size="xs" fw={700} className="analysis-stage-recommendation-title">
          {RESILIENCE_CHART_SLIDES[activeIndex]?.title || 'Resilienz'}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge variant="filled" size="md" className="analysis-coverage-carousel-counter">
            {activeIndex + 1}/{RESILIENCE_CHART_SLIDES.length}
          </Badge>
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" onClick={() => emblaApi?.scrollPrev()} disabled={!canGoPrev}>
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" onClick={() => emblaApi?.scrollNext()} disabled={!canGoNext}>
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Carousel
        withIndicators
        withControls={false}
        getEmblaApi={setEmblaApi}
        className="analysis-coverage-carousel"
        slideSize="100%"
        slideGap={0}
        emblaOptions={{ loop: false, align: 'start', dragFree: false }}
      >
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 0 ? <ResilienceScorePanel monteCarlo={monteCarlo} /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 1 ? <ResilienceCascadeChart monteCarlo={monteCarlo} accent={accent} /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 2 ? (
              <ResilienceClosurePatternsChart monteCarlo={monteCarlo} accent={accent} />
            ) : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 3 ? (
              <ResilienceClosureDurationChart monteCarlo={monteCarlo} accent={accent} />
            ) : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 4 ? (
              <ResilienceHeatmapChart
                xCategories={categories}
                yCategories={monteCarlo?.weekdayLabels || ['Mo', 'Di', 'Mi', 'Do', 'Fr']}
                values={monteCarlo?.weekdayHeatValues || []}
                accent={accent}
                title="Kritische Slots nach Wochentag"
              />
            ) : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 5 ? (
              <ResilienceHeatmapChart
                xCategories={monteCarlo?.periodLabels || []}
                yCategories={monteCarlo?.weekdayLabels || ['Mo', 'Di', 'Mi', 'Do', 'Fr']}
                values={monteCarlo?.periodHeatValues || []}
                accent={accent}
                title="Kritische Wochen im Zeitraum"
              />
            ) : null}
          </Box>
        </Carousel.Slide>
      </Carousel>
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

function PreviewSankeyChart({ previewFlow, accent, privacyMode = false }) {
  const [hoverInfo, setHoverInfo] = React.useState(null);
  const [stageBadgePositions, setStageBadgePositions] = React.useState([]);
  const stageBadgeSignatureRef = React.useRef('');

  const filteredLinks = React.useMemo(() => {
    return previewFlow?.links || [];
  }, [previewFlow?.links]);

  const filteredNodes = React.useMemo(() => {
    const nodes = previewFlow?.nodes || [];
    const links = filteredLinks || [];
    if (!links.length) return [];
    const usedIds = new Set();
    links.forEach((entry) => {
      if (entry?.from) usedIds.add(String(entry.from));
      if (entry?.to) usedIds.add(String(entry.to));
    });
    return nodes.filter((node) => usedIds.has(String(node.id)));
  }, [previewFlow?.nodes, filteredLinks]);

  const hasData = filteredLinks.length > 0;
  const stageLabels = React.useMemo(() => {
    const byDate = new Map();
    (filteredNodes || []).forEach((node) => {
      const dateIso = String(node?.dateIso || '');
      if (!dateIso) return;
      if (!byDate.has(dateIso)) {
        byDate.set(dateIso, String(node?.stageLabel || dateIso));
      }
    });
    return Array.from(byDate.entries())
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([, label]) => label);
  }, [filteredNodes]);

  const linksByNodeId = React.useMemo(() => {
    const map = new Map();
    filteredLinks.forEach((entry) => {
      const fromId = String(entry?.from || '');
      const toId = String(entry?.to || '');
      if (fromId) {
        const fromLinks = map.get(fromId) || [];
        fromLinks.push(entry);
        map.set(fromId, fromLinks);
      }
      if (toId) {
        const toLinks = map.get(toId) || [];
        toLinks.push(entry);
        map.set(toId, toLinks);
      }
    });
    return map;
  }, [filteredLinks]);

  const options = React.useMemo(
    () => {
      const links = filteredLinks;
      const nodes = filteredNodes;
      const nodesById = new Map(nodes.map((node) => [String(node.id), node]));
      const resolveNodeColor = (groupIdRaw) => {
        const groupId = String(groupIdRaw || '__NO_GROUP__');
        const mappedColor = previewFlow?.groupColorsById?.[groupId];
        if (mappedColor) return mappedColor;
        if (groupId === '__NO_GROUP__') return '#94a3b8';
        return accent;
      };

      const linksWithColor = links.map((entry) => {
        const toNode = nodesById.get(String(entry.to));
        return {
          ...entry,
          color: resolveNodeColor(toNode?.groupId),
        };
      });

      const nodesWithColor = [...nodes]
        .sort((left, right) => {
          const dateDiff = String(left?.dateIso || '').localeCompare(String(right?.dateIso || ''));
          if (dateDiff !== 0) return dateDiff;
          return Number(right?.rank || 0) - Number(left?.rank || 0);
        })
        .map((node) => ({
          ...node,
          color: resolveNodeColor(node.groupId),
        }));

      return {
        chart: {
          backgroundColor: 'transparent',
          spacing: [40, 8, 8, 8],
          events: {
            render() {
              const sankeySeries = this.series?.find((series) => series?.type === 'sankey');
              if (!sankeySeries) return;

              const byDate = new Map();
              (sankeySeries.points || []).forEach((point) => {
                if (!point?.isNode) return;
                const dateIso = String(point?.options?.dateIso || '');
                if (!dateIso) return;
                const shape = point.shapeArgs;
                if (!shape || !Number.isFinite(shape.x) || !Number.isFinite(shape.width)) return;

                const centerX = this.plotLeft + Number(shape.x) + (Number(shape.width) / 2);
                const current = byDate.get(dateIso) || {
                  label: String(point?.options?.stageLabel || dateIso),
                  sumX: 0,
                  count: 0,
                };
                current.sumX += centerX;
                current.count += 1;
                byDate.set(dateIso, current);
              });

              const next = Array.from(byDate.entries())
                .sort(([left], [right]) => String(left).localeCompare(String(right)))
                .map(([dateIso, entry]) => ({
                  dateIso,
                  label: entry.label,
                  leftPx: entry.count > 0 ? entry.sumX / entry.count : 0,
                }));

              const signature = JSON.stringify(next.map((item) => [item.dateIso, Math.round(item.leftPx), item.label]));
              if (signature !== stageBadgeSignatureRef.current) {
                stageBadgeSignatureRef.current = signature;
                setStageBadgePositions(next);
              }
            },
          },
        },
        title: { text: null },
        credits: { enabled: false },
        tooltip: {
          pointFormatter() {
            if (this.isNode) {
              return `<b>${this.name || ''}</b><br/>Stufe: <b>${this.options?.stageLabel || '-'}</b><br/>Kinder: <b>${Number(this.sum || 0)}</b>`;
            }
            const stepLabel = this.options?.stepLabel ? `<br/>Zeitpunkt: <b>${this.options.stepLabel}</b>` : '';
            return `<b>${this.fromNode?.name || ''}</b> -> <b>${this.toNode?.name || ''}</b>: <b>${Number(this.weight || 0)}</b>${stepLabel}`;
          },
        },
        plotOptions: {
          series: {
            animation: false,
          },
          sankey: {
            nodePadding: 14,
            nodeWidth: 18,
            curveFactor: 0.45,
            minLinkWidth: 2,
            point: {
              events: {
                mouseOut() {
                  setHoverInfo(null);
                },
                mouseOver() {
                  if (this.isNode) {
                    const nodeId = String(this.id || this.options?.id || '');
                    const relatedLinks = linksByNodeId.get(nodeId) || [];
                    const childrenMap = new Map();
                    relatedLinks.forEach((link) => {
                      (link.children || []).forEach((child) => {
                        childrenMap.set(String(child.id || ''), child);
                      });
                    });
                    setHoverInfo({
                      kind: 'node',
                      title: String(this.name || '-'),
                      subtitle: String(this.options?.stageLabel || '-'),
                      count: Number(this.sum || 0),
                      children: Array.from(childrenMap.values()),
                    });
                    return;
                  }

                  setHoverInfo({
                    kind: 'link',
                    title: `${this.fromNode?.name || '-'} -> ${this.toNode?.name || '-'}`,
                    subtitle: String(this.options?.stepLabel || '-'),
                    count: Number(this.weight || 0),
                    children: Array.isArray(this.options?.children) ? this.options.children : [],
                  });
                },
              },
            },
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
            name: 'Gruppenubergange',
            data: linksWithColor,
            nodes: nodesWithColor,
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
    [accent, filteredLinks, filteredNodes, linksByNodeId, previewFlow?.groupColorsById]
  );

  if (!hasData) {
    return (
      <Paper className="analysis-diagram-placeholder" withBorder p="lg">
        <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
          <Badge variant="light" size="lg" className="analysis-diagram-placeholder-badge">
            Sankey-Chart
          </Badge>
          <Title order={3} className="analysis-diagram-placeholder-title">
            Keine gruppenbezogenen Ubergange
          </Title>
          <Text size="sm" c="dimmed" ta="center" className="analysis-diagram-placeholder-text">
            Ab dem Stichtag wurden in den bekannten Ereignissen keine Gruppenwechsel aktiver Kinder gefunden.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="analysis-diagram-placeholder" withBorder p="xs">
      <Group align="stretch" gap="sm" wrap="nowrap" style={{ minHeight: 0, height: '100%' }}>
        <Box style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <Box style={{ position: 'relative', height: '100%' }}>
            {(stageBadgePositions.length > 0 || stageLabels.length > 0) ? (
              <Box style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 22, pointerEvents: 'none', zIndex: 2 }}>
                {(stageBadgePositions.length > 0 ? stageBadgePositions : stageLabels.map((label, idx) => ({
                  dateIso: String(idx),
                  label,
                  leftPx: `${((idx + 1) / (stageLabels.length + 1)) * 100}%`,
                }))).map((entry) => (
                  <Box
                    key={`sankey-stage-${entry.dateIso}`}
                    style={{
                      position: 'absolute',
                      left: typeof entry.leftPx === 'string' ? entry.leftPx : `${entry.leftPx}px`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <Badge variant="outline" size="xs" color="gray">{entry.label}</Badge>
                  </Box>
                ))}
              </Box>
            ) : null}
            <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
          </Box>
        </Box>
        <Box style={{ width: 320, minWidth: 320, maxWidth: 320, flex: '0 0 320px', borderLeft: '1px solid var(--mantine-color-gray-3)', paddingLeft: 12, overflowY: 'auto' }}>
          {hoverInfo ? (
            <Stack gap={6}>
              <Badge variant="outline" size="sm" color="gray">{hoverInfo.subtitle}</Badge>
              <Text size="sm" fw={600}>{hoverInfo.title}</Text>
              <Badge variant="light" size="sm" color="gray">Kinder: {hoverInfo.count}</Badge>
              <Box>
                <Text size="xs" fw={600} mb={4}>Kinderliste</Text>
                <Text size="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
                  {(hoverInfo.children || []).slice(0, 120).map((child, idx) => (
                    <span key={`${String(child.id || '')}-${idx}`}>
                      {privacyMode ? `Kind ${idx + 1}` : (child.name || `Kind ${idx + 1}`)}
                      {idx < Math.min((hoverInfo.children || []).length, 120) - 1 ? ', ' : ''}
                    </span>
                  ))}
                </Text>
              </Box>
            </Stack>
          ) : (
            <Text size="xs" c="dimmed">Sankey-Link oder Knoten berühren, um Werte anzuzeigen.</Text>
          )}
        </Box>
      </Group>
    </Paper>
  );
}

function ForecastGroupTimelineChart({ previewFlow, accent, privacyMode = false }) {
  const sharedChartMargins = {
    marginLeft: 76,
    marginRight: 12,
  };

  const groupTimeline = previewFlow?.groupTimeline || null;
  const categories = groupTimeline?.labels || [];
  const timelineDateIsos = groupTimeline?.dates || [];
  const seriesByGroup = groupTimeline?.seriesByGroup || [];
  const timelinePoints = groupTimeline?.timelinePoints || EMPTY_LIST;
  const rangeStartIso = groupTimeline?.rangeStartIso || null;
  const rangeEndIso = groupTimeline?.rangeEndIso || null;
  const [hoveredTimestamp, setHoveredTimestamp] = React.useState(null);
  const rangeStartMs = rangeStartIso ? new Date(`${rangeStartIso}T00:00:00Z`).getTime() : undefined;
  const rangeEndMs = rangeEndIso ? new Date(`${rangeEndIso}T00:00:00Z`).getTime() : undefined;
  const timelineDateMs = timelineDateIsos.map((dateIso) => new Date(`${dateIso}T00:00:00Z`).getTime());

  const hoverIndex = React.useMemo(() => {
    if (!timelineDateMs.length || hoveredTimestamp == null) return -1;
    let bestIndex = 0;
    let bestDistance = Math.abs(Number(timelineDateMs[0]) - Number(hoveredTimestamp));
    for (let idx = 1; idx < timelineDateMs.length; idx += 1) {
      const distance = Math.abs(Number(timelineDateMs[idx]) - Number(hoveredTimestamp));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = idx;
      }
    }
    return bestIndex;
  }, [hoveredTimestamp, timelineDateMs]);

  const hoverTimestamp = hoverIndex >= 0 ? Number(timelineDateMs[hoverIndex]) : null;

  const eventCountByTimestamp = React.useMemo(() => {
    const map = new Map();
    (timelinePoints || []).forEach((point) => {
      const key = Number(point?.x || 0);
      if (!Number.isFinite(key)) return;
      map.set(key, Number(point?.count || 0));
    });
    return map;
  }, [timelinePoints]);

  const hoverEventCount = hoverTimestamp == null ? 0 : Number(eventCountByTimestamp.get(hoverTimestamp) || 0);

  if (!categories.length || !seriesByGroup.length) {
    return (
      <Paper className="analysis-diagram-placeholder" withBorder p="lg">
        <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
          <Badge variant="light" size="lg" className="analysis-diagram-placeholder-badge">
            Gruppenverlauf
          </Badge>
          <Title order={3} className="analysis-diagram-placeholder-title">
            Keine Gruppendaten
          </Title>
          <Text size="sm" c="dimmed" ta="center" className="analysis-diagram-placeholder-text">
            Für den gewählten Zeitraum konnten keine Gruppenverläufe ermittelt werden.
          </Text>
        </Stack>
      </Paper>
    );
  }

  const buildLineOptions = (groupSeries, showXAxis) => ({
    chart: {
      type: 'line',
      backgroundColor: 'transparent',
      spacing: [4, 8, 4, 8],
      ...sharedChartMargins,
    },
    title: { text: null },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      type: 'datetime',
      min: rangeStartMs,
      max: rangeEndMs,
      plotLines: hoverTimestamp == null
        ? []
        : [{ value: hoverTimestamp, color: '#334155', width: 1, zIndex: 7, dashStyle: 'ShortDot' }],
      labels: {
        enabled: showXAxis,
        format: '{value:%d.%m.%Y}',
        rotation: showXAxis ? -25 : 0,
      },
      tickLength: showXAxis ? 4 : 0,
      lineWidth: showXAxis ? 1 : 0,
    },
    yAxis: {
      min: 0,
      allowDecimals: false,
      title: { text: groupSeries?.name || 'Gruppe' },
    },
    tooltip: {
      shared: false,
      positioner(labelWidth, labelHeight, point) {
        const chart = this.chart;
        let x = point.plotX + chart.plotLeft - labelWidth / 2;
        let y = point.plotY + chart.plotTop - labelHeight - 12;
        x = Math.max(chart.plotLeft, Math.min(x, chart.plotLeft + chart.plotWidth - labelWidth));
        y = Math.max(chart.plotTop, y);
        return { x, y };
      },
      pointFormatter() {
        const dateLabel = Highcharts.dateFormat('%d.%m.%Y', Number(this.x || 0));
        return `<b>${this.series.name}</b><br/>${dateLabel}: <b>${Number(this.y || 0)}</b> Kinder`;
      },
    },
    plotOptions: {
      series: {
        animation: false,
        marker: { enabled: false },
        point: {
          events: {
            mouseOver() {
              setHoveredTimestamp(Number(this.x));
            },
          },
        },
      },
    },
    series: [
      {
        type: 'line',
        name: groupSeries?.name || 'Gruppe',
        data: timelineDateMs.map((x, idx) => [x, Number(groupSeries?.data?.[idx] || 0)]),
        color: groupSeries?.color || accent,
        lineWidth: 2,
      },
    ],
  });

  const timelineOptions = {
    chart: {
      type: 'timeline',
      backgroundColor: 'transparent',
      spacing: [4, 8, 8, 8],
      ...sharedChartMargins,
    },
    title: { text: null },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      type: 'datetime',
      min: rangeStartMs,
      max: rangeEndMs,
      plotLines: hoverTimestamp == null
        ? []
        : [{ value: hoverTimestamp, color: '#334155', width: 1, zIndex: 7, dashStyle: 'ShortDot' }],
      labels: {
        format: '{value:%d.%m.%Y}',
      },
      title: { text: 'Event-Timeline' },
    },
    yAxis: {
      visible: false,
      title: { text: null },
    },
    tooltip: {
      useHTML: true,
      positioner(labelWidth, labelHeight, point) {
        const chart = this.chart;
        let x = point.plotX + chart.plotLeft - labelWidth / 2;
        let y = point.plotY + chart.plotTop - labelHeight - 12;
        x = Math.max(chart.plotLeft, Math.min(x, chart.plotLeft + chart.plotWidth - labelWidth));
        y = Math.max(chart.plotTop, y);
        return { x, y };
      },
      pointFormatter() {
        const dateText = this.options.dateLabel || this.key || '';
        const total = Number(this.options.count || 0);
        const autoCount = Number(this.options.autoCount || 0);
        const eventList = this.options.eventList || [];
        const eventRows = eventList.slice(0, 8).map((ev) => {
          const typeLabel = ev.targetStage
            ? `\u2192 ${ev.targetStage}`
            : String(ev.type || '').replace(/_/g, ' ');
          return `<li>${ev.entityName || '-'} (${typeLabel})</li>`;
        }).join('');
        const moreHint = eventList.length > 8 ? `<li style="color:#94a3b8">+${eventList.length - 8} weitere</li>` : '';
        return `<strong>${dateText}</strong><br /><span>${total} Events (${autoCount} Auto)</span><ul style="margin:4px 0 0 0;padding-left:16px;font-size:11px">${eventRows}${moreHint}</ul>`;
      },
    },
    plotOptions: {
      series: {
        animation: false,
        point: {
          events: {
            mouseOver() {
              setHoveredTimestamp(Number(this.x));
            },
          },
        },
      },
      timeline: {
        marker: {
          symbol: 'circle',
        },
        dataLabels: {
          enabled: false,
        },
      },
    },
    series: [
      {
        type: 'timeline',
        name: 'Events',
        data: timelinePoints,
        color: '#64748b',
        showInLegend: false,
      },
    ],
  };

  return (
    <Paper className="analysis-diagram-placeholder" withBorder p="xs" onMouseLeave={() => setHoveredTimestamp(null)}>
      <Group align="stretch" gap="sm" wrap="nowrap" style={{ minHeight: 0, height: '100%' }}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Stack gap={6} h="100%" style={{ overflowY: 'auto', minHeight: 0 }}>
            {seriesByGroup.map((groupSeries, idx) => (
              <Box key={`forecast-group-series-${groupSeries.groupId || idx}`} style={{ minHeight: 130, height: 130, flex: '0 0 auto' }}>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={buildLineOptions(groupSeries, false)}
                  containerProps={{ style: { height: '100%' } }}
                />
              </Box>
            ))}
            <Box style={{ minHeight: 170, height: 170, flex: '0 0 auto' }}>
              <HighchartsReact
                highcharts={Highcharts}
                options={timelineOptions}
                containerProps={{ style: { height: '100%' } }}
              />
            </Box>
          </Stack>
        </Box>

        <Box style={{ width: 320, minWidth: 320, maxWidth: 320, flex: '0 0 320px', borderLeft: '1px solid var(--mantine-color-gray-3)', paddingLeft: 12, overflowY: 'auto' }}>
          {hoverIndex >= 0 ? (
            <Stack gap={6}>
              <Group gap={8} wrap="wrap">
                <Badge variant="outline" color="gray" size="sm">
                  {categories[hoverIndex] || '-'}
                </Badge>
                {seriesByGroup.map((groupSeries) => (
                  <Badge key={`hover-value-${groupSeries.groupId}`} variant="light" size="sm" style={{ backgroundColor: `${groupSeries.color || accent}1A`, color: groupSeries.color || accent }}>
                    {groupSeries.name}: {Number(groupSeries?.data?.[hoverIndex] || 0)}
                  </Badge>
                ))}
                <Badge variant="light" color="gray" size="sm">
                  Events: {hoverEventCount}
                </Badge>
              </Group>

              {seriesByGroup.map((groupSeries) => {
                const children = groupSeries.childrenByIndex?.[hoverIndex] || [];
                if (!children.length) return null;
                return (
                  <Box key={`child-list-${groupSeries.groupId}`}>
                    <Text size="xs" fw={600} style={{ color: groupSeries.color || accent }}>
                      {groupSeries.name}:
                    </Text>
                    <Text size="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
                      {children.map((child, idx) => (
                        <span key={child.id}>
                          {privacyMode ? `Kind ${idx + 1}` : child.name}
                          {idx < children.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </Text>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed">Diagramm berühren, um Werte anzuzeigen.</Text>
          )}
        </Box>
      </Group>
    </Paper>
  );
}

function ForecastHoursTimelineChart({ previewFlow, accent, privacyMode = false }) {
  const sharedChartMargins = { marginLeft: 76, marginRight: 12 };
  const groupTimeline = previewFlow?.groupTimeline || null;
  const timelineDateIsos = groupTimeline?.dates || [];
  const seriesByGroup = groupTimeline?.seriesByGroup || [];
  const rangeStartIso = groupTimeline?.rangeStartIso || null;
  const rangeEndIso = groupTimeline?.rangeEndIso || null;
  const [hoveredTimestamp, setHoveredTimestamp] = React.useState(null);
  const rangeStartMs = rangeStartIso ? new Date(`${rangeStartIso}T00:00:00Z`).getTime() : undefined;
  const rangeEndMs = rangeEndIso ? new Date(`${rangeEndIso}T00:00:00Z`).getTime() : undefined;
  const timelineDateMs = timelineDateIsos.map((d) => new Date(`${d}T00:00:00Z`).getTime());

  const hoverIndex = React.useMemo(() => {
    if (!timelineDateMs.length || hoveredTimestamp == null) return -1;
    let best = 0;
    let bestDist = Math.abs(Number(timelineDateMs[0]) - Number(hoveredTimestamp));
    for (let i = 1; i < timelineDateMs.length; i += 1) {
      const d = Math.abs(Number(timelineDateMs[i]) - Number(hoveredTimestamp));
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, [hoveredTimestamp, timelineDateMs]);

  const hoverTimestamp = hoverIndex >= 0 ? Number(timelineDateMs[hoverIndex]) : null;

  if (!seriesByGroup.length) {
    return (
      <Paper className="analysis-diagram-placeholder" withBorder p="lg">
        <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
          <Badge variant="light" size="lg">Buchungsstunden</Badge>
          <Title order={3} className="analysis-diagram-placeholder-title">Keine Buchungsdaten</Title>
          <Text size="sm" c="dimmed" ta="center">Für den gewählten Zeitraum konnten keine Buchungsstunden ermittelt werden.</Text>
        </Stack>
      </Paper>
    );
  }

  const buildHoursOptions = (groupSeries) => ({
    chart: { type: 'line', backgroundColor: 'transparent', spacing: [4, 8, 4, 8], ...sharedChartMargins },
    title: { text: null },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      type: 'datetime',
      min: rangeStartMs,
      max: rangeEndMs,
      plotLines: hoverTimestamp == null ? [] : [{ value: hoverTimestamp, color: '#334155', width: 1, zIndex: 7, dashStyle: 'ShortDot' }],
      labels: { enabled: false },
      tickLength: 0,
      lineWidth: 0,
    },
    yAxis: {
      min: 0,
      allowDecimals: true,
      title: { text: `${groupSeries?.name || 'Gruppe'} (h/Wo)` },
    },
    tooltip: {
      shared: false,
      positioner(labelWidth, labelHeight, point) {
        const chart = this.chart;
        let x = point.plotX + chart.plotLeft - labelWidth / 2;
        let y = point.plotY + chart.plotTop - labelHeight - 12;
        x = Math.max(chart.plotLeft, Math.min(x, chart.plotLeft + chart.plotWidth - labelWidth));
        y = Math.max(chart.plotTop, y);
        return { x, y };
      },
      pointFormatter() {
        return `<b>${this.series.name}</b><br/>${Highcharts.dateFormat('%d.%m.%Y', Number(this.x || 0))}: <b>${Number(this.y || 0).toFixed(1)} h/Wo</b>`;
      },
    },
    plotOptions: {
      series: {
        animation: false,
        marker: { enabled: false },
        point: { events: { mouseOver() { setHoveredTimestamp(Number(this.x)); } } },
      },
    },
    series: [{
      type: 'line',
      name: groupSeries?.name || 'Gruppe',
      data: timelineDateMs.map((x, idx) => [x, Number(groupSeries?.hoursData?.[idx] || 0)]),
      color: groupSeries?.color || accent,
      lineWidth: 2,
    }],
  });

  return (
    <Paper className="analysis-diagram-placeholder" withBorder p="xs" onMouseLeave={() => setHoveredTimestamp(null)}>
      <Group align="stretch" gap="sm" wrap="nowrap" style={{ minHeight: 0, height: '100%' }}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Stack gap={6} h="100%" style={{ overflowY: 'auto', minHeight: 0 }}>
            {seriesByGroup.map((groupSeries, idx) => (
              <Box key={`forecast-hours-${groupSeries.groupId || idx}`} style={{ minHeight: 130, height: 130, flex: '0 0 auto' }}>
                <HighchartsReact highcharts={Highcharts} options={buildHoursOptions(groupSeries)} containerProps={{ style: { height: '100%' } }} />
              </Box>
            ))}
          </Stack>
        </Box>
        <Box style={{ width: 280, minWidth: 280, maxWidth: 280, flex: '0 0 280px', borderLeft: '1px solid var(--mantine-color-gray-3)', paddingLeft: 12, overflowY: 'auto' }}>
          {hoverIndex >= 0 ? (
            <Stack gap={6}>
              <Badge variant="outline" color="gray" size="sm">{timelineDateIsos[hoverIndex] || '-'}</Badge>
              {seriesByGroup.map((groupSeries) => (
                <Badge key={`hours-hover-${groupSeries.groupId}`} variant="light" size="sm" style={{ backgroundColor: `${groupSeries.color || accent}1A`, color: groupSeries.color || accent }}>
                  {groupSeries.name}: {Number(groupSeries?.hoursData?.[hoverIndex] || 0).toFixed(1)} h/Wo
                </Badge>
              ))}
              {!privacyMode ? (
                <Box>
                  <Text size="xs" fw={600} mb={4} c="dimmed">Kinder mit Buchungen:</Text>
                  {seriesByGroup.map((groupSeries) => {
                    const children = groupSeries.childrenByIndex?.[hoverIndex] || [];
                    if (!children.length) return null;
                    return (
                      <Box key={`hours-child-list-${groupSeries.groupId}`} mb={4}>
                        <Text size="xs" fw={600} style={{ color: groupSeries.color || accent }}>{groupSeries.name}:</Text>
                        <Text size="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
                          {children.map((child, i) => (
                            <span key={child.id}>{child.name}{i < children.length - 1 ? ', ' : ''}</span>
                          ))}
                        </Text>
                      </Box>
                    );
                  })}
                </Box>
              ) : null}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed">Diagramm berühren, um Stunden anzuzeigen.</Text>
          )}
        </Box>
      </Group>
    </Paper>
  );
}

function DemographyAgeChart({ demographyData, accent, selectedResolution = 'quarter', onResolutionChange = () => {} }) {
  const snapshots = React.useMemo(() => demographyData?.snapshots || [], [demographyData]);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [selectedMonth, setSelectedMonth] = React.useState(null);
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const hasData = snapshots.length > 0;

  const snapshotIndexByMonth = React.useMemo(() => {
    const index = new Map();
    snapshots.forEach((snapshot, idx) => {
      const key = String(snapshot?.monthIso || '').slice(0, 7);
      if (key) index.set(key, idx);
    });
    return index;
  }, [snapshots]);

  React.useEffect(() => {
    setFrameIndex(0);
    setIsPlaying(false);
    const initialMonthIso = snapshots[0]?.monthIso;
    setSelectedMonth(initialMonthIso ? new Date(`${initialMonthIso.slice(0, 7)}-01T00:00:00.000Z`) : null);
  }, [demographyData, snapshots]);

  React.useEffect(() => {
    if (!selectedMonth) return;
    const monthKey = selectedMonth.toISOString().slice(0, 7);
    const idx = snapshotIndexByMonth.get(monthKey);
    if (Number.isInteger(idx)) {
      setFrameIndex(idx);
      setIsPlaying(false);
    }
  }, [selectedMonth, snapshotIndexByMonth]);

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
      const categories = activeSnapshot?.cohortLabels || demographyData?.cohortLabels || [];
      const counts = activeSnapshot?.cohortCounts || categories.map(() => 0);
      const cohortSizeMonths = Number(activeSnapshot?.cohortSizeMonths || demographyData?.cohortSizeMonths || DEMOGRAPHY_RESOLUTION_MONTHS.quarter);

      const indexForMonths = (months) => Math.floor(months / cohortSizeMonths);
      const krippeEndIndex = indexForMonths(35);
      // Bayerischer Einschulungskorridor: Kinder, die zwischen 1. Juli und 30. September 6 Jahre alt werden.
      const corridorStartIndex = indexForMonths(72);
      const corridorEndIndex = indexForMonths(74);
      const regelStartIndex = indexForMonths(36);
      const regelEndIndex = Math.max(regelStartIndex, corridorStartIndex - 1);
      const schoolStartIndex = corridorEndIndex + 1;

      const rangeByCategory = {
        all: { start: 0, end: categories.length - 1 },
        krippe: { start: 0, end: krippeEndIndex },
        regel: { start: regelStartIndex, end: regelEndIndex },
        schule: { start: schoolStartIndex, end: categories.length - 1 },
      };
      const selectedRange = rangeByCategory[selectedCategory] || rangeByCategory.all;
      const startIndex = Math.max(0, Math.min(categories.length - 1, selectedRange.start));
      const endIndex = Math.max(startIndex, Math.min(categories.length - 1, selectedRange.end));

      const visibleCategories = selectedCategory === 'all'
        ? categories
        : categories.slice(startIndex, endIndex + 1);
      const visibleCounts = selectedCategory === 'all'
        ? counts
        : counts.slice(startIndex, endIndex + 1);

      const seriesData = visibleCounts.map((value, index) => {
        let color = '#16a34a';
        const absoluteIndex = selectedCategory === 'all' ? index : startIndex + index;
        if (absoluteIndex <= krippeEndIndex) color = '#3b82f6';
        if (absoluteIndex >= corridorStartIndex && absoluteIndex <= corridorEndIndex) color = '#f59e0b';
        if (absoluteIndex >= schoolStartIndex) color = '#64748b';
        return { y: Number(value || 0), color };
      });

      const plotBands = selectedCategory === 'all'
        ? [
            {
              from: -0.5,
              to: krippeEndIndex + 0.5,
              color: 'rgba(59, 130, 246, 0.10)',
              label: { text: 'Krippe', style: { color: '#1d4ed8', fontSize: '10px' } },
            },
            {
              from: regelStartIndex - 0.5,
              to: regelEndIndex + 0.5,
              color: 'rgba(34, 197, 94, 0.10)',
              label: { text: 'Regelgruppe', style: { color: '#166534', fontSize: '10px' } },
            },
            {
              from: corridorStartIndex - 0.5,
              to: corridorEndIndex + 0.5,
              color: 'rgba(245, 158, 11, 0.20)',
              borderColor: 'rgba(245, 158, 11, 0.55)',
              borderWidth: 1,
              label: { text: 'Einschulungskorridor', style: { color: '#92400e', fontSize: '10px' } },
            },
            {
              from: schoolStartIndex - 0.5,
              to: categories.length - 0.5,
              color: 'rgba(100, 116, 139, 0.12)',
              label: { text: 'Schulkinder', style: { color: '#334155', fontSize: '10px' } },
            },
          ]
        : [];

      return {
        chart: {
          type: 'column',
          backgroundColor: 'transparent',
          spacing: [8, 8, 8, 8],
        },
        title: { text: null },
        credits: { enabled: false },
        xAxis: {
          categories: visibleCategories,
          title: { text: `Alter in Jahren (${cohortSizeMonths}-Monats-Cohorten)` },
          labels: {
            style: { fontSize: '10px' },
            formatter() {
              if (this.pos % 4 !== 0) return '';
              return visibleCategories[this.pos] || '';
            },
          },
          plotBands,
        },
        yAxis: {
          min: 0,
          allowDecimals: false,
          title: { text: 'Kinder', style: { fontSize: '11px' } },
        },
        tooltip: {
          formatter() {
            const cohort = visibleCategories[this.point.index] || '';
            return `<b>${cohort} Jahre</b><br/><b>${Number(this.point.y || 0)}</b> Kinder`;
          },
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
            data: seriesData,
            color: accent,
          },
        ],
      };
    },
    [accent, activeSnapshot?.cohortCounts, activeSnapshot?.cohortLabels, activeSnapshot?.cohortSizeMonths, demographyData, selectedCategory]
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

        <Group gap={6} wrap="wrap" justify="flex-end">
          <Select
            value={selectedCategory}
            onChange={(value) => setSelectedCategory(value || 'all')}
            data={[
              { value: 'all', label: 'Alle Altersgruppen' },
              { value: 'krippe', label: 'Krippe' },
              { value: 'regel', label: 'Regelgruppe' },
              { value: 'schule', label: 'Schule' },
            ]}
            size="xs"
            w={170}
            allowDeselect={false}
            data-testid="forecast-demography-category-filter"
          />
          <Select
            value={selectedResolution}
            onChange={(value) => onResolutionChange(value || 'quarter')}
            data={[
              { value: 'quarter', label: 'Quartale' },
              { value: 'halfyear', label: 'Halbjahre' },
              { value: 'year', label: 'Jahre' },
            ]}
            size="xs"
            w={140}
            allowDeselect={false}
            data-testid="forecast-demography-resolution-filter"
          />
          <MonthPickerInput
            value={selectedMonth}
            onChange={setSelectedMonth}
            valueFormat="MM/YYYY"
            placeholder="Monat wählen"
            size="xs"
            w={170}
            data-testid="forecast-demography-monthpicker"
            minDate={snapshots[0]?.monthIso ? new Date(`${String(snapshots[0].monthIso).slice(0, 7)}-01T00:00:00.000Z`) : undefined}
            maxDate={snapshots[snapshots.length - 1]?.monthIso ? new Date(`${String(snapshots[snapshots.length - 1].monthIso).slice(0, 7)}-01T00:00:00.000Z`) : undefined}
          />
        </Group>
      </Group>

      <Box h="calc(100% - 2rem)">
        <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Paper>
  );
}

function TrendHistoryChart({ trendData, accent, page = 'counts' }) {
  const options = React.useMemo(() => {
    const defaultCategories = trendData?.categories || [];
    const yearCategories = trendData?.trendYearCategories || [];
    const categories = (page === 'entries' || page === 'entryAge' || page === 'corridor' || page === 'regelAge')
      ? yearCategories
      : defaultCategories;
    const childrenSeries = trendData?.children || [];
    const employeeSeries = trendData?.employees || [];
    const bookingSeries = trendData?.bookingHours || [];
    const workingSeries = trendData?.workingHours || [];
    const entrySeries = trendData?.entries || [];
    const entryAgeSeries = trendData?.entryAgeYears || [];
    const corridorSeries = trendData?.corridorRemainPct || [];
    const regelAgeSeries = trendData?.regelEntryAgeYears || [];
    const groupChildrenSeries = trendData?.groupChildrenSeries || [];

    const isCountsPage = page === 'counts';
    const isHoursPage = page === 'hours';
    const isEntriesPage = page === 'entries';

    let series = [
      { name: 'Kinder', data: childrenSeries, color: accent },
      { name: 'Mitarbeiter', data: employeeSeries, color: '#4f46e5' },
    ];
    if (isHoursPage) {
      series = [
        { name: 'Buchungsstunden', data: bookingSeries, color: '#0f766e' },
        { name: 'Arbeitsstunden', data: workingSeries, color: '#ea580c' },
      ];
    }
    if (isEntriesPage) {
      series = [
        { name: 'Eintritte', data: entrySeries, color: '#0284c7' },
      ];
    }
    if (page === 'entryAge') {
      series = [
        { name: 'Eintrittsalter', data: entryAgeSeries, color: '#b45309' },
      ];
    }
    if (page === 'corridor') {
      series = [
        { name: 'Korridor-Verbleib', data: corridorSeries, color: '#7c3aed' },
      ];
    }
    if (page === 'regelAge') {
      series = [
        { name: 'Ø Alter bei Wechsel in Regelgruppe', data: regelAgeSeries, color: '#0f766e' },
      ];
    }
    if (page === 'groupChildren') {
      series = groupChildrenSeries;
    }

    const yAxisTitle = page === 'groupChildren'
      ? 'Kinderanzahl'
      : isCountsPage
      ? 'Anzahl'
      : isHoursPage
        ? 'Stunden/Woche'
        : isEntriesPage
          ? 'Anzahl Eintritte'
          : page === 'corridor'
            ? 'Anteil in %'
            : page === 'regelAge'
              ? 'Jahre'
          : 'Jahre';

    return {
      chart: {
        type: 'line',
        backgroundColor: 'transparent',
        spacing: [8, 8, 8, 8],
      },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        categories,
      },
      yAxis: {
        min: 0,
        allowDecimals: !isCountsPage && !isEntriesPage && page !== 'groupChildren',
        title: { text: yAxisTitle },
      },
      tooltip: {
        shared: true,
      },
      plotOptions: {
        series: {
          animation: false,
          marker: {
            enabled: false,
          },
        },
      },
      series,
    };
  }, [accent, page, trendData]);

  const hasData = React.useMemo(() => {
    const categories = (page === 'entries' || page === 'entryAge' || page === 'corridor' || page === 'regelAge')
      ? (trendData?.trendYearCategories || [])
      : (trendData?.categories || []);
    if (!Array.isArray(categories) || categories.length === 0) return false;
    if (page === 'groupChildren') {
      return Array.isArray(trendData?.groupChildrenSeries) && trendData.groupChildrenSeries.length > 0;
    }
    return true;
  }, [page, trendData]);

  if (!hasData) {
    return (
      <Paper className="analysis-diagram-placeholder" withBorder p="lg">
        <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
          <Badge variant="light" size="lg" className="analysis-diagram-placeholder-badge">
            Trend-Chart
          </Badge>
          <Title order={3} className="analysis-diagram-placeholder-title">
            Keine historischen Werte
          </Title>
          <Text size="sm" c="dimmed" ta="center" className="analysis-diagram-placeholder-text">
            Für den gewählten Kontext konnten keine historischen Monatswerte aggregiert werden.
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

const TREND_CHART_SLIDES = [
  { id: 'counts', title: 'Anzahl Kinder & Mitarbeiter' },
  { id: 'groupChildren', title: 'Kinderanzahl nach Gruppen (historisch)' },
  { id: 'hours', title: 'Buchungsstunden & Arbeitsstunden' },
  { id: 'entries', title: 'Neu-Anmeldungen (Jahresachse)' },
  { id: 'entryAge', title: 'Eintrittsalter (Jahresachse)' },
  { id: 'corridor', title: 'Korridor-Verbleib (Jahresachse)' },
  { id: 'regelAge', title: 'Ø Alter beim Wechsel in Regelgruppe' },
];

function TrendHistoryCarousel({ trendData, accent }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canGoPrev, setCanGoPrev] = React.useState(false);
  const [canGoNext, setCanGoNext] = React.useState(true);

  React.useEffect(() => {
    if (!emblaApi) return undefined;

    const updateState = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
      setCanGoPrev(emblaApi.canScrollPrev());
      setCanGoNext(emblaApi.canScrollNext());
    };

    updateState();
    emblaApi.on('select', updateState);
    emblaApi.on('reInit', updateState);

    return () => {
      emblaApi.off('select', updateState);
      emblaApi.off('reInit', updateState);
    };
  }, [emblaApi]);

  return (
    <Box className="analysis-coverage-carousel-wrap">
      <Group className="analysis-coverage-carousel-header" justify="space-between" wrap="nowrap">
        <Text size="xs" fw={700} className="analysis-stage-recommendation-title">
          {TREND_CHART_SLIDES[activeIndex]?.title || 'Trend'}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge variant="filled" size="md" className="analysis-coverage-carousel-counter">
            {activeIndex + 1}/{TREND_CHART_SLIDES.length}
          </Badge>
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" onClick={() => emblaApi?.scrollPrev()} disabled={!canGoPrev}>
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" onClick={() => emblaApi?.scrollNext()} disabled={!canGoNext}>
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Carousel
        withIndicators
        withControls={false}
        getEmblaApi={setEmblaApi}
        className="analysis-coverage-carousel"
        slideSize="100%"
        slideGap={0}
        emblaOptions={{ loop: false, align: 'start', dragFree: false }}
      >
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 0 ? <TrendHistoryChart trendData={trendData} accent={accent} page="counts" /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 1 ? <TrendHistoryChart trendData={trendData} accent={accent} page="groupChildren" /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 2 ? <TrendHistoryChart trendData={trendData} accent={accent} page="hours" /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 3 ? <TrendHistoryChart trendData={trendData} accent={accent} page="entries" /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 4 ? <TrendHistoryChart trendData={trendData} accent={accent} page="entryAge" /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 5 ? <TrendHistoryChart trendData={trendData} accent={accent} page="corridor" /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 6 ? <TrendHistoryChart trendData={trendData} accent={accent} page="regelAge" /> : null}
          </Box>
        </Carousel.Slide>
      </Carousel>
    </Box>
  );
}

const FORECAST_CHART_SLIDES = [
  { id: 'groups-timeline', title: 'Gruppenverlauf & Event-Timeline' },
  { id: 'booking-hours', title: 'Buchungsstunden-Verlauf' },
  { id: 'preview', title: 'Ausblick (Sankey)' },
  { id: 'demography', title: 'Demografie-Prognose' },
];

function ForecastStageCarousel({
  previewFlow,
  demographyData,
  accent,
  privacyMode = false,
  demographyResolution = 'quarter',
  onDemographyResolutionChange = () => {},
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canGoPrev, setCanGoPrev] = React.useState(false);
  const [canGoNext, setCanGoNext] = React.useState(true);

  React.useEffect(() => {
    if (!emblaApi) return undefined;

    const updateState = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
      setCanGoPrev(emblaApi.canScrollPrev());
      setCanGoNext(emblaApi.canScrollNext());
    };

    updateState();
    emblaApi.on('select', updateState);
    emblaApi.on('reInit', updateState);

    return () => {
      emblaApi.off('select', updateState);
      emblaApi.off('reInit', updateState);
    };
  }, [emblaApi]);

  return (
    <Box className="analysis-coverage-carousel-wrap">
      <Group className="analysis-coverage-carousel-header" justify="space-between" wrap="nowrap">
        <Text size="xs" fw={700} className="analysis-stage-recommendation-title">
          {FORECAST_CHART_SLIDES[activeIndex]?.title || 'Ausblick'}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge variant="filled" size="md" className="analysis-coverage-carousel-counter">
            {activeIndex + 1}/{FORECAST_CHART_SLIDES.length}
          </Badge>
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" onClick={() => emblaApi?.scrollPrev()} disabled={!canGoPrev}>
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" onClick={() => emblaApi?.scrollNext()} disabled={!canGoNext}>
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Carousel
        withIndicators
        withControls={false}
        getEmblaApi={setEmblaApi}
        className="analysis-coverage-carousel"
        slideSize="100%"
        slideGap={0}
        emblaOptions={{ loop: false, align: 'start', dragFree: false }}
      >
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 0 ? <ForecastGroupTimelineChart previewFlow={previewFlow} accent={accent} privacyMode={privacyMode} /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 1 ? <ForecastHoursTimelineChart previewFlow={previewFlow} accent={accent} privacyMode={privacyMode} /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 2 ? (
              <PreviewSankeyChart
                previewFlow={previewFlow}
                accent={accent}
                privacyMode={privacyMode}
              />
            ) : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 3 ? (
              <DemographyAgeChart
                demographyData={demographyData}
                accent={accent}
                selectedResolution={demographyResolution}
                onResolutionChange={onDemographyResolutionChange}
              />
            ) : null}
          </Box>
        </Carousel.Slide>
      </Carousel>
    </Box>
  );
}

function StoryCard({ story, isActive, onSelect }) {
  const StoryIcon = story.icon;

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
      </div>
    </Paper>
  );
}

function AnalysisProgressPanel({ stageIndex, isLoading, stages }) {
  const panelStages = stages?.length ? stages : [ANALYSIS_LOADING_STAGES[0]];
  const safeIndex = Math.min(Math.max(stageIndex, 0), panelStages.length - 1);
  const activeStage = panelStages[safeIndex] || panelStages[0];
  const completed = panelStages
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
          {panelStages.map((stage, index) => (
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
  const weeklyChartData = useSelector(selectWeeklyChartData);
  const scenarios = useSelector((state) => state.simScenario.scenarios || EMPTY_LIST);
  const overlaysByScenario = useSelector((state) => state.simOverlay?.overlaysByScenario || {});
  const dataByScenario = useSelector((state) => state.simData?.dataByScenario || {});
  const bookingsByScenario = useSelector((state) => state.simBooking?.bookingsByScenario || {});
  const groupsByScenario = useSelector((state) => state.simGroup?.groupsByScenario || {});
  const groupDefsByScenario = useSelector((state) => state.simGroup?.groupDefsByScenario || {});
  const eventsByScenario = useSelector((state) => state.events?.eventsByScenario || {});
  const qualificationAssignmentsByScenario = useSelector(
    (state) => state.simQualification?.qualificationAssignmentsByScenario || {}
  );
  const qualificationDefsByScenario = useSelector((state) => state.simQualification?.qualificationDefsByScenario || {});
  const qualificationDefs = useSelector(
    (state) =>
      selectedScenarioId
        ? state.simQualification?.qualificationDefsByScenario?.[selectedScenarioId] || EMPTY_LIST
        : EMPTY_LIST
  );
  const financeScenario = useSelector(
    (state) => (selectedScenarioId ? state.simFinance?.financeByScenario?.[selectedScenarioId] || null : null)
  );
  const activeAnalysisSubPage = useSelector((state) => state.ui.analysisSubPage || STORY_STEPS[0].id);
  const [activeStep, setActiveStep] = React.useState(() => {
    const normalizedSubPage = ANALYSIS_SUBPAGE_ALIASES[activeAnalysisSubPage] || activeAnalysisSubPage;
    const idx = STORY_STEPS.findIndex((step) => step.id === normalizedSubPage);
    return idx >= 0 ? idx : 0;
  });
  const [settledStep, setSettledStep] = React.useState(() => {
    const normalizedSubPage = ANALYSIS_SUBPAGE_ALIASES[activeAnalysisSubPage] || activeAnalysisSubPage;
    const idx = STORY_STEPS.findIndex((step) => step.id === normalizedSubPage);
    return idx >= 0 ? idx : 0;
  });
  const activeStepRef = React.useRef(activeStep);
  const privacyMode = useSelector((state) => state.ui.privacyMode || false);
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);
  const [demographyResolution, setDemographyResolution] = React.useState('quarter');
  const [simulateInflow, setSimulateInflow] = React.useState(false);
  const [monteCarloConfig, setMonteCarloConfig] = React.useState({
    runs: 1200,
    baseAbsenceProbabilityPct: 14,
    simulationWeeks: 26,
    maxConcurrentOutages: 3,
    minExpertRatioPct: LEGAL_EXPERT_RATIO_MIN_PCT,
    maxCareRatio: 8,
    minGroupHeadcount: 1,
    minGroupHeadcountByGroup: {},
    maxUndercoverageSlots: 4,
    maxOvertimeHoursPerEmployeePerWeek: 2,
    maxTimeReductionHoursPerWeek: 3,
    emergencyDemandReductionPct: 18,
    seasonalityEnabled: true,
    contagionEnabled: true,
    contagionBoostPct: 28,
    contagionDays: 3,
    childCompensationEnabled: true,
    childCompensationRatePct: 6,
  });
  const [monteCarloRunId, setMonteCarloRunId] = React.useState(0);

  // Debounce step changes by 500ms so heavy analysis only starts after user settles
  React.useEffect(() => {
    activeStepRef.current = activeStep;
    const timer = setTimeout(() => setSettledStep(activeStep), 500);
    return () => clearTimeout(timer);
  }, [activeStep]);
  const todayIso = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const qualityReferenceDate = React.useMemo(() => chartState?.referenceDate || todayIso, [chartState?.referenceDate, todayIso]);
  const activeStory = STORY_STEPS[activeStep] || STORY_STEPS[0];
  const settledStory = STORY_STEPS[settledStep] || STORY_STEPS[0];
  const trendStatistics = useSelector((state) =>
    selectHistoricalStatistics(state, {
      aggregation: 'month',
      asOfDate: qualityReferenceDate,
    })
  );
  const { getEffectiveDataItems, getEffectiveBookings, getEffectiveGroupAssignments, getEffectiveGroupDefs } = useOverlayData();
  const activeLoadingStages = React.useMemo(
    () => ANALYSIS_LOADING_STAGES_BY_STORY[settledStory.id] || [ANALYSIS_LOADING_STAGES[0]],
    [settledStory.id]
  );
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
  const [statusHoverData, setStatusHoverData] = React.useState(null);
  const [heatmapMode, setHeatmapMode] = React.useState(HEATMAP_MODES.UNWEIGHTED_QUOTIENT);
  const [qualityOnlyPlannedStaff, setQualityOnlyPlannedStaff] = React.useState(false);
  const handleStatusHoverChange = React.useCallback((data) => setStatusHoverData(data), []);

  const computeCoverageData = React.useCallback(() => {
    if (!selectedScenarioId) return null;

    const storyId = settledStory.id;
    const needsCoverage = storyId === 'status' || storyId === 'transitions';
    const needsResilience = storyId === 'transitions';
    const needsFinance = storyId === 'cohort';

    if (!needsCoverage && !needsFinance) {
      return null;
    }

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
    const fallbackCategories = generateTimeSegments();
    const weeklyData = weeklyChartData?.categories?.length
      ? weeklyChartData
      : {
          categories: fallbackCategories,
          demand: [],
          capacity: [],
          capacity_pedagogical: [],
          capacity_administrative: [],
          care_ratio: [],
          expert_ratio: [],
        };
    const categories = weeklyData.categories?.length ? weeklyData.categories : fallbackCategories;

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
      const groupCapacitySeriesByGroup = {};

      groupsForHeatmap.forEach((group, groupIndex) => {
        const groupFilter = group.id === '__NO_GROUP__' ? ['__NO_GROUP__'] : [group.id];
        const { demand: groupDemand, capacity: groupCapacity } = filterBookings({
          ...baseInput,
          selectedGroups: groupFilter,
        });

        const groupDemandSeries = generateBookingDataSeries(referenceDate, groupDemand, categories);
        const groupCapacitySeries = generateBookingDataSeries(referenceDate, groupCapacity, categories, 'all');
        groupCapacitySeriesByGroup[String(group.id)] = groupCapacitySeries.map((value) => Number(value || 0));
        const groupPedCapacitySeries = generateBookingDataSeries(referenceDate, groupCapacity, categories, 'pedagogical');
        const groupCareRatioSeries = generateCareRatioSeries(
          categories,
          groupDemand,
          groupCapacity,
          scopedDataItems,
          overlayAware.effectiveGroupDefs || []
        );
        let groupMinutes = 0;

        categories.forEach((_, slotIndex) => {
          const demandValue = Number(groupDemandSeries[slotIndex] || 0);
          const capacityValue = Number(groupCapacitySeries[slotIndex] || 0);
          const pedagogicalValue = Number(groupPedCapacitySeries[slotIndex] || 0);
          const administrativeValue = Math.max(0, capacityValue - pedagogicalValue);
          const careRatioValue = Number(groupCareRatioSeries[slotIndex] || 0);
          const expertRatioValue = Number(weeklyData?.expert_ratio?.[slotIndex] || 0);

          const delta = capacityValue - demandValue;
          if (delta < 0) groupMinutes += Math.abs(delta) * 30;

          let heatValue;
          if (heatmapMode === HEATMAP_MODES.CARE_KEY) {
            heatValue = careRatioValue;
          } else if (heatmapMode === HEATMAP_MODES.PRESENT_STAFF) {
            heatValue = pedagogicalValue;
          } else {
            // Default and primary mode: Kinder pro pädagogischer Mitarbeiter.
            heatValue = pedagogicalValue > 0 ? demandValue / pedagogicalValue : (demandValue > 0 ? demandValue : 0);
          }

          const slotLabel = categories[slotIndex] || '-';
          heatValues.push({
            x: slotIndex,
            y: groupIndex,
            value: heatValue,
            kpiLabel: `${group.name} · ${slotLabel}`,
            demand: demandValue,
            capacityPedagogical: pedagogicalValue,
            capacityAdministrative: administrativeValue,
            careRatio: careRatioValue,
            expertRatio: expertRatioValue,
          });
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
        groupCapacitySeriesByGroup,
      };
    };

    const baselineSnapshot = needsCoverage
      ? buildSnapshot([])
      : {
          demandSeries: [],
          capacitySeries: [],
          deficits: [],
          deficitSlots: 0,
          worstDeficit: 0,
          undercoverageMinutes: 0,
          totalDemand: 0,
          totalCapacity: 0,
          heatValues: [],
          groupUndercoverageMinutes: [],
        };

    let monteCarloResult = null;
    if (needsResilience) {
      const runs = Math.max(200, Math.min(20000, Number(monteCarloConfig?.runs || 1200)));
      const simulationWeeks = Math.max(4, Math.min(52, Number(monteCarloConfig?.simulationWeeks || 26)));
      const baseAbsenceProb = Math.max(0.01, Math.min(0.9, Number(monteCarloConfig?.baseAbsenceProbabilityPct || 14) / 100));
      const maxConcurrentOutages = Math.max(1, Math.min(12, Number(monteCarloConfig?.maxConcurrentOutages || 3)));
      const minExpertRatioPct = Math.max(0, Math.min(100, Number(monteCarloConfig?.minExpertRatioPct || LEGAL_EXPERT_RATIO_MIN_PCT)));
      const maxCareRatioAllowed = Math.max(1, Math.min(30, Number(monteCarloConfig?.maxCareRatio || 8)));
      const minGroupHeadcount = Math.max(0, Math.min(10, Number(monteCarloConfig?.minGroupHeadcount || 1)));
      const minGroupHeadcountByGroup = (monteCarloConfig?.minGroupHeadcountByGroup && typeof monteCarloConfig.minGroupHeadcountByGroup === 'object')
        ? monteCarloConfig.minGroupHeadcountByGroup
        : {};
      const maxUndercoverageSlots = Math.max(0, Math.min(200, Number(monteCarloConfig?.maxUndercoverageSlots || 4)));
      const maxOvertimeHoursPerEmployeePerWeek = Math.max(0, Math.min(20, Number(monteCarloConfig?.maxOvertimeHoursPerEmployeePerWeek || 2)));
      const maxTimeReductionHoursPerWeek = Math.max(0, Math.min(20, Number(monteCarloConfig?.maxTimeReductionHoursPerWeek || 3)));
      const emergencyDemandReductionPct = Math.max(0, Math.min(80, Number(monteCarloConfig?.emergencyDemandReductionPct || 18)));
      const seasonalityEnabled = Boolean(monteCarloConfig?.seasonalityEnabled);
      const contagionEnabled = Boolean(monteCarloConfig?.contagionEnabled);
      const contagionBoostPct = Math.max(0, Math.min(200, Number(monteCarloConfig?.contagionBoostPct || 28)));
      const contagionDays = Math.max(0, Math.min(14, Number(monteCarloConfig?.contagionDays || 3)));
      const childCompensationEnabled = Boolean(monteCarloConfig?.childCompensationEnabled);
      const childCompensationRatePct = Math.max(0, Math.min(30, Number(monteCarloConfig?.childCompensationRatePct || 6)));

      const slotsPerDay = Math.max(1, Math.floor(categories.length / 5));
      const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
      const groupCount = Math.max(1, groupsForHeatmap.length);
      const groupIdsForMonteCarlo = groupsForHeatmap.map((group) => String(group.id));
      const baselineGroupCapacitySeries = baselineSnapshot?.groupCapacitySeriesByGroup || {};
      const expertSeriesBase = (weeklyData?.expert_ratio || []).map((value) => Number(value || 0));
      const demandSeriesBase = (weeklyData?.demand || []).map((value) => Number(value || 0));
      const pedSeriesBase = (weeklyData?.capacity_pedagogical || []).map((value) => Number(value || 0));
      const adminSeriesBase = (weeklyData?.capacity_administrative || []).map((value) => Number(value || 0));
      const avgPedHeadcount = pedSeriesBase.length
        ? pedSeriesBase.reduce((sum, value) => sum + value, 0) / pedSeriesBase.length
        : 1;

      const weeklySeasonality = [1.16, 1.14, 1.08, 1.0, 0.95, 0.9, 0.86, 0.88, 0.94, 1.0, 1.08, 1.15];

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

      const cascadeCounts = [0, 0, 0, 0, 0];
      const weekdayRiskAccumulator = Array.from({ length: dayLabels.length }, () => Array.from({ length: slotsPerDay }, () => 0));
      const periodRiskAccumulator = Array.from({ length: simulationWeeks }, () => Array.from({ length: dayLabels.length }, () => 0));
      const toleratedClosuresPerDay = Math.max(0, maxUndercoverageSlots / dayLabels.length);
      const closureCombinationLabels = new Map();
      const closurePatternStats = new Map();
      const closureIncidentDurationsSlots = [];

      let regularDaysAllRuns = 0;
      let resiliencePointsAllRuns = 0;
      let closedSlotsAllRuns = 0;
      let totalSlotsAllRuns = 0;

      const registerClosureIncident = (combinationKey, durationSlots) => {
        if (!combinationKey || durationSlots <= 0) return;
        closureIncidentDurationsSlots.push(durationSlots);
        const existing = closurePatternStats.get(combinationKey) || {
          count: 0,
          totalDurationSlots: 0,
          maxDurationSlots: 0,
        };
        existing.count += 1;
        existing.totalDurationSlots += durationSlots;
        existing.maxDurationSlots = Math.max(existing.maxDurationSlots, durationSlots);
        closurePatternStats.set(combinationKey, existing);
      };

      for (let run = 0; run < runs; run += 1) {
        for (let weekIndex = 0; weekIndex < simulationWeeks; weekIndex += 1) {
          const monthIndex = Math.floor((weekIndex / 4.33) % 12);
          const seasonalFactor = seasonalityEnabled ? weeklySeasonality[monthIndex] : 1;
          const overtimeBudgetSlots = Math.max(0, Math.round(avgPedHeadcount * (maxOvertimeHoursPerEmployeePerWeek / SLOT_HOURS)));
          let remainingOvertimeBudget = overtimeBudgetSlots;
          let remainingTimeReductionSlots = Math.max(0, Math.round(maxTimeReductionHoursPerWeek / SLOT_HOURS));
          let contagionRemaining = 0;
          const dayClosedSlots = Array.from({ length: dayLabels.length }, () => 0);
          const dayClosureCombinationKeys = Array.from({ length: dayLabels.length }, () => Array.from({ length: slotsPerDay }, () => null));

          for (let slotIndex = 0; slotIndex < categories.length; slotIndex += 1) {
            totalSlotsAllRuns += 1;

            const dayIndex = Math.floor(slotIndex / slotsPerDay);
            const slotInDay = slotIndex % slotsPerDay;
            const demandBase = Number(demandSeriesBase[slotIndex] || 0);
            const pedBase = Number(pedSeriesBase[slotIndex] || 0);
            const adminBase = Number(adminSeriesBase[slotIndex] || 0);
            const expertBase = Number(expertSeriesBase[slotIndex] || 0);

            const contagionFactor = contagionEnabled && contagionRemaining > 0 ? (1 + (contagionBoostPct / 100)) : 1;
            const absenceProb = Math.max(0.01, Math.min(0.95, baseAbsenceProb * seasonalFactor * contagionFactor));

            let absentPed = 0;
            const outageCap = Math.min(Math.round(pedBase), maxConcurrentOutages);
            for (let workerIdx = 0; workerIdx < outageCap; workerIdx += 1) {
              if (nextRandom() < absenceProb) absentPed += 1;
            }

            if (contagionEnabled && absentPed > 0) {
              contagionRemaining = contagionDays;
            } else if (contagionRemaining > 0) {
              contagionRemaining -= 1;
            }

            let effectivePed = Math.max(0, pedBase - absentPed);
            let effectiveDemand = demandBase;
            if (childCompensationEnabled && absentPed > 0) {
              const demandFactor = Math.max(0.55, 1 - ((childCompensationRatePct / 100) * absentPed));
              effectiveDemand *= demandFactor;
            }

            let totalStaff = effectivePed + adminBase;
            const minimumStaffRequired = groupIdsForMonteCarlo.reduce((sum, groupId) => {
              const rawMin = Number(minGroupHeadcountByGroup[groupId]);
              const required = Number.isFinite(rawMin) ? rawMin : minGroupHeadcount;
              return sum + Math.max(0, required);
            }, 0);
            const baselineGroupCapacityAtSlot = groupIdsForMonteCarlo.reduce((sum, groupId) => {
              const series = baselineGroupCapacitySeries[groupId] || [];
              return sum + Number(series[slotIndex] || 0);
            }, 0);
            const groupCapacityScalingFactor = baselineGroupCapacityAtSlot > 0
              ? (totalStaff / baselineGroupCapacityAtSlot)
              : 0;
            const hasGroupMinViolation = groupIdsForMonteCarlo.some((groupId) => {
              const rawMin = Number(minGroupHeadcountByGroup[groupId]);
              const groupMinRequired = Number.isFinite(rawMin) ? rawMin : minGroupHeadcount;
              const series = baselineGroupCapacitySeries[groupId] || [];
              const baselineGroupCapacity = Number(series[slotIndex] || 0);
              const effectiveGroupCapacity = baselineGroupCapacityAtSlot > 0
                ? (baselineGroupCapacity * groupCapacityScalingFactor)
                : (totalStaff / Math.max(1, groupCount));
              return effectiveGroupCapacity + 1e-9 < Math.max(0, groupMinRequired);
            });
            let currentCareRatio = totalStaff > 0 ? effectiveDemand / totalStaff : Number.POSITIVE_INFINITY;
            let currentExpertRatio = expertBase;

            let stage = 0;
            let isCompliant = (
              totalStaff >= minimumStaffRequired
              && !hasGroupMinViolation
              && currentCareRatio <= maxCareRatioAllowed
              && currentExpertRatio >= minExpertRatioPct
            );

            if (!isCompliant) {
              const targetStaffForCare = Math.max(0, Math.ceil((effectiveDemand / Math.max(1, maxCareRatioAllowed)) - totalStaff));
              const overtimeSlotsUsed = Math.min(targetStaffForCare, remainingOvertimeBudget);
              if (overtimeSlotsUsed > 0) {
                remainingOvertimeBudget -= overtimeSlotsUsed;
                effectivePed += overtimeSlotsUsed;
                totalStaff += overtimeSlotsUsed;
                currentCareRatio = totalStaff > 0 ? effectiveDemand / totalStaff : Number.POSITIVE_INFINITY;
                isCompliant = (
                  totalStaff >= minimumStaffRequired
                  && !hasGroupMinViolation
                  && currentCareRatio <= maxCareRatioAllowed
                  && currentExpertRatio >= minExpertRatioPct
                );
                stage = 1;
              }
            }

            if (!isCompliant && remainingTimeReductionSlots > 0) {
              const reductionFactor = Math.min(0.45, remainingTimeReductionSlots / Math.max(1, categories.length));
              effectiveDemand *= (1 - reductionFactor);
              remainingTimeReductionSlots -= 1;
              currentCareRatio = totalStaff > 0 ? effectiveDemand / totalStaff : Number.POSITIVE_INFINITY;
              isCompliant = (
                totalStaff >= minimumStaffRequired
                && !hasGroupMinViolation
                && currentCareRatio <= maxCareRatioAllowed
                && currentExpertRatio >= minExpertRatioPct
              );
              stage = 2;
            }

            if (!isCompliant) {
              effectiveDemand *= (1 - (emergencyDemandReductionPct / 100));
              currentCareRatio = totalStaff > 0 ? effectiveDemand / totalStaff : Number.POSITIVE_INFINITY;
              isCompliant = (
                totalStaff >= minimumStaffRequired
                && !hasGroupMinViolation
                && currentCareRatio <= maxCareRatioAllowed
                && currentExpertRatio >= minExpertRatioPct
              );
              stage = 3;
            }

            if (!isCompliant) {
              stage = 4;
              dayClosedSlots[dayIndex] += 1;
              closedSlotsAllRuns += 1;
              weekdayRiskAccumulator[dayIndex][slotInDay] += 1;
              periodRiskAccumulator[weekIndex][dayIndex] += 1;

              const isHeadcountIssue = totalStaff < minimumStaffRequired;
              const isGroupMinIssue = hasGroupMinViolation;
              const isCareRatioIssue = currentCareRatio > maxCareRatioAllowed;
              const isExpertIssue = currentExpertRatio < minExpertRatioPct;
              const absenceBucket = absentPed >= 3 ? '3+' : String(absentPed);
              const factorLabels = [];
              if (isHeadcountIssue) factorLabels.push('Unterbesetzung');
              if (isGroupMinIssue) factorLabels.push('Gruppen-Minimum');
              if (isCareRatioIssue) factorLabels.push('Schlüsselgrenze');
              if (isExpertIssue) factorLabels.push('Fachkraftquote');
              if (factorLabels.length === 0) factorLabels.push('Sonstige Restriktion');

              const combinationKey = `A${absenceBucket}|H${isHeadcountIssue ? 1 : 0}|G${isGroupMinIssue ? 1 : 0}|C${isCareRatioIssue ? 1 : 0}|E${isExpertIssue ? 1 : 0}`;
              const combinationLabel = `Ausfälle ${absenceBucket} · ${factorLabels.join(' + ')}`;
              dayClosureCombinationKeys[dayIndex][slotInDay] = combinationKey;
              closureCombinationLabels.set(combinationKey, combinationLabel);
            }

            cascadeCounts[stage] += 1;
          }

          dayClosedSlots.forEach((closedSlots, dayIndex) => {
            const overloadSlots = Math.max(0, closedSlots - toleratedClosuresPerDay);
            const overflowRange = Math.max(1, slotsPerDay - toleratedClosuresPerDay);
            const dayResilienceScore = Math.max(0, 1 - (overloadSlots / overflowRange));
            resiliencePointsAllRuns += dayResilienceScore;

            if (closedSlots <= toleratedClosuresPerDay) {
              regularDaysAllRuns += 1;
            }

            const closureKeys = dayClosureCombinationKeys[dayIndex] || [];
            let currentDuration = 0;
            const incidentCombinationHits = new Map();

            const finalizeIncident = () => {
              if (currentDuration <= 0 || incidentCombinationHits.size === 0) return;
              let dominantKey = null;
              let dominantHits = -1;
              incidentCombinationHits.forEach((hits, key) => {
                if (hits > dominantHits) {
                  dominantHits = hits;
                  dominantKey = key;
                }
              });
              if (dominantKey) {
                registerClosureIncident(dominantKey, currentDuration);
              }
            };

            for (let slotInDay = 0; slotInDay < slotsPerDay; slotInDay += 1) {
              const combinationKey = closureKeys[slotInDay];
              if (!combinationKey) {
                finalizeIncident();
                currentDuration = 0;
                incidentCombinationHits.clear();
                continue;
              }

              currentDuration += 1;
              incidentCombinationHits.set(combinationKey, (incidentCombinationHits.get(combinationKey) || 0) + 1);
            }

            finalizeIncident();
          });
        }
      }

      const totalDayCount = runs * simulationWeeks * dayLabels.length;
      const resilienceScorePct = totalDayCount > 0 ? (resiliencePointsAllRuns / totalDayCount) * 100 : 0;
      const regularDaysPct = totalDayCount > 0 ? (regularDaysAllRuns / totalDayCount) * 100 : 0;
      const regularOperationPct = totalSlotsAllRuns > 0 ? (Number(cascadeCounts[0] || 0) / totalSlotsAllRuns) * 100 : 0;
      const closurePct = totalSlotsAllRuns > 0 ? (closedSlotsAllRuns / totalSlotsAllRuns) * 100 : 0;
      const closurePatterns = Array.from(closurePatternStats.entries())
        .map(([key, stats]) => {
          const avgDurationSlots = stats.count > 0 ? stats.totalDurationSlots / stats.count : 0;
          return {
            key,
            label: closureCombinationLabels.get(key) || key,
            count: stats.count,
            avgDurationMinutes: avgDurationSlots * SLOT_HOURS * 60,
            maxDurationMinutes: stats.maxDurationSlots * SLOT_HOURS * 60,
            totalDurationMinutes: stats.totalDurationSlots * SLOT_HOURS * 60,
          };
        })
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return b.totalDurationMinutes - a.totalDurationMinutes;
        });

      const durationBuckets = [
        { key: 'd30', label: 'bis 30 Min.', min: 0, max: 30 },
        { key: 'd60', label: '31-60 Min.', min: 31, max: 60 },
        { key: 'd120', label: '61-120 Min.', min: 61, max: 120 },
        { key: 'd180', label: '121-180 Min.', min: 121, max: 180 },
        { key: 'd181', label: '> 180 Min.', min: 181, max: Number.POSITIVE_INFINITY },
      ];
      const closureIncidentDurationsMinutes = closureIncidentDurationsSlots.map((slots) => slots * SLOT_HOURS * 60);
      const sortedDurations = [...closureIncidentDurationsMinutes].sort((a, b) => a - b);
      const totalIncidents = closureIncidentDurationsMinutes.length;
      const closureDurationDistribution = durationBuckets.map((bucket) => {
        const count = closureIncidentDurationsMinutes.filter((minutes) => minutes >= bucket.min && minutes <= bucket.max).length;
        return {
          key: bucket.key,
          label: bucket.label,
          count,
          sharePct: totalIncidents > 0 ? (count / totalIncidents) * 100 : 0,
        };
      });
      const closureDurationStats = {
        avgMinutes: totalIncidents > 0
          ? closureIncidentDurationsMinutes.reduce((sum, minutes) => sum + minutes, 0) / totalIncidents
          : 0,
        p95Minutes: totalIncidents > 0
          ? sortedDurations[Math.min(sortedDurations.length - 1, Math.floor(sortedDurations.length * 0.95))]
          : 0,
        maxMinutes: totalIncidents > 0 ? sortedDurations[sortedDurations.length - 1] : 0,
      };

      const weekdayHeatValues = [];
      dayLabels.forEach((_, dayIndex) => {
        for (let slotInDay = 0; slotInDay < slotsPerDay; slotInDay += 1) {
          const denominator = runs * simulationWeeks;
          const risk = denominator > 0 ? weekdayRiskAccumulator[dayIndex][slotInDay] / denominator : 0;
          const x = (dayIndex * slotsPerDay) + slotInDay;
          weekdayHeatValues.push([x, dayIndex, risk]);
        }
      });

      const periodLabels = Array.from({ length: simulationWeeks }, (_, idx) => `KW ${idx + 1}`);
      const periodHeatValues = [];
      for (let weekIndex = 0; weekIndex < simulationWeeks; weekIndex += 1) {
        for (let dayIndex = 0; dayIndex < dayLabels.length; dayIndex += 1) {
          const denominator = runs * slotsPerDay;
          const risk = denominator > 0 ? periodRiskAccumulator[weekIndex][dayIndex] / denominator : 0;
          periodHeatValues.push([weekIndex, dayIndex, risk]);
        }
      }

      monteCarloResult = {
        runs,
        simulationWeeks,
        baseAbsenceProbabilityPct: baseAbsenceProb * 100,
        maxConcurrentOutages,
        resilienceScorePct,
        regularDaysPct,
        regularOperationPct,
        closurePct,
        closurePatterns,
        closureDurationDistribution,
        closureDurationStats,
        toleratedClosuresPerDay,
        seasonalityInfo: {
          enabled: seasonalityEnabled,
          minFactor: Math.min(...weeklySeasonality),
          maxFactor: Math.max(...weeklySeasonality),
        },
        cascadeCounts,
        weekdayLabels: dayLabels,
        weekdayHeatValues,
        periodLabels,
        periodHeatValues,
      };
    }

    const careValues = (weeklyData?.care_ratio || []).map((value) => Number(value || 0)).filter((value) => value > 0);
    const expertValues = (weeklyData?.expert_ratio || []).map((value) => Number(value || 0)).filter((value) => value >= 0);
    const demandSeries = (weeklyData?.demand || []).map((value) => Number(value || 0));
    const capacitySeries = (weeklyData?.capacity || []).map((value) => Number(value || 0));

    const avgCareRatio = careValues.length ? careValues.reduce((sum, value) => sum + value, 0) / careValues.length : 0;
    const minCareRatio = careValues.length ? Math.min(...careValues) : 0;
    const maxCareRatio = careValues.length ? Math.max(...careValues) : 0;

    const avgExpertRatio = expertValues.length ? expertValues.reduce((sum, value) => sum + value, 0) / expertValues.length : 0;
    const expertRatioUnderLegalSlots = expertValues.filter((value) => value < LEGAL_EXPERT_RATIO_MIN_PCT).length;

    const deficits = demandSeries.map((demandValue, index) => demandValue - Number(capacitySeries[index] || 0));
    const deficitSlots = deficits.filter((value) => value > 0).length;
    const worstDeficit = deficits.length ? Math.max(0, ...deficits) : 0;

    const weeklyCapacityHours = capacitySeries.reduce((sum, value) => sum + (Number(value || 0) * SLOT_HOURS), 0);
    const weeklyDemandHours = demandSeries.reduce((sum, value) => sum + (Number(value || 0) * SLOT_HOURS), 0);
    const monthlyCapacityFte = (weeklyCapacityHours * MONTHS_PER_WEEK) / MONTHLY_HOURS_PER_FTE;
    const monthlyDemandFte = (weeklyDemandHours * MONTHS_PER_WEEK) / MONTHLY_HOURS_PER_FTE;

    let financeTrend = {
      categories: [],
      income: [],
      expenses: [],
      net: [],
      kpis: {
        costPerCarePoint: 0,
        costCoveragePct: 0,
        rollingNet: 0,
      },
    };

    if (needsFinance) {
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

      financeTrend = {
        categories: financeRows.map((row) => row.label),
        income: financeRows.map((row) => row.income),
        expenses: financeRows.map((row) => row.expenses),
        net: financeRows.map((row) => row.net),
        kpis: {
          costPerCarePoint,
          costCoveragePct,
          rollingNet,
        },
      };
    }

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
        expertRatioUnderLegalSlots,
        monthlyCapacityFte,
        monthlyDemandFte,
        deficitSlots,
        worstDeficit,
      },
      resilience: {
        monteCarlo: monteCarloResult,
      },
      financeTrend,
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
    settledStory.id,
    weeklyChartData,
    heatmapMode,
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

    if (activeLoadingStages.length > 1) {
      stageIntervalId = setInterval(() => {
        setAnalysisLoadingStage((prev) => Math.min(prev + 1, activeLoadingStages.length - 2));
      }, 520);
    }

    const finishLoading = (nextData) => {
      if (cancelled) return;
      setCoverageData(nextData);
      setAnalysisLoadingStage(activeLoadingStages.length - 1);
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
  }, [activeLoadingStages, computeCoverageData]);

  const qualityMetrics = React.useMemo(() => {
    const activeItems = Object.values(effectiveDataItems || {}).filter(
      (item) =>
        shouldIncludeDataItemInAnalysis(item) &&
        (item.type === 'demand' || item.type === 'capacity') &&
        isRecordActiveOnDate(item, qualityReferenceDate)
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
        const currentGroupId = resolveGroupIdAtDate(getEffectiveGroupAssignments(itemId), qualityReferenceDate, item.groupId || null);
        const hasBooking = Object.values(getEffectiveBookings(itemId) || {}).some((booking) => isRecordActiveOnDate(booking, qualityReferenceDate));

        let hasFinance = false;
        if (itemType === 'capacity') {
          const personnelHistory = financeScenario?.itemFinances?.[itemId]?.personnelCostHistory || [];
          hasFinance = personnelHistory.some((entry) => isRecordActiveOnDate(entry, qualityReferenceDate));
        } else {
          // Kinder benötigen für diese KPI keine eigenen Finanzdaten.
          hasFinance = true;
        }

        const hasActiveAbsence = itemType === 'capacity'
          ? (Array.isArray(item.absences)
            && item.absences.some((absence) => isDateWithinRange(
              qualityReferenceDate,
              absence?.start || absence?.startdate || '',
              absence?.end || absence?.enddate || ''
            )))
          : false;

        const missingReasons = [];
        if (!hasBooking) missingReasons.push('keine Buchung');
        if (!hasFinance) missingReasons.push('keine Finanzen');

        return {
          id: itemId,
          name: item.name || (itemType === 'demand' ? 'Kind' : 'Mitarbeiter'),
          type: itemType,
          groupId: currentGroupId ? String(currentGroupId) : null,
          isComplete: missingReasons.length === 0,
          missingReasons,
          hasActiveAbsence,
        };
      })
      .filter((entry) => applyGroupFilter(entry.groupId));

    const childrenEntries = itemAnalyses.filter((entry) => entry.type === 'demand');
    const employeeEntries = itemAnalyses.filter((entry) => entry.type === 'capacity');

    const completeChildren = childrenEntries.filter((entry) => entry.isComplete).length;
    const completeEmployees = employeeEntries.filter((entry) => entry.isComplete).length;
    const totalChildren = itemAnalyses.filter((entry) => entry.type === 'demand').length;
    const totalEmployees = itemAnalyses.filter((entry) => entry.type === 'capacity').length;
    const incompleteRecords = itemAnalyses.filter((entry) => !entry.isComplete);

    const incompleteChildren = childrenEntries.filter((entry) => !entry.isComplete);
    const incompleteEmployees = employeeEntries.filter((entry) => !entry.isComplete);
    const activeEmployees = employeeEntries.filter((entry) => !entry.hasActiveAbsence).length;
    const passiveEmployees = employeeEntries.filter((entry) => entry.hasActiveAbsence).length;

    const groupDefById = new Map((groupDefs || []).map((group) => [String(group.id), group]));
    const childCountsByGroup = new Map();
    childrenEntries.forEach((entry) => {
      const key = entry.groupId || '__NO_GROUP__';
      childCountsByGroup.set(key, (childCountsByGroup.get(key) || 0) + 1);
    });

    const childGroupBreakdown = Array.from(childCountsByGroup.entries())
      .map(([groupId, count]) => {
        if (groupId === '__NO_GROUP__') {
          return { id: groupId, name: 'Ohne Gruppe', icon: null, count: Number(count || 0) };
        }
        const group = groupDefById.get(String(groupId));
        return {
          id: String(groupId),
          name: group?.name || 'Gruppe',
          icon: group?.icon,
          count: Number(count || 0),
        };
      })
      .sort((a, b) => b.count - a.count);

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
      incompleteChildren,
      incompleteEmployees,
      activeEmployees,
      passiveEmployees,
      childGroupBreakdown,
      alerts,
    };
  }, [
    effectiveDataItems,
    financeScenario,
    getEffectiveBookings,
    getEffectiveGroupAssignments,
    groupDefs,
    qualificationDefs,
    qualityReferenceDate,
    selectedGroups,
  ]);

  const qualityStaffScheduleData = React.useMemo(() => {
    const categories = generateTimeSegments();
    const hasGroupFilter = Array.isArray(selectedGroups) && selectedGroups.length > 0;
    const groupFilterSet = new Set((selectedGroups || []).map((groupId) => String(groupId)));
    const rawScenarioItems = dataByScenario?.[selectedScenarioId] || {};
    const archivedIds = new Set(
      Object.entries(rawScenarioItems)
        .filter(([, item]) => isArchivedDataItem(item))
        .map(([itemId]) => String(itemId))
    );
    const groupNameById = new Map((groupDefs || []).map((group) => [String(group.id), group.name || 'Gruppe']));
    const groupColorById = new Map((groupDefs || []).map((group, index) => [
      String(group.id),
      QUALITY_GROUP_COLOR_PALETTE[index % QUALITY_GROUP_COLOR_PALETTE.length],
    ]));

    const hasActiveAbsenceAtReferenceDate = (item) => (
      Array.isArray(item?.absences)
      && item.absences.some((absence) => isDateWithinRange(
        qualityReferenceDate,
        absence?.start || absence?.startdate || '',
        absence?.end || absence?.enddate || ''
      ))
    );

    const applyGroupFilter = (groupId) => {
      if (!hasGroupFilter) return true;
      if (!groupId && groupFilterSet.has('__NO_GROUP__')) return true;
      if (!groupId) return false;
      return groupFilterSet.has(String(groupId));
    };

    const employeeRows = Object.values(effectiveDataItems || {})
      .filter(
        (item) =>
          item?.type === 'capacity'
          && !isArchivedDataItem(item)
          && !archivedIds.has(String(item?.id || ''))
          && shouldIncludeDataItemInAnalysis(item)
          && isRecordActiveOnDate(item, qualityReferenceDate)
          && !hasActiveAbsenceAtReferenceDate(item)
      )
      .map((item) => {
        const itemId = String(item.id);
        const resolvedGroupId = resolveGroupIdAtDate(
          getEffectiveGroupAssignments(itemId),
          qualityReferenceDate,
          item.groupId || null
        );
        const groupId = resolvedGroupId ? String(resolvedGroupId) : null;
        if (!applyGroupFilter(groupId)) return null;

        const activeBookings = Object.values(getEffectiveBookings(itemId) || {})
          .filter((booking) => !booking?.archived && isRecordActiveOnDate(booking, qualityReferenceDate));
        const pedSeries = generateBookingDataSeries(qualityReferenceDate, activeBookings, categories, 'pedagogical')
          .map((value) => (Number(value || 0) > 0 ? 1 : 0));
        const adminSeries = generateBookingDataSeries(qualityReferenceDate, activeBookings, categories, 'administrative')
          .map((value) => (Number(value || 0) > 0 ? 1 : 0));
        const combinedPresenceSeries = pedSeries.map((value, index) => (
          (Number(value || 0) > 0 || Number(adminSeries[index] || 0) > 0) ? 1 : 0
        ));

        return {
          id: itemId,
          name: item.name || 'Mitarbeiter',
          groupId: groupId || '__NO_GROUP__',
          groupName: groupId ? (groupNameById.get(groupId) || 'Gruppe') : 'Ohne Gruppe',
          groupColor: groupId ? (groupColorById.get(groupId) || '#64748b') : '#64748b',
          pedagogicalPresenceSeries: pedSeries,
          administrativePresenceSeries: adminSeries,
          isPlannedAtLeastOnce: combinedPresenceSeries.some((value) => Number(value || 0) > 0),
        };
      })
      .filter(Boolean)
      .filter((row) => (qualityOnlyPlannedStaff ? row.isPlannedAtLeastOnce : true))
      .sort((a, b) => {
        const groupCompare = a.groupName.localeCompare(b.groupName, 'de', { sensitivity: 'base' });
        if (groupCompare !== 0) return groupCompare;
        return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
      });

    const employees = employeeRows.map((row) => ({
      id: row.id,
      name: row.name,
      groupName: row.groupName,
      groupColor: row.groupColor,
    }));

    const groupLegendMap = new Map();
    employeeRows.forEach((row) => {
      if (!groupLegendMap.has(row.groupId)) {
        groupLegendMap.set(row.groupId, {
          id: row.groupId,
          name: row.groupName,
          color: row.groupColor,
        });
      }
    });

    const heatValues = [];
    employeeRows.forEach((row, rowIndex) => {
      categories.forEach((_, slotIndex) => {
        const pedPlanned = Number(row.pedagogicalPresenceSeries[slotIndex] || 0) > 0 ? 1 : 0;
        const adminPlanned = Number(row.administrativePresenceSeries[slotIndex] || 0) > 0 ? 1 : 0;
        const hasAnyPlanned = pedPlanned || adminPlanned;
        const roleLabel = pedPlanned && adminPlanned
          ? 'Pädagogische + Administrative Zeit'
          : pedPlanned
            ? 'Pädagogische Zeit'
            : adminPlanned
              ? 'Administrative Zeit'
              : 'Keine Planung';
        const cellColor = pedPlanned
          ? row.groupColor
          : adminPlanned
            ? QUALITY_ADMIN_TIME_COLOR
            : '#e2e8f0';

        heatValues.push({
          x: slotIndex,
          y: rowIndex,
          value: hasAnyPlanned ? 1 : 0,
          roleLabel,
          color: cellColor,
          groupName: row.groupName,
        });
      });
    });

    return {
      categories,
      employees,
      heatValues,
      groupLegend: Array.from(groupLegendMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })),
    };
  }, [
    dataByScenario,
    effectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupAssignments,
    groupDefs,
    qualityOnlyPlannedStaff,
    qualityReferenceDate,
    selectedScenarioId,
    selectedGroups,
  ]);

  const previewFlow = React.useMemo(() => {
    const referenceDate = chartState?.referenceDate || todayIso;
    const inflowActive = Boolean(simulateInflow);
    const noGroup = 'Ohne Gruppe';
    const syntheticGroupIds = {
      kita: '__AUTO_STAGE_KITA__',
      school: '__AUTO_STAGE_SCHOOL__',
      exit: '__AUTO_STAGE_EXIT__',
    };
    const dateLabelFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

    const groupsById = new Map((groupDefs || []).map((group) => [String(group.id), group.name || 'Gruppe']));
    const groupMetaById = new Map((groupDefs || []).map((group) => [String(group.id), {
      name: String(group?.name || ''),
      type: String(group?.type || ''),
    }]));
    groupsById.set(syntheticGroupIds.kita, 'Kita');
    groupsById.set(syntheticGroupIds.school, 'Schule');
    groupsById.set(syntheticGroupIds.exit, 'Aus Einrichtung');
    groupMetaById.set(syntheticGroupIds.kita, { name: 'Kita', type: 'Regelgruppe' });
    groupMetaById.set(syntheticGroupIds.school, { name: 'Schule', type: 'Schulkindgruppe' });
    groupMetaById.set(syntheticGroupIds.exit, { name: 'Aus Einrichtung', type: 'Exit' });

    const fillUpGroupIds = new Set(
      (groupDefs || [])
        .filter((group) => String(group?.type || '') === 'Schulkindgruppe' && Boolean(group?.fillUp))
        .map((group) => String(group.id))
    );

    // Build a map of group-id -> maxSchoolGrade for school groups with fill-up
    const maxSchoolGradeByGroup = new Map();
    (groupDefs || []).forEach((group) => {
      const gid = String(group.id);
      const raw = Number(group?.maxSchoolGrade);
      if (Number.isFinite(raw) && raw > 0 && fillUpGroupIds.has(gid)) {
        maxSchoolGradeByGroup.set(gid, raw);
      }
    });

    // For each school child, pre-compute a simulated exit date based on maxSchoolGrade.
    // School entry is Sep 1 of the child's enrollment year (Bavaria rule).
    // After `maxSchoolGrade` years of school, the child exits on Sep 1 of the following year.
    const computeSchoolGradeExitDate = (item, schoolGroupId) => {
      const maxGrade = maxSchoolGradeByGroup.get(String(schoolGroupId || ''));
      if (!maxGrade) return null;
      const dob = item?.dateofbirth;
      if (!dob) return null;
      // Simplified: birth -> 6th birthday -> next Sep 1 = school start year
      const birthDate = parseIsoDateSafe(dob);
      if (!birthDate) return null;
      const sixthBirthYear = birthDate.getUTCFullYear() + 6;
      const sixthBirthMonth = birthDate.getUTCMonth() + 1;
      // Bavaria: enrolled Sep of 6th-birthday year if birthday before Oct 1
      const schoolStartYear = sixthBirthMonth <= 9 ? sixthBirthYear : sixthBirthYear + 1;
      // After maxGrade years, the exit is at Sep 1 (start of year after last grade)
      const exitYear = schoolStartYear + maxGrade;
      return `${String(exitYear).padStart(4, '0')}-09-01`;
    };

    // Override isRecordActiveOnDate for school-group children honoring maxSchoolGrade
    const isActiveForForecast = (item, dateIso, { schoolGroupId = null } = {}) => {
      if (!isRecordActiveOnDate(item, dateIso)) return false;
      if (!schoolGroupId || !maxSchoolGradeByGroup.has(String(schoolGroupId))) return true;
      const exitDate = computeSchoolGradeExitDate(item, schoolGroupId);
      if (!exitDate) return true;
      return String(dateIso) < exitDate;
    };

    const groupColorsById = (() => {
      const map = {};
      (groupDefs || []).forEach((group, idx) => {
        map[String(group.id)] = FORECAST_GROUP_COLOR_PALETTE[idx % FORECAST_GROUP_COLOR_PALETTE.length];
      });
      map[String(syntheticGroupIds.kita)] = '#0ea5e9';
      map[String(syntheticGroupIds.school)] = '#6366f1';
      map[String(syntheticGroupIds.exit)] = '#475569';
      map.__NO_GROUP__ = '#94a3b8';
      return map;
    })();

    const groupIdByStage = {
      kita: String(
        (groupDefs || []).find((group) => {
          const type = String(group?.type || '').toLowerCase();
          const name = String(group?.name || '').toLowerCase();
          return type.includes('regel') || type.includes('kita') || name.includes('regel') || name.includes('kita');
        })?.id || syntheticGroupIds.kita
      ),
      school: String(
        (groupDefs || []).find((group) => {
          const type = String(group?.type || '').toLowerCase();
          const name = String(group?.name || '').toLowerCase();
          return type.includes('schul') || name.includes('schul');
        })?.id || syntheticGroupIds.school
      ),
      exit: String(syntheticGroupIds.exit),
    };

    const formatGroupLabel = (groupIdRaw) => {
      if (!groupIdRaw) return noGroup;
      const groupId = String(groupIdRaw);
      const baseName = groupsById.get(groupId) || noGroup;
      if (fillUpGroupIds.has(groupId)) {
        return `${baseName} (Auffuellen)`;
      }
      return baseName;
    };

    const getAgeBucketRank = (groupId) => {
      const id = String(groupId || '');
      const meta = groupMetaById.get(id) || { name: id, type: '' };
      const haystack = `${String(meta.name || '')} ${String(meta.type || '')}`.toLowerCase();

      // Render order top -> bottom: Schule, Regelgruppe, Krippe.
      if (id === String(syntheticGroupIds.exit) || haystack.includes('exit') || haystack.includes('aus einrichtung')) return 4;
      if (haystack.includes('schul') || haystack.includes('vorschul') || haystack.includes('hort')) return 3;
      if (haystack.includes('regel') || haystack.includes('kita') || haystack.includes('kindergarten')) return 2;
      if (haystack.includes('kripp') || haystack.includes('u3')) return 1;
      if (id === '__NO_GROUP__') return 0;
      return 2;
    };

    const hasGroupFilter = Array.isArray(selectedGroups) && selectedGroups.length > 0;
    const selectedGroupSet = new Set((selectedGroups || []).map((value) => String(value)));

    const allScenarioEvents = (eventsByScenario?.[selectedScenarioId] || []).filter((event) => {
      if (!event || event.enabled === false) return false;
      if (event.entityType !== 'demand') return false;
      const eventDateIso = String(event?.simulatedDate || event?.effectiveDate || '');
      if (!eventDateIso || eventDateIso < referenceDate) return false;
      return event.type === 'group_assignment_start'
        || event.type === 'group_assignment_end'
        || event.type === 'auto_group_transition';
    });

    const getEventDateIso = (event) => String(event?.simulatedDate || event?.effectiveDate || '');

    const flowCounter = new Map();
    const nodesById = new Map();

    const makeNodeId = (dateIso, groupId) => `${dateIso}__${groupId || '__NO_GROUP__'}`;

    const ensureNode = (dateIso, groupId, groupLabel) => {
      const id = makeNodeId(dateIso, groupId);
      if (!nodesById.has(id)) {
        nodesById.set(id, {
          id,
          name: groupLabel,
          dateIso,
          groupId: groupId || '__NO_GROUP__',
          groupLabel,
          count: 0,
        });
      }
      return id;
    };

    const addFlow = (fromNodeId, toNodeId, stepLabel, stepDateIso, weight = 1, children = []) => {
      if (!fromNodeId || !toNodeId || weight <= 0) return;
      const key = `${fromNodeId}__${toNodeId}__${stepDateIso || ''}`;
      const current = flowCounter.get(key);
      if (current) {
        current.weight += weight;
        current.children = [...(current.children || []), ...children];
      } else {
        flowCounter.set(key, {
          from: fromNodeId,
          to: toNodeId,
          weight,
          stepLabel,
          stepDateIso,
          children: [...children],
        });
      }
    };

    const demandItems = getActiveDemandChildrenAtDate(effectiveDataItems || {}, referenceDate);

    const activeNowChildren = demandItems.filter((item) => {
      const itemId = String(item.id);
      const assignments = getEffectiveGroupAssignments(itemId);
      const currentGroupId = resolveGroupIdAtDate(assignments, referenceDate, item.groupId || null);
      if (!hasGroupFilter) return true;
      if (!currentGroupId) return selectedGroupSet.has('__NO_GROUP__');
      return selectedGroupSet.has(String(currentGroupId));
    });

    const activeNowChildIds = new Set(activeNowChildren.map((item) => String(item.id || '')));
    const scenarioEvents = allScenarioEvents.filter((event) => activeNowChildIds.has(String(event?.entityId || '')));

    // Simulated inflow: synthetic "phantom" children entering each Sept 1 in forecast window
    // Compute avg entries directly from dataByScenario historical startdates.
    const simulatedInflowChildren = [];
    if (inflowActive) {
      const scenarioItemsForInflow = selectedScenarioId ? (dataByScenario?.[selectedScenarioId] || {}) : {};
      const entryYearCounts = new Map();
      Object.values(scenarioItemsForInflow).forEach((item) => {
        if (!item || item.archived || item.type !== 'demand') return;
        if (!shouldIncludeDataItemInAnalysis(item)) return;
        const startIso = String(item.startdate || '');
        if (!startIso) return;
        const yearKey = startIso.slice(0, 4);
        entryYearCounts.set(yearKey, Number(entryYearCounts.get(yearKey) || 0) + 1);
      });
      const entriesTotalVals = Array.from(entryYearCounts.values());
      const avgAnnualEntries = entriesTotalVals.length > 0
        ? entriesTotalVals.reduce((sum, v) => sum + v, 0) / entriesTotalVals.length
        : 0;
      if (avgAnnualEntries > 0) {
        const refYear = Number(String(referenceDate).slice(0, 4));
        const maxYears = 6;
        for (let yearOffset = 1; yearOffset <= maxYears; yearOffset += 1) {
          const entryYear = refYear + yearOffset;
          const entryDate = `${entryYear}-09-01`;
          const exitDate = `${entryYear + 3}-09-01`; // assume Krippe 3 years
          const count = Math.round(avgAnnualEntries);
          for (let i = 0; i < count; i += 1) {
            simulatedInflowChildren.push({
              _synthetic: true,
              id: `__inflow__${entryYear}__${i}`,
              name: `Zulauf ${entryYear} #${i + 1}`,
              startdate: entryDate,
              enddate: exitDate,
              type: 'demand',
              groupId: groupIdByStage.kita || null,
            });
          }
        }
      }
    }

    const assignmentDates = activeNowChildren.flatMap((item) => {
      const assignments = getEffectiveGroupAssignments(String(item.id));
      if (!Array.isArray(assignments)) return [];
      return assignments
        .map((assignment) => String(assignment?.start || ''))
        .filter((dateIso) => dateIso && dateIso >= referenceDate);
    });

    const autoTransitionsByItem = new Map();
    scenarioEvents
      .filter((event) => event?.type === 'auto_group_transition' && event?.metadata?.targetStage)
      .forEach((event) => {
        const itemId = String(event.entityId || '');
        if (!itemId) return;
        const next = autoTransitionsByItem.get(itemId) || [];
        next.push(event);
        autoTransitionsByItem.set(itemId, next);
      });
    autoTransitionsByItem.forEach((events, itemId) => {
      autoTransitionsByItem.set(
        itemId,
        [...events].sort((left, right) => {
          const dateDiff = getEventDateIso(left).localeCompare(getEventDateIso(right));
          if (dateDiff !== 0) return dateDiff;
          return String(left.id || '').localeCompare(String(right.id || ''));
        })
      );
    });

    const eventDates = Array.from(
      new Set([
        ...scenarioEvents.map((event) => getEventDateIso(event)).filter((dateIso) => Boolean(dateIso)),
        ...assignmentDates,
      ])
    ).sort();

    const resolveGroupAtDate = (item, dateIso, { includeExit = true } = {}) => {
      if (!isRecordActiveOnDate(item, dateIso)) {
        if (includeExit) {
          return {
            groupId: String(syntheticGroupIds.exit),
            groupLabel: formatGroupLabel(syntheticGroupIds.exit),
          };
        }
        return {
          groupId: '__NO_GROUP__',
          groupLabel: noGroup,
        };
      }

      const itemId = String(item.id || '');
      const assignments = getEffectiveGroupAssignments(itemId);
      const baseGroupIdRaw = resolveGroupIdAtDate(assignments, dateIso, item.groupId || null);

      const transitions = autoTransitionsByItem.get(itemId) || [];
      const applicable = transitions.filter((event) => getEventDateIso(event) <= String(dateIso));
      const lastTransition = applicable.length ? applicable[applicable.length - 1] : null;
      const targetStage = String(lastTransition?.metadata?.targetStage || '').toLowerCase();
      const projectedGroupId = Object.prototype.hasOwnProperty.call(groupIdByStage, targetStage)
        ? groupIdByStage[targetStage]
        : null;

      const groupIdRaw = projectedGroupId || baseGroupIdRaw;
      const groupId = groupIdRaw ? String(groupIdRaw) : '__NO_GROUP__';

      // Apply maxSchoolGrade exit: if this child should have left already, mark as exit
      if (includeExit && !isActiveForForecast(item, dateIso, { schoolGroupId: groupId })) {
        return {
          groupId: String(syntheticGroupIds.exit),
          groupLabel: formatGroupLabel(syntheticGroupIds.exit),
        };
      }

      const groupLabel = groupIdRaw ? formatGroupLabel(groupId) : noGroup;
      return { groupId, groupLabel };
    };

    const timelineTailDates = activeNowChildren.flatMap((item) => {
      const dates = [];
      const enddateRaw = String(item?.enddate || '');
      if (enddateRaw && enddateRaw >= referenceDate) dates.push(enddateRaw);
      // Add grade-exit dates for school children
      if (maxSchoolGradeByGroup.size > 0) {
        [groupIdByStage.school, ...(groupDefs || []).filter((g) => maxSchoolGradeByGroup.has(String(g.id))).map((g) => String(g.id))].forEach((gid) => {
          const exitDate = computeSchoolGradeExitDate(item, gid);
          if (exitDate && exitDate >= referenceDate) dates.push(exitDate);
        });
      }
      return dates;
    });

    const timelineDates = Array.from(new Set([referenceDate, ...eventDates, ...timelineTailDates])).sort();

    const stepSummaries = [];
    let previousDate = timelineDates[0] || referenceDate;

    timelineDates.slice(1).forEach((eventDate) => {
      const stepLabel = dateLabelFormatter.format(parseIsoDateSafe(eventDate) || new Date(`${eventDate}T00:00:00Z`));
      let changedInStep = 0;
      let linkedInStep = 0;
      const stepFlowCounter = new Map();

      const addStepFlow = (fromNodeId, toNodeId, child, weight = 1) => {
        if (!fromNodeId || !toNodeId || weight <= 0) return;
        const key = `${fromNodeId}__${toNodeId}`;
        const current = stepFlowCounter.get(key);
        if (current) {
          current.weight += weight;
          current.children.push(child);
        } else {
          stepFlowCounter.set(key, { from: fromNodeId, to: toNodeId, weight, children: [child] });
        }
      };

      activeNowChildren.forEach((item) => {
        if (!isRecordActiveOnDate(item, previousDate)) return;

        const fromState = resolveGroupAtDate(item, previousDate, { includeExit: false });
        const toState = resolveGroupAtDate(item, eventDate);
        const fromNodeId = ensureNode(previousDate, fromState.groupId, fromState.groupLabel);
        const toNodeId = ensureNode(eventDate, toState.groupId, toState.groupLabel);

        addStepFlow(fromNodeId, toNodeId, { id: String(item.id || ''), name: String(item.name || 'Kind') }, 1);
        linkedInStep += 1;
        if (fromState.groupId !== toState.groupId) {
          changedInStep += 1;
        }
      });

      if (linkedInStep > 0) {
        stepFlowCounter.forEach((entry) => {
          addFlow(entry.from, entry.to, stepLabel, eventDate, Number(entry.weight || 0), entry.children || []);
        });
        stepSummaries.push({
          dateIso: eventDate,
          label: stepLabel,
          changed: changedInStep,
          linked: linkedInStep,
        });
        previousDate = eventDate;
      }
    });

    const links = Array.from(flowCounter.values())
      .map((entry) => ({
        from: entry.from,
        to: entry.to,
        weight: Number(entry.weight || 0),
        stepLabel: entry.stepLabel,
        stepDateIso: entry.stepDateIso,
        children: Array.from(
          new Map((entry.children || []).map((child) => [String(child.id || ''), child])).values()
        ),
      }))
      .filter((entry) => entry.weight > 0);

    const nodeCountById = new Map();
    timelineDates.forEach((dateIso) => {
      activeNowChildren.forEach((item) => {
        const state = resolveGroupAtDate(item, dateIso);
        const nodeId = ensureNode(dateIso, state.groupId, state.groupLabel);
        nodeCountById.set(nodeId, Number(nodeCountById.get(nodeId) || 0) + 1);
      });
    });

    const nodes = Array.from(nodesById.values()).map((node) => ({
      id: node.id,
      name: `${node.name}: ${Number(nodeCountById.get(node.id) || 0)} Kinder`,
      groupId: node.groupId,
      dateIso: node.dateIso,
      rank: getAgeBucketRank(node.groupId),
      stageLabel: node.dateIso === referenceDate
        ? 'Stichtag'
        : dateLabelFormatter.format(parseIsoDateSafe(node.dateIso) || new Date(`${node.dateIso}T00:00:00Z`)),
    }));
    const timelineLabels = timelineDates.map((dateIso) => dateLabelFormatter.format(parseIsoDateSafe(dateIso) || new Date(`${dateIso}T00:00:00Z`)));
    const groupTimelineCounter = new Map();

    timelineDates.forEach((dateIso, dateIndex) => {
      const allForecastChildren = inflowActive
        ? [...activeNowChildren, ...simulatedInflowChildren]
        : activeNowChildren;

      allForecastChildren.forEach((item) => {
        if (!isRecordActiveOnDate(item, dateIso)) return;
        const isSynthetic = Boolean(item._synthetic);
        const state = isSynthetic
          ? { groupId: String(item.groupId || groupIdByStage.kita || '__NO_GROUP__'), groupLabel: groupsById.get(String(item.groupId || '')) || 'Krippe (Zulauf)' }
          : resolveGroupAtDate(item, dateIso);
        const groupId = String(state.groupId || '__NO_GROUP__');
        if (!groupTimelineCounter.has(groupId)) {
          groupTimelineCounter.set(groupId, {
            groupId,
            name: state.groupLabel,
            color: groupColorsById[groupId] || '#64748b',
            data: timelineDates.map(() => 0),
            hoursData: timelineDates.map(() => 0),
            childrenByIndex: timelineDates.map(() => []),
          });
        }
        const groupSeries = groupTimelineCounter.get(groupId);
        groupSeries.data[dateIndex] = Number(groupSeries.data[dateIndex] || 0) + 1;

        if (!isSynthetic) {
          // Accumulate weekly booking hours for this child at this date
          const itemId = String(item.id || '');
          const bookingsForItem = Object.values(getEffectiveBookings(itemId) || {});
          const activeBookings = bookingsForItem.filter((b) => isRecordActiveOnDate(b, dateIso));
          const childWeeklyHours = activeBookings.reduce((sum, booking) => {
            let totalMins = 0;
            (booking.times || []).forEach((day) => {
              (day.segments || []).forEach((seg) => {
                if (!seg.booking_start || !seg.booking_end) return;
                const [sh, sm] = String(seg.booking_start).split(':').map(Number);
                const [eh, em] = String(seg.booking_end).split(':').map(Number);
                const mins = ((eh * 60 + em) - (sh * 60 + sm));
                if (mins > 0) totalMins += mins;
              });
            });
            return sum + (totalMins / 60);
          }, 0);
          groupSeries.hoursData[dateIndex] = Number(groupSeries.hoursData[dateIndex] || 0) + childWeeklyHours;
          groupSeries.childrenByIndex[dateIndex].push({
            id: itemId,
            name: String(item.name || 'Kind'),
          });
        }
      });
    });

    const seriesByGroup = Array.from(groupTimelineCounter.values())
      .sort((left, right) => {
        const leftRank = getAgeBucketRank(left.groupId);
        const rightRank = getAgeBucketRank(right.groupId);
        if (leftRank !== rightRank) return rightRank - leftRank;

        const leftMax = Math.max(...left.data, 0);
        const rightMax = Math.max(...right.data, 0);
        if (leftMax !== rightMax) return rightMax - leftMax;
        return String(left.name).localeCompare(String(right.name), 'de', { sensitivity: 'base' });
      });

    const eventByDate = scenarioEvents.reduce((accumulator, event) => {
      const key = getEventDateIso(event);
      if (!key) return accumulator;
      if (!accumulator[key]) {
        accumulator[key] = { total: 0, auto: 0, eventList: [] };
      }
      accumulator[key].total += 1;
      if (event?.type === 'auto_group_transition') {
        accumulator[key].auto += 1;
      }
      accumulator[key].eventList.push({
        id: String(event?.id || ''),
        type: String(event?.type || ''),
        entityName: String(event?.entityName || ''),
        description: String(event?.description || ''),
        targetStage: String(event?.metadata?.targetStage || ''),
      });
      return accumulator;
    }, {});

    const timelinePoints = Object.entries(eventByDate)
      .sort(([leftDate], [rightDate]) => String(leftDate).localeCompare(String(rightDate)))
      .map(([dateIso, counts]) => ({
        x: new Date(`${dateIso}T00:00:00Z`).getTime(),
        name: `${Number(counts.total || 0)} Events`,
        label: `${dateLabelFormatter.format(parseIsoDateSafe(dateIso) || new Date(`${dateIso}T00:00:00Z`))} · ${Number(counts.total || 0)}`,
        description: `${Number(counts.auto || 0)} Auto-Events`,
        count: Number(counts.total || 0),
        autoCount: Number(counts.auto || 0),
        dateLabel: dateLabelFormatter.format(parseIsoDateSafe(dateIso) || new Date(`${dateIso}T00:00:00Z`)),
        eventList: counts.eventList || [],
      }));

    const changedLinks = links.filter((entry) => {
      const fromNode = nodesById.get(entry.from);
      const toNode = nodesById.get(entry.to);
      return fromNode && toNode && fromNode.groupId !== toNode.groupId;
    });

    const changedVolumes = changedLinks.map((entry) => Number(entry.weight || 0));
    const totalTransitions = changedVolumes.reduce((sum, value) => sum + value, 0);
    const top3Transitions = [...changedVolumes].sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
    const concentrationPct = totalTransitions > 0 ? (top3Transitions / totalTransitions) * 100 : 0;

    const topTransition = changedLinks.reduce((best, current) => {
      const currentWeight = Number(current.weight || 0);
      if (!best || currentWeight > best.weight) {
        const fromNode = nodesById.get(current.from);
        const toNode = nodesById.get(current.to);
        return {
          from: fromNode?.name || '-',
          to: toNode?.name || '-',
          weight: currentWeight,
        };
      }
      return best;
    }, null);

    return {
      referenceDate,
      eventDates: stepSummaries,
      nodes,
      links,
      groupColorsById,
      groupTimeline: {
        dates: timelineDates,
        labels: timelineLabels,
        seriesByGroup,
        timelinePoints,
        rangeStartIso: timelineDates[0] || referenceDate,
        rangeEndIso: timelineDates[timelineDates.length - 1] || referenceDate,
      },
      kpis: {
        activeNowCount: activeNowChildren.length,
        eventStepsCount: stepSummaries.length,
        transitionCount: totalTransitions,
        concentrationPct,
        topTransition,
      },
    };
  }, [
    chartState?.referenceDate,
    dataByScenario,
    effectiveDataItems,
    eventsByScenario,
    getEffectiveBookings,
    getEffectiveGroupAssignments,
    groupDefs,
    selectedGroups,
    selectedScenarioId,
    simulateInflow,
    todayIso,
  ]);

  const demographyData = React.useMemo(() => {
    const referenceDate = chartState?.referenceDate || todayIso;
    const cohortSizeMonths = Number(DEMOGRAPHY_RESOLUTION_MONTHS[demographyResolution] || DEMOGRAPHY_RESOLUTION_MONTHS.quarter);
    const formatter = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });
    const cohortStarts = Array.from(
      { length: Math.floor(AGE_HISTOGRAM_MAX_MONTHS / cohortSizeMonths) + 1 },
      (_, idx) => idx * cohortSizeMonths
    );
    const cohortLabels = cohortStarts.map((start) => {
      const fromYears = (start / 12).toLocaleString('de-DE', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });
      const toYears = ((start + cohortSizeMonths) / 12).toLocaleString('de-DE', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });
      return `${fromYears}-${toYears}`;
    });

    const hasGroupFilter = Array.isArray(selectedGroups) && selectedGroups.length > 0;
    const groupFilterSet = new Set((selectedGroups || []).map((value) => String(value)));

    const scenarioEvents = (eventsByScenario?.[selectedScenarioId] || []).filter((event) => (
      event
      && event.enabled !== false
      && event.type === 'auto_group_transition'
      && event.entityType === 'demand'
      && event.effectiveDate
      && event.metadata?.targetStage
    ));

    const autoTransitionsByItem = new Map();
    scenarioEvents.forEach((event) => {
      const itemId = String(event.entityId || '');
      if (!itemId) return;
      const next = autoTransitionsByItem.get(itemId) || [];
      next.push(event);
      autoTransitionsByItem.set(itemId, next);
    });
    autoTransitionsByItem.forEach((events, itemId) => {
      autoTransitionsByItem.set(
        itemId,
        [...events].sort((left, right) => {
          const dateDiff = String(left.effectiveDate).localeCompare(String(right.effectiveDate));
          if (dateDiff !== 0) return dateDiff;
          return String(left.id || '').localeCompare(String(right.id || ''));
        })
      );
    });

    const groupIdByStage = {
      kita: String(
        (groupDefs || []).find((group) => {
          const type = String(group?.type || '').toLowerCase();
          const name = String(group?.name || '').toLowerCase();
          return type.includes('regel') || type.includes('kita') || name.includes('regel') || name.includes('kita');
        })?.id || ''
      ),
      school: String(
        (groupDefs || []).find((group) => {
          const type = String(group?.type || '').toLowerCase();
          const name = String(group?.name || '').toLowerCase();
          return type.includes('schul') || name.includes('schul');
        })?.id || ''
      ),
    };

    const resolveProjectedGroupIdAtDate = (item, dateIso) => {
      const itemId = String(item?.id || '');
      if (!itemId) return null;

      const baseGroupId = resolveGroupIdAtDate(getEffectiveGroupAssignments(itemId), dateIso, item.groupId || null);
      const transitions = autoTransitionsByItem.get(itemId) || [];
      if (!transitions.length) return baseGroupId;

      const applicable = transitions.filter((event) => String(event.effectiveDate) <= String(dateIso));
      if (!applicable.length) return baseGroupId;

      const lastTransition = applicable[applicable.length - 1];
      const targetStage = String(lastTransition?.metadata?.targetStage || '').toLowerCase();
      const projectedGroupId = groupIdByStage[targetStage];
      return projectedGroupId || baseGroupId;
    };

    const isGroupSelected = (item, dateIso) => {
      if (!hasGroupFilter) return true;
      const groupId = resolveProjectedGroupIdAtDate(item, dateIso);
      if (!groupId) return groupFilterSet.has('__NO_GROUP__');
      return groupFilterSet.has(String(groupId));
    };

    const snapshots = Array.from({ length: 12 }, (_, idx) => {
      const monthDate = new Date(referenceDate);
      monthDate.setUTCDate(15);
      monthDate.setUTCMonth(monthDate.getUTCMonth() + idx);
      const monthIso = monthDate.toISOString().slice(0, 10);

      const ageValues = getActiveDemandChildrenAtDate(effectiveDataItems || {}, monthIso)
        .filter((item) => isGroupSelected(item, monthIso))
        .map((item) => getAgeInMonthsAtDate(item.dateofbirth, monthIso))
        .filter((age) => Number.isFinite(age));

      const cohortCounts = cohortStarts.map(() => 0);
      ageValues.forEach((ageMonths) => {
        const boundedAge = Math.max(0, Math.min(AGE_HISTOGRAM_MAX_MONTHS, Number(ageMonths || 0)));
        const cohortIndex = Math.min(cohortCounts.length - 1, Math.floor(boundedAge / cohortSizeMonths));
        cohortCounts[cohortIndex] += 1;
      });

      const total = ageValues.length;
      const peakIndex = cohortCounts.reduce((bestIdx, value, idx, arr) => (value > arr[bestIdx] ? idx : bestIdx), 0);
      const peakBand = cohortLabels[peakIndex] || '-';
      const peakValue = Number(cohortCounts[peakIndex] || 0);
      const under3Count = ageValues.filter((ageMonths) => Number(ageMonths || 0) < 36).length;

      return {
        label: formatter.format(monthDate),
        monthIso,
        cohortSizeMonths,
        cohortLabels,
        cohortCounts,
        total,
        medianAgeMonths: getMedian(ageValues),
        u3SharePct: total > 0 ? (under3Count / total) * 100 : 0,
        peakBand,
        peakSharePct: total > 0 ? (peakValue / total) * 100 : 0,
      };
    });

    const currentSnapshot = snapshots[0] || null;
    const horizonDate = new Date(referenceDate);
    horizonDate.setUTCMonth(horizonDate.getUTCMonth() + 12);
    const horizonIso = horizonDate.toISOString().slice(0, 10);

    const schoolStarters12M = getActiveDemandChildrenAtDate(effectiveDataItems || {}, referenceDate)
      .filter((item) => isGroupSelected(item, referenceDate))
      .reduce((sum, item) => {
        const ageNow = getAgeInMonthsAtDate(item.dateofbirth, referenceDate);
        const ageFuture = getAgeInMonthsAtDate(item.dateofbirth, horizonIso);
        if (!Number.isFinite(ageNow) || !Number.isFinite(ageFuture)) return sum;
        if (ageNow < 72 && ageFuture >= 72) return sum + 1;
        return sum;
      }, 0);

    return {
      cohortLabels,
      cohortSizeMonths,
      snapshots,
      kpis: {
        medianAgeYears: (currentSnapshot?.medianAgeMonths || 0) / 12,
        u3SharePct: currentSnapshot?.u3SharePct || 0,
        schoolStarters12M,
        peakBand: currentSnapshot?.peakBand || '-',
        peakBandSharePct: currentSnapshot?.peakSharePct || 0,
      },
    };
  }, [
    chartState?.referenceDate,
    effectiveDataItems,
    eventsByScenario,
    getEffectiveGroupAssignments,
    groupDefs,
    selectedGroups,
    selectedScenarioId,
    demographyResolution,
    todayIso,
  ]);

  const trendHistoryData = React.useMemo(() => {
    const bucketsAll = Array.isArray(trendStatistics?.buckets) ? trendStatistics.buckets : [];
    const reference = parseIsoDateSafe(qualityReferenceDate);
    const cutoffDate = reference ? new Date(reference.getTime()) : null;
    if (cutoffDate) cutoffDate.setUTCFullYear(cutoffDate.getUTCFullYear() - 10);
    const cutoffIso = cutoffDate ? cutoffDate.toISOString().slice(0, 10) : null;
    const buckets = cutoffIso
      ? bucketsAll.filter((bucket) => String(bucket.evaluationDate || bucket.end || '') >= cutoffIso)
      : bucketsAll;
    const scenarioItems = selectedScenarioId ? (dataByScenario?.[selectedScenarioId] || {}) : {};
    const trendYearCategories = (
      Number.isInteger(cutoffDate?.getUTCFullYear()) && Number.isInteger(reference?.getUTCFullYear())
        ? Array.from({ length: reference.getUTCFullYear() - cutoffDate.getUTCFullYear() + 1 }, (_, idx) => String(cutoffDate.getUTCFullYear() + idx))
        : []
    );

    const categories = buckets.map((bucket) => String(bucket.label || ''));
    const children = buckets.map((bucket) => Number(bucket.childrenCount || 0));
    const bookingHours = buckets.map((bucket) => Number(bucket.bookingHours || 0));
    const workingHours = buckets.map((bucket) => Number(bucket.careHours || 0));
    const groupNamesById = new Map((groupDefs || []).map((group) => [String(group.id), String(group.name || 'Gruppe')]));
    const childrenByGroupSeries = new Map();

    buckets.forEach((bucket, bucketIndex) => {
      const evalDate = String(bucket.evaluationDate || bucket.end || '');
      if (!evalDate) return;

      Object.values(scenarioItems).forEach((item) => {
        if (!item || item.archived || item.type !== 'demand') return;
        if (!shouldIncludeDataItemInAnalysis(item)) return;
        if (!isRecordActiveOnDate(item, evalDate)) return;

        const itemId = String(item.id || '');
        const groupIdRaw = resolveGroupIdAtDate(getEffectiveGroupAssignments(itemId), evalDate, item.groupId || null);
        const groupId = groupIdRaw ? String(groupIdRaw) : '__NO_GROUP__';
        const groupName = groupIdRaw ? (groupNamesById.get(groupId) || 'Gruppe') : 'Ohne Gruppe';

        if (!childrenByGroupSeries.has(groupId)) {
          childrenByGroupSeries.set(groupId, {
            name: groupName,
            data: buckets.map(() => 0),
          });
        }
        const series = childrenByGroupSeries.get(groupId);
        series.data[bucketIndex] = Number(series.data[bucketIndex] || 0) + 1;
      });
    });

    const groupChildrenSeries = Array.from(childrenByGroupSeries.values())
      .map((series, idx) => {
        const palette = ['#0ea5e9', '#14b8a6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ef4444', '#64748b'];
        return {
          type: 'line',
          name: series.name,
          data: series.data,
          color: palette[idx % palette.length],
        };
      })
      .sort((left, right) => String(left.name).localeCompare(String(right.name), 'de', { sensitivity: 'base' }));

    const entryYearStart = cutoffDate ? cutoffDate.getUTCFullYear() : null;
    const entryYearEnd = reference ? reference.getUTCFullYear() : null;
    const entryYearCategories = (
      Number.isInteger(entryYearStart) && Number.isInteger(entryYearEnd) && entryYearStart <= entryYearEnd
    )
      ? Array.from({ length: entryYearEnd - entryYearStart + 1 }, (_, idx) => String(entryYearStart + idx))
      : [];

    const entriesByYear = new Map(entryYearCategories.map((year) => [year, 0]));
    const entryAgeSumByYear = new Map(entryYearCategories.map((year) => [year, 0]));
    const entryAgeCountByYear = new Map(entryYearCategories.map((year) => [year, 0]));

    Object.values(scenarioItems).forEach((item) => {
      if (!item || item.archived || item.type !== 'demand') return;
      if (!shouldIncludeDataItemInAnalysis(item)) return;

      const startIso = String(item.startdate || '');
      if (!startIso) return;
      if (cutoffIso && startIso < cutoffIso) return;
      if (String(startIso) > String(qualityReferenceDate)) return;

      const yearKey = String(startIso).slice(0, 4);
      if (!entriesByYear.has(yearKey)) return;

      entriesByYear.set(yearKey, Number(entriesByYear.get(yearKey) || 0) + 1);

      const dob = parseIsoDateSafe(item.dateofbirth);
      const startDate = parseIsoDateSafe(startIso);
      if (!dob || !startDate) return;

      let years = startDate.getUTCFullYear() - dob.getUTCFullYear();
      const monthDelta = startDate.getUTCMonth() - dob.getUTCMonth();
      if (monthDelta < 0 || (monthDelta === 0 && startDate.getUTCDate() < dob.getUTCDate())) {
        years -= 1;
      }

      const beforeBirthday = (
        startDate.getUTCMonth() < dob.getUTCMonth()
        || (startDate.getUTCMonth() === dob.getUTCMonth() && startDate.getUTCDate() < dob.getUTCDate())
      );
      const birthdayThisYear = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        dob.getUTCMonth(),
        dob.getUTCDate()
      ));
      const lastBirthday = beforeBirthday
        ? new Date(Date.UTC(startDate.getUTCFullYear() - 1, dob.getUTCMonth(), dob.getUTCDate()))
        : birthdayThisYear;
      const dayMs = 24 * 60 * 60 * 1000;
      const daysSinceBirthday = Math.max(0, Math.round((startDate.getTime() - lastBirthday.getTime()) / dayMs));
      const ageYears = years + (daysSinceBirthday / 365.25);
      if (!Number.isFinite(ageYears) || ageYears < 0) return;

      entryAgeSumByYear.set(yearKey, Number(entryAgeSumByYear.get(yearKey) || 0) + ageYears);
      entryAgeCountByYear.set(yearKey, Number(entryAgeCountByYear.get(yearKey) || 0) + 1);
    });

    const entries = entryYearCategories.map((year) => Number(entriesByYear.get(year) || 0));
    const entryAgeYears = entryYearCategories.map((year) => {
      const count = Number(entryAgeCountByYear.get(year) || 0);
      if (count <= 0) return null;
      const sum = Number(entryAgeSumByYear.get(year) || 0);
      return Number((sum / count).toFixed(2));
    });

    const employees = buckets.map((bucket) => {
      const evalDate = String(bucket.evaluationDate || bucket.end || '');
      if (!evalDate) return 0;

      return Object.values(scenarioItems).reduce((sum, item) => {
        if (!item || item.archived || item.type !== 'capacity') return sum;
        if (!shouldIncludeDataItemInAnalysis(item)) return sum;
        if (!isRecordActiveOnDate(item, evalDate)) return sum;
        return sum + 1;
      }, 0);
    });

    const latestIndex = categories.length - 1;
    const firstIndex = 0;
    const avgChildren = children.length > 0 ? (children.reduce((sum, value) => sum + Number(value || 0), 0) / children.length) : 0;
    const avgEmployees = employees.length > 0 ? (employees.reduce((sum, value) => sum + Number(value || 0), 0) / employees.length) : 0;
    const avgEntries = entries.length > 0 ? (entries.reduce((sum, value) => sum + Number(value || 0), 0) / entries.length) : 0;
    const entryAgeValid = entryAgeYears.filter((value) => Number.isFinite(value));
    const avgEntryAgeYears = entryAgeValid.length > 0
      ? (entryAgeValid.reduce((sum, value) => sum + Number(value || 0), 0) / entryAgeValid.length)
      : 0;

    const annualTransitionState = {
      simScenario: { selectedScenarioId },
      simData: { dataByScenario },
      simBooking: { bookingsByScenario },
      simGroup: { groupsByScenario, groupDefsByScenario },
    };

    const annualTransitionStats = trendYearCategories.map((year) => {
      const asOfDate = `${year}-12-31`;
      return selectGroupTransitionStatistics(annualTransitionState, {
        asOfDate,
        windowDays: 90,
      });
    });

    const corridorRemainPct = annualTransitionStats.map((result) => Number(((result?.corridor?.remainProbability || 0) * 100).toFixed(1)));
    const regelEntryAgeYears = annualTransitionStats.map((result, index) => {
      const year = trendYearCategories[index];
      const yearTransitions = Array.isArray(result?.transitions)
        ? result.transitions.filter((transition) => transition.toGroupId === 'regelgruppe' && String(transition.date || '').startsWith(`${year}-`))
        : [];
      const ages = yearTransitions
        .map((transition) => Number(transition.ageMonths))
        .filter((value) => Number.isFinite(value));
      if (ages.length === 0) return null;
      return Number((ages.reduce((sum, value) => sum + value, 0) / ages.length / 12).toFixed(2));
    });

    const avgChildrenByGroup = groupChildrenSeries
      .map((series) => {
        const seriesAvg = series.data.length > 0
          ? (series.data.reduce((sum, value) => sum + Number(value || 0), 0) / series.data.length)
          : 0;
        return { name: series.name, average: seriesAvg };
      })
      .sort((left, right) => right.average - left.average);

    const avgChildrenByGroupSubtitle = avgChildrenByGroup.length > 0
      ? avgChildrenByGroup.map((entry) => `${entry.name}: ${entry.average.toFixed(1)}`).join(' · ')
      : 'Keine Gruppendaten verfügbar.';

    return {
      categories,
      entryYearCategories,
      children,
      employees,
      bookingHours,
      workingHours,
      entries,
      entryAgeYears,
      trendYearCategories,
      corridorRemainPct,
      regelEntryAgeYears,
      groupChildrenSeries,
      kpis: {
        latestChildren: latestIndex >= 0 ? Number(children[latestIndex] || 0) : 0,
        latestEmployees: latestIndex >= 0 ? Number(employees[latestIndex] || 0) : 0,
        latestBookingHours: latestIndex >= 0 ? Number(bookingHours[latestIndex] || 0) : 0,
        latestWorkingHours: latestIndex >= 0 ? Number(workingHours[latestIndex] || 0) : 0,
        avgEntries,
        avgEntryAgeYears,
        avgChildren,
        avgEmployees,
        avgChildrenByGroupSubtitle,
        childrenDelta: latestIndex > firstIndex ? Number(children[latestIndex] || 0) - Number(children[firstIndex] || 0) : 0,
        bookingDelta: latestIndex > firstIndex ? Number(bookingHours[latestIndex] || 0) - Number(bookingHours[firstIndex] || 0) : 0,
      },
    };
  }, [bookingsByScenario, dataByScenario, getEffectiveGroupAssignments, groupDefs, groupDefsByScenario, groupsByScenario, qualityReferenceDate, selectedScenarioId, trendStatistics]);

  const stageRecommendations =
    activeStory.id === 'quality'
      ? [
          {
            key: 'kpi-children',
            title: 'Aktuelle Anzahl Kinder',
            value: `${qualityMetrics.totalChildren}`,
            text: 'Aufschlüsselung nach Gruppen.',
            groupBreakdown: qualityMetrics.childGroupBreakdown,
            tone: 'good',
          },
          {
            key: 'kpi-employees',
            title: 'Aktuelle Anzahl Mitarbeiter',
            value: `${qualityMetrics.totalEmployees}`,
            text: `Aktive Kapazität: ${qualityMetrics.activeEmployees} · Pausierend (z. B. Elternzeit): ${qualityMetrics.passiveEmployees}`,
            tone: 'good',
          },
          {
            key: 'kpi-incomplete-employees',
            title: 'Lückenhafte Daten Mitarbeiter',
            value: `${qualityMetrics.incompleteEmployees.length}`,
            text: 'Fehlende Buchung oder Finanzdaten.',
            tone: qualityMetrics.incompleteEmployees.length > 0 ? 'warn' : 'good',
            records: qualityMetrics.incompleteEmployees,
          },
          {
            key: 'kpi-incomplete-children',
            title: 'Lückenhafte Daten Kinder',
            value: `${qualityMetrics.incompleteChildren.length}`,
            text: 'Fehlende Buchung.',
            tone: qualityMetrics.incompleteChildren.length > 0 ? 'warn' : 'good',
            records: qualityMetrics.incompleteChildren,
          },
          {
            key: 'kpi-quality-hints',
            title: 'Hinweise',
            value: `${qualityMetrics.alerts.length}`,
            text: qualityMetrics.alerts.length > 0
              ? 'Strukturelle Hinweise zur Datenbasis.'
              : 'Keine strukturellen Hinweise.',
            tone: qualityMetrics.alerts.length > 0 ? 'warn' : 'good',
            hints: qualityMetrics.alerts,
          },
        ]
      : activeStory.id === 'status'
        ? [
            {
              key: 'kpi-care-ratio',
              title: 'Betreuungsschlüssel',
              value: `${coverageData?.kpis?.avgCareRatio?.toFixed(2) || '0.00'}`,
              text: `Min ${coverageData?.kpis?.minCareRatio?.toFixed(2) || '0.00'} · Max ${coverageData?.kpis?.maxCareRatio?.toFixed(2) || '0.00'}`,
              tone: 'good',
            },
            {
              key: 'kpi-expert-ratio',
              title: 'Fachkräftequote',
              value: `${coverageData?.kpis?.avgExpertRatio?.toFixed(1) || '0.0'}%`,
              text: `${coverageData?.kpis?.expertRatioUnderLegalSlots || 0} Slots unter ${LEGAL_EXPERT_RATIO_MIN_PCT}%`,
              tone: (coverageData?.kpis?.expertRatioUnderLegalSlots || 0) > 0 ? 'warn' : 'good',
            },
            {
              key: 'kpi-monthly-fte',
              title: 'Monatliche Kapazität (FTE)',
              value: `${coverageData?.kpis?.monthlyCapacityFte?.toFixed(2) || '0.00'}`,
              text: `Monatlicher Bedarf: ${coverageData?.kpis?.monthlyDemandFte?.toFixed(2) || '0.00'} FTE`,
              tone: (coverageData?.kpis?.monthlyCapacityFte || 0) >= (coverageData?.kpis?.monthlyDemandFte || 0) ? 'good' : 'warn',
            },
            {
              key: 'kpi-hover-slot',
              title: statusHoverData?.label || 'Aktuelle Diagrammwerte',
              value: statusHoverData ? `${statusHoverData.demand} Kinder / ${statusHoverData.capacityPedagogical + statusHoverData.capacityAdministrative} MA` : '–',
              text: statusHoverData ? `Schlüssel ${statusHoverData.careRatio.toFixed(2)} · Fachkraft ${statusHoverData.expertRatio.toFixed(0)}%` : 'Hover über das Diagramm',
              tone: statusHoverData && statusHoverData.demand > (statusHoverData.capacityPedagogical + statusHoverData.capacityAdministrative) ? 'warn' : 'good',
            },
          ]
      : activeStory.id === 'transitions'
        ? [
            {
              key: 'kpi-resilience-score',
              title: 'Resilienz-Score',
              value: `${(coverageData?.resilience?.monteCarlo?.resilienceScorePct || 0).toFixed(1)}%`,
              text: 'Toleranzgewichteter Tages-Score trotz Schließungsereignissen.',
              tone: (coverageData?.resilience?.monteCarlo?.resilienceScorePct || 0) >= 70 ? 'good' : 'warn',
            },
            {
              key: 'kpi-closure-rate',
              title: 'Schließungsrate',
              value: `${(coverageData?.resilience?.monteCarlo?.closurePct || 0).toFixed(1)}%`,
              text: 'Anteil der Slots, die in Stufe Schließung enden.',
              tone: (coverageData?.resilience?.monteCarlo?.closurePct || 0) > 8 ? 'warn' : 'good',
            },
            {
              key: 'kpi-cascade-regular',
              title: 'Kaskade: Regelbetrieb',
              value: `${(coverageData?.resilience?.monteCarlo?.regularOperationPct || 0).toFixed(1)}%`,
              text: 'Slots, die ohne Kompensationsstufe gelöst wurden.',
              tone: (coverageData?.resilience?.monteCarlo?.regularOperationPct || 0) >= 60 ? 'good' : 'warn',
            },
            {
              key: 'kpi-simulation-profile',
              title: 'Simulationsprofil',
              value: `${coverageData?.resilience?.monteCarlo?.runs || 0} Läufe`,
              text: `${coverageData?.resilience?.monteCarlo?.simulationWeeks || 0} Wochen · Basis-Ausfall ${(coverageData?.resilience?.monteCarlo?.baseAbsenceProbabilityPct || 0).toFixed(1)}% · Saisonalität ${coverageData?.resilience?.monteCarlo?.seasonalityInfo?.enabled ? `aktiv (${(Number(coverageData?.resilience?.monteCarlo?.seasonalityInfo?.minFactor || 1) * 100).toFixed(0)}-${(Number(coverageData?.resilience?.monteCarlo?.seasonalityInfo?.maxFactor || 1) * 100).toFixed(0)}% Faktor)` : 'aus'}`,
              tone: 'good',
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
              key: 'kpi-active-now',
              title: 'Aktive Kinder (Stichtag)',
              value: `${previewFlow?.kpis?.activeNowCount || 0}`,
              text: 'Kohorte fur den Verlauf ohne externe Zugange.',
              tone: 'good',
            },
            {
              key: 'kpi-transition-steps',
              title: 'Ereignisschritte mit Wechseln',
              value: `${previewFlow?.kpis?.eventStepsCount || 0}`,
              text: `${previewFlow?.kpis?.transitionCount || 0} Gruppenwechsel uber alle bekannten Ereigniszeitpunkte.`,
              tone: (previewFlow?.kpis?.eventStepsCount || 0) > 0 ? 'good' : 'warn',
            },
            {
              key: 'kpi-flow-concentration',
              title: 'Konzentrationsindex (Top-3)',
              value: `${(previewFlow?.kpis?.concentrationPct || 0).toFixed(1)}%`,
              text: previewFlow?.kpis?.topTransition
                ? `Großter Einzelubergang: ${previewFlow.kpis.topTransition.from} -> ${previewFlow.kpis.topTransition.to} (${previewFlow.kpis.topTransition.weight}).`
                : 'Keine gruppenbezogenen Ubergange im Zeitraum.',
              tone: (previewFlow?.kpis?.concentrationPct || 0) > 70 ? 'warn' : 'good',
            },
            {
              key: 'kpi-demography-median',
              title: 'Medianalter',
              value: `${(demographyData?.kpis?.medianAgeYears || 0).toFixed(1)} Jahre`,
              text: 'Median der aktuell aktiven Kinder.',
              tone: 'good',
            },
            {
              key: 'kpi-demography-school',
              title: 'Schulstarter (12M)',
              value: `${demographyData?.kpis?.schoolStarters12M || 0}`,
              text: 'Kinder, die binnen 12 Monaten 6 Jahre erreichen.',
              tone: 'warn',
            },
          ]
      : activeStory.id === 'trends'
        ? [
            {
              key: 'kpi-trend-inflow',
              title: 'Durchschnittlicher Zulauf',
              value: `${(trendHistoryData?.kpis?.avgEntries || 0).toFixed(1)}`,
              text: 'Ø Neu-Anmeldungen pro Jahr über 10 Jahre.',
              tone: 'good',
            },
            {
              key: 'kpi-trend-entry-age',
              title: 'Durchschnittliches Eintrittsalter',
              value: `${(trendHistoryData?.kpis?.avgEntryAgeYears || 0).toFixed(2)} Jahre`,
              text: 'Gemittelt über die jährlichen Eintrittsalter.',
              tone: 'good',
            },
            {
              key: 'kpi-trend-children-average',
              title: 'Durchschnittliche Kinderanzahl',
              value: `${(trendHistoryData?.kpis?.avgChildren || 0).toFixed(1)}`,
              text: trendHistoryData?.kpis?.avgChildrenByGroupSubtitle || 'Keine Gruppendaten verfügbar.',
              tone: 'good',
            },
            {
              key: 'kpi-trend-employees-average',
              title: 'Durchschnittliche MitarbeiterZahl',
              value: `${(trendHistoryData?.kpis?.avgEmployees || 0).toFixed(1)}`,
              text: 'Ø aktive Kapazität über die historischen Buckets.',
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

  // Fix: when emblaApi first initializes scroll to current active step (sidebar nav sync)
  React.useEffect(() => {
    if (!emblaApi) return;
    emblaApi.scrollTo(activeStepRef.current);
  }, [emblaApi]);

  const handleStepChange = React.useCallback((index) => {
    const safeIndex = Math.max(0, Math.min(STORY_STEPS.length - 1, Number(index) || 0));
    setActiveStep(safeIndex);

    const stepId = STORY_STEPS[safeIndex]?.id;
    if (stepId && stepId !== activeAnalysisSubPage) {
      dispatch(setAnalysisSubPage(stepId));
    }
  }, [activeAnalysisSubPage, dispatch]);

  const slides = STORY_STEPS.map((story, index) => (
    <Carousel.Slide key={story.id} className="analysis-story-slide">
      <StoryCard
        story={story}
        isActive={index === activeStep}
        onSelect={() => {
          handleStepChange(index);
          emblaApi?.scrollTo(index);
        }}
      />
    </Carousel.Slide>
  ));

  React.useEffect(() => {
    const normalizedSubPage = ANALYSIS_SUBPAGE_ALIASES[activeAnalysisSubPage] || activeAnalysisSubPage;
    if (normalizedSubPage !== activeAnalysisSubPage) {
      dispatch(setAnalysisSubPage(normalizedSubPage));
    }
    const stepIndex = STORY_STEPS.findIndex((step) => step.id === normalizedSubPage);
    if (stepIndex >= 0 && stepIndex !== activeStep) {
      setActiveStep(stepIndex);
      emblaApi?.scrollTo(stepIndex);
    }
  }, [activeAnalysisSubPage, activeStep, dispatch, emblaApi]);

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
            onSlideChange={handleStepChange}
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
                {(Array.isArray(item.records) && item.records.length > 0) || (Array.isArray(item.hints) && item.hints.length > 0) ? (
                  <ActionIcon variant="subtle" size="sm" className="analysis-kpi-info-btn" aria-label="Lückenhafte Datensätze vorhanden">
                    <IconInfoCircle size={16} />
                  </ActionIcon>
                ) : null}
              </Group>
              <Text size="lg" fw={800} className="analysis-stage-recommendation-value">
                {item.value}
              </Text>
              <Text size="xs" className="analysis-stage-recommendation-text">
                {item.text}
              </Text>

              {Array.isArray(item.records) && item.records.length > 0 && (
                <Stack gap={2} mt={6} className="analysis-kpi-tooltip-list">
                  {item.records.slice(0, 4).map((record) => (
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
                  {item.records.length > 4 && (
                    <Text size="xs" c="dimmed">+{item.records.length - 4} weitere</Text>
                  )}
                </Stack>
              )}

              {Array.isArray(item.groupBreakdown) && item.groupBreakdown.length > 0 && (
                <Group gap={8} mt={6} wrap="wrap">
                  {item.groupBreakdown.slice(0, 5).map((entry) => (
                    <Group key={entry.id} gap={4} wrap="nowrap">
                      {entry.icon ? <GroupIcon icon={entry.icon} size={14} /> : <IconInfoCircle size={12} />}
                      <Text size="xs" c="dimmed">{entry.count}</Text>
                    </Group>
                  ))}
                  {item.groupBreakdown.length > 5 && (
                    <Text size="xs" c="dimmed">+{item.groupBreakdown.length - 5}</Text>
                  )}
                </Group>
              )}

              {Array.isArray(item.hints) && item.hints.length > 0 && (
                <Stack gap={2} mt={6}>
                  {item.hints.slice(0, 4).map((hint) => (
                    <Text key={hint} size="xs" c="dimmed">• {hint}</Text>
                  ))}
                  {item.hints.length > 4 && (
                    <Text size="xs" c="dimmed">+{item.hints.length - 4} weitere</Text>
                  )}
                </Stack>
              )}
            </Paper>
          ))}
        </Group>

        <Box className="analysis-stage-content" data-testid="analysis-stage-content">
          {settledStep !== activeStep ? (
            <Box className="analysis-diagram-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text size="sm" c="dimmed">Wird berechnet…</Text>
            </Box>
          ) : activeStory.id === 'quality' ? (
            <QualityStageCarousel
              qualityDonutData={qualityDonutData}
              qualityStaffScheduleData={qualityStaffScheduleData}
              accent={activeStory.accent}
            />
          ) : activeStory.id === 'status' ? (
            <CoverageStageCarousel
              weeklyData={coverageData?.weeklyData || { categories: coverageData?.categories || [] }}
              categories={coverageData?.categories || []}
              groups={coverageData?.groupsForHeatmap || []}
              heatValues={coverageData?.heatValues || []}
              accent={activeStory.accent}
              onHoverChange={handleStatusHoverChange}
              heatmapMode={heatmapMode}
            />
          ) : activeStory.id === 'transitions' ? (
            <ResilienceMonteCarloCarousel
              monteCarlo={coverageData?.resilience?.monteCarlo || null}
              categories={coverageData?.categories || []}
              accent={activeStory.accent}
            />
          ) : activeStory.id === 'cohort' ? (
            <FinanceTrendChart financeTrend={coverageData?.financeTrend || null} accent={activeStory.accent} />
          ) : activeStory.id === 'compare' ? (
            <ForecastStageCarousel
              previewFlow={previewFlow}
              demographyData={demographyData}
              accent={activeStory.accent}
              privacyMode={privacyMode}
              demographyResolution={demographyResolution}
              onDemographyResolutionChange={setDemographyResolution}
            />
          ) : activeStory.id === 'trends' ? (
            <TrendHistoryCarousel trendData={trendHistoryData} accent={activeStory.accent} />
          ) : (
            <DiagramPlaceholder story={activeStory} />
          )}
        </Box>

        <Box className="analysis-stage-filterbar" data-testid="analysis-stage-filterbar">
          {activeStory.id === 'compare' ? (
            <Group gap="sm" mb={4} wrap="nowrap" align="center" style={{ paddingLeft: 8 }}>
              <Switch
                size="sm"
                label="Zulauf simulieren"
                checked={simulateInflow}
                onChange={(e) => setSimulateInflow(e.currentTarget.checked)}
                title="Simuliert neue Kinder basierend auf historischen Eintrittsdaten"
              />
            </Group>
          ) : null}
          <ChartFilterForm
            showStichtag
            scenarioId={selectedScenarioId}
            compactBar
            groupsOnly={activeStory.id === 'quality'}
            showHeatmapModeControl={activeStory.id === 'status'}
            heatmapMode={heatmapMode}
            onHeatmapModeChange={setHeatmapMode}
            showPlannedStaffOnlyControl={activeStory.id === 'quality'}
            plannedStaffOnly={qualityOnlyPlannedStaff}
            onPlannedStaffOnlyChange={setQualityOnlyPlannedStaff}
            showMonteCarloControls={activeStory.id === 'transitions'}
            monteCarloParams={monteCarloConfig}
            onMonteCarloParamsChange={setMonteCarloConfig}
            onRerunMonteCarlo={() => setMonteCarloRunId((prev) => prev + 1)}
            showTrigger
          />
        </Box>
      </Paper>

      <AnalysisProgressPanel
        stageIndex={analysisLoadingStage}
        isLoading={isAnalysisLoading}
        stages={activeLoadingStages}
      />
    </Box>
  );
}

export default VisuView;
