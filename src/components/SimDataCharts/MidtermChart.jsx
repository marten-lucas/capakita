import React, { useCallback, useMemo, useRef } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, Card, Group, Paper, SimpleGrid, Stack, Text, Title, useMantineTheme } from '@mantine/core';
import { useSelector } from 'react-redux';
import { createColoredYAxis } from '../../utils/highchartsAxis';
import { selectMidtermChartData } from '../../store/chartSelectors';

export default function MidtermChart() {
  const theme = useMantineTheme();
  const chartRefs = useRef([]);
  const syncInProgress = useRef(false);

  const demandColor = theme.colors.blue[6];
  const capacityPedagogicalColor = theme.colors.green[6];
  const capacityAdministrativeColor = theme.colors.violet[6];
  const expertRatioColor = theme.colors.orange[6];
  const financeIncomeColor = theme.colors.teal[6];
  const financeExpenseColor = theme.colors.gray[7];
  const financeNetColor = theme.colors.lime[7];
  const eventColor = theme.colors.red[6];

  const chartData = useSelector(selectMidtermChartData);

  const formatCurrency = (value) => new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

  const syncXExtremes = useCallback(function syncXExtremes(event) {
    if (event?.trigger === 'syncExtremes' || syncInProgress.current) return;

    const sourceChart = this.chart;
    syncInProgress.current = true;

    chartRefs.current.forEach((chart) => {
      if (!chart || chart === sourceChart) return;
      chart.xAxis[0].setExtremes(event.min, event.max, false, false, { trigger: 'syncExtremes' });
    });

    chartRefs.current.forEach((chart) => chart?.redraw());
    syncInProgress.current = false;
  }, []);

  const registerChartRef = useCallback((chart, index) => {
    if (chart && chart.series) {
      chartRefs.current[index] = chart;
    }
  }, []);

  // Suppress Highcharts errors related to race conditions during series updates
  const handleChartError = useCallback((error) => {
    if (error?.message?.includes('removePoint') || error?.message?.includes('Cannot read properties')) {
      // These errors occur during rapid category/data updates - safe to ignore
      return true;
    }
    return false;
  }, []);

  const buildXAxis = useCallback((showLabels, showTitle) => {
    const categories = chartData.categories || [];
    return {
      categories,
      title: { text: showTitle ? 'Zeitraum' : null },
      labels: showLabels ? {} : { enabled: false },
      crosshair: true,
      events: {
        afterSetExtremes: syncXExtremes,
      },
    };
  }, [chartData.categories, syncXExtremes]);

  const formatSeriesValue = useCallback((point) => {
    const value = Number(point?.y || 0);
    const format = point?.series?.userOptions?.custom?.format || 'number';
    const decimals = point?.series?.userOptions?.custom?.decimals ?? 0;
    const suffix = point?.series?.userOptions?.custom?.suffix || '';

    if (format === 'currency') {
      return formatCurrency(value);
    }

    return `${value.toFixed(decimals).replace('.', ',')}${suffix}`;
  }, []);

  const buildSharedTooltip = useCallback((points, category) => {
    const lines = (points || []).map((point) => {
      if (!point?.series?.name || point.series.name === 'Timeline') {
        return null;
      }

      return `<span style="color:${point.color}">●</span> ${point.series.name}: <b>${formatSeriesValue(point)}</b>`;
    }).filter(Boolean);

    return [`<b>${category}</b>`, ...lines].join('<br/>');
  }, [formatSeriesValue]);

  const maxHours = Math.max(Number(chartData.maxdemand) || 0, Number(chartData.maxcapacity) || 0) || null;

  const demandCapacityOptions = useMemo(() => ({
    chart: { type: 'line', zoomType: 'xy', resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' } },
    title: { text: null },
    xAxis: buildXAxis(false, false),
    yAxis: [
      createColoredYAxis({
        title: 'Stunden',
        color: demandColor,
        min: 0,
        max: maxHours,
        opposite: false,
        gridLineWidth: 1,
      }),
    ],
    series: [
      {
        name: 'Bedarf',
        type: 'area',
        data: chartData.demand || [],
        color: demandColor,
        fillOpacity: 0.35,
        marker: { enabled: false },
        custom: { decimals: 0, suffix: ' h' },
      },
      {
        name: 'Kapazität (pädagogisch)',
        type: 'column',
        data: chartData.capacity_pedagogical || [],
        color: capacityPedagogicalColor,
        stacking: 'normal',
        marker: { enabled: false },
        custom: { decimals: 0, suffix: ' h' },
      },
      {
        name: 'Kapazität (administrativ)',
        type: 'column',
        data: chartData.capacity_administrative || [],
        color: capacityAdministrativeColor,
        stacking: 'normal',
        marker: { enabled: false },
        custom: { decimals: 0, suffix: ' h' },
      },
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function formatter() {
        const category = this.points?.[0]?.category || this.x;
        return buildSharedTooltip(this.points, category);
      },
    },
  }), [
    chartData,
    buildSharedTooltip,
    buildXAxis,
    demandColor,
    capacityPedagogicalColor,
    capacityAdministrativeColor,
    maxHours,
  ]);

  const ratioFinanceOptions = useMemo(() => ({
    chart: { type: 'line', zoomType: 'xy', resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' } },
    title: { text: null },
    xAxis: buildXAxis(false, false),
    yAxis: [
      createColoredYAxis({
        title: 'Fachkraftquote (%)',
        color: expertRatioColor,
        min: 0,
        max: chartData.maxexpert_ratio || 100,
        tickInterval: 10,
        opposite: false,
        gridLineWidth: 1,
      }),
      createColoredYAxis({
        title: 'Finanzen (EUR)',
        color: financeIncomeColor,
        min: chartData.net_total?.some((value) => value < 0) ? undefined : 0,
        max: chartData.maxfinance || null,
        opposite: true,
        gridLineWidth: 0,
      }),
    ],
    series: [
      {
        name: 'Fachkraftquote',
        type: 'line',
        data: chartData.expert_ratio || [],
        yAxis: 0,
        color: expertRatioColor,
        marker: { enabled: false },
        custom: { decimals: 1, suffix: ' %' },
      },
      {
        name: 'Einnahmen',
        type: 'line',
        data: chartData.income_total || [],
        yAxis: 1,
        color: financeIncomeColor,
        lineWidth: 2,
        marker: { enabled: false },
        custom: { format: 'currency' },
      },
      {
        name: 'Ausgaben',
        type: 'line',
        data: chartData.expenses_total || [],
        yAxis: 1,
        color: financeExpenseColor,
        lineWidth: 2,
        marker: { enabled: false },
        custom: { format: 'currency' },
      },
      {
        name: 'Saldo',
        type: 'line',
        data: chartData.net_total || [],
        yAxis: 1,
        color: financeNetColor,
        dashStyle: 'ShortDash',
        lineWidth: 2,
        marker: { enabled: false },
        custom: { format: 'currency' },
      },
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function formatter() {
        const category = this.points?.[0]?.category || this.x;
        return buildSharedTooltip(this.points, category);
      },
    },
  }), [
    chartData,
    buildSharedTooltip,
    buildXAxis,
    financeIncomeColor,
    financeExpenseColor,
    financeNetColor,
  ]);

  const eventTimelineOptions = useMemo(() => ({
    chart: { type: 'line', zoomType: 'x', resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' } },
    title: { text: null },
    xAxis: buildXAxis(true, true),
    yAxis: {
      min: -1,
      max: 1,
      visible: false,
      title: { text: null },
    },
    series: [
      {
        id: 'timeline-anchor',
        name: 'Timeline',
        type: 'line',
        data: (chartData.categories || []).map(() => 0),
        color: 'transparent',
        lineWidth: 0,
        marker: { enabled: false },
        enableMouseTracking: false,
        showInLegend: false,
      },
      ...(chartData.flags && chartData.flags.length > 0
        ? [{
            type: 'flags',
            name: 'Ereignisse',
            data: (chartData.flags || []).map((flag) => ({ x: flag.x, title: flag.title, text: flag.text })),
            onSeries: 'timeline-anchor',
            shape: 'flag',
            width: 18,
            color: eventColor,
            fillColor: eventColor,
            allowOverlapX: true,
            y: -24,
          }]
        : []),
    ],
    legend: { enabled: false },
    tooltip: {
      useHTML: true,
      formatter: function formatter() {
        if (!this.point || this.series.type !== 'flags') {
          return false;
        }

        return `<b>${this.x}</b><br/>${this.point.text || ''}`;
      },
    },
  }), [buildXAxis, chartData.categories, chartData.flags, eventColor]);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed" mb={4}>Durchschnittlicher Betreuungsschluessel</Text>
          <Group justify="space-between" align="flex-end">
            <Text fw={700} size="xl">{(chartData.financeKpis?.averageCareRatioWeek || 0).toFixed(1)}</Text>
            <Text size="sm" c="dimmed">Stichtagswoche</Text>
          </Group>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed" mb={4}>Personalkosten pro betreutem Kind</Text>
          <Group justify="space-between" align="flex-end">
            <Text fw={700} size="xl">{formatCurrency(chartData.financeKpis?.personnelCostPerChild || 0)}</Text>
            <Text size="sm" c="dimmed">{chartData.financeKpis?.activeChildrenWithBookings || 0} Kinder</Text>
          </Group>
        </Card>
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="sm">Bedarf und Kapazität</Title>
        <Box h={320} data-testid="midterm-demand-capacity-chart">
          <HighchartsReact
            key={`demand-capacity-${(chartData.categories || []).length}`}
            highcharts={Highcharts}
            options={demandCapacityOptions}
            callback={(chart) => registerChartRef(chart, 0)}
            containerProps={{ style: { height: '100%' } }}
          />
        </Box>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="sm">Fachkraftquote und Finanzen</Title>
        <Box h={320} data-testid="midterm-ratio-finance-chart">
          <HighchartsReact
            key={`ratio-finance-${(chartData.categories || []).length}`}
            highcharts={Highcharts}
            options={ratioFinanceOptions}
            callback={(chart) => registerChartRef(chart, 1)}
            containerProps={{ style: { height: '100%' } }}
          />
        </Box>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="sm">Ereignisse</Title>
        <Box h={180} data-testid="midterm-event-timeline-chart">
          <HighchartsReact
            key={`event-timeline-${(chartData.categories || []).length}`}
            highcharts={Highcharts}
            options={eventTimelineOptions}
            callback={(chart) => registerChartRef(chart, 2)}
            containerProps={{ style: { height: '100%' } }}
          />
        </Box>
      </Paper>
    </Stack>
  );
}


