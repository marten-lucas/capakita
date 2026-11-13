import React from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Menu,
  NumberInput,
  Paper,
  RingProgress,
  Select,
  Stack,
  Stepper,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { MonthPickerInput } from '@mantine/dates';
import Highcharts from 'highcharts';
import HighchartsHeatmap from 'highcharts/modules/heatmap';
import HighchartsSankey from 'highcharts/modules/sankey';
import HighchartsTimeline from 'highcharts/modules/timeline';
import { CopySvgButton, CopyableHighcharts as HighchartsReact } from '../components/common/CopyToClipboardButton';
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm';
import WeeklyChart from '../components/SimDataCharts/WeeklyChart';
import GroupIcon from '../components/common/GroupIcon';
import { useDispatch, useSelector } from 'react-redux';
import { setActivePage, setAnalysisSubPage } from '../store/uiSlice';
import { setSelectedItem, setSelectedItems } from '../store/simScenarioSlice';
import { ensureScenario, setFilterGroups } from '../store/chartSlice';
import { selectOverlayAwareChartData, selectWeeklyChartData } from '../store/chartSelectors';
import { selectForecastEventsAvailable, selectForecastEventsError } from '../store/eventSlice';
import { buildTrendHistory } from './trendModel';
import { useOverlayData } from '../hooks/useOverlayData';
import { isDateWithinRange, isRecordActiveOnDate, resolveGroupIdAtDate, resolveGroupIdsAtDate } from '../utils/financeUtils';
import { calculateAdebisScenarioMonthlyFinance } from '../utils/adebisFinance';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { buildForecastInflow, buildForecastModel, getForecastGroupAssignments } from '../utils/forecastUtils';
import { buildForecastFillUp, limitForecastInflow } from '../utils/forecastUtilsModel';
import { exportChart } from '../utils/chartExport';
import { isArchivedDataItem, shouldIncludeDataItemInAnalysis, getActiveDemandChildrenAtDate } from '../utils/dataVisibility';
import { collectCoverageQualifications, filterBookings } from '../utils/chartUtils/chartUtils';
import { coverageGroupMetrics, coverageGroups, coverageHeatValue, coverageHoursModel, coverageWeeklyData } from './coverageModel';
import { buildResilienceStaff, compensateResilienceSlot, drawResilienceDay, evaluateResilienceConstraints, normalizeResilienceConfig } from '../utils/resilienceModel';
import { buildHistogramDataFromBookings, generateSharedHistogramBins } from '../utils/chartUtils/chartUtilsHistogram';
import { calculateZeitkatDistribution } from '../utils/chartUtils/chartUtilsZeitkat';
import HoursHistogramSlide from '../components/SimDataCharts/HoursHistogramSlide';
import ZeitkatHistogramSlide from '../components/SimDataCharts/ZeitkatHistogramSlide';
import FundingSimulationPanel from '../components/SimDataCharts/FundingSimulationPanel';
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
  IconDownload,
  IconPlayerPause,
  IconPlayerPlay,
  IconRoute,
} from '@tabler/icons-react';
import './VisuView.css';

const EMPTY_LIST = [];

const escapeChartText = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

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


const HEATMAP_MODES = {
  UNWEIGHTED_QUOTIENT: 'unweightedQuotient',
  CARE_KEY: 'careKey',
  PRESENT_STAFF: 'presentStaff',
};

const QUALITY_GROUP_COLOR_PALETTE = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be123c', '#4d7c0f'];
const QUALITY_ADMIN_TIME_COLOR = '#8b5cf6';

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
if (typeof HighchartsTimeline === 'function') {
  HighchartsTimeline(Highcharts);
}

const STORY_STEPS = [
  {
    id: 'quality',
    category: '01',
    title: 'Datenqualität',
    stepperLabel: 'Daten',
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
    stepperLabel: 'Bedarf',
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
    stepperLabel: 'Resilienz',
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
    stepperLabel: 'Finanzen',
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
    stepperLabel: 'Ausblick',
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
    title: 'Simulation von Beitragsänderungen',
    stepperLabel: 'Beiträge',
    subtitle: 'Beitragssätze und Mehrstunden-Ausschöpfung vergleichen',
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
    stepperLabel: 'Trends',
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
        labels: {
          formatter() { return escapeChartText(this.value); },
          style: { fontSize: '10px' },
        },
      },
      tooltip: {
        formatter() {
          const slot = categories[this.point.x] || '';
          const employeeName = employees[this.point.y]?.name || 'Mitarbeiter';
          const roleLabel = this.point.options?.roleLabel || '';
          const planned = Number(this.point.value || 0) > 0 ? 'Ja' : 'Nein';
          const groupName = this.point.options?.groupName || employees[this.point.y]?.groupName || 'Gruppe';
          return `<b>${escapeChartText(employeeName)}</b><br/>Typ: <b>${escapeChartText(roleLabel)}</b><br/>Gruppe: <b>${escapeChartText(groupName)}</b><br/>${escapeChartText(slot)}<br/>Geplant: <b>${planned}</b>`;
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

function QualityStageCarousel({ qualityDonutData, qualityStaffScheduleData, accent, privacyMode }) {
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
            {activeIndex === 1 ? <QualityStaffScheduleChart key={privacyMode ? 'private' : 'named'} scheduleData={qualityStaffScheduleData} accent={accent} /> : null}
          </Box>
        </Carousel.Slide>
      </Carousel>
    </Box>
  );
}

export function CoverageHeatmap({ categories, groups, heatValues, accent, mode, onHoverChange }) {
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
    const values = heatValues.map((entry) => Array.isArray(entry) ? entry[2] : entry?.value)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
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
      return 'Gewichtete Kinder pro pädagogischer Kraft (Basisbuchungen); graue Zellen: keine pädagogische Kraft, Schlüssel nicht definiert.';
    }
    return 'Quotient = Kinder pro pädagogischer Kraft. Grau: keine pädagogische Kraft, Quotient nicht definiert. Die Farben sind relative Werte, keine Rechtsprüfung.';
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
          const value = this.point.value;
          return `<b>${groupName}</b><br/>${slot}<br/>${metricLabel}: <b>${value == null ? 'Nicht definiert – keine pädagogische Kraft' : Number(value).toFixed(2)}</b>`;
        },
      },
      series: [
        {
          type: 'heatmap',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.6)',
          data: heatValues,
          nullColor: 'rgba(226,232,240,0.5)',
          nullInteraction: true,
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
                  careRatio: options.careRatio,
                  expertRatio: options.expertRatio,
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
    <Stack style={{ height: '100%', minHeight: 0 }} gap={4} data-testid="coverage-heatmap">
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
  { id: 'hours-hist', title: 'Buchungsstunden' },
  { id: 'kategorie-hist', title: 'Buchungskategorien' },
];

function CoverageStageCarousel({ weeklyData, categories, groups, heatValues, hoursHistogram, zeitkatDistribution, accent, onHoverChange, heatmapMode }) {
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

        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 3 ? (
              <HoursHistogramSlide
                histogram={hoursHistogram || {}}
                groups={groups}
                accent={accent}
              />
            ) : null}
          </Box>
        </Carousel.Slide>

        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 4 ? (
              <ZeitkatHistogramSlide
                distribution={zeitkatDistribution || {}}
                groups={groups}
                accent={accent}
              />
            ) : null}
          </Box>
        </Carousel.Slide>
      </Carousel>
    </Box>
  );
}

function formatResiliencePercent(value) {
  const number = Number(value) || 0;
  if (number > 0 && number < 1) return '<1%';
  if (number > 99 && number < 100) return '>99%';
  return `${Math.round(number)}%`;
}

function ResilienceScorePanel({ monteCarlo }) {
  const ringSvgRef = React.useRef(null);
  const resilienceScore = Number(monteCarlo?.resilienceScorePct || 0);
  const regularDaysPct = Number(monteCarlo?.regularDaysPct || 0);
  const closurePct = Number(monteCarlo?.closurePct || 0);

  return (
    <Paper withBorder p="md" className="analysis-coverage-heatmap-panel" style={{ height: '100%' }}>
      <Stack gap="md" align="center" justify="center" style={{ height: '100%' }}>
        <Box ref={ringSvgRef}>
          <RingProgress
            size={180}
            thickness={16}
            roundCaps
            sections={[{ value: resilienceScore, color: 'blue' }]}
            label={<Text ta="center" fw={800} size="xl">{formatResiliencePercent(resilienceScore)}</Text>}
          />
        </Box>
        <CopySvgButton svgRef={ringSvgRef} testId="copy-resilience-score" />
        <Text fw={700}>Resilienz-Score</Text>
        <Text size="xs" c="dimmed" ta="center">
          Toleranzgewichtet: Tage mit wenig Schließung senken den Score nur anteilig.
        </Text>
        <Group gap="xl">
          <Text size="sm">Toleranz-Tage: <b>{formatResiliencePercent(regularDaysPct)}</b></Text>
          <Text size="sm">Schließung: <b>{formatResiliencePercent(closurePct)}</b></Text>
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

  if (monteCarlo && !monteCarlo.hasBookingData) {
    return <Paper withBorder p="md"><Text size="sm">Keine auswertbare Resilienz: Im Zeitfenster fehlen Bedarfs- oder pädagogische Personalbuchungen.</Text></Paper>;
  }

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
    <Paper className="analysis-diagram-placeholder analysis-finance-chart" withBorder p="xs" data-testid="analysis-finance-chart">
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
    </Paper>
  );
}

