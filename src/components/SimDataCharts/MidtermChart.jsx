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
  const careRatioColor = theme.colors.red[6];
  const expertRatioColor = theme.colors.orange[6];
  const financeIncomeColor = theme.colors.teal[6];
  const financeExpenseColor = theme.colors.gray[7];
  const financeNetColor = theme.colors.lime[7];
  const childCountColor = theme.colors.cyan[6];
  const employeeCountColor = theme.colors.indigo[6];
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
    if (chart && chart.xAxis?.[0]) {
      chartRefs.current[index] = chart;
    }
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

  const timelineData = useMemo(() => {
    const groupedEvents = new Map();

    (chartData.flags || []).forEach((flag) => {
      const category = chartData.categories?.[flag.x];
      if (!category) return;

      if (!groupedEvents.has(category)) {
        groupedEvents.set(category, {
          x: flag.x,
          descriptions: [],
        });
      }

      groupedEvents.get(category).descriptions.push(flag.text);
    });

    return Array.from(groupedEvents.entries())
      .map(([category, entry]) => ({
        x: entry.x,
        name: category,
        label: `${category}: ${entry.descriptions.length} Ereignis${entry.descriptions.length === 1 ? '' : 'se'}`,
        description: entry.descriptions.join('<br/>'),
      }))
      .sort((left, right) => left.x - right.x);
  }, [chartData.categories, chartData.flags]);

  const maxDemandHours = Number(chartData.maxdemand) || null;
  const maxCapacityHours = Number(chartData.maxcapacity) || null;

  const demandCapacityOptions = useMemo(() => ({
    chart: {
      type: 'line',
      zoomType: 'xy',
      resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' },
    },
    title: { text: null },
    xAxis: buildXAxis(true, true),
    yAxis: [
      createColoredYAxis({
        title: 'Bedarf (Stunden)',
        color: demandColor,
        min: 0,
        max: maxDemandHours,
        opposite: false,
        gridLineWidth: 1,
      }),
      createColoredYAxis({
        title: 'Kapazität (Stunden)',
        color: capacityPedagogicalColor,
        min: 0,
        max: maxCapacityHours,
        opposite: true,
        gridLineWidth: 0,
      }),
    ],
    series: [
      {
        name: 'Bedarf',
        type: 'area',
        data: chartData.demand || [],
        yAxis: 0,
        color: demandColor,
        fillOpacity: 0.35,
        marker: { enabled: false },
        custom: { decimals: 0, suffix: ' h' },
      },
      {
        name: 'Kapazität (pädagogisch)',
        type: 'column',
        data: chartData.capacity_pedagogical || [],
        yAxis: 1,
        color: capacityPedagogicalColor,
        stacking: 'normal',
        marker: { enabled: false },
        custom: { decimals: 0, suffix: ' h' },
      },
      {
        name: 'Kapazität (administrativ)',
        type: 'column',
        data: chartData.capacity_administrative || [],
        yAxis: 1,
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
    buildSharedTooltip,
    buildXAxis,
    capacityAdministrativeColor,
    capacityPedagogicalColor,
    chartData.capacity_administrative,
    chartData.capacity_pedagogical,
    chartData.demand,
    demandColor,
    maxCapacityHours,
    maxDemandHours,
  ]);

  const ratioFinanceOptions = useMemo(() => ({
    chart: {
      type: 'line',
      zoomType: 'xy',
      resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' },
    },
    title: { text: null },
    xAxis: buildXAxis(true, true),
    yAxis: [
      createColoredYAxis({
        title: 'Betreuungsschlüssel',
        color: careRatioColor,
        min: 0,
        max: chartData.max_care_ratio || null,
        opposite: false,
        gridLineWidth: 1,
      }),
      createColoredYAxis({
        title: 'Fachkraftquote (%)',
        color: expertRatioColor,
        min: 0,
        max: chartData.maxexpert_ratio || 100,
        tickInterval: 10,
        opposite: true,
        offset: 70,
        gridLineWidth: 0,
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
        name: 'Betreuungsschlüssel',
        type: 'line',
        data: chartData.care_ratio || [],
        yAxis: 0,
        color: careRatioColor,
        marker: { enabled: false },
        custom: { decimals: 1 },
      },
      {
        name: 'Fachkraftquote',
        type: 'line',
        data: chartData.expert_ratio || [],
        yAxis: 1,
        color: expertRatioColor,
        marker: { enabled: false },
        custom: { decimals: 1, suffix: ' %' },
      },
      {
        name: 'Einnahmen',
        type: 'line',
        data: chartData.income_total || [],
        yAxis: 2,
        color: financeIncomeColor,
        lineWidth: 2,
        marker: { enabled: false },
        custom: { format: 'currency' },
      },
      {
        name: 'Ausgaben',
        type: 'line',
        data: chartData.expenses_total || [],
        yAxis: 2,
        color: financeExpenseColor,
        lineWidth: 2,
        marker: { enabled: false },
        custom: { format: 'currency' },
      },
      {
        name: 'Saldo',
        type: 'line',
        data: chartData.net_total || [],
        yAxis: 2,
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
    buildSharedTooltip,
    buildXAxis,
    careRatioColor,
    chartData.care_ratio,
    chartData.expenses_total,
    chartData.expert_ratio,
    chartData.income_total,
    chartData.max_care_ratio,
    chartData.maxexpert_ratio,
    chartData.maxfinance,
    chartData.net_total,
    expertRatioColor,
    financeExpenseColor,
    financeIncomeColor,
    financeNetColor,
  ]);

  const countOptions = useMemo(() => ({
    children: {
      chart: {
        type: 'column',
        zoomType: 'x',
        resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' },
      },
      title: { text: null },
      xAxis: buildXAxis(false, false),
      yAxis: [
        createColoredYAxis({
          title: 'Kinder',
          color: childCountColor,
          min: 0,
          max: chartData.maxchildcount || null,
          opposite: false,
          gridLineWidth: 1,
          allowDecimals: false,
        }),
      ],
      plotOptions: {
        column: {
          stacking: 'normal',
          borderWidth: 0,
          groupPadding: 0.12,
          pointPadding: 0.04,
        },
      },
      series: (chartData.child_count_by_group || []).map((entry, index) => ({
        name: entry.name,
        type: 'column',
        stack: 'children',
        data: entry.data || [],
        color: Highcharts.color(childCountColor).brighten(index * 0.12 - 0.18).get(),
        custom: { decimals: 0 },
      })),
      legend: { align: 'center', verticalAlign: 'bottom' },
      tooltip: {
        shared: true,
        useHTML: true,
        formatter: function formatter() {
          const category = this.points?.[0]?.category || this.x;
          return buildSharedTooltip(this.points, category);
        },
      },
    },
    employees: {
      chart: {
        type: 'column',
        zoomType: 'x',
        resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' },
      },
      title: { text: null },
      xAxis: buildXAxis(true, true),
      yAxis: [
        createColoredYAxis({
          title: 'Mitarbeiter',
          color: employeeCountColor,
          min: 0,
          max: chartData.maxemployeecount || null,
          opposite: false,
          gridLineWidth: 1,
          allowDecimals: false,
        }),
      ],
      plotOptions: {
        column: {
          stacking: 'normal',
          borderWidth: 0,
          groupPadding: 0.12,
          pointPadding: 0.04,
        },
      },
      series: (chartData.employee_count_by_group || []).map((entry, index) => ({
        name: entry.name,
        type: 'column',
        stack: 'employees',
        data: entry.data || [],
        color: Highcharts.color(employeeCountColor).brighten(index * 0.12 - 0.18).get(),
        custom: { decimals: 0 },
      })),
      legend: { align: 'center', verticalAlign: 'bottom' },
      tooltip: {
        shared: true,
        useHTML: true,
        formatter: function formatter() {
          const category = this.points?.[0]?.category || this.x;
          return buildSharedTooltip(this.points, category);
        },
      },
    },
  }), [
    buildSharedTooltip,
    buildXAxis,
    chartData.child_count_by_group,
    chartData.employee_count_by_group,
    chartData.maxchildcount,
    chartData.maxemployeecount,
    childCountColor,
    employeeCountColor,
  ]);

  const eventTimelineOptions = useMemo(() => ({
    chart: {
      type: 'timeline',
      zoomType: 'x',
      spacingLeft: 0,
      spacingRight: 0,
      resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' },
    },
    title: { text: null },
    xAxis: {
      ...buildXAxis(false, false),
      visible: false,
      minPadding: 0,
      maxPadding: 0,
      startOnTick: false,
      endOnTick: false,
    },
    yAxis: { visible: false, title: { text: null } },
    plotOptions: {
      timeline: {
        colorByPoint: false,
      },
    },
    series: [
      {
        name: 'Timeline',
        data: timelineData,
        color: eventColor,
        lineColor: eventColor,
        lineWidth: 3,
        marker: {
          symbol: 'circle',
        },
        dataLabels: {
          allowOverlap: false,
          connectorColor: theme.colors.gray[4],
          connectorWidth: 2,
          alternate: true,
          distance: 16,
          style: {
            textOutline: 'none',
          },
        },
      },
    ],
    legend: { enabled: false },
    tooltip: {
      useHTML: true,
      formatter: function formatter() {
        if (!this.point) {
          return false;
        }

        return `<b>${this.point.name || ''}</b><br/>${this.point.description || ''}`;
      },
    },
  }), [buildXAxis, eventColor, theme.colors.gray, timelineData]);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed" mb={4}>Durchschnittlicher Betreuungsschluessel</Text>
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Text fw={700} size="xl">{(chartData.financeKpis?.averageCareRatioWeek || 0).toFixed(1)}</Text>
            <Text size="sm" c="dimmed">Stichtagswoche</Text>
          </Group>
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text size="sm" c="dimmed" mb={4}>Personalkosten pro betreutem Kind</Text>
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Text fw={700} size="xl">{formatCurrency(chartData.financeKpis?.personnelCostPerChild || 0)}</Text>
            <Text size="sm" c="dimmed">{chartData.financeKpis?.activeChildrenWithBookings || 0} Kinder</Text>
          </Group>
        </Card>
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="sm">Bedarf und Kapazität</Title>
        <Box h={{ base: 260, sm: 320 }} data-testid="midterm-demand-capacity-chart">
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
        <Title order={5} mb="sm">Betreuungsschlüssel, Fachkraftquote und Finanzen</Title>
        <Box h={{ base: 260, sm: 320 }} data-testid="midterm-ratio-finance-chart">
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
        <Title order={5} mb="sm">Kinder und Mitarbeiter</Title>
        <Stack gap="md">
          <Box>
            <Text size="sm" c="dimmed" mb={6}>Kinder nach Gruppen</Text>
            <Box h={{ base: 220, sm: 250 }} data-testid="midterm-child-count-chart">
              <HighchartsReact
                key={`child-count-${(chartData.categories || []).length}`}
                highcharts={Highcharts}
                options={countOptions.children}
                callback={(chart) => registerChartRef(chart, 2)}
                containerProps={{ style: { height: '100%' } }}
              />
            </Box>
          </Box>
          <Box>
            <Text size="sm" c="dimmed" mb={6}>Mitarbeiter nach Gruppen</Text>
            <Box h={{ base: 220, sm: 250 }} data-testid="midterm-employee-count-chart">
              <HighchartsReact
                key={`employee-count-${(chartData.categories || []).length}`}
                highcharts={Highcharts}
                options={countOptions.employees}
                callback={(chart) => registerChartRef(chart, 3)}
                containerProps={{ style: { height: '100%' } }}
              />
            </Box>
          </Box>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="sm">Ereignisse</Title>
        <Box h={{ base: 260, sm: 320 }} data-testid="midterm-event-timeline-chart">
          <HighchartsReact
            key={`event-timeline-${timelineData.length}`}
            highcharts={Highcharts}
            options={eventTimelineOptions}
            callback={(chart) => registerChartRef(chart, 4)}
            containerProps={{ style: { height: '100%' } }}
          />
        </Box>
      </Paper>
    </Stack>
  );
}


