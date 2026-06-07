import React from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Group,
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
import GroupIcon from '../components/common/GroupIcon';
import { useDispatch, useSelector } from 'react-redux';
import { setActivePage, setAnalysisSubPage } from '../store/uiSlice';
import { setSelectedItem, setSelectedItems } from '../store/simScenarioSlice';
import { ensureScenario } from '../store/chartSlice';
import { selectWeeklyChartData } from '../store/chartSelectors';
import { useOverlayData } from '../hooks/useOverlayData';
import { calculateScenarioMonthlyFinance, isDateWithinRange, isRecordActiveOnDate, resolveGroupIdAtDate } from '../utils/financeUtils';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { isArchivedDataItem, shouldIncludeDataItemInAnalysis } from '../utils/dataVisibility';
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

function CoverageHeatmap({ categories, groups, heatValues, accent, mode }) {
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
    const values = heatValues.map(([, , value]) => Number(value || 0));
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
        [1, '#7c3aed'],
      ];
    }

    return [
      [0, '#7c3aed'],
      [0.5, '#f59e0b'],
      [1, '#ef4444'],
    ];
  }, [mode]);

  const metricLabel = React.useMemo(() => {
    if (mode === HEATMAP_MODES.UNWEIGHTED_QUOTIENT) return 'Quotient';
    if (mode === HEATMAP_MODES.CARE_KEY) return 'Betreuungsschlüssel';
    return 'Päd. Mitarbeiter';
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
          states: {
            hover: {
              borderColor: accent,
              borderWidth: 1.5,
            },
          },
        },
      ],
    }),
    [accent, categories, colorStops, dayBands, daySeparatorLines, groups, heatValues, majorTickPositions, metricLabel, metricRange.max, metricRange.min]
  );

  const legendEntries = React.useMemo(() => {
    if (mode === HEATMAP_MODES.PRESENT_STAFF) {
      return [
        { color: '#ef4444', label: 'Wenige Mitarbeiter' },
        { color: '#f59e0b', label: 'Mittlere Besetzung' },
        { color: '#7c3aed', label: 'Viele Mitarbeiter' },
      ];
    }

    if (mode === HEATMAP_MODES.CARE_KEY) {
      return [
        { color: '#7c3aed', label: 'Niedriger Schlüssel' },
        { color: '#f59e0b', label: 'Mittlerer Schlüssel' },
        { color: '#ef4444', label: 'Hoher Schlüssel' },
      ];
    }

    return [
      { color: '#7c3aed', label: 'Niedriger Quotient' },
      { color: '#f59e0b', label: 'Mittlerer Quotient' },
      { color: '#ef4444', label: 'Hoher Quotient' },
    ];
  }, [mode]);

  return (
    <Stack style={{ height: '100%', minHeight: 0 }} gap={4}>
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
    const idx = STORY_STEPS.findIndex((step) => step.id === activeAnalysisSubPage);
    return idx >= 0 ? idx : 0;
  });
  const [emblaApi, setEmblaApi] = React.useState(null);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);
  const [monteCarloConfig, setMonteCarloConfig] = React.useState({
    runs: 1200,
    baseAbsenceProbabilityPct: 14,
    simulationWeeks: 26,
    maxConcurrentOutages: 3,
    minExpertRatioPct: LEGAL_EXPERT_RATIO_MIN_PCT,
    maxCareRatio: 8,
    minGroupHeadcount: 1,
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
  const todayIso = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const qualityReferenceDate = React.useMemo(() => chartState?.referenceDate || todayIso, [chartState?.referenceDate, todayIso]);
  const { getEffectiveDataItems, getEffectiveBookings, getEffectiveGroupAssignments, getEffectiveGroupDefs } = useOverlayData();
  const activeStory = STORY_STEPS[activeStep] || STORY_STEPS[0];
  const activeLoadingStages = React.useMemo(
    () => ANALYSIS_LOADING_STAGES_BY_STORY[activeStory.id] || [ANALYSIS_LOADING_STAGES[0]],
    [activeStory.id]
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

    const storyId = activeStory.id;
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

      groupsForHeatmap.forEach((group, groupIndex) => {
        const groupFilter = group.id === '__NO_GROUP__' ? ['__NO_GROUP__'] : [group.id];
        const { demand: groupDemand, capacity: groupCapacity } = filterBookings({
          ...baseInput,
          selectedGroups: groupFilter,
        });

        const groupDemandSeries = generateBookingDataSeries(referenceDate, groupDemand, categories);
        const groupCapacitySeries = generateBookingDataSeries(referenceDate, groupCapacity, categories, 'all');
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
          const delta = Number(groupCapacitySeries[slotIndex] || 0) - Number(groupDemandSeries[slotIndex] || 0);
          if (delta < 0) groupMinutes += Math.abs(delta) * 30;

          const demandValue = Number(groupDemandSeries[slotIndex] || 0);
          const pedagogicalValue = Number(groupPedCapacitySeries[slotIndex] || 0);

          let heatValue;
          if (heatmapMode === HEATMAP_MODES.CARE_KEY) {
            heatValue = Number(groupCareRatioSeries[slotIndex] || 0);
          } else if (heatmapMode === HEATMAP_MODES.PRESENT_STAFF) {
            heatValue = pedagogicalValue;
          } else {
            // Default and primary mode: Kinder pro pädagogischer Mitarbeiter.
            heatValue = pedagogicalValue > 0 ? demandValue / pedagogicalValue : (demandValue > 0 ? demandValue : 0);
          }

          heatValues.push([slotIndex, groupIndex, heatValue]);
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
            const minimumStaffRequired = minGroupHeadcount * groupCount;
            let currentCareRatio = totalStaff > 0 ? effectiveDemand / totalStaff : Number.POSITIVE_INFINITY;
            let currentExpertRatio = expertBase;

            let stage = 0;
            let isCompliant = (
              totalStaff >= minimumStaffRequired
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
              const isCareRatioIssue = currentCareRatio > maxCareRatioAllowed;
              const isExpertIssue = currentExpertRatio < minExpertRatioPct;
              const absenceBucket = absentPed >= 3 ? '3+' : String(absentPed);
              const factorLabels = [];
              if (isHeadcountIssue) factorLabels.push('Unterbesetzung');
              if (isCareRatioIssue) factorLabels.push('Schlüsselgrenze');
              if (isExpertIssue) factorLabels.push('Fachkraftquote');
              if (factorLabels.length === 0) factorLabels.push('Sonstige Restriktion');

              const combinationKey = `A${absenceBucket}|H${isHeadcountIssue ? 1 : 0}|C${isCareRatioIssue ? 1 : 0}|E${isExpertIssue ? 1 : 0}`;
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
    activeStory.id,
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
    const stepIndex = STORY_STEPS.findIndex((step) => step.id === activeAnalysisSubPage);
    if (stepIndex >= 0 && stepIndex !== activeStep) {
      setActiveStep(stepIndex);
      emblaApi?.scrollTo(stepIndex);
    }
  }, [activeAnalysisSubPage, activeStep, emblaApi]);

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
          {activeStory.id === 'quality' ? (
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
            <PreviewSankeyChart previewFlow={previewFlow} accent={activeStory.accent} />
          ) : activeStory.id === 'demography' ? (
            <DemographyAgeChart demographyData={demographyData} accent={activeStory.accent} />
          ) : (
            <DiagramPlaceholder story={activeStory} />
          )}
        </Box>

        <Box className="analysis-stage-filterbar" data-testid="analysis-stage-filterbar">
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
