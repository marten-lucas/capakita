import React from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import SankeyModule from 'highcharts/modules/sankey';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Paper,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { IconAlertTriangle, IconPlayerPause, IconPlayerPlay, IconPrinter } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { useMediaQuery } from '@mantine/hooks';
import { selectGroupTransitionStatistics, selectHistoricalStatistics } from '../store/statisticsSelectors';
import { selectMidtermChartData, selectOverlayAwareChartData } from '../store/chartSelectors';
import { selectSelectedScenario } from '../store/simScenarioSlice';
import { setActivePage, setDataCaptureQueueMode, setDataListFilter } from '../store/uiSlice';
import { calculateChartDataAgeHistogram } from '../utils/chartUtils/chartUtilsAgeHistogram';
import { computeAnalysisInsights } from '../utils/analysis/ruleEngine';
import './StatisticsStoryDeckView.css';

if (typeof Highcharts?.seriesTypes?.sankey === 'undefined') {
  SankeyModule(Highcharts);
}

const STORY_STEPS = [
  { id: 'quality', title: 'Datenqualitaet' },
  { id: 'stock', title: 'Bestand' },
  { id: 'utilization', title: 'Auslastung' },
  { id: 'transitions', title: 'Gruppenuebergaenge' },
  { id: 'age', title: 'Altersverteilung' },
  { id: 'kpis', title: 'Kennzahlen' },
  { id: 'summary', title: 'Kernaussagen' },
];

const DEFAULT_COMBO_SERIES = {
  childCount: true,
  employeeCount: true,
  income: true,
  expenses: true,
  net: true,
  careRatio: true,
  expertRatio: true,
};

function parseDate(dateValue) {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIso(date) {
  return date.toISOString().slice(0, 10);
}

function monthsAgo(months) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()));
}

function roundOne(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10;
}