function PreviewSankeyChart({ previewFlow, accent, privacyMode = false }) {
  const [hoverState, setHoverInfo] = React.useState(null);
  const hoverInfo = hoverState?.privacyMode === privacyMode ? hoverState : null;
  React.useEffect(() => { setHoverInfo(null); }, [privacyMode]);
  const [stageBadgePositions, setStageBadgePositions] = React.useState([]);
  const [chartState, setChartState] = React.useState(null);
  const chart = chartState?.privacyMode === privacyMode ? chartState.chart : null;
  const [exporting, setExporting] = React.useState('');
  const [exportError, setExportError] = React.useState('');
  const stageBadgeSignatureRef = React.useRef('');
  const handleChartReady = React.useCallback((nextChart) => setChartState({ chart: nextChart, privacyMode }), [privacyMode]);
  const exportFilenameBase = `capakita-ausblick-${String(previewFlow?.referenceDate || 'export').replace(/[^0-9-]/g, '')}`;

  const handleExport = async (format) => {
    if (!chart || exporting) return;
    setExporting(format);
    setExportError('');
    try {
      await exportChart(chart, format, exportFilenameBase);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export fehlgeschlagen.');
    } finally {
      setExporting('');
    }
  };

  const filteredLinks = React.useMemo(() => {
    const links = previewFlow?.links || [];
    if (!privacyMode) return links;
    const childIds = Array.from(new Set(links.flatMap((link) => (link.children || []).map((child) => String(child.id || ''))))).sort();
    const pseudonyms = new Map(childIds.map((id, index) => [id, `Kind ${index + 1}`]));
    return links.map(({ from, to, weight, known, projected, unknown, stepDateIso, stepLabel, admission, children }) => ({
      from, to, weight, known, projected, unknown, stepDateIso, stepLabel, admission,
      children: (children || []).map((child) => {
        const name = pseudonyms.get(String(child.id || ''));
        return { id: name, name };
      }),
    }));
  }, [previewFlow?.links, privacyMode]);

  const filteredNodes = React.useMemo(() => {
    const nodes = previewFlow?.nodes || [];
    const links = filteredLinks || [];
    if (!links.length) return [];
    const usedIds = new Set();
    links.forEach((entry) => {
      if (entry?.from) usedIds.add(String(entry.from));
      if (entry?.to) usedIds.add(String(entry.to));
    });
    const usedNodes = nodes.filter((node) => usedIds.has(String(node.id)));
    return privacyMode
      ? usedNodes.map(({ id, name, groupId, dateIso, rank, stageLabel }) => ({ id, name, groupId, dateIso, rank, stageLabel }))
      : usedNodes;
  }, [previewFlow?.nodes, filteredLinks, privacyMode]);

  const hasData = filteredLinks.length > 0;
  const transitionPairs = React.useMemo(() => {
    const namesById = new Map(filteredNodes.map((node) => [String(node.id), String(node.name || '')]));
    return filteredLinks
      .map((link) => `${namesById.get(String(link.from)) || ''} -> ${namesById.get(String(link.to)) || ''}`)
      .join(' | ');
  }, [filteredLinks, filteredNodes]);
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
      }).sort((left, right) => {
        const dateDiff = String(left?.stepDateIso || '').localeCompare(String(right?.stepDateIso || ''));
        if (dateDiff !== 0) return dateDiff;
        const fromRankDiff = Number(nodesById.get(String(left.from))?.rank || 0)
          - Number(nodesById.get(String(right.from))?.rank || 0);
        if (fromRankDiff !== 0) return fromRankDiff;
        const toRankDiff = Number(nodesById.get(String(left.to))?.rank || 0)
          - Number(nodesById.get(String(right.to))?.rank || 0);
        if (toRankDiff !== 0) return toRankDiff;
        return String(nodesById.get(String(left.from))?.name || '')
          .localeCompare(String(nodesById.get(String(right.from))?.name || ''), 'de', { sensitivity: 'base' });
      });

      const nodesWithColor = [...nodes]
        .sort((left, right) => {
          const dateDiff = String(left?.dateIso || '').localeCompare(String(right?.dateIso || ''));
          if (dateDiff !== 0) return dateDiff;
          return Number(left?.rank || 0) - Number(right?.rank || 0);
        })
        .map((node) => ({
          ...node,
          color: resolveNodeColor(node.groupId),
        }));

      return {
        chart: {
          backgroundColor: '#f8fafc',
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
              return `<b>${escapeChartText(this.name || '')}</b><br/>Stufe: <b>${escapeChartText(this.options?.stageLabel || '-')}</b><br/>Kinder: <b>${Number(this.sum || 0)}</b>`;
            }
            const stepLabel = this.options?.stepLabel ? `<br/>Zeitpunkt: <b>${escapeChartText(this.options.stepLabel)}</b>` : '';
            return `<b>${escapeChartText(this.fromNode?.name || '')}</b> → <b>${escapeChartText(this.toNode?.name || '')}</b>: <b>${Number(this.weight || 0)}</b>${stepLabel}<br/>Bekannt: ${Number(this.options?.known || 0)} · Projiziert: ${Number(this.options?.projected || 0)} · Ungeklärt: ${Number(this.options?.unknown || 0)}`;
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
                      privacyMode,
                      kind: 'node',
                      title: String(this.name || '-'),
                      subtitle: String(this.options?.stageLabel || '-'),
                      count: Number(this.sum || 0),
                      children: Array.from(childrenMap.values()),
                    });
                    return;
                  }

                  setHoverInfo({
                    privacyMode,
                    kind: 'link',
                    title: `${this.fromNode?.name || '-'} -> ${this.toNode?.name || '-'}`,
                    subtitle: String(this.options?.stepLabel || '-'),
                    count: Number(this.weight || 0),
                    sources: { known: this.options?.known || 0, projected: this.options?.projected || 0, unknown: this.options?.unknown || 0 },
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
            name: 'Stufenübergänge',
            data: linksWithColor,
            nodes: nodesWithColor,
            colorByPoint: false,
            colors: [accent],
            dataLabels: {
              enabled: true,
              nodeFormatter() {
                return escapeChartText(this.name || '');
              },
              style: { color: '#0f172a', fontSize: '10px', fontWeight: '600', textOutline: 'none' },
            },
          },
        ],
      };
    },
    [accent, filteredLinks, filteredNodes, linksByNodeId, previewFlow?.groupColorsById, privacyMode]
  );

  if (!hasData) {
    return (
      <Paper className="analysis-diagram-placeholder" withBorder p="lg">
        <Stack gap={6} align="center" justify="center" className="analysis-diagram-placeholder-inner">
          <Badge variant="light" size="lg" className="analysis-diagram-placeholder-badge">
            Sankey-Chart
          </Badge>
          <Title order={3} className="analysis-diagram-placeholder-title">
            Keine Stufenübergänge
          </Title>
          <Text size="sm" c="dimmed" ta="center" className="analysis-diagram-placeholder-text">
            Für die ausgewählten Kinder und den optionalen Zulauf liegen keine darstellbaren Flüsse vor.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      className="analysis-diagram-placeholder"
      withBorder
      p="xs"
      data-testid="forecast-sankey-chart"
      data-transition-pairs={transitionPairs}
    >
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
            <HighchartsReact
              key={privacyMode ? 'private' : 'named'}
              highcharts={Highcharts}
              options={options}
              callback={handleChartReady}
              containerProps={{ style: { height: '100%' } }}
            />
          </Box>
        </Box>
        <Box style={{ width: 320, minWidth: 320, maxWidth: 320, flex: '0 0 320px', borderLeft: '1px solid var(--mantine-color-gray-3)', paddingLeft: 12, overflowY: 'auto' }}>
          <Group justify="space-between" align="center" mb="xs">
            <Text size="xs" fw={700}>Sankey exportieren</Text>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size={14} />}
                  disabled={!chart || Boolean(exporting)}
                  data-testid="forecast-sankey-export-menu"
                >
                  {exporting ? 'Export…' : 'Export'}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => handleExport('png')} data-testid="forecast-sankey-export-png">PNG</Menu.Item>
                <Menu.Item onClick={() => handleExport('svg')} data-testid="forecast-sankey-export-svg">SVG</Menu.Item>
                <Menu.Item onClick={() => handleExport('pdf')} data-testid="forecast-sankey-export-pdf">PDF</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
          {exportError ? <Text size="xs" c="red" mb="xs">{exportError}</Text> : null}
          {hoverInfo ? (
            <Stack gap={6}>
              <Badge variant="outline" size="sm" color="gray">{hoverInfo.subtitle}</Badge>
              <Text size="sm" fw={600}>{hoverInfo.title}</Text>
              <Badge variant="light" size="sm" color="gray">Kinder: {hoverInfo.count}</Badge>
              {hoverInfo.sources && <Text size="xs">Bekannt: {hoverInfo.sources.known} · Projiziert: {hoverInfo.sources.projected} · Ungeklärt: {hoverInfo.sources.unknown}</Text>}
              <Box>
                <Text size="xs" fw={600} mb={4}>Kinderliste</Text>
                <Text size="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
                  {(hoverInfo.children || []).slice(0, 120).map((child, idx) => (
                    <span key={`${String(child.id || '')}-${idx}`}>
                      {child.name || `Kind ${idx + 1}`}
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
        return `<b>${escapeChartText(this.series.name)}</b><br/>${dateLabel}: <b>${Number(this.y || 0)}</b> Kinder`;
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
        step: 'left',
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
        const dateText = escapeChartText(this.options.dateLabel || this.key || '');
        const total = Number(this.options.count || 0);
        const autoCount = Number(this.options.autoCount || 0);
        const eventList = this.options.eventList || [];
        const eventRows = eventList.slice(0, 8).map((ev) => {
          const typeLabel = ev.targetStage
            ? `\u2192 ${ev.targetStage}`
            : String(ev.type || '').replace(/_/g, ' ');
          return `<li>${escapeChartText(ev.entityName || '-')} (${escapeChartText(typeLabel)})</li>`;
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
        data: privacyMode ? timelinePoints.map(({ x, count, autoCount, dateLabel, eventList }) => ({
          x, count, autoCount, dateLabel,
          name: `${count} Ereignisse`,
          label: `${dateLabel} · ${count}`,
          description: `${autoCount} Annahmen`,
          eventList: (eventList || []).map(({ type, targetStage }) => ({ type, targetStage, entityName: 'Kind' })),
        })) : timelinePoints,
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
                key={`forecast-events-${privacyMode ? 'private' : 'named'}`}
                options={timelineOptions}
                containerProps={{ 'data-testid': 'forecast-event-timeline', 'data-privacy': privacyMode ? 'on' : 'off', style: { height: '100%' } }}
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
                    {groupSeries.name}: {Number(groupSeries?.data?.[hoverIndex] || 0)} (bekannt {groupSeries.sourceData?.known?.[hoverIndex] || 0}, projiziert {groupSeries.sourceData?.projected?.[hoverIndex] || 0}, ungeklärt {groupSeries.sourceData?.unknown?.[hoverIndex] || 0})
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
      step: 'left',
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
                  <Text size="xs" fw={600} mb={4} c="dimmed">Kinder in dieser Stufe:</Text>
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
            aria-label="Altersgruppe"
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
            aria-label="Zeitauflösung"
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
            aria-label="Prognosemonat"
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
    if (['entries', 'entryAge', 'corridor', 'regelAge'].includes(page)) {
      const values = { entries: trendData?.entries, entryAge: trendData?.entryAgeYears, corridor: trendData?.corridorRemainPct, regelAge: trendData?.regelEntryAgeYears };
      return (values[page] || []).some(Number.isFinite);
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
            Für den gewählten Kontext liegen keine auswertbaren historischen Werte vor.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="analysis-diagram-placeholder" withBorder p="xs">
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ 'data-testid': 'trend-history-chart', style: { height: '100%' } }} />
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

function TrendHistoryCarousel({ trendData, accent, onPageChange }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canGoPrev, setCanGoPrev] = React.useState(false);
  const [canGoNext, setCanGoNext] = React.useState(true);

  React.useEffect(() => {
    if (!emblaApi) return undefined;

    const updateState = () => {
      const index = emblaApi.selectedScrollSnap();
      setActiveIndex(index);
      onPageChange(TREND_CHART_SLIDES[index]?.id || 'counts');
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
  }, [emblaApi, onPageChange]);

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
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" aria-label="Vorheriges Trend-Diagramm" onClick={() => emblaApi?.scrollPrev()} disabled={!canGoPrev}>
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" aria-label="Nächstes Trend-Diagramm" onClick={() => emblaApi?.scrollNext()} disabled={!canGoNext}>
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Text size="xs" c="dimmed" data-testid="trend-filter-scope">
        {activeIndex >= 5 ? 'Übergänge und Korridor zeigen die gesamte Einrichtung; Gruppen- und Qualifikationsfilter sind für dieses Diagramm deaktiviert. Die Kennzahlen bleiben gruppen- bzw. personalgefiltert.' : activeIndex === 0 || activeIndex === 2 ? 'Gruppen gelten am jeweiligen Stichtag; Qualifikationen nur für Mitarbeiter und Arbeitsstunden, nicht für Kinder und Buchungsstunden.' : 'Gruppen gelten am jeweiligen Stichtag bzw. Eintrittstag. Qualifikationen sind für Kinderkennzahlen nicht anwendbar.'} Monatswerte zählen aktive Personen einmal; bei mehreren Kindergruppen zählt die erste Zuordnung. Personal kann mehreren Gruppen angehören und wird in der Summe nur einmal gezählt; Stunden sind Wochenwerte, Arbeitsstunden pädagogisch. Offene Grenzen gelten fortdauernd, auch bei Qualifikationen; Abwesenheiten werden nicht abgezogen. Fehlende Buchungen ergeben keine Stunden; Eintritte zählen nur gespeicherte Beginne, die Vollständigkeit ist unbekannt. Jahresrandwerte können unvollständig sein.
      </Text>
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
  { id: 'preview', title: 'Ausblick (Sankey)' },
  { id: 'groups-timeline', title: 'Stufenverlauf & Ereignisse' },
  { id: 'booking-hours', title: 'Buchungsstunden-Verlauf' },
  { id: 'demography', title: 'Demografie-Prognose' },
];

function ForecastStageCarousel({
  previewFlow,
  inflowBasis,
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
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" aria-label="Vorheriges Diagramm" onClick={() => emblaApi?.scrollPrev()} disabled={!canGoPrev}>
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon variant="filled" size="md" className="analysis-coverage-carousel-nav" aria-label="Nächstes Diagramm" onClick={() => emblaApi?.scrollNext()} disabled={!canGoNext}>
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Group gap="xs" wrap="wrap" aria-label="Stichtagszählung">
        <Badge variant="outline" color="gray">Stichtag: {previewFlow?.referenceDate}</Badge>
        {(previewFlow?.groupTimeline?.seriesByGroup || []).filter((series) => series.data[0] > 0).map((series) => (
          <Badge key={series.groupId} variant="light" color="gray">{series.name}: {series.data[0]} (bekannt {series.sourceData.known[0]}, projiziert {series.sourceData.projected[0]}, ungeklärt {series.sourceData.unknown[0]})</Badge>
        ))}
      </Group>
      <Text size="xs" c="dimmed">Sankey und Stufenverlauf zeigen den Stichtagsbestand, bekannte spätere Aufnahmen und angenommene Wechsel. Nur der Stufenverlauf enthält optional geschätzten Zulauf; das Sankey enthält niemals synthetische Kinder. Bekannte Zuordnungen und Austritte haben Vorrang; der letzte Betreuungstag zählt mit. Einschulung ohne Zuordnung bleibt ungeklärt, nicht Schulkindbetreuung, außer bei aktivem Auffüllen. Simulierter Zulauf ergänzt bekannte Aufnahmen bis zum gerundeten Mittel der Jahre mit berücksichtigten Aufnahmen: für die sechs Folgejahre ab 1. September, drei Jahre Krippe, danach Ende der Annahme; bei Gruppenfilter nicht simuliert. Der Gruppenfilter wählt Kinder anhand der Zuordnung am Stichtag bzw. Aufnahmetag. Buchungsstunden verwenden vorhandene Basisbuchungen einschließlich bekannter künftiger Änderungen; unbefristete Buchungen gelten weiter, solange das Kind betreut wird. Unbekannte Änderungen werden nicht prognostiziert, für simulierten Zulauf werden keine Stunden geschätzt.</Text>
      <Text size="xs" c="orange">Offene Beginne werden als bereits anwesend, offene Enden als fortdauernd behandelt; das ist keine gesicherte Anwesenheit. „Bekannt“ bezeichnet die gespeicherte Zuordnung, nicht eine Garantie für künftige Betreuung. Fehlende oder widersprüchliche Gruppen bleiben ungeklärt.</Text>
      <Text size="xs" c="orange" data-testid="forecast-inflow-basis">{inflowBasis}</Text>
      <Text size="xs" c="orange" fw={600}>Auffüllen berücksichtigt alle bekannten Kinder der gesamten Einrichtung einschließlich ungeklärter Bedarfe. Bereits betreute Kandidaten zählen nur einmal; bei Überschreitung der Gesamtkapazität gibt es kein Angebot. Geschätzter Zulauf wird bei gültiger Gesamtkapazität nur berücksichtigt, wenn er während seines gesamten angenommenen Aufenthalts neben dem bekannten Bestand Platz hat. Ohne gültige Gesamtkapazität ist er nicht kapazitätsgeprüft. Abgelehnte Bedarfe bleiben ungeklärt und sind keine tatsächlichen Austritte; angenommene Schulkindbetreuung ist keine verbindliche Gruppenzuordnung. Maximale Schulklasse wird nicht prognostiziert.</Text>
      {(previewFlow?.fillUp?.issues || []).map((issue) => <Text key={issue} size="xs" c="orange">{issue}</Text>)}
      {(previewFlow?.fillUp?.decisions || []).filter((decision) => decision.status === 'rejected').length > 0 ? (
        <Text size="xs" c="orange" data-testid="forecast-fillup-rejected">Nicht gedeckte Auffüllbedarfe: {previewFlow.fillUp.decisions.filter((decision) => decision.status === 'rejected').length} ({previewFlow.fillUp.decisions.filter((decision) => decision.status === 'rejected').map((decision) => decision.date).join(', ')}). Keine Austritte angenommen.</Text>
      ) : null}
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
            {activeIndex === 1 ? <ForecastGroupTimelineChart previewFlow={previewFlow} accent={accent} privacyMode={privacyMode} /> : null}
          </Box>
        </Carousel.Slide>
        <Carousel.Slide>
          <Box className="analysis-coverage-carousel-slide">
            {activeIndex === 2 ? <ForecastHoursTimelineChart previewFlow={previewFlow} accent={accent} privacyMode={privacyMode} /> : null}
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
  const forecastEventsAvailable = useSelector((state) => !selectedScenarioId || selectForecastEventsAvailable(state, selectedScenarioId));
  const forecastEventsError = useSelector((state) => selectForecastEventsError(state, selectedScenarioId));
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
  const privacyMode = useSelector((state) => state.ui.privacyMode || false);
  const [demographyResolution, setDemographyResolution] = React.useState('quarter');
  const [trendPage, setTrendPage] = React.useState('counts');
  React.useEffect(() => { if (activeStep !== STORY_STEPS.findIndex((step) => step.id === 'trends')) setTrendPage('counts'); }, [activeStep]);
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
    const timer = setTimeout(() => setSettledStep(activeStep), 500);
    return () => clearTimeout(timer);
  }, [activeStep]);
  const todayIso = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const qualityReferenceDate = React.useMemo(() => chartState?.referenceDate || todayIso, [chartState?.referenceDate, todayIso]);
  const activeStory = STORY_STEPS[activeStep] || STORY_STEPS[0];
  const settledStory = STORY_STEPS[settledStep] || STORY_STEPS[0];

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

  const chartOverlayData = useSelector(selectOverlayAwareChartData);
  const [coverageData, setCoverageData] = React.useState(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = React.useState(false);
  const [analysisLoadingStage, setAnalysisLoadingStage] = React.useState(0);
  const [statusHoverData, setStatusHoverData] = React.useState(null);
  const [heatmapMode, setHeatmapMode] = React.useState(HEATMAP_MODES.UNWEIGHTED_QUOTIENT);
  const [modelCareKey, setModelCareKey] = React.useState('');
  React.useEffect(() => { setModelCareKey(''); }, [selectedScenarioId]);
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

    const overlayAware = (needsCoverage && chartOverlayData) || buildOverlayAwareData(selectedScenarioId, {
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
    const weeklyData = coverageWeeklyData(weeklyChartData?.categories?.length
      ? weeklyChartData
      : {
          categories: fallbackCategories,
          demand: [],
          capacity: [],
          capacity_pedagogical: [],
          capacity_administrative: [],
          care_ratio: [],
          expert_ratio: [],
        });
    const categories = weeklyData.categories;

    const rawDataItems = overlayAware.effectiveDataItems || {};
    const rawBookings = overlayAware.effectiveBookingsByItem || {};
    const rawGroupAssignments = overlayAware.effectiveGroupAssignmentsByItem || {};
    const rawQualificationAssignments = collectCoverageQualifications(
      Object.keys(rawDataItems), overlayAware.scenarioChain, overlaysByScenario, qualificationAssignmentsByScenario
    );
    const selectedBookings = filterBookings({
      bookingsByScenario: { [selectedScenarioId]: rawBookings },
      dataByScenario: { [selectedScenarioId]: rawDataItems },
      qualificationAssignmentsByScenario: { [selectedScenarioId]: rawQualificationAssignments },
      groupsByScenario: { [selectedScenarioId]: rawGroupAssignments },
      overlaysByScenario: {}, scenarioId: selectedScenarioId, referenceDate,
      selectedGroups, selectedQualifications,
    });
    const groupsForHeatmap = coverageGroups(overlayAware.effectiveGroupDefs, selectedGroups, selectedBookings.demand, selectedBookings.capacity);

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

      // Histogramm-/Kategorien-Verteilung (A1/A2): gesamt + je Gruppe.
      // Gemeinsame Bins für alle Gruppen (Voraussetzung für gestapelte Serien).
      const sharedHistogramBins = generateSharedHistogramBins(demand, capacity);
      const hoursHistogram = {
        all: buildHistogramDataFromBookings(demand, capacity, sharedHistogramBins),
        byGroup: {},
      };
      const zeitkatDistribution = {
        all: calculateZeitkatDistribution(demand),
        byGroup: {},
      };

      const heatValues = [];
      const groupUndercoverageMinutes = [];
      const groupCapacitySeriesByGroup = {};
      const groupDemandSeriesByGroup = {};

      groupsForHeatmap.forEach((group, groupIndex) => {
        const groupFilter = group.id === '__NO_GROUP__' ? ['__NO_GROUP__'] : [group.id];
        const { demand: groupDemand, capacity: groupCapacity } = filterBookings({
          ...baseInput,
          selectedGroups: groupFilter,
        });

        const groupMetrics = coverageGroupMetrics(categories, groupDemand, groupCapacity, scopedDataItems,
          overlayAware.effectiveGroupDefs, overlayAware.effectiveQualificationDefs, referenceDate);
        const groupDemandSeries = groupMetrics.demand;
        const groupCapacitySeries = groupMetrics.capacity;
        groupCapacitySeriesByGroup[String(group.id)] = groupCapacitySeries.map((value) => Number(value || 0));
        groupDemandSeriesByGroup[String(group.id)] = groupDemandSeries;
        hoursHistogram.byGroup[String(group.id)] = buildHistogramDataFromBookings(groupDemand, groupCapacity, sharedHistogramBins);
        zeitkatDistribution.byGroup[String(group.id)] = calculateZeitkatDistribution(groupDemand);
        const groupPedCapacitySeries = groupMetrics.pedagogical;
        const groupCareRatioSeries = groupMetrics.careRatio;
        const groupExpertRatioSeries = groupMetrics.expertRatio;
        let groupMinutes = 0;

        categories.forEach((_, slotIndex) => {
          const demandValue = Number(groupDemandSeries[slotIndex] || 0);
          const capacityValue = Number(groupCapacitySeries[slotIndex] || 0);
          const pedagogicalValue = Number(groupPedCapacitySeries[slotIndex] || 0);
          const administrativeValue = Math.max(0, capacityValue - pedagogicalValue);
          const careRatioValue = pedagogicalValue > 0 ? Number(groupCareRatioSeries[slotIndex] || 0) : null;
          const expertRatioValue = pedagogicalValue > 0 ? Number(groupExpertRatioSeries[slotIndex] || 0) : null;

          const delta = capacityValue - demandValue;
          if (delta < 0) groupMinutes += Math.abs(delta) * 30;

          const heatValue = coverageHeatValue(heatmapMode, demandValue, pedagogicalValue, careRatioValue);

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
        groupDemandSeriesByGroup,
        capacityBookings: capacity,
        demandBookings: demand,
        hoursHistogram,
        zeitkatDistribution,
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
          hoursHistogram: { all: null, byGroup: {} },
          zeitkatDistribution: { all: null, byGroup: {} },
        };

    let monteCarloResult = null;
    if (needsResilience) {
      const config = normalizeResilienceConfig({ minExpertRatioPct: LEGAL_EXPERT_RATIO_MIN_PCT, ...monteCarloConfig });
      const { runs, simulationWeeks, maxConcurrentOutages, minExpertRatioPct, minGroupHeadcount } = config;
      const baseAbsenceProb = config.baseAbsenceProbabilityPct / 100;
      const maxCareRatioAllowed = config.maxCareRatio;
      const minGroupHeadcountByGroup = (monteCarloConfig?.minGroupHeadcountByGroup && typeof monteCarloConfig.minGroupHeadcountByGroup === 'object')
        ? monteCarloConfig.minGroupHeadcountByGroup
        : {};
      const { maxUndercoverageSlots, maxOvertimeHoursPerEmployeePerWeek, maxTimeReductionHoursPerWeek, emergencyDemandReductionPct } = config;
      const seasonalityEnabled = Boolean(monteCarloConfig?.seasonalityEnabled);
      const contagionEnabled = Boolean(monteCarloConfig?.contagionEnabled);
      const { contagionBoostPct, contagionDays } = config;
      const childCompensationEnabled = Boolean(monteCarloConfig?.childCompensationEnabled);
      const { childCompensationRatePct } = config;

      const slotsPerDay = Math.max(1, Math.floor(categories.length / 5));
      const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
      const groupIdsForMonteCarlo = groupsForHeatmap.map((group) => String(group.id));
      const groupDemandSeries = { ...baselineSnapshot.groupDemandSeriesByGroup };
      const unassignedDemand = baselineSnapshot.demandBookings.filter((booking) => !booking.groupId);
      const unassignedCapacity = baselineSnapshot.capacityBookings.some((booking) => !booking.groupId);
      if ((unassignedDemand.length || unassignedCapacity) && !groupIdsForMonteCarlo.includes('__NO_GROUP__')) {
        groupIdsForMonteCarlo.push('__NO_GROUP__');
        groupDemandSeries.__NO_GROUP__ = generateBookingDataSeries(referenceDate, unassignedDemand, categories);
      }
      const { capacity: workBookings } = filterBookings({
        bookingsByScenario: { [selectedScenarioId]: rawBookings },
        dataByScenario: { [selectedScenarioId]: rawDataItems },
        qualificationAssignmentsByScenario: { [selectedScenarioId]: rawQualificationAssignments },
        groupsByScenario: { [selectedScenarioId]: rawGroupAssignments },
        overlaysByScenario: {}, scenarioId: selectedScenarioId, referenceDate,
        selectedGroups: [], selectedQualifications, includeAllCapacityWork: true,
      });
      const staff = buildResilienceStaff(baselineSnapshot.capacityBookings, categories, overlayAware.effectiveQualificationDefs, workBookings);
      const groupMinimums = Object.fromEntries(groupIdsForMonteCarlo.map((groupId) => {
        const raw = minGroupHeadcountByGroup[groupId];
        const value = raw == null || raw === '' ? minGroupHeadcount : Number(raw);
        return [groupId, Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : minGroupHeadcount];
      }));
      const demandSeriesBase = baselineSnapshot.demandSeries;

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
        let contagionRemaining = 0;
        for (let weekIndex = 0; weekIndex < simulationWeeks; weekIndex += 1) {
          const weekDate = new Date(`${referenceDate}T12:00:00Z`);
          weekDate.setUTCDate(weekDate.getUTCDate() + (weekIndex * 7));
          const monthIndex = weekDate.getUTCMonth();
          const seasonalFactor = seasonalityEnabled ? weeklySeasonality[monthIndex] : 1;
          let overtimeRemaining = Object.fromEntries(staff.map((person) => [person.id, Math.floor(maxOvertimeHoursPerEmployeePerWeek / SLOT_HOURS)]));
          let remainingTimeReductionSlots = Math.floor(maxTimeReductionHoursPerWeek / SLOT_HOURS);
          let dayState = null;
          const dayClosedSlots = Array.from({ length: dayLabels.length }, () => 0);
          const dayClosureCombinationKeys = Array.from({ length: dayLabels.length }, () => Array.from({ length: slotsPerDay }, () => null));

          for (let slotIndex = 0; slotIndex < categories.length; slotIndex += 1) {
            totalSlotsAllRuns += 1;

            const dayIndex = Math.floor(slotIndex / slotsPerDay);
            const slotInDay = slotIndex % slotsPerDay;
            const demandBase = Number(demandSeriesBase[slotIndex] || 0);
            if (slotInDay === 0) {
              dayState = drawResilienceDay(staff, slotIndex, slotsPerDay, baseAbsenceProb * seasonalFactor,
                maxConcurrentOutages, contagionEnabled ? contagionRemaining : 0,
                contagionBoostPct, contagionEnabled ? contagionDays : 0, nextRandom);
              contagionRemaining = dayState.remaining;
            }
            if (demandBase <= 0 && !dayState.scheduled.some((person) => Object.keys(person.slots[slotIndex]).length > 0)) {
              cascadeCounts[0] += 1;
              continue;
            }
            const absentPed = dayState.scheduled.filter((person) => dayState.absent.has(person.id) && Object.keys(person.slots[slotIndex]).length > 0).length;
            let effectiveDemand = demandBase;
            if (childCompensationEnabled && absentPed > 0) {
              const demandFactor = Math.max(0.55, 1 - ((childCompensationRatePct / 100) * absentPed));
              effectiveDemand *= demandFactor;
            }

            const groupDemand = Object.fromEntries(groupIdsForMonteCarlo.map((id) => [id, Number(groupDemandSeries[id]?.[slotIndex] || 0)]));
            const slot = compensateResilienceSlot({ people: dayState.scheduled, absent: dayState.absent, slotIndex,
              groupDemand, groupMinimums, demand: effectiveDemand, maxCareRatio: maxCareRatioAllowed,
              minExpertRatioPct, overtimeRemaining });
            overtimeRemaining = slot.overtimeRemaining;
            let assessment = slot.assessment;
            let stage = slot.used > 0 ? 1 : 0;
            const reassess = () => evaluateResilienceConstraints({ groupStaff: slot.groupStaff, activeGroups: slot.activeGroups,
              groupMinimums, staff: slot.staff, experts: slot.experts, demand: effectiveDemand,
              maxCareRatio: maxCareRatioAllowed, minExpertRatioPct });

            if (!assessment.compliant && remainingTimeReductionSlots > 0 && assessment.careIssue) {
              const reductionFactor = Math.min(0.45, remainingTimeReductionSlots / Math.max(1, categories.length));
              effectiveDemand *= (1 - reductionFactor);
              remainingTimeReductionSlots -= 1;
              assessment = reassess();
              stage = 2;
            }

            if (!assessment.compliant && emergencyDemandReductionPct > 0 && assessment.careIssue) {
              effectiveDemand *= (1 - (emergencyDemandReductionPct / 100));
              assessment = reassess();
              stage = 3;
            }

            if (!assessment.compliant) {
              stage = 4;
              dayClosedSlots[dayIndex] += 1;
              closedSlotsAllRuns += 1;
              weekdayRiskAccumulator[dayIndex][slotInDay] += 1;
              periodRiskAccumulator[weekIndex][dayIndex] += 1;

              const isHeadcountIssue = assessment.headcountIssue;
              const isGroupMinIssue = assessment.hasGroupMinViolation;
              const isCareRatioIssue = assessment.careIssue;
              const isExpertIssue = assessment.expertIssue;
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
        hasBookingData: staff.some((person) => person.slots.some((groups) => Object.keys(groups).length > 0)) && demandSeriesBase.some((value) => value > 0),
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

    const hoursModel = coverageHoursModel(demandSeries, weeklyData?.capacity_pedagogical, modelCareKey);

    let financeTrend = {
      categories: [],
      income: [],
      expenses: [],
      net: [],
      kpis: {
        costPerCarePoint: null,
        costCoveragePct: null,
        rollingNet: null,
      },
    };

    if (needsFinance) {
      const monthFormatter = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });
      const baseDate = new Date(referenceDate);
      const shiftMonth = (date, offsetMonths) => {
        const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));
        return shifted;
      };

      // Like the midterm finance chart, the financial scope is the whole facility.
      const financeDataItems = Object.fromEntries(Object.entries(rawDataItems).filter(([, item]) => !isArchivedDataItem(item)));
      const financeRows = Array.from({ length: 12 }, (_, idx) => {
        const monthDate = shiftMonth(baseDate, idx - 11);
        const monthRef = monthDate.toISOString().slice(0, 10);
        const monthlyFinance = calculateAdebisScenarioMonthlyFinance({
          referenceDate: monthRef,
          effectiveDataItems: financeDataItems,
          effectiveBookingsByItem: rawBookings,
          effectiveGroupAssignmentsByItem: rawGroupAssignments,
          effectiveGroupDefs: overlayAware.effectiveGroupDefs || [],
          financeScenario,
        });

        const activeChildren = (monthlyFinance.childRows || []).filter((row) => isRecordActiveOnDate(financeDataItems[row.itemId], monthRef));
        const carePoints = activeChildren.some((row) => row.bayKiBiGAmount == null || !Number.isFinite(row.bayKiBiGWeight))
          ? null : activeChildren.reduce((sum, row) => sum + row.bayKiBiGWeight, 0);

        return {
          label: monthFormatter.format(monthDate),
          income: monthlyFinance.summary.incomeTotal,
          expenses: monthlyFinance.summary.expensesTotal,
          net: monthlyFinance.summary.net,
          carePoints,
        };
      });

      const latestFinance = financeRows[financeRows.length - 1];
      const costPerCarePoint = latestFinance.expenses != null && latestFinance.carePoints > 0
        ? latestFinance.expenses / latestFinance.carePoints : null;
      const costCoveragePct = latestFinance.income != null && latestFinance.expenses > 0
        ? (latestFinance.income / latestFinance.expenses) * 100 : null;
      const rollingNet = financeRows.some((row) => row.net == null)
        ? null : financeRows.reduce((sum, row) => sum + row.net, 0);

      financeTrend = {
        categories: financeRows.map((row) => row.label),
        income: financeRows.map((row) => row.income),
        expenses: financeRows.map((row) => row.expenses),
        net: financeRows.map((row) => row.net),
        missingIncomeMonths: financeRows.filter((row) => row.income == null).length,
        missingExpenseMonths: financeRows.filter((row) => row.expenses == null).length,
        kpis: {
          costPerCarePoint,
          costPerCarePointNoDenominator: latestFinance.expenses != null && latestFinance.carePoints === 0,
          costCoveragePct,
          costCoverageNoDenominator: latestFinance.income != null && latestFinance.expenses === 0,
          rollingNet,
        },
      };
    }

    return {
      categories,
      weeklyData: {
        ...weeklyData,
        categories,
      },
      groupsForHeatmap,
      heatValues: baselineSnapshot.heatValues,
      hoursHistogram: baselineSnapshot.hoursHistogram,
      zeitkatDistribution: baselineSnapshot.zeitkatDistribution,
      kpis: {
        avgCareRatio,
        minCareRatio,
        maxCareRatio,
        avgExpertRatio,
        expertRatioUnderLegalSlots,
        ...hoursModel,
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
    chartOverlayData,
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
    modelCareKey,
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

  const qualityPseudonymsRef = React.useRef({ labels: new Map(), counts: { demand: 0, capacity: 0 } });
  const qualityPseudonyms = React.useMemo(() => {
    const registry = qualityPseudonymsRef.current;
    const result = new Map();
    Object.values(effectiveDataItems || {})
      .filter((item) => item?.id != null && (item.type === 'demand' || item.type === 'capacity'))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .forEach((item) => {
        const key = JSON.stringify([selectedScenarioId, item.type, String(item.id)]);
        if (!registry.labels.has(key)) {
          const prefix = item.type === 'demand' ? 'Kind' : 'Mitarbeiter';
          registry.counts[item.type] += 1;
          registry.labels.set(key, `${prefix} ${registry.counts[item.type]}`);
        }
        result.set(String(item.id), registry.labels.get(key));
      });
    return result;
  }, [effectiveDataItems, selectedScenarioId]);

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
          name: privacyMode ? qualityPseudonyms.get(itemId) || 'Mitarbeiter' : item.name || 'Mitarbeiter',
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
    privacyMode,
    qualityOnlyPlannedStaff,
    qualityPseudonyms,
    qualityReferenceDate,
    selectedScenarioId,
    selectedGroups,
  ]);

  const forecastHistory = React.useMemo(() => (
    Object.values(effectiveDataItems || {}).filter((item) => item?.type === 'demand' && shouldIncludeDataItemInAnalysis(item))
  ), [effectiveDataItems]);
  const inflowBasis = React.useMemo(() => {
    const referenceDate = chartState?.referenceDate || todayIso;
    const admissions = forecastHistory.filter((item) => item.startdate && item.startdate <= referenceDate);
    const years = new Set(admissions.map((item) => String(item.startdate).slice(0, 4)));
    const sample = years.size
      ? `${admissions.length} Aufnahmedatensätze in ${years.size} Jahren; gerundetes Mittel ${Math.round(admissions.length / years.size)} pro Jahr`
      : 'keine berücksichtigten Aufnahmedatensätze; kein Mittel berechenbar';
    return `Zulauf-Datengrundlage bis ${referenceDate}: ${sample}. Nur nicht archivierte Kinder mit zulässigem Status; archivierte und andere Status sind ausgeschlossen. Jahre ohne berücksichtigte Aufnahmen zählen nicht, das Stichtagsjahr nur bis zum Stichtag. Datensätze werden nicht auf doppelte Aufnahmen geprüft; die Historie kann unvollständig sein. ${selectedGroups?.length ? 'Bei aktivem Gruppenfilter wird kein Zulauf simuliert.' : simulateInflow ? 'Zulaufschätzung eingeschaltet.' : 'Zulaufschätzung ausgeschaltet.'}`;
  }, [chartState?.referenceDate, forecastHistory, selectedGroups, simulateInflow, todayIso]);

  const previewFlow = React.useMemo(() => {
    const referenceDate = chartState?.referenceDate || todayIso;
    const selected = new Set((selectedGroups || []).map(String));
    const children = Object.values(effectiveDataItems || {}).filter((item) => {
      if (!item || item.type !== 'demand' || !shouldIncludeDataItemInAnalysis(item) || (item.enddate && item.enddate < referenceDate)) return false;
      if (!selected.size) return true;
      const date = item.startdate && item.startdate > referenceDate ? item.startdate : referenceDate;
      const assignments = getEffectiveGroupAssignments(String(item.id));
      const groupIds = resolveGroupIdsAtDate(assignments, date, getForecastGroupAssignments(assignments).length ? null : item.groupId);
      return groupIds.length ? groupIds.some((id) => selected.has(String(id))) : selected.has('__NO_GROUP__');
    });
    const assignmentsByChild = Object.fromEntries(forecastHistory.map((item) => [String(item.id), getEffectiveGroupAssignments(String(item.id))]));
    const events = eventsByScenario?.[selectedScenarioId] || [];
    const fillUp = buildForecastFillUp({ referenceDate, children: forecastHistory, groups: groupDefs || [], assignmentsByChild, events });
    const inflow = simulateInflow && !selected.size
      ? limitForecastInflow({ inflow: buildForecastInflow({ referenceDate, history: forecastHistory, futureAdmissions: children }), children: forecastHistory, capacity: fillUp.capacity })
      : [];
    const bookingsByChild = Object.fromEntries(children.map((item) => [String(item.id), getEffectiveBookings(String(item.id))]));
    return buildForecastModel({ referenceDate, children, groups: groupDefs || [], assignmentsByChild, bookingsByChild, events, inflow, fillUp });
  }, [chartState?.referenceDate, effectiveDataItems, eventsByScenario, getEffectiveBookings,
    getEffectiveGroupAssignments, groupDefs, selectedGroups, selectedScenarioId, simulateInflow, todayIso, forecastHistory]);

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


    const isGroupSelected = (item, dateIso) => {
      if (!hasGroupFilter) return true;
      const assignments = getEffectiveGroupAssignments(String(item.id));
      const groupIds = resolveGroupIdsAtDate(assignments, dateIso, getForecastGroupAssignments(assignments).length ? null : item.groupId);
      return groupIds.length ? groupIds.some((id) => groupFilterSet.has(String(id))) : groupFilterSet.has('__NO_GROUP__');
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
    getEffectiveGroupAssignments,
    selectedGroups,
    demographyResolution,
    todayIso,
  ]);

  const trendHistoryData = React.useMemo(() => {
    if (activeStory.id !== 'trends') return { kpis: {} };
    return buildTrendHistory({
      simScenario: { scenarios }, simOverlay: { overlaysByScenario }, simData: { dataByScenario },
      simBooking: { bookingsByScenario }, simGroup: { groupsByScenario, groupDefsByScenario },
      simQualification: { qualificationAssignmentsByScenario, qualificationDefsByScenario },
    }, { scenarioId: selectedScenarioId, asOfDate: qualityReferenceDate, selectedGroups, selectedQualifications });
  }, [activeStory.id, scenarios, overlaysByScenario, dataByScenario, bookingsByScenario, groupsByScenario, groupDefsByScenario, qualificationAssignmentsByScenario, qualificationDefsByScenario, selectedScenarioId, qualityReferenceDate, selectedGroups, selectedQualifications]);

  const stageRecommendations =
    activeStory.id === 'options'
      ? []
      : activeStory.id === 'quality'
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
              title: 'Pädagogische Kapazität (Modell-FTE)',
              value: coverageData ? coverageData.kpis.monthlyStaffFte.toFixed(2) : '–',
              text: coverageData ? `${coverageData.kpis.weeklyChildHours.toFixed(1)} Kinderstunden/Woche · ${coverageData.kpis.weeklyStaffHours.toFixed(1)} päd. Personalstunden/Woche · ${coverageData.kpis.monthlyModelFte == null ? 'Kein Modell-Personalbedarf ohne Schlüssel' : `Modell-Personalbedarf ${coverageData.kpis.monthlyModelFte.toFixed(2)} FTE`}` : 'Berechnung läuft',
              tone: 'neutral',
            },
            {
              key: 'kpi-hover-slot',
              title: statusHoverData?.label || 'Aktuelle Diagrammwerte',
              value: statusHoverData ? `${statusHoverData.demand} Kinder / ${statusHoverData.capacityPedagogical + statusHoverData.capacityAdministrative} MA` : '–',
              text: statusHoverData ? `Schlüssel ${statusHoverData.careRatio == null || statusHoverData.capacityPedagogical <= 0 ? 'nicht definiert (keine päd. Kraft)' : statusHoverData.careRatio.toFixed(2)} · Fachkraftquote ${statusHoverData.expertRatio == null || statusHoverData.capacityPedagogical <= 0 ? 'nicht definiert' : `${statusHoverData.expertRatio.toFixed(0)}%`}` : 'Hover über das Diagramm',
              tone: 'neutral',
            },
          ]
      : activeStory.id === 'transitions'
        ? [
            {
              key: 'kpi-resilience-score',
              title: 'Resilienz-Score',
              value: coverageData?.resilience?.monteCarlo?.hasBookingData ? formatResiliencePercent(coverageData.resilience.monteCarlo.resilienceScorePct) : 'Keine Daten',
              text: 'Toleranzgewichteter Tages-Score trotz Schließungsereignissen.',
              tone: 'neutral',
            },
            {
              key: 'kpi-closure-rate',
              title: 'Schließungsrate',
              value: coverageData?.resilience?.monteCarlo?.hasBookingData ? formatResiliencePercent(coverageData.resilience.monteCarlo.closurePct) : 'Keine Daten',
              text: 'Anteil der Slots, die in Stufe Schließung enden.',
              tone: 'neutral',
            },
            {
              key: 'kpi-cascade-regular',
              title: 'Kaskade: Regelbetrieb',
              value: coverageData?.resilience?.monteCarlo?.hasBookingData ? formatResiliencePercent(coverageData.resilience.monteCarlo.regularOperationPct) : 'Keine Daten',
              text: 'Slots, die ohne Kompensationsstufe gelöst wurden.',
              tone: 'neutral',
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
              value: coverageData?.financeTrend?.kpis?.costPerCarePoint == null ? (coverageData?.financeTrend?.kpis?.costPerCarePointNoDenominator ? 'Nicht berechenbar' : 'Ungeklärt') : `${coverageData.financeTrend.kpis.costPerCarePoint.toFixed(0)} EUR`,
              text: 'Personalkosten je Gewichtungspunkt am Monatsanfang; ohne Punkte oder bei fehlenden Angaben nicht berechenbar.',
              tone: 'warn',
            },
            {
              key: 'kpi-coverage',
              title: 'Kostendeckungsgrad',
              value: coverageData?.financeTrend?.kpis?.costCoveragePct == null ? (coverageData?.financeTrend?.kpis?.costCoverageNoDenominator ? 'Nicht berechenbar' : 'Ungeklärt') : `${coverageData.financeTrend.kpis.costCoveragePct.toFixed(1)}%`,
              text: 'Bruttobeiträge und Basisförderung im Verhältnis zu Personalkosten; bei null Kosten oder fehlenden Angaben nicht berechenbar.',
              tone: coverageData?.financeTrend?.kpis?.costCoveragePct == null ? 'warn' : coverageData.financeTrend.kpis.costCoveragePct >= 100 ? 'good' : 'warn',
            },
            {
              key: 'kpi-rolling-net',
              title: 'Saldo 12 Monate',
              value: coverageData?.financeTrend?.kpis?.rollingNet == null ? 'Ungeklärt' : `${coverageData.financeTrend.kpis.rollingNet.toFixed(0)} EUR`,
              text: 'Summe der zwölf Monatssalden; bei einer Lücke nicht berechenbar.',
              tone: coverageData?.financeTrend?.kpis?.rollingNet == null ? 'warn' : coverageData.financeTrend.kpis.rollingNet >= 0 ? 'good' : 'problem',
            },
          ]
      : activeStory.id === 'compare'
        ? [
            {
              key: 'kpi-active-now',
              title: 'Aktive Kinder (Stichtag)',
              value: `${previewFlow?.kpis?.activeNowCount || 0}`,
              text: 'Kinder am Stichtag; spätere Aufnahmen erscheinen im Sankey und Stufenverlauf, geschätzter Zulauf nur im Stufenverlauf.',
              tone: 'good',
            },
            {
              key: 'kpi-transition-steps',
              title: 'Ereignisschritte mit Wechseln',
              value: `${previewFlow?.kpis?.eventStepsCount || 0}`,
              text: `${previewFlow?.kpis?.transitionCount || 0} Stufenwechsel einschließlich Annahmen und Austritten.`,
              tone: (previewFlow?.kpis?.eventStepsCount || 0) > 0 ? 'good' : 'warn',
            },
            {
              key: 'kpi-flow-concentration',
              title: 'Konzentrationsindex (Top-3)',
              value: `${(previewFlow?.kpis?.concentrationPct || 0).toFixed(1)}%`,
              text: previewFlow?.kpis?.topTransition
                ? `Großter Einzelubergang: ${previewFlow.kpis.topTransition.from} -> ${previewFlow.kpis.topTransition.to} (${previewFlow.kpis.topTransition.weight}).`
                : 'Keine Stufenübergänge im Zeitraum.',
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
              value: trendHistoryData?.kpis?.avgEntries == null ? '–' : trendHistoryData.kpis.avgEntries.toFixed(1),
              text: 'Ø Eintritte pro Kalenderjahr im 10-Jahres-Fenster; Randjahre können unvollständig sein.',
              tone: 'good',
            },
            {
              key: 'kpi-trend-entry-age',
              title: 'Durchschnittliches Eintrittsalter',
              value: trendHistoryData?.kpis?.avgEntryAgeYears == null ? '–' : `${trendHistoryData.kpis.avgEntryAgeYears.toFixed(2)} Jahre`,
              text: 'Gemittelt über die jährlichen Eintrittsalter.',
              tone: 'good',
            },
            {
              key: 'kpi-trend-children-average',
              title: 'Durchschnittliche Kinderanzahl',
              value: trendHistoryData?.kpis?.avgChildren == null ? '–' : trendHistoryData.kpis.avgChildren.toFixed(1),
              text: trendHistoryData?.kpis?.avgChildrenByGroupSubtitle || 'Keine Gruppendaten verfügbar.',
              tone: 'good',
            },
            {
              key: 'kpi-trend-employees-average',
              title: 'Durchschnittliche MitarbeiterZahl',
              value: trendHistoryData?.kpis?.avgEmployees == null ? '–' : trendHistoryData.kpis.avgEmployees.toFixed(1),
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


  const handleStepChange = React.useCallback((index) => {
    const safeIndex = Math.max(0, Math.min(STORY_STEPS.length - 1, Number(index) || 0));
    setActiveStep(safeIndex);

    const stepId = STORY_STEPS[safeIndex]?.id;
    if (stepId && stepId !== activeAnalysisSubPage) {
      dispatch(setAnalysisSubPage(stepId));
    }
  }, [activeAnalysisSubPage, dispatch]);


  React.useEffect(() => {
    const normalizedSubPage = ANALYSIS_SUBPAGE_ALIASES[activeAnalysisSubPage] || activeAnalysisSubPage;
    if (normalizedSubPage !== activeAnalysisSubPage) {
      dispatch(setAnalysisSubPage(normalizedSubPage));
    }
    const stepIndex = STORY_STEPS.findIndex((step) => step.id === normalizedSubPage);
    if (stepIndex >= 0 && stepIndex !== activeStep) setActiveStep(stepIndex);
  }, [activeAnalysisSubPage, activeStep, dispatch]);

  return (
    <Box
      data-testid="analysis-clean-sheet"
      className={`analysis-view-root${activeStory.id === 'options' ? ' analysis-view-root--options-scroll' : ''}`}
      style={{ '--analysis-link-accent': activeStory.accent }}
    >
      <Box className="analysis-album-flow-root">
        <Paper p="xs" className="analysis-album-flow-shell">
          <Box className="analysis-story-stepper-scroll" data-testid="analysis-story-navigation" role="region" aria-label="Analysebereiche" tabIndex={0}>
            <Stepper
              active={activeStep}
              onStepClick={handleStepChange}
              allowNextStepsSelect
              wrap={false}
              size="xs"
              iconSize={24}
              className="analysis-story-stepper"
            >
              {STORY_STEPS.map((story) => {
                const StoryIcon = story.icon;
                return (
                  <Stepper.Step
                    key={story.id}
                    label={story.stepperLabel || story.title}
                    title={`${story.title} — ${story.subtitle}`}
                    aria-label={`${story.category} ${story.title}: ${story.subtitle}`}
                    icon={<StoryIcon size={12} stroke={1.7} />}
                    data-testid={`story-step-${story.id}`}
                  />
                );
              })}
            </Stepper>
          </Box>
        </Paper>
      </Box>

      <Paper
        className={`analysis-stage-shell${activeStory.id === 'options' ? ' analysis-stage-shell--options-scroll' : ''}`}
        p="xs"
        withBorder
      >
        {activeStory.id === 'compare' && !forecastEventsAvailable && (
          <Text role="alert" size="sm" c="orange" data-testid="forecast-events-unavailable">
            Prognose unvollständig: {forecastEventsError || 'Ereignisse sind nicht verfügbar oder werden aktualisiert.'}
          </Text>
        )}
        {activeStory.id === 'status' && (
          <Group align="end" gap="sm" mb="xs">
            <NumberInput label="Modell-Betreuungsschlüssel (Kinder je päd. Kraft)" value={modelCareKey} onChange={setModelCareKey} min={0.1} decimalScale={2} placeholder="Keine Annahme" w={280} />
            <Text size="xs" c="dimmed" data-testid="coverage-model-basis">Optionale Modellannahme für diese Ansicht, keine Rechtsvorgabe oder Rechtsprüfung; beim Szenariowechsel zurückgesetzt. Kinderstunden ÷ Schlüssel; 4,33 Wochen/Monat, 160 Stunden/FTE. Für diese Modellstunden: Mo–Fr 7:00 bis 17:00 Uhr (Ende ausgeschlossen), 30-Minuten-Slots mit dem Belegungsstand am Slotbeginn. Bei Zwischenzeiten ist dies eine Näherung; keine Ausfall-, Vorbereitungs- oder Gruppenmindestzeiten und keine Bedarfsdeckung im Einzelzeitpunkt. Stunden- und Buchungszeitkategorien-Histogramme werten die vollständigen Buchungen aus.</Text>
          </Group>
        )}
        {stageRecommendations.length > 0 ? (
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
                      {privacyMode ? qualityPseudonyms.get(record.id) || (record.type === 'demand' ? 'Kind' : 'Mitarbeiter') : record.name} ({record.missingReasons.join(', ')})
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
        ) : null}

        <Box
          className={`analysis-stage-content${activeStory.id === 'options' ? ' analysis-stage-content--options' : ''}`}
          data-testid="analysis-stage-content"
        >
          {settledStep !== activeStep ? (
            <Box className="analysis-diagram-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text size="sm" c="dimmed">Wird berechnet…</Text>
            </Box>
          ) : activeStory.id === 'quality' ? (
            <QualityStageCarousel
              qualityDonutData={qualityDonutData}
              qualityStaffScheduleData={qualityStaffScheduleData}
              accent={activeStory.accent}
              privacyMode={privacyMode}
            />
          ) : activeStory.id === 'status' ? (
            <CoverageStageCarousel
              weeklyData={coverageData?.weeklyData || { categories: coverageData?.categories || [] }}
              categories={coverageData?.categories || []}
              groups={coverageData?.groupsForHeatmap || []}
              heatValues={coverageData?.heatValues || []}
              hoursHistogram={coverageData?.hoursHistogram || { all: null, byGroup: {} }}
              zeitkatDistribution={coverageData?.zeitkatDistribution || { all: null, byGroup: {} }}
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
              inflowBasis={inflowBasis}
              demographyData={demographyData}
              accent={activeStory.accent}
              privacyMode={privacyMode}
              demographyResolution={demographyResolution}
              onDemographyResolutionChange={setDemographyResolution}
            />
          ) : activeStory.id === 'trends' ? (
            <TrendHistoryCarousel trendData={trendHistoryData} accent={activeStory.accent} onPageChange={setTrendPage} />
          ) : activeStory.id === 'options' ? (
            <FundingSimulationPanel accent={activeStory.accent} scrollPage />
          ) : (
            <DiagramPlaceholder story={activeStory} />
          )}
        </Box>

        <Box className="analysis-stage-filterbar" data-testid="analysis-stage-filterbar">
          {activeStory.id === 'transitions' ? (
            <Box data-testid="analysis-resilience-basis" px="xs" mb={4} style={{ minWidth: 0, flex: '1 1 auto', maxHeight: '7rem', overflowY: 'auto' }}>
              {coverageData?.resilience?.monteCarlo && !coverageData.resilience.monteCarlo.hasBookingData ? <Text size="xs" c="orange">Im betrachteten Zeitfenster fehlen Bedarfs- oder pädagogische Personalbuchungen; die Modellwerte sind nicht belastbar.</Text> : null}
              <Text size="xs" c="dimmed">Modell, keine Prognose oder Rechtsprüfung. Werte sind zufallsabhängige, nicht empirisch kalibrierte Schätzungen; wenige Läufe und seltene Ereignisse sind besonders unsicher. Wiederholte Slots und Tage sind keine unabhängigen Stichproben. Die gefilterte Stichtagswoche wird Mo–Fr von 7:00 bis 17:00 Uhr (Ende ausgeschlossen) in 30-Minuten-Slots wiederholt; Bedarf und Personal werden am Slotbeginn erfasst. Ausfälle werden pro eingeplanter Person und Betriebstag unabhängig gezogen und auf das Tagesmaximum begrenzt; ein Ausfall dauert einen Tag. Der Ansteckungsschub gilt für die folgenden Betriebstage, auch über Wochenenden hinweg. Saisonfaktoren sind pauschale Annahmen.</Text>
              <Text size="xs" c="dimmed">Nur pädagogische Buchungen zählen; Gruppenanteile und Qualifikation folgen dem Stichtag. Der Betreuungsschlüssel ist die ungewichtete Nachfrage geteilt durch das gesamte pädagogische Personal, nicht je Gruppe. Mehrarbeit nutzt verfügbare, an diesem Tag eingeplante Personen außerhalb ihrer Buchung, mit Wochenbudget und freier Gruppenzuordnung; die Kaskade ist eine Reihenfolge-Heuristik, keine optimale Dienstplanung. Ruhezeiten werden nicht geprüft. Nicht zugeordnete Buchungen bilden eine eigene Gruppe mit globalem Minimum. Zeitreduktion senkt die Slot-Nachfrage pauschal um verbleibende Wochen-Slots geteilt durch Wochen-Slots (höchstens 45 %); Kinderkompensation je anwesend geplantem Ausfall bis höchstens 45 %, Notbetreuung um den eingestellten Satz. Keine konkreten Buchungen werden geändert. Leere Zeit-Slots gehen in die Prozentwerte ein; geschlossene Slots sind Modellverstöße, keine tatsächlichen Schließungen; Vorfälle enden täglich. Das Wochen-Toleranzbudget wird gleichmäßig auf fünf Tage verteilt; der Score gewichtet tägliche Überschreitungen nach dem verbleibenden Slot-Anteil. Außerhalb belegter oder besetzter Gruppen gilt kein Gruppenminimum. Hohe Lauf- und Wochenzahlen können den Browser länger blockieren.</Text>
            </Box>
          ) : activeStory.id === 'cohort' ? (
            <Box data-testid="analysis-finance-basis" px="xs" mb={4} style={{ minWidth: 0, flex: '1 1 auto', maxHeight: '7rem', overflowY: 'auto' }}>
              {coverageData?.financeTrend && (coverageData.financeTrend.missingIncomeMonths > 0 || coverageData.financeTrend.missingExpenseMonths > 0) ? (
                <Text size="xs" c="orange">Ungeklärt: Einnahmen in {coverageData.financeTrend.missingIncomeMonths} und Personalkosten in {coverageData.financeTrend.missingExpenseMonths} Monaten. Fehlende Regeln, Tarife, Buchungsdaten oder Personalkosten erzeugen Lücken; ein Saldo ist nur bei vollständigen Einnahmen und Ausgaben berechenbar.</Text>
              ) : null}
              <Text size="xs" c="dimmed">Zwölf Monatsanfänge, gesamte Einrichtung wie im Finanzchart: Gruppen- und Qualifikationsfilter gelten hier nicht; archivierte Datensätze sind ausgeschlossen. Stichtagswerte, keine taggenaue Abrechnung.</Text>
              <Text size="xs" c="dimmed">Einnahmen: Bruttobeiträge und ADEBIS-Basisförderung (gewichtete Tagesstunden × Jahresbasiswert / 24), ohne Beitragszuschuss, Zusatzförderung und Reform. Ausgaben: erfasste Personalkosten, ohne Sachkosten. Saldo und Kostendeckung beziehen sich nur auf diese Größen, nicht auf das vollständige Betriebsergebnis.</Text>
            </Box>
          ) : null}
          {activeStory.id === 'compare' ? (
            <Group gap="sm" mb={4} wrap="wrap" align="center" style={{ paddingLeft: 8 }}>
              <Switch
                size="sm"
                label="Zulauf im Stufenverlauf simulieren"
                checked={simulateInflow}
                onChange={(e) => setSimulateInflow(e.currentTarget.checked)}
                title="Ohne Gruppenfilter: bekannte Aufnahmen werden auf den geschätzten Jahreszulauf aus nicht archivierten Datensätzen angerechnet; ergänzender Eintritt am 1. September für drei Jahre Krippe."
              />
              <Text size="xs" c={selectedGroups.length ? 'orange' : 'dimmed'} data-testid="forecast-group-filter-status">
                {selectedGroups.length ? 'Gruppenfilter aktiv: kein geschätzter Zulauf.' : 'Alle Gruppen (kein Filter).'} Der Gruppenfilter gilt auch für andere Analysen und den Finanz-Forecast.
              </Text>
              {selectedGroups.length ? <Button size="compact-xs" variant="light" onClick={() => dispatch(setFilterGroups({ scenarioId: selectedScenarioId, groups: [] }))}>Gruppenfilter leeren</Button> : null}
            </Group>
          ) : null}
          <ChartFilterForm
            allowEmptyGroups
            allowEmptyQualifications={activeStory.id === 'trends'}
            groupFilterDisabled={activeStory.id === 'trends' && (trendPage === 'corridor' || trendPage === 'regelAge')}
            qualificationFilterDisabled={activeStory.id === 'trends' && trendPage !== 'counts' && trendPage !== 'hours'}
            qualificationFilterDescription={activeStory.id === 'trends' ? (trendPage === 'counts' || trendPage === 'hours' ? 'Gilt nur für Mitarbeiter und Arbeitsstunden; keine Auswahl: alle Qualifikationen.' : 'Für dieses Diagramm nicht anwendbar; Auswahl bleibt für andere Ansichten erhalten.') : undefined}
            groupFilterDescription={activeStory.id === 'trends' && (trendPage === 'corridor' || trendPage === 'regelAge') ? 'Für dieses Übergangsdiagramm nicht anwendbar; Auswahl bleibt erhalten und wirkt weiterhin auf die Kennzahlen.' : activeStory.id === 'cohort' ? 'Der Finanzverlauf zeigt die gesamte Einrichtung; Gruppen- und Qualifikationsfilter gelten hier nicht. Die Filter wirken weiterhin in anderen Ansichten und im Finanz-Forecast.' : undefined}
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
