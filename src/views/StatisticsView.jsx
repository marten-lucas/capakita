import React from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import {
  Alert,
  Badge,
  Box,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useSelector } from 'react-redux';
import { selectGroupTransitionStatistics, selectHistoricalStatistics } from '../store/statisticsSelectors';
import { selectSelectedScenario } from '../store/simScenarioSlice';

function parseIsoDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsAgo(baseDate, months) {
  return new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - months, baseDate.getUTCDate()));
}

function roundTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function average(values) {
  if (!values.length) return 0;
  return roundTwo(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return roundTwo((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function buildHistogram(ages) {
  const map = new Map();

  ages.forEach((age) => {
    if (!Number.isFinite(age) || age < 0) return;
    const start = Math.floor(age / 3) * 3;
    const end = start + 2;
    const key = `${start}-${end}`;
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([range, count]) => {
      const [start, end] = range.split('-').map(Number);
      return {
        key: range,
        label: `${start}-${end} Monate`,
        start,
        end,
        count,
      };
    })
    .sort((a, b) => a.start - b.start);
}

function buildRouteCounts(transitions) {
  const map = new Map();
  transitions.forEach((transition) => {
    const label = `${transition.fromGroupName} -> ${transition.toGroupName}`;
    map.set(label, (map.get(label) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildRouteDelta(transitions) {
  const map = new Map();
  transitions.forEach((transition) => {
    const label = `${transition.fromGroupName} -> ${transition.toGroupName}`;
    if (!map.has(label)) {
      map.set(label, { sum: 0, count: 0 });
    }
    const current = map.get(label);
    current.sum += Number(transition.deltaHours || 0);
    current.count += 1;
  });

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, avgDelta: value.count ? roundTwo(value.sum / value.count) : 0 }))
    .sort((a, b) => Math.abs(b.avgDelta) - Math.abs(a.avgDelta));
}

function shortenRouteLabel(label, maxLength = 22) {
  if (typeof label !== 'string') return '';
  return label.length <= maxLength ? label : `${label.slice(0, maxLength - 1)}…`;
}

function StatisticsView() {
  const theme = useMantineTheme();
  const isTestEnvironment = import.meta.env.MODE === 'test';
  const [aggregation, setAggregation] = React.useState('month');
  const [timeframe, setTimeframe] = React.useState('all');
  const [fromGroupFilter, setFromGroupFilter] = React.useState('all');
  const [toGroupFilter, setToGroupFilter] = React.useState('all');

  const statistics = useSelector((state) =>
    selectHistoricalStatistics(state, {
      aggregation,
      asOfDate: new Date().toISOString().slice(0, 10),
    })
  );
  const transitionStatistics = useSelector((state) =>
    selectGroupTransitionStatistics(state, {
      asOfDate: new Date().toISOString().slice(0, 10),
      windowDays: 90,
    })
  );
  const selectedScenario = useSelector(selectSelectedScenario);

  const latest = statistics.buckets[statistics.buckets.length - 1] || null;
  const statisticsBinding = selectedScenario?.autoEventSettings?.statisticsBinding || null;
  const asOfDate = React.useMemo(() => parseIsoDate(transitionStatistics.asOfDate), [transitionStatistics.asOfDate]);

  const fromGroupOptions = React.useMemo(() => {
    const unique = new Map();
    transitionStatistics.transitions.forEach((transition) => {
      unique.set(transition.fromGroupId, transition.fromGroupName);
    });
    return [
      { value: 'all', label: 'Alle Von-Gruppen' },
      ...Array.from(unique.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'de')),
    ];
  }, [transitionStatistics.transitions]);

  const toGroupOptions = React.useMemo(() => {
    const unique = new Map();
    transitionStatistics.transitions.forEach((transition) => {
      unique.set(transition.toGroupId, transition.toGroupName);
    });
    return [
      { value: 'all', label: 'Alle Zu-Gruppen' },
      ...Array.from(unique.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'de')),
    ];
  }, [transitionStatistics.transitions]);

  const filteredTransitions = React.useMemo(() => {
    const cutoffDate = (() => {
      if (!asOfDate || timeframe === 'all') return null;
      if (timeframe === 'last12') return monthsAgo(asOfDate, 12);
      if (timeframe === 'last24') return monthsAgo(asOfDate, 24);
      return null;
    })();

    return transitionStatistics.transitions.filter((transition) => {
      if (fromGroupFilter !== 'all' && transition.fromGroupId !== fromGroupFilter) return false;
      if (toGroupFilter !== 'all' && transition.toGroupId !== toGroupFilter) return false;
      if (!cutoffDate) return true;

      const transitionDate = parseIsoDate(transition.date);
      if (!transitionDate) return false;
      return transitionDate >= cutoffDate;
    });
  }, [asOfDate, timeframe, fromGroupFilter, toGroupFilter, transitionStatistics.transitions]);

  const filteredSummary = React.useMemo(() => {
    const ages = filteredTransitions.map((entry) => entry.ageMonths).filter((value) => Number.isFinite(value));
    const before = filteredTransitions.map((entry) => entry.beforeHours);
    const after = filteredTransitions.map((entry) => entry.afterHours);
    const delta = filteredTransitions.map((entry) => entry.deltaHours);

    return {
      count: filteredTransitions.length,
      averageAgeMonths: average(ages),
      medianAgeMonths: median(ages),
      averageBeforeHours: average(before),
      averageAfterHours: average(after),
      averageDeltaHours: average(delta),
    };
  }, [filteredTransitions]);

  const filteredHistogram = React.useMemo(
    () => buildHistogram(filteredTransitions.map((entry) => entry.ageMonths)),
    [filteredTransitions]
  );
  const historicalCategories = React.useMemo(
    () => statistics.buckets.map((bucket) => bucket.label),
    [statistics.buckets]
  );
  const routeCounts = React.useMemo(() => buildRouteCounts(filteredTransitions), [filteredTransitions]);
  const routeDelta = React.useMemo(() => buildRouteDelta(filteredTransitions), [filteredTransitions]);

  const chartPalette = React.useMemo(
    () => ({
      children: theme.colors.blue[6],
      bookingHours: theme.colors.teal[6],
      careHours: theme.colors.orange[6],
      transitionsCount: theme.colors.indigo[6],
      deltaHours: theme.colors.cyan[6],
      baseline: theme.colors.gray[5],
      axisLine: theme.colors.gray[4],
    }),
    [theme.colors]
  );

  const historicalOptions = React.useMemo(
    () => ({
      chart: {
        type: 'line',
        height: 320,
      },
      title: { text: null },
      credits: { enabled: false },
      colors: [chartPalette.children, chartPalette.bookingHours, chartPalette.careHours],
      xAxis: {
        categories: historicalCategories,
        lineColor: chartPalette.axisLine,
      },
      yAxis: [
        {
          title: { text: 'Kinder' },
          allowDecimals: false,
          min: 0,
        },
        {
          title: { text: 'Stunden/Woche' },
          opposite: true,
          min: 0,
        },
      ],
      tooltip: {
        shared: true,
      },
      series: [
        {
          name: 'Kinder',
          data: statistics.buckets.map((bucket) => bucket.childrenCount),
          color: chartPalette.children,
          yAxis: 0,
        },
        {
          name: 'Buchungsstunden',
          data: statistics.buckets.map((bucket) => bucket.bookingHours),
          color: chartPalette.bookingHours,
          yAxis: 1,
        },
        {
          name: 'Betreuungsstunden',
          data: statistics.buckets.map((bucket) => bucket.careHours),
          color: chartPalette.careHours,
          yAxis: 1,
        },
      ],
    }),
    [chartPalette, historicalCategories, statistics.buckets]
  );

  const histogramOptions = React.useMemo(
    () => ({
      chart: {
        type: 'column',
        height: 260,
        spacingTop: 8,
        spacingRight: 12,
        spacingBottom: 8,
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      colors: [chartPalette.transitionsCount],
      xAxis: {
        categories: filteredHistogram.map((bucket) => bucket.label),
        title: { text: 'Alter beim Übergang' },
        lineColor: chartPalette.axisLine,
      },
      yAxis: {
        title: { text: 'Anzahl Übergänge' },
        allowDecimals: false,
        min: 0,
      },
      tooltip: {
        pointFormat: '<b>{point.y}</b> Übergänge',
      },
      plotOptions: {
        series: {
          borderRadius: 4,
        },
      },
      series: [
        {
          name: 'Übergänge',
          data: filteredHistogram.map((bucket) => bucket.count),
          color: chartPalette.transitionsCount,
        },
      ],
    }),
    [chartPalette, filteredHistogram]
  );

  const routeCountOptions = React.useMemo(
    () => ({
      chart: {
        type: 'column',
        height: 260,
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      colors: [chartPalette.transitionsCount],
      xAxis: {
        categories: routeCounts.map((route) => route.label),
        labels: {
          rotation: -25,
          formatter() {
            return shortenRouteLabel(this.value);
          },
        },
      },
      yAxis: {
        title: { text: 'Anzahl Übergänge' },
        allowDecimals: false,
        min: 0,
      },
      tooltip: {
        formatter() {
          return `<b>${this.key}</b><br/>Anzahl: <b>${this.y}</b>`;
        },
      },
      plotOptions: {
        series: {
          borderRadius: 4,
          dataLabels: {
            enabled: true,
          },
        },
      },
      series: [
        {
          name: 'Übergänge',
          data: routeCounts.map((route) => route.count),
          color: chartPalette.transitionsCount,
        },
      ],
    }),
    [chartPalette, routeCounts]
  );

  const routeDeltaOptions = React.useMemo(
    () => ({
      chart: {
        type: 'bar',
        height: 260,
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      colors: [chartPalette.deltaHours],
      xAxis: {
        categories: routeDelta.map((route) => route.label),
        labels: {
          formatter() {
            return shortenRouteLabel(this.value);
          },
        },
      },
      yAxis: {
        title: { text: 'Ø Delta Buchungszeit (h/Woche)' },
        plotLines: [
          {
            value: 0,
            width: 1,
            color: chartPalette.baseline,
            zIndex: 3,
          },
        ],
      },
      tooltip: {
        formatter() {
          return `<b>${this.key}</b><br/>Ø Delta: <b>${roundTwo(this.y)}</b> h/Woche`;
        },
      },
      plotOptions: {
        series: {
          borderRadius: 4,
          dataLabels: {
            enabled: true,
            formatter() {
              return `${roundTwo(this.y)} h`;
            },
          },
        },
      },
      series: [
        {
          name: 'Ø Delta',
          data: routeDelta.map((route) => route.avgDelta),
          color: chartPalette.deltaHours,
        },
      ],
    }),
    [chartPalette, routeDelta]
  );

  return (
    <Paper withBorder p="md" data-testid="statistics-view">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="xl" fw={700}>Statistik</Text>
          <SegmentedControl
            value={aggregation}
            onChange={setAggregation}
            data={[
              { label: 'Monat', value: 'month' },
              { label: 'Quartal', value: 'quarter' },
              { label: 'Jahr', value: 'year' },
            ]}
            data-testid="statistics-aggregation"
          />
        </Group>
        <Text c="dimmed">
          Diese Seite zeigt historische Kennzahlen auf Basis importierter Adebis-Daten.
        </Text>
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          Historische Buckets und Gruppenübergänge basieren direkt auf importierten Daten.
        </Alert>

        {statisticsBinding?.snapshot && (
          <Alert icon={<IconInfoCircle size={16} />} color="teal" variant="light" data-testid="statistics-auto-event-binding">
            <Stack gap={4}>
              <Text fw={600}>Belegte Auto-Event-Werte aus Optionen</Text>
              <Text size="sm">
                Krippe → Kita: {statisticsBinding.snapshot.kita?.ageYears ?? 'n/a'} Jahre, Delta {statisticsBinding.snapshot.kita?.bookingDeltaHours ?? 'n/a'} h/Woche
              </Text>
              <Text size="sm">
                Kita → Schulkind: {statisticsBinding.snapshot.school?.ageYears ?? 'n/a'} Jahre, Delta {statisticsBinding.snapshot.school?.bookingDeltaHours ?? 'n/a'} h/Woche
              </Text>
              <Text size="xs" c="dimmed">
                Stand: {String(statisticsBinding.appliedAt || '').slice(0, 10)}
              </Text>
            </Stack>
          </Alert>
        )}

        {latest && (
          <Group gap="md" wrap="wrap" data-testid="statistics-latest-kpis">
            <Badge variant="light" size="lg">Kinder: {latest.childrenCount}</Badge>
            <Badge variant="light" size="lg">Buchungsstunden: {latest.bookingHours}</Badge>
            <Badge variant="light" size="lg">Betreuungsstunden: {latest.careHours}</Badge>
          </Group>
        )}

        <Paper withBorder p="sm" data-testid="statistics-historical-chart-shell">
          <Text size="sm" fw={600} mb="xs">Historische Entwicklung</Text>
          {statistics.buckets.length === 0 ? (
            <Text size="sm" c="dimmed">Keine historischen Daten vorhanden.</Text>
          ) : isTestEnvironment ? (
            <Box data-testid="statistics-historical-chart" style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {statistics.buckets.map((bucket) => (
                <Badge key={bucket.key} variant="light">
                  {bucket.label}: K {bucket.childrenCount} | B {bucket.bookingHours} | Bt {bucket.careHours}
                </Badge>
              ))}
            </Box>
          ) : (
            <Box h={320} data-testid="statistics-historical-chart" style={{ width: '100%' }}>
              <HighchartsReact
                highcharts={Highcharts}
                options={historicalOptions}
                containerProps={{ style: { height: '100%', width: '100%' } }}
              />
            </Box>
          )}
        </Paper>

        <Text size="lg" fw={700} mt="md">Gruppenübergänge</Text>

        <Group grow align="flex-end" data-testid="statistics-transition-filters">
          <SegmentedControl
            value={timeframe}
            onChange={setTimeframe}
            data={[
              { label: 'Gesamt', value: 'all' },
              { label: 'Letzte 12M', value: 'last12' },
              { label: 'Letzte 24M', value: 'last24' },
            ]}
            data-testid="statistics-transition-timeframe"
          />
          <Select
            label="Von Gruppe"
            data={fromGroupOptions}
            value={fromGroupFilter}
            onChange={(value) => setFromGroupFilter(value || 'all')}
            allowDeselect={false}
            data-testid="statistics-transition-from-group"
          />
          <Select
            label="Zu Gruppe"
            data={toGroupOptions}
            value={toGroupFilter}
            onChange={(value) => setToGroupFilter(value || 'all')}
            allowDeselect={false}
            data-testid="statistics-transition-to-group"
          />
        </Group>

        <Group gap="md" wrap="wrap" data-testid="statistics-transition-kpis">
          <Badge variant="light" size="lg">Übergänge: {filteredSummary.count}</Badge>
          <Badge variant="light" size="lg">Ø Alter: {filteredSummary.averageAgeMonths} Monate</Badge>
          <Badge variant="light" size="lg">Median Alter: {filteredSummary.medianAgeMonths} Monate</Badge>
          <Badge variant="light" size="lg">Ø Vorher: {filteredSummary.averageBeforeHours} h</Badge>
          <Badge variant="light" size="lg">Ø Nachher: {filteredSummary.averageAfterHours} h</Badge>
          <Badge variant="light" size="lg">Ø Delta Buchungszeit: {filteredSummary.averageDeltaHours} h</Badge>
        </Group>

        <Paper withBorder p="sm" data-testid="statistics-transition-histogram-shell">
          <Text size="sm" fw={600} mb="xs">Histogramm: Alter beim Gruppenübergang</Text>
          {filteredHistogram.length === 0 ? (
            <Text size="sm" c="dimmed">Keine Daten für das Histogramm verfügbar.</Text>
          ) : isTestEnvironment ? (
            <Box data-testid="statistics-transition-histogram" style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {filteredHistogram.map((bucket) => (
                <Badge key={bucket.key} variant="light">{bucket.label}: {bucket.count}</Badge>
              ))}
            </Box>
          ) : (
            <Box h={260} data-testid="statistics-transition-histogram" style={{ width: '100%' }}>
              <HighchartsReact
                highcharts={Highcharts}
                options={histogramOptions}
                containerProps={{ style: { height: '100%', width: '100%' } }}
              />
            </Box>
          )}
        </Paper>

        <Group grow align="stretch">
          <Paper withBorder p="sm" data-testid="statistics-transition-routes-shell">
            <Text size="sm" fw={600} mb="xs">Übergänge nach Wechselrichtung</Text>
            {routeCounts.length === 0 ? (
              <Text size="sm" c="dimmed">Keine Daten für Wechselrichtungen verfügbar.</Text>
            ) : isTestEnvironment ? (
              <Box data-testid="statistics-transition-routes-chart" style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                {routeCounts.map((route) => (
                  <Badge key={route.label} variant="light">{route.label}: {route.count}</Badge>
                ))}
              </Box>
            ) : (
              <Box h={260} data-testid="statistics-transition-routes-chart" style={{ width: '100%' }}>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={routeCountOptions}
                  containerProps={{ style: { height: '100%', width: '100%' } }}
                />
              </Box>
            )}
          </Paper>

          <Paper withBorder p="sm" data-testid="statistics-transition-delta-shell">
            <Text size="sm" fw={600} mb="xs">Ø Delta Buchungszeit nach Wechselrichtung</Text>
            {routeDelta.length === 0 ? (
              <Text size="sm" c="dimmed">Keine Delta-Daten verfügbar.</Text>
            ) : isTestEnvironment ? (
              <Box data-testid="statistics-transition-delta-chart" style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                {routeDelta.map((route) => (
                  <Badge key={route.label} variant="light">{route.label}: {route.avgDelta} h</Badge>
                ))}
              </Box>
            ) : (
              <Box h={260} data-testid="statistics-transition-delta-chart" style={{ width: '100%' }}>
                <HighchartsReact
                  highcharts={Highcharts}
                  options={routeDeltaOptions}
                  containerProps={{ style: { height: '100%', width: '100%' } }}
                />
              </Box>
            )}
          </Paper>
        </Group>
      </Stack>
    </Paper>
  );
}

export default StatisticsView;