function buildDeltaPercent(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function parseYearCategory(label) {
  if (!label) return null;
  const normalized = String(label).replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function getAgeBand(years) {
  if (!Number.isFinite(years)) return 'unknown';
  if (years <= 3) return 'krippe';
  if (years <= 6) return 'regel';
  return 'schule';
}

function severityColor(severity) {
  if (severity === 'high') return 'red';
  if (severity === 'medium') return 'yellow';
  return 'gray';
}

function StatisticsStoryDeckView() {
  const dispatch = useDispatch();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [activeStepIndex, setActiveStepIndex] = React.useState(0);
  const [transitionWindowDays, setTransitionWindowDays] = React.useState(90);
  const [transitionPlaybackMonths, setTransitionPlaybackMonths] = React.useState(0);
  const [transitionAutoPlay, setTransitionAutoPlay] = React.useState(false);
  const [agePlaybackMonths, setAgePlaybackMonths] = React.useState(0);
  const [ageAutoPlay, setAgeAutoPlay] = React.useState(false);
  const [comboSeries, setComboSeries] = React.useState(DEFAULT_COMBO_SERIES);

  const selectedScenario = useSelector(selectSelectedScenario);
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const dataByScenario = useSelector((state) => state.simData.dataByScenario);
  const bookingsByScenario = useSelector((state) => state.simBooking.bookingsByScenario);
  const groupsByScenario = useSelector((state) => state.simGroup.groupsByScenario);

  const historicalStatistics = useSelector((state) =>
    selectHistoricalStatistics(state, {
      aggregation: 'month',
      asOfDate: formatIso(new Date()),
    })
  );

  const transitionAsOfDate = React.useMemo(() => formatIso(monthsAgo(transitionPlaybackMonths)), [transitionPlaybackMonths]);
  const transitionStatistics = useSelector((state) =>
    selectGroupTransitionStatistics(state, {
      asOfDate: transitionAsOfDate,
      windowDays: transitionWindowDays,
    })
  );

  const midtermData = useSelector(selectMidtermChartData);
  const overlayData = useSelector(selectOverlayAwareChartData);

  React.useEffect(() => {
    if (!transitionAutoPlay) return undefined;
    const timer = setInterval(() => {
      setTransitionPlaybackMonths((current) => (current >= 24 ? 0 : current + 1));
    }, 1200);
    return () => clearInterval(timer);
  }, [transitionAutoPlay]);

  React.useEffect(() => {
    if (!ageAutoPlay) return undefined;
    const timer = setInterval(() => {
      setAgePlaybackMonths((current) => (current >= 24 ? 0 : current + 1));
    }, 1200);
    return () => clearInterval(timer);
  }, [ageAutoPlay]);

  React.useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'ArrowRight') {
        setActiveStepIndex((index) => Math.min(STORY_STEPS.length - 1, index + 1));
      }
      if (event.key === 'ArrowLeft') {
        setActiveStepIndex((index) => Math.max(0, index - 1));
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const dataQualitySummary = React.useMemo(() => {
    const items = Object.values(dataByScenario?.[selectedScenarioId] || {}).filter((item) => !item.archived);
    const bookingBuckets = bookingsByScenario?.[selectedScenarioId] || {};
    const groupBuckets = groupsByScenario?.[selectedScenarioId] || {};

    let missingBooking = 0;
    let missingGroup = 0;
    let missingBirthDate = 0;
    let missingName = 0;

    items.forEach((item) => {
      if (!String(item.name || '').trim()) missingName += 1;

      const bookings = Object.values(bookingBuckets[String(item.id)] || {});
      if (bookings.length === 0) missingBooking += 1;

      const groups = Object.values(groupBuckets[String(item.id)] || {});
      if (groups.length === 0) missingGroup += 1;

      if (item.type === 'demand' && !item.dateofbirth) missingBirthDate += 1;
    });

    return {
      total: items.length,
      missingBooking,
      missingGroup,
      missingBirthDate,
      missingName,
    };
  }, [bookingsByScenario, dataByScenario, groupsByScenario, selectedScenarioId]);

  const latestBucket = historicalStatistics.buckets[historicalStatistics.buckets.length - 1];
  const previousBucket = historicalStatistics.buckets[historicalStatistics.buckets.length - 2];

  const historicalDelta = React.useMemo(() => ({
    childrenPct: buildDeltaPercent(latestBucket?.childrenCount || 0, previousBucket?.childrenCount || 0),
    bookingPct: buildDeltaPercent(latestBucket?.bookingHours || 0, previousBucket?.bookingHours || 0),
    carePct: buildDeltaPercent(latestBucket?.careHours || 0, previousBucket?.careHours || 0),
  }), [latestBucket, previousBucket]);

  const utilizationMetrics = React.useMemo(() => {
    const demand = midtermData?.demand || [];
    const capacity = midtermData?.capacity || [];
    if (demand.length === 0 || capacity.length === 0) {
      return { overloadSharePct: 0, maxOverloadHours: 0, meanOverloadHours: 0 };
    }

    const overloadSeries = demand.map((value, index) => Math.max(0, Number(value || 0) - Number(capacity[index] || 0)));
    const overloaded = overloadSeries.filter((value) => value > 0);
    const overloadSharePct = (overloaded.length / overloadSeries.length) * 100;
    const maxOverloadHours = overloaded.length > 0 ? Math.max(...overloaded) : 0;
    const meanOverloadHours = overloaded.length > 0
      ? overloaded.reduce((sum, value) => sum + value, 0) / overloaded.length
      : 0;

    return { overloadSharePct, maxOverloadHours, meanOverloadHours };
  }, [midtermData]);

  const transitionRoutes = React.useMemo(() => {
    const map = new Map();
    (transitionStatistics.transitions || []).forEach((entry) => {
      const key = `${entry.fromGroupName}->${entry.toGroupName}`;
      if (!map.has(key)) {
        map.set(key, {
          from: entry.fromGroupName,
          to: entry.toGroupName,
          count: 0,
          deltaSum: 0,
        });
      }
      const current = map.get(key);
      current.count += 1;
      current.deltaSum += Number(entry.deltaHours || 0);
    });

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      avgDelta: entry.count > 0 ? entry.deltaSum / entry.count : 0,
    }));
  }, [transitionStatistics.transitions]);

  const sankeyData = React.useMemo(() => transitionRoutes.map((route) => ({
    from: route.from,
    to: route.to,
    weight: route.count,
    color: route.avgDelta < 0 ? theme.colors.red[6] : theme.colors.teal[6],
  })), [theme.colors.red, theme.colors.teal, transitionRoutes]);

  const ageReferenceDate = React.useMemo(() => formatIso(monthsAgo(agePlaybackMonths)), [agePlaybackMonths]);

  const ageHistogramData = React.useMemo(() => {
    if (!selectedScenarioId || !overlayData) {
      return { categories: [], series: [] };
    }

    return calculateChartDataAgeHistogram(ageReferenceDate, [], {
      dataByScenario: { [selectedScenarioId]: overlayData.effectiveDataItems || {} },
      groupsByScenario: { [selectedScenarioId]: overlayData.effectiveGroupAssignmentsByItem || {} },
      scenarioId: selectedScenarioId,
    });
  }, [ageReferenceDate, overlayData, selectedScenarioId]);

  const ageDistribution = React.useMemo(() => {
    const total = (ageHistogramData.series || []).reduce((sum, value) => sum + Number(value || 0), 0);
    if (!total) {
      return { krippePct: 0, regelPct: 0, schulePct: 0 };
    }

    let krippe = 0;
    let regel = 0;
    let schule = 0;

    ageHistogramData.categories.forEach((label, index) => {
      const years = parseYearCategory(label);
      const count = Number(ageHistogramData.series[index] || 0);
      const band = getAgeBand(years);
      if (band === 'krippe') krippe += count;
      if (band === 'regel') regel += count;
      if (band === 'schule') schule += count;
    });

    return {
      krippePct: (krippe / total) * 100,
      regelPct: (regel / total) * 100,
      schulePct: (schule / total) * 100,
    };
  }, [ageHistogramData.categories, ageHistogramData.series]);

  const financeMetrics = React.useMemo(() => {
    const incomeTotal = (midtermData?.income_total || []).reduce((sum, value) => sum + Number(value || 0), 0);
    const expensesTotal = (midtermData?.expenses_total || []).reduce((sum, value) => sum + Number(value || 0), 0);
    const netTotal = (midtermData?.net_total || []).reduce((sum, value) => sum + Number(value || 0), 0);
    const careRatioSeries = (midtermData?.care_ratio || []).filter((value) => Number(value) > 0);
    const expertRatioSeries = (midtermData?.expert_ratio || []).filter((value) => Number(value) > 0);

    const careRatio = careRatioSeries.length > 0
      ? careRatioSeries.reduce((sum, value) => sum + value, 0) / careRatioSeries.length
      : 0;
    const expertRatio = expertRatioSeries.length > 0
      ? expertRatioSeries.reduce((sum, value) => sum + value, 0) / expertRatioSeries.length
      : 0;

    return {
      income: incomeTotal,
      expenses: expensesTotal,
      net: netTotal,
      careRatio,
      expertRatio,
    };
  }, [midtermData]);

  const insights = React.useMemo(() => computeAnalysisInsights({
    dataQuality: dataQualitySummary,
    latest: latestBucket,
    historicalDelta,
    utilization: utilizationMetrics,
    transitions: {
      count: transitionStatistics.summary?.count,
      averageAgeMonths: transitionStatistics.summary?.averageAgeMonths,
      averageDeltaHours: transitionStatistics.summary?.averageDeltaHours,
      corridorRemainPct: Number(transitionStatistics.corridor?.remainProbability || 0) * 100,
    },
    ageDistribution,
    finance: financeMetrics,
  }), [ageDistribution, dataQualitySummary, financeMetrics, historicalDelta, latestBucket, transitionStatistics.corridor?.remainProbability, transitionStatistics.summary?.averageAgeMonths, transitionStatistics.summary?.averageDeltaHours, transitionStatistics.summary?.count, utilizationMetrics]);

  const activeStep = STORY_STEPS[activeStepIndex] || STORY_STEPS[0];

  const qualityChartOptions = React.useMemo(() => ({
    chart: { type: 'column', height: 280 },
    title: { text: null },
    credits: { enabled: false },
    xAxis: { categories: ['Ohne Buchung', 'Ohne Gruppe', 'Ohne Geburtsdatum', 'Ohne Namen'] },
    yAxis: { min: 0, title: { text: 'Anzahl' } },
    series: [{
      name: 'Offene Datenpunkte',
      data: [
        dataQualitySummary.missingBooking,
        dataQualitySummary.missingGroup,
        dataQualitySummary.missingBirthDate,
        dataQualitySummary.missingName,
      ],
      color: theme.colors.orange[6],
    }],
    legend: { enabled: false },
  }), [dataQualitySummary.missingBirthDate, dataQualitySummary.missingBooking, dataQualitySummary.missingGroup, dataQualitySummary.missingName, theme.colors.orange]);

  const stockChartOptions = React.useMemo(() => ({
    chart: { type: 'line', height: 320 },
    title: { text: null },
    credits: { enabled: false },
    xAxis: { categories: historicalStatistics.buckets.map((bucket) => bucket.label) },
    yAxis: [{ title: { text: 'Kinder' }, min: 0 }, { title: { text: 'Stunden' }, min: 0, opposite: true }],
    series: [
      { name: 'Kinder', data: historicalStatistics.buckets.map((bucket) => bucket.childrenCount), yAxis: 0, color: theme.colors.blue[6] },
      { name: 'Buchungsstunden', data: historicalStatistics.buckets.map((bucket) => bucket.bookingHours), yAxis: 1, color: theme.colors.teal[6] },
      { name: 'Betreuungsstunden', data: historicalStatistics.buckets.map((bucket) => bucket.careHours), yAxis: 1, color: theme.colors.orange[6] },
    ],
  }), [historicalStatistics.buckets, theme.colors.blue, theme.colors.orange, theme.colors.teal]);

  const utilizationChartOptions = React.useMemo(() => ({
    chart: { type: 'line', height: 320 },
    title: { text: null },
    credits: { enabled: false },
    xAxis: { categories: midtermData.categories || [] },
    yAxis: [{ title: { text: 'Stunden' }, min: 0 }],
    series: [
      {
        name: 'Bedarf',
        type: 'area',
        data: midtermData.demand || [],
        color: theme.colors.blue[6],
        fillOpacity: 0.25,
      },
      {
        name: 'Kapazitaet',
        type: 'line',
        data: midtermData.capacity || [],
        color: theme.colors.green[6],
      },
    ],
  }), [midtermData.capacity, midtermData.categories, midtermData.demand, theme.colors.blue, theme.colors.green]);

  const transitionChartOptions = React.useMemo(() => ({
    chart: { type: 'sankey', height: 340 },
    title: { text: null },
    credits: { enabled: false },
    tooltip: {
      pointFormatter() {
        return `<b>${this.from} -> ${this.to}</b><br/>Uebergaenge: ${this.weight}`;
      },
    },
    series: [{
      keys: ['from', 'to', 'weight'],
      data: sankeyData.map((entry) => [entry.from, entry.to, entry.weight]),
      colorByPoint: false,
      dataLabels: { enabled: true, style: { textOutline: 'none' } },
      states: { inactive: { opacity: 0.8 } },
    }],
  }), [sankeyData]);

  const ageChartOptions = React.useMemo(() => ({
    chart: { type: 'column', height: 320 },
    title: { text: null },
    credits: { enabled: false },
    xAxis: {
      categories: ageHistogramData.categories || [],
      plotBands: [
        { from: -0.5, to: 11.5, color: 'rgba(54, 162, 235, 0.10)', label: { text: 'Krippe' } },
        { from: 12.5, to: 23.5, color: 'rgba(76, 175, 80, 0.10)', label: { text: 'Regelgruppe' } },
        { from: 24.5, to: 60, color: 'rgba(255, 152, 0, 0.10)', label: { text: 'Schule' } },
      ],
    },
    yAxis: { min: 0, title: { text: 'Kinder' } },
    series: [{ name: 'Kinder', data: ageHistogramData.series || [], color: theme.colors.indigo[6] }],
    legend: { enabled: false },
  }), [ageHistogramData.categories, ageHistogramData.series, theme.colors.indigo]);

  const comboSeriesList = React.useMemo(() => {
    const series = [];
    if (comboSeries.childCount) {
      series.push({ name: 'Kinderzahl', data: midtermData.child_count || [], yAxis: 0, type: 'line', color: theme.colors.blue[6] });
    }
    if (comboSeries.employeeCount) {
      series.push({ name: 'Mitarbeiterzahl', data: midtermData.employee_count || [], yAxis: 0, type: 'line', color: theme.colors.violet[6] });
    }
    if (comboSeries.income) {
      series.push({ name: 'Einnahmen', data: midtermData.income_total || [], yAxis: 1, type: 'line', color: theme.colors.teal[6] });
    }
    if (comboSeries.expenses) {
      series.push({ name: 'Ausgaben', data: midtermData.expenses_total || [], yAxis: 1, type: 'line', color: theme.colors.red[6] });
    }
    if (comboSeries.net) {
      series.push({ name: 'Saldo', data: midtermData.net_total || [], yAxis: 1, type: 'line', color: theme.colors.lime[7] });
    }
    if (comboSeries.careRatio) {
      series.push({ name: 'Betreuungsschluessel', data: midtermData.care_ratio || [], yAxis: 2, type: 'line', color: theme.colors.orange[6] });
    }
    if (comboSeries.expertRatio) {
      series.push({ name: 'Fachkraftquote', data: midtermData.expert_ratio || [], yAxis: 2, type: 'line', color: theme.colors.cyan[6] });
    }
    return series;
  }, [comboSeries.careRatio, comboSeries.childCount, comboSeries.employeeCount, comboSeries.expenses, comboSeries.expertRatio, comboSeries.income, comboSeries.net, midtermData.care_ratio, midtermData.child_count, midtermData.employee_count, midtermData.expenses_total, midtermData.expert_ratio, midtermData.income_total, midtermData.net_total, theme.colors.blue, theme.colors.cyan, theme.colors.lime, theme.colors.orange, theme.colors.red, theme.colors.teal, theme.colors.violet]);

  const comboChartOptions = React.useMemo(() => ({
    chart: { type: 'line', height: 340 },
    title: { text: null },
    credits: { enabled: false },
    xAxis: { categories: midtermData.categories || [] },
    yAxis: [
      { title: { text: 'Anzahl' }, min: 0 },
      { title: { text: 'EUR' }, opposite: true },
      { title: { text: 'Quote/Schluessel' }, opposite: true, offset: 65, min: 0 },
    ],
    series: comboSeriesList,
  }), [comboSeriesList, midtermData.categories]);

  const onToggleSeries = (key) => {
    setComboSeries((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const openDataFixMode = React.useCallback((filter, queueMode = false) => {
    dispatch(setDataListFilter(filter));
    dispatch(setDataCaptureQueueMode(queueMode));
    dispatch(setActivePage('data'));
  }, [dispatch]);

  const renderScreenStep = () => {
    if (activeStep.id === 'quality') {
      return (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{insights.stepStatements.quality}</Text>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light" color="yellow">Ohne Buchung: {dataQualitySummary.missingBooking}</Badge>
            <Badge variant="light" color="yellow">Ohne Gruppe: {dataQualitySummary.missingGroup}</Badge>
            <Badge variant="light" color="yellow">Ohne Geburtsdatum: {dataQualitySummary.missingBirthDate}</Badge>
            <Badge variant="light" color="red">Ohne Namen: {dataQualitySummary.missingName}</Badge>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Button size="xs" variant="light" onClick={() => openDataFixMode('missing_booking')}>Fehlende Buchungen bearbeiten</Button>
            <Button size="xs" variant="light" onClick={() => openDataFixMode('missing_group')}>Fehlende Gruppen bearbeiten</Button>
            <Button size="xs" variant="light" onClick={() => openDataFixMode('missing_birthdate')}>Fehlende Geburtsdaten bearbeiten</Button>
            <Button size="xs" onClick={() => openDataFixMode('incomplete', true)}>Erfassungs-Queue starten</Button>
          </Group>
          <Box h={{ base: 250, sm: 280 }}>
            <HighchartsReact highcharts={Highcharts} options={qualityChartOptions} containerProps={{ style: { height: '100%' } }} />
          </Box>
        </Stack>
      );
    }

    if (activeStep.id === 'stock') {
      return (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{insights.stepStatements.stock}</Text>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light">Kinder Delta: {roundOne(historicalDelta.childrenPct)}%</Badge>
            <Badge variant="light">Buchungsstunden Delta: {roundOne(historicalDelta.bookingPct)}%</Badge>
            <Badge variant="light">Betreuungsstunden Delta: {roundOne(historicalDelta.carePct)}%</Badge>
          </Group>
          <Box h={{ base: 280, sm: 320 }}>
            <HighchartsReact highcharts={Highcharts} options={stockChartOptions} containerProps={{ style: { height: '100%' } }} />
          </Box>
        </Stack>
      );
    }

    if (activeStep.id === 'utilization') {
      return (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{insights.stepStatements.utilization}</Text>
          <Group gap="xs" wrap="wrap">
            <Badge variant="light">Ueberlastanteil: {roundOne(utilizationMetrics.overloadSharePct)}%</Badge>
            <Badge variant="light">Maximale Ueberlast: {roundOne(utilizationMetrics.maxOverloadHours)} h</Badge>
            <Badge variant="light">Mittlere Ueberlast: {roundOne(utilizationMetrics.meanOverloadHours)} h</Badge>
          </Group>
          <Box h={{ base: 280, sm: 320 }}>
            <HighchartsReact highcharts={Highcharts} options={utilizationChartOptions} containerProps={{ style: { height: '100%' } }} />
          </Box>
        </Stack>
      );
    }

    if (activeStep.id === 'transitions') {
      return (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{insights.stepStatements.transitions}</Text>
          <Group gap="xs" wrap="wrap" align="center">
            <Text size="sm">Zeitfenster (Tage):</Text>
            <Slider
              value={transitionWindowDays}
              onChange={setTransitionWindowDays}
              min={30}
              max={180}
              step={30}
              w={220}
            />
            <Text size="sm" c="dimmed">Stichtag-Offset: {transitionPlaybackMonths} Monate</Text>
            <Button
              size="xs"
              variant="light"
              leftSection={transitionAutoPlay ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
              onClick={() => setTransitionAutoPlay((value) => !value)}
            >
              {transitionAutoPlay ? 'Playback stoppen' : 'Playback starten'}
            </Button>
          </Group>
          <Box h={{ base: 300, sm: 340 }}>
            <HighchartsReact highcharts={Highcharts} options={transitionChartOptions} containerProps={{ style: { height: '100%' } }} />
          </Box>
        </Stack>
      );
    }

    if (activeStep.id === 'age') {
      return (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{insights.stepStatements.age}</Text>
          <Group gap="xs" wrap="wrap" align="center">
            <Text size="sm" c="dimmed">Stichtag-Offset: {agePlaybackMonths} Monate</Text>
            <Button
              size="xs"
              variant="light"
              leftSection={ageAutoPlay ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
              onClick={() => setAgeAutoPlay((value) => !value)}
            >
              {ageAutoPlay ? 'Playback stoppen' : 'Playback starten'}
            </Button>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Badge color="blue" variant="light">Krippe: {roundOne(ageDistribution.krippePct)}%</Badge>
            <Badge color="green" variant="light">Regelgruppe: {roundOne(ageDistribution.regelPct)}%</Badge>
            <Badge color="orange" variant="light">Schule: {roundOne(ageDistribution.schulePct)}%</Badge>
          </Group>
          <Box h={{ base: 280, sm: 320 }}>
            <HighchartsReact highcharts={Highcharts} options={ageChartOptions} containerProps={{ style: { height: '100%' } }} />
          </Box>
        </Stack>
      );
    }

    if (activeStep.id === 'kpis') {
      return (
        <Stack gap="md">
          <Text size="sm" c="dimmed">{insights.stepStatements.kpis}</Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
            <Checkbox label="Kinderzahl" checked={comboSeries.childCount} onChange={() => onToggleSeries('childCount')} />
            <Checkbox label="Mitarbeiterzahl" checked={comboSeries.employeeCount} onChange={() => onToggleSeries('employeeCount')} />
            <Checkbox label="Einnahmen" checked={comboSeries.income} onChange={() => onToggleSeries('income')} />
            <Checkbox label="Ausgaben" checked={comboSeries.expenses} onChange={() => onToggleSeries('expenses')} />
            <Checkbox label="Saldo" checked={comboSeries.net} onChange={() => onToggleSeries('net')} />
            <Checkbox label="Betreuungsschluessel" checked={comboSeries.careRatio} onChange={() => onToggleSeries('careRatio')} />
            <Checkbox label="Fachkraftquote" checked={comboSeries.expertRatio} onChange={() => onToggleSeries('expertRatio')} />
          </SimpleGrid>
          <Box h={{ base: 300, sm: 340 }}>
            <HighchartsReact highcharts={Highcharts} options={comboChartOptions} containerProps={{ style: { height: '100%' } }} />
          </Box>
        </Stack>
      );
    }

    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">{insights.stepStatements.summary}</Text>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {insights.topAlerts.length === 0 && (
            <Paper withBorder p="md">
              <Text fw={600}>Keine kritischen Alerts</Text>
              <Text size="sm" c="dimmed">Aktuell liegt kein priorisiertes Handlungsfeld vor.</Text>
            </Paper>
          )}
          {insights.topAlerts.map((alert) => (
            <Paper key={alert.id} withBorder p="md">
              <Group justify="space-between" mb={4}>
                <Text fw={600}>{alert.title}</Text>
                <Badge color={severityColor(alert.severity)} variant="light">{alert.severity.toUpperCase()}</Badge>
              </Group>
              <Text size="sm">{alert.statement}</Text>
              <Text size="sm" c="dimmed" mt="xs">Massnahme: {alert.measure}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    );
  };

  const renderPrintSlides = () => (
    <Stack gap="lg" className="storydeck-print-only">
      {STORY_STEPS.map((step, index) => (
        <Paper key={step.id} withBorder p="lg" className="storydeck-print-slide">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">Analysebericht - Schritt {index + 1}/{STORY_STEPS.length}</Text>
            <Text size="xl" fw={700}>{step.title}</Text>
            <Text size="sm">Szenario: {selectedScenario?.name || 'Unbenanntes Szenario'}</Text>
            <Text size="sm">Stichtag: {transitionAsOfDate}</Text>
            <Text>{insights.stepStatements[step.id]}</Text>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  return (
    <Paper withBorder p="md" data-testid="statistics-storydeck-view" className="storydeck-root">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap" className="storydeck-print-hide">
          <Stack gap={2}>
            <Text size="xl" fw={700}>Analyse-Story</Text>
            <Text size="sm" c="dimmed">Gefuehrter Analysemodus fuer fokussierte Kommunikation.</Text>
          </Stack>
          <Group>
            <Button
              variant="light"
              leftSection={<IconPrinter size={16} />}
              onClick={() => window.print()}
              data-testid="storydeck-export-pdf"
            >
              Als PDF exportieren
            </Button>
          </Group>
        </Group>

        {insights.topAlerts.length > 0 && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" className="storydeck-print-hide">
            <Stack gap={4}>
              <Text fw={600}>Priorisierte Alerts</Text>
              {insights.topAlerts.map((alert) => (
                <Text key={alert.id} size="sm">• {alert.title}: {alert.statement}</Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Box className="storydeck-thumbnail-strip storydeck-screen-only">
          <Group gap="xs" wrap="nowrap">
            {STORY_STEPS.map((step, index) => {
              const isActive = index === activeStepIndex;
              const stepAlert = insights.topAlerts.find((alert) => alert.stepId === step.id);
              return (
                <Paper
                  key={step.id}
                  withBorder
                  p="xs"
                  className={`storydeck-thumbnail ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveStepIndex(index)}
                  data-testid={`storydeck-thumb-${step.id}`}
                >
                  <Text fw={600} size="sm">{index + 1}. {step.title}</Text>
                  <Text size="xs" c="dimmed">{insights.stepStatements[step.id]}</Text>
                  {stepAlert && (
                    <Badge mt={6} size="xs" color={severityColor(stepAlert.severity)} variant="light">
                      {stepAlert.severity.toUpperCase()}
                    </Badge>
                  )}
                </Paper>
              );
            })}
          </Group>
        </Box>

        <Group justify="space-between" className="storydeck-print-hide">
          <Button
            variant="subtle"
            disabled={activeStepIndex === 0}
            onClick={() => setActiveStepIndex((value) => Math.max(0, value - 1))}
          >
            Vorheriger Schritt
          </Button>
          <Badge size="lg" variant="light">{activeStepIndex + 1} / {STORY_STEPS.length}</Badge>
          <Button
            variant="subtle"
            disabled={activeStepIndex === STORY_STEPS.length - 1}
            onClick={() => setActiveStepIndex((value) => Math.min(STORY_STEPS.length - 1, value + 1))}
          >
            Naechster Schritt
          </Button>
        </Group>

        <Paper withBorder p="md" className="storydeck-stage storydeck-screen-only">
          <Stack gap="sm" className="storydeck-slide" key={activeStep.id}>
            <Text fw={700} size={isMobile ? 'md' : 'lg'}>
              {activeStepIndex + 1}. {activeStep.title}
            </Text>
            <Text size="sm" c="dimmed">Stichtag: {transitionAsOfDate}</Text>
            {renderScreenStep()}
          </Stack>
        </Paper>

        {renderPrintSlides()}
      </Stack>
    </Paper>
  );
}

export default StatisticsStoryDeckView;
