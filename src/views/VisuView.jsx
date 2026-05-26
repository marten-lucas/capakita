import React from 'react';
import { Alert, Badge, Box, Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertTriangle, IconUpload } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import WeeklyChart from '../components/SimDataCharts/WeeklyChart';
import MidtermChart from '../components/SimDataCharts/MidtermChart';
import BookingHistogram from '../components/SimDataCharts/BookingHistogram';
import AgeHistogram from '../components/SimDataCharts/AgeHistogram';
import { setSelectedScenarioId } from '../store/simScenarioSlice';
import { setActivePage } from '../store/uiSlice';
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm';
import { useScenarioEvents } from '../hooks/useScenarioEvents';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import ChartErrorBoundary from '../components/common/ChartErrorBoundary';
import { selectWeeklyChartDataByGroup, selectMidtermChartData } from '../store/chartSelectors';
import { selectGroupTransitionStatistics, selectHistoricalStatistics } from '../store/statisticsSelectors';
import { computeAnalysisInsights } from '../utils/analysis/ruleEngine';
import './VisuView.css';

const EMPTY_TOGGLES = [];

const FLOW_STEPS = [
  { id: 'current', title: 'Aktuelle Lage' },
  { id: 'midterm', title: 'Langzeit-Fokus' },
  { id: 'historical', title: 'Historische Signale' },
  { id: 'transitions', title: 'Gruppenuebergaenge' },
  { id: 'summary', title: 'Priorisierung' },
];

const DEFAULT_INSIGHTS = {
  alerts: [],
  topAlerts: [],
};

function formatIso(date) {
  return date.toISOString().slice(0, 10);
}

function roundOne(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10;
}

function severityColor(severity) {
  if (severity === 'high') return 'red';
  if (severity === 'medium') return 'yellow';
  return 'gray';
}

function buildDeltaPercent(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function VisuView() {
  const dispatch = useDispatch();
  const isMobile = useMediaQuery('(max-width: 48em)');

  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const scenarios = useSelector((state) => state.simScenario.scenarios);
  const chartState = useSelector((state) => state.chart[selectedScenarioId] ?? null);
  const chartToggles = chartState?.chartToggles || EMPTY_TOGGLES;
  const weeklyChartsByGroup = useSelector(selectWeeklyChartDataByGroup);
  const midtermData = useSelector(selectMidtermChartData);
  const weeklySyncGroupKey = selectedScenarioId ? `weekly-sync-${selectedScenarioId}` : null;
  const [showGroupWeeklyCharts, setShowGroupWeeklyCharts] = React.useState(false);
  const [activeStepIndex, setActiveStepIndex] = React.useState(0);
  const [insights, setInsights] = React.useState(DEFAULT_INSIGHTS);

  const sectionRefs = React.useMemo(() => ({
    current: React.createRef(),
    midterm: React.createRef(),
    historical: React.createRef(),
    transitions: React.createRef(),
    summary: React.createRef(),
  }), []);

  const dataByScenario = useSelector((state) => state.simData.dataByScenario);
  const bookingsByScenario = useSelector((state) => state.simBooking.bookingsByScenario);
  const groupsByScenario = useSelector((state) => state.simGroup.groupsByScenario);

  const historicalStatistics = useSelector((state) =>
    selectHistoricalStatistics(state, {
      aggregation: 'month',
      asOfDate: formatIso(new Date()),
    })
  );

  const transitionStatistics = useSelector((state) =>
    selectGroupTransitionStatistics(state, {
      asOfDate: formatIso(new Date()),
      windowDays: 90,
    })
  );

  React.useEffect(() => {
    if (selectedScenarioId && scenarios.length > 0) {
      if (!scenarios.some((scenario) => scenario.id === selectedScenarioId)) {
        dispatch(setSelectedScenarioId(scenarios[0].id));
      }
    } else if (!selectedScenarioId && scenarios.length > 0) {
      dispatch(setSelectedScenarioId(scenarios[0].id));
    }
  }, [selectedScenarioId, scenarios, dispatch]);

  useScenarioEvents(selectedScenarioId);

  const effectiveDataItems = useSelector(
    (state) => {
      if (!selectedScenarioId) return [];
      const overlayData = buildOverlayAwareData(selectedScenarioId, state);
      return Object.values(overlayData.effectiveDataItems || {});
    },
    (prev, next) => {
      if (!prev || !next) return prev === next;
      if (prev.length !== next.length) return false;
      return prev.every((item, idx) => item?.id === next[idx]?.id);
    }
  );

  const dataQualitySummary = React.useMemo(() => {
    const items = Object.values(dataByScenario?.[selectedScenarioId] || {}).filter((item) => !item.archived);
    const bookingBuckets = bookingsByScenario?.[selectedScenarioId] || {};
    const groupBuckets = groupsByScenario?.[selectedScenarioId] || {};

    let missingBooking = 0;
    let missingGroup = 0;
    let missingBirthDate = 0;

    items.forEach((item) => {
      if (Object.values(bookingBuckets[String(item.id)] || {}).length === 0) missingBooking += 1;
      if (Object.values(groupBuckets[String(item.id)] || {}).length === 0) missingGroup += 1;
      if (item.type === 'demand' && !item.dateofbirth) missingBirthDate += 1;
    });

    return {
      total: items.length,
      missingBooking,
      missingGroup,
      missingBirthDate,
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
    return {
      overloadSharePct: (overloaded.length / overloadSeries.length) * 100,
      maxOverloadHours: overloaded.length > 0 ? Math.max(...overloaded) : 0,
      meanOverloadHours: overloaded.length > 0 ? overloaded.reduce((sum, value) => sum + value, 0) / overloaded.length : 0,
    };
  }, [midtermData]);

  const transitionMetrics = React.useMemo(() => {
    const transitions = transitionStatistics.transitions || [];
    const routeMap = new Map();
    transitions.forEach((entry) => {
      const key = `${entry.fromGroupName}->${entry.toGroupName}`;
      routeMap.set(key, (routeMap.get(key) || 0) + 1);
    });
    const routeCounts = Array.from(routeMap.values());
    const topRouteCount = routeCounts.length > 0 ? Math.max(...routeCounts) : 0;
    const total = routeCounts.reduce((sum, value) => sum + value, 0);

    return {
      count: transitionStatistics.summary?.count || transitions.length,
      averageAgeMonths: transitionStatistics.summary?.averageAgeMonths,
      medianAgeMonths: transitionStatistics.summary?.medianAgeMonths,
      averageDeltaHours: transitionStatistics.summary?.averageDeltaHours,
      corridorRemainPct: Number(transitionStatistics.corridor?.remainProbability || 0) * 100,
      topRouteSharePct: total > 0 ? (topRouteCount / total) * 100 : 0,
    };
  }, [transitionStatistics]);

  const financeMetrics = React.useMemo(() => {
    const incomeSeries = midtermData?.income_total || [];
    const expensesSeries = midtermData?.expenses_total || [];
    const netSeries = midtermData?.net_total || [];

    return {
      income: incomeSeries.reduce((sum, value) => sum + Number(value || 0), 0),
      expenses: expensesSeries.reduce((sum, value) => sum + Number(value || 0), 0),
      net: netSeries.reduce((sum, value) => sum + Number(value || 0), 0),
      careRatio: (midtermData?.care_ratio || []).filter((value) => Number(value) > 0).reduce((sum, value, _idx, arr) => sum + value / arr.length, 0),
      expertRatio: (midtermData?.expert_ratio || []).filter((value) => Number(value) > 0).reduce((sum, value, _idx, arr) => sum + value / arr.length, 0),
    };
  }, [midtermData]);

  React.useEffect(() => {
    let cancelled = false;

    computeAnalysisInsights({
      dataQuality: dataQualitySummary,
      latest: latestBucket,
      historicalDelta,
      utilization: utilizationMetrics,
      transitions: transitionMetrics,
      finance: financeMetrics,
      ageDistribution: { krippePct: 0, regelPct: 0, schulePct: 0 },
    })
      .then((result) => {
        if (!cancelled) setInsights(result);
      })
      .catch(() => {
        if (!cancelled) setInsights(DEFAULT_INSIGHTS);
      });

    return () => {
      cancelled = true;
    };
  }, [dataQualitySummary, financeMetrics, historicalDelta, latestBucket, transitionMetrics, utilizationMetrics]);

  const historicalTrendOptions = React.useMemo(() => ({
    chart: { type: 'line', height: 320 },
    title: { text: null },
    credits: { enabled: false },
    xAxis: { categories: historicalStatistics.buckets.map((bucket) => bucket.label) },
    yAxis: [{ title: { text: 'Kinder' }, min: 0 }, { title: { text: 'Stunden' }, min: 0, opposite: true }],
    series: [
      { name: 'Kinder', data: historicalStatistics.buckets.map((bucket) => bucket.childrenCount), yAxis: 0, color: '#228be6' },
      { name: 'Buchungsstunden', data: historicalStatistics.buckets.map((bucket) => bucket.bookingHours), yAxis: 1, color: '#12b886' },
      { name: 'Betreuungsstunden', data: historicalStatistics.buckets.map((bucket) => bucket.careHours), yAxis: 1, color: '#f08c00' },
    ],
  }), [historicalStatistics.buckets]);

  const transitionRouteOptions = React.useMemo(() => {
    const routeCounts = new Map();
    (transitionStatistics.transitions || []).forEach((transition) => {
      const label = `${transition.fromGroupName} -> ${transition.toGroupName}`;
      routeCounts.set(label, (routeCounts.get(label) || 0) + 1);
    });

    const sorted = Array.from(routeCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      chart: { type: 'column', height: 300 },
      title: { text: null },
      credits: { enabled: false },
      xAxis: { categories: sorted.map((entry) => entry.label) },
      yAxis: { title: { text: 'Uebergaenge' }, min: 0 },
      series: [{ name: 'Anzahl', data: sorted.map((entry) => entry.count), color: '#4c6ef5' }],
      legend: { enabled: false },
    };
  }, [transitionStatistics.transitions]);

  const transitionDeltaOptions = React.useMemo(() => {
    const routeDelta = new Map();
    (transitionStatistics.transitions || []).forEach((transition) => {
      const label = `${transition.fromGroupName} -> ${transition.toGroupName}`;
      if (!routeDelta.has(label)) routeDelta.set(label, { sum: 0, count: 0 });
      const current = routeDelta.get(label);
      current.sum += Number(transition.deltaHours || 0);
      current.count += 1;
    });

    const sorted = Array.from(routeDelta.entries())
      .map(([label, value]) => ({ label, avg: value.count ? value.sum / value.count : 0 }))
      .sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg))
      .slice(0, 8);

    return {
      chart: { type: 'bar', height: 300 },
      title: { text: null },
      credits: { enabled: false },
      xAxis: { categories: sorted.map((entry) => entry.label) },
      yAxis: { title: { text: 'Ø Delta Stunden/Woche' } },
      series: [{ name: 'Ø Delta', data: sorted.map((entry) => roundOne(entry.avg)), color: '#0ca678' }],
      legend: { enabled: false },
    };
  }, [transitionStatistics.transitions]);

  const scrollToStep = React.useCallback((index) => {
    const step = FLOW_STEPS[index];
    if (!step) return;
    setActiveStepIndex(index);
    sectionRefs[step.id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sectionRefs]);

  React.useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'ArrowRight') {
        scrollToStep(Math.min(FLOW_STEPS.length - 1, activeStepIndex + 1));
      }
      if (event.key === 'ArrowLeft') {
        scrollToStep(Math.max(0, activeStepIndex - 1));
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeStepIndex, scrollToStep]);

  if (!effectiveDataItems || effectiveDataItems.length === 0) {
    return (
      <Container size="sm" py="xl">
        <Paper shadow="xs" p="xl" withBorder style={{ textAlign: 'center' }}>
          <Stack align="center">
            <Title order={3}>Keine Daten vorhanden</Title>
            <Text c="dimmed">Um die Simulation zu starten, muessen Sie zuerst Daten importieren oder anlegen.</Text>
            <Button leftSection={<IconUpload size={16} />} onClick={() => dispatch(setActivePage('data'))}>
              Zu Simulationsdaten wechseln
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Stack gap={isMobile ? 'md' : 'lg'} pb="xl" data-testid="analysis-storyflow-view">
      <ChartFilterForm showStichtag scenarioId={selectedScenarioId} />

      {insights.topAlerts.length > 0 && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
          <Stack gap={4}>
            <Text fw={600}>Priorisierte Alerts</Text>
            {insights.topAlerts.map((alert) => (
              <Text key={alert.id} size="sm">- {alert.title}: {alert.statement}</Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Paper withBorder p="md" className="analysis-flow-root">
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={2}>
              <Title order={2}>Analyse-Buehne</Title>
              <Text size="sm" c="dimmed">Gefuehrter Analysefluss fuer Gegenwart, Zukunft und historische Signale.</Text>
            </Stack>
            <Badge size="lg" variant="light">{activeStepIndex + 1} / {FLOW_STEPS.length}</Badge>
          </Group>

          <Box className="analysis-flow-thumbnails">
            <Group gap="xs" wrap="nowrap">
              {FLOW_STEPS.map((step, index) => {
                const active = index === activeStepIndex;
                return (
                  <Paper
                    key={step.id}
                    withBorder
                    p="xs"
                    className={`analysis-flow-thumb ${active ? 'is-active' : ''}`}
                    onClick={() => scrollToStep(index)}
                    data-testid={`analysis-flow-thumb-${step.id}`}
                  >
                    <Text fw={600} size="sm">{index + 1}. {step.title}</Text>
                  </Paper>
                );
              })}
            </Group>
          </Box>

          <Group justify="space-between">
            <Button variant="subtle" disabled={activeStepIndex === 0} onClick={() => scrollToStep(Math.max(0, activeStepIndex - 1))}>
              Vorheriger Schritt
            </Button>
            <Button variant="subtle" disabled={activeStepIndex === FLOW_STEPS.length - 1} onClick={() => scrollToStep(Math.min(FLOW_STEPS.length - 1, activeStepIndex + 1))}>
              Naechster Schritt
            </Button>
          </Group>

          <Stack gap="md" className="analysis-flow-stage">
            <Paper ref={sectionRefs.current} withBorder p="md" className="analysis-flow-slide">
              <Title order={3} mb="xs">1. Aktuelle Lage</Title>
              <Text size="sm" c="dimmed" mb="sm">Regelbetrieb und Datenqualitaet in der aktuellen Situation.</Text>
              <Group gap="xs" wrap="wrap" mb="sm">
                <Badge color="blue" variant="light">Datensaetze: {dataQualitySummary.total}</Badge>
                <Badge color="orange" variant="light">Ohne Buchung: {dataQualitySummary.missingBooking}</Badge>
                <Badge color="orange" variant="light">Ohne Gruppe: {dataQualitySummary.missingGroup}</Badge>
                <Badge color="orange" variant="light">Ohne Geburtsdatum: {dataQualitySummary.missingBirthDate}</Badge>
              </Group>

              {chartToggles.includes('weekly') && (
                <Paper p="md" withBorder style={{ overflow: 'visible' }}>
                  <Title order={4} mb="md" c="dimmed">Regelbetrieb</Title>
                  <ChartErrorBoundary>
                    <WeeklyChart syncGroupKey={weeklySyncGroupKey} />
                  </ChartErrorBoundary>
                  {weeklyChartsByGroup.length > 0 && (
                    <Stack gap="sm" mt="lg" style={{ overflow: 'visible' }}>
                      <Button variant="subtle" size="compact-sm" onClick={() => setShowGroupWeeklyCharts((open) => !open)}>
                        {showGroupWeeklyCharts
                          ? `Gruppendiagramme ausblenden (${weeklyChartsByGroup.length})`
                          : `Gruppendiagramme anzeigen (${weeklyChartsByGroup.length})`}
                      </Button>
                      {showGroupWeeklyCharts && (
                        <Stack gap="lg" style={{ overflow: 'visible' }}>
                          {weeklyChartsByGroup.map((groupChart) => (
                            <Paper key={groupChart.groupId} p="sm" withBorder style={{ overflow: 'visible' }}>
                              <Title order={5} mb="sm" c="dimmed">Gruppe: {groupChart.groupName}</Title>
                              <ChartErrorBoundary>
                                <WeeklyChart chartData={groupChart.chartData} syncGroupKey={weeklySyncGroupKey} showRatioChart={false} />
                              </ChartErrorBoundary>
                            </Paper>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  )}
                </Paper>
              )}
            </Paper>

            <Paper ref={sectionRefs.midterm} withBorder p="md" className="analysis-flow-slide">
              <Title order={3} mb="xs">2. Langzeit-Fokus</Title>
              <Text size="sm" c="dimmed" mb="sm">Langzeitplanung mit den urspruenglichen Midterm-, Alters- und Verteilungsdiagrammen.</Text>
              <Group gap="xs" wrap="wrap" mb="sm">
                <Badge variant="light">Kinder Delta: {roundOne(historicalDelta.childrenPct)}%</Badge>
                <Badge variant="light">Buchungsstunden Delta: {roundOne(historicalDelta.bookingPct)}%</Badge>
                <Badge variant="light">Betreuungsstunden Delta: {roundOne(historicalDelta.carePct)}%</Badge>
              </Group>

              {chartToggles.includes('midterm') && (
                <Paper p="md" withBorder mb="md">
                  <Title order={4} mb="md" c="dimmed">Langzeit</Title>
                  <ChartErrorBoundary>
                    <MidtermChart hideFilters scenarioId={selectedScenarioId} />
                  </ChartErrorBoundary>
                </Paper>
              )}

              {chartToggles.includes('ageHistogram') && (
                <Paper p="md" withBorder mb="md">
                  <Title order={4} mb="md" c="dimmed">Alters-Histogramm</Title>
                  <Box h={{ base: 300, sm: 350, lg: 400 }}>
                    <ChartErrorBoundary>
                      <AgeHistogram />
                    </ChartErrorBoundary>
                  </Box>
                </Paper>
              )}

              {chartToggles.includes('histogram') && (
                <Paper p="md" withBorder>
                  <Title order={4} mb="md" c="dimmed">Buchungsverteilung</Title>
                  <Box h={{ base: 300, sm: 350, lg: 400 }}>
                    <ChartErrorBoundary>
                      <BookingHistogram />
                    </ChartErrorBoundary>
                  </Box>
                </Paper>
              )}
            </Paper>

            <Paper ref={sectionRefs.historical} withBorder p="md" className="analysis-flow-slide">
              <Title order={3} mb="xs">3. Historische Signale</Title>
              <Text size="sm" c="dimmed" mb="sm">Historische Entwicklung ist direkt in den Analysefluss integriert.</Text>
              <Paper p="md" withBorder>
                <Title order={4} mb="md" c="dimmed">Historische Entwicklung</Title>
                <Box h={{ base: 280, sm: 320 }}>
                  <HighchartsReact highcharts={Highcharts} options={historicalTrendOptions} containerProps={{ style: { height: '100%' } }} />
                </Box>
              </Paper>
            </Paper>

            <Paper ref={sectionRefs.transitions} withBorder p="md" className="analysis-flow-slide">
              <Title order={3} mb="xs">4. Gruppenuebergaenge</Title>
              <Text size="sm" c="dimmed" mb="sm">Wechselrichtungen und Buchungsdeltas aus dem bisherigen Statistikbereich.</Text>
              <Group gap="xs" wrap="wrap" mb="sm">
                <Badge color="blue" variant="light">Uebergaenge: {transitionMetrics.count}</Badge>
                <Badge color="cyan" variant="light">Ø Alter: {roundOne(transitionMetrics.averageAgeMonths)} Monate</Badge>
                <Badge color="teal" variant="light">Median Alter: {roundOne(transitionMetrics.medianAgeMonths)} Monate</Badge>
                <Badge color="orange" variant="light">Ø Delta: {roundOne(transitionMetrics.averageDeltaHours)} h</Badge>
                <Badge color="indigo" variant="light">Korridor: {roundOne(transitionMetrics.corridorRemainPct)}%</Badge>
              </Group>
              <Paper p="md" withBorder mb="md">
                <Title order={4} mb="md" c="dimmed">Uebergaenge nach Wechselrichtung</Title>
                <Box h={{ base: 260, sm: 300 }}>
                  <HighchartsReact highcharts={Highcharts} options={transitionRouteOptions} containerProps={{ style: { height: '100%' } }} />
                </Box>
              </Paper>
              <Paper p="md" withBorder>
                <Title order={4} mb="md" c="dimmed">Ø Delta Buchungszeit pro Richtung</Title>
                <Box h={{ base: 260, sm: 300 }}>
                  <HighchartsReact highcharts={Highcharts} options={transitionDeltaOptions} containerProps={{ style: { height: '100%' } }} />
                </Box>
              </Paper>
            </Paper>

            <Paper ref={sectionRefs.summary} withBorder p="md" className="analysis-flow-slide">
              <Title order={3} mb="xs">5. Priorisierung</Title>
              <Text size="sm" c="dimmed" mb="sm">Automatisch priorisierte Alerts und Massnahmen.</Text>
              {insights.topAlerts.length === 0 ? (
                <Paper withBorder p="md">
                  <Text fw={600}>Keine kritischen Alerts</Text>
                  <Text size="sm" c="dimmed">Aktuell liegt kein priorisiertes Handlungsfeld vor.</Text>
                </Paper>
              ) : (
                <Stack gap="sm">
                  {insights.topAlerts.map((alert) => (
                    <Paper key={alert.id} withBorder p="md">
                      <Group justify="space-between" mb={4}>
                        <Text fw={600}>{alert.title}</Text>
                        <Badge color={severityColor(alert.severity)} variant="light">{alert.severity.toUpperCase()}</Badge>
                      </Group>
                      <Text size="sm">{alert.statement}</Text>
                      <Text size="sm" c="dimmed" mt="xs">Massnahme ({alert.measureId}): {alert.measure}</Text>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        </Stack>
      </Paper>

      {chartToggles.length === 0 && (
        <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
          <Text size="lg" fw={500} c="dimmed">Keine Charts ausgewaehlt</Text>
          <Text size="sm" c="dimmed">Waehlen Sie mindestens einen Chart aus, um Daten anzuzeigen.</Text>
        </Paper>
      )}
    </Stack>
  );
}

export default VisuView;
