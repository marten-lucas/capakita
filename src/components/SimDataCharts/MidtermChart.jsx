import React, { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, Card, Group, SimpleGrid, Text, useMantineTheme } from '@mantine/core';
import { useSelector } from 'react-redux';
import { generateWeeklyChartTooltip } from '../../utils/chartUtils/chartUtilsWeekly';
import { createColoredYAxis } from '../../utils/highchartsAxis';
import { selectMidtermChartData } from '../../store/chartSelectors';

export default function MidtermChart() {
  const theme = useMantineTheme();

  const demandColor = theme.colors.blue[6];
  const capacityPedagogicalColor = theme.colors.green[6];
  const capacityAdministrativeColor = theme.colors.violet[6];
  const careRatioColor = theme.colors.red[6];
  const expertRatioColor = theme.colors.orange[6];
  const financeIncomeColor = theme.colors.teal[6];
  const financeExpenseColor = theme.colors.gray[7];
  const financeNetColor = theme.colors.lime[7];

  const chartData = useSelector(selectMidtermChartData);

  const formatCurrency = (value) => new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);


  // Chart options
  const midtermOptions = useMemo(() => ({
    chart: { type: 'column', zoomType: 'x' }, // <-- enable zoom
    title: { text: null },
    xAxis: {
      categories: chartData.categories,
      title: { text: 'Zeitraum' }
    },
    yAxis: [
      createColoredYAxis({
        title: 'Bedarf (Stunden)',
        color: demandColor,
        min: 0,
        max: chartData.maxdemand || null,
        tickInterval: null,
        opposite: false,
        gridLineWidth: 1
      }),
      createColoredYAxis({
        title: 'Kapazität (Stunden)',
        color: capacityPedagogicalColor,
        min: 0,
        max: chartData.maxcapacity || null,
        tickInterval: null,
        opposite: false,
        gridLineWidth: 1
      }),
      createColoredYAxis({
        title: 'Betreuungsschlüssel',
        color: careRatioColor,
        min: 0,
        max: chartData.max_care_ratio || null,
        tickInterval: null,
        opposite: true,
        gridLineWidth: 0
      }),
      createColoredYAxis({
        title: 'Fachkraftquote (%)',
        color: expertRatioColor,
        min: 0,
        max: chartData.maxexpert_ratio || 100,
        tickInterval: 10,
        opposite: true,
        gridLineWidth: 0
      }),
      createColoredYAxis({
        title: 'Finanzen (EUR)',
        color: financeIncomeColor,
        min: chartData.net_total?.some((value) => value < 0) ? undefined : 0,
        max: chartData.maxfinance || null,
        tickInterval: null,
        opposite: true,
        gridLineWidth: 0
      })
    ],
    series: [
      {
        name: 'Bedarf',
        type: 'area',
        data: chartData.demand || [],
        yAxis: 0,
        color: demandColor,
        fillOpacity: 0.6,
        marker: { enabled: false }
      },
      {
        name: 'Mitarbeiter (pädagogisch)',
        type: 'column',
        data: chartData.capacity_pedagogical || [],
        yAxis: 1,
        color: capacityPedagogicalColor,
        stacking: 'normal',
        marker: { enabled: false },
      },
      {
        name: 'Mitarbeiter (administrativ)',
        type: 'column',
        data: chartData.capacity_administrative || [],
        yAxis: 1,
        color: capacityAdministrativeColor,
        stacking: 'normal',
        marker: { enabled: false }
      },
      {
        name: 'Betreuungsschlüssel',
        type: 'line',
        data: chartData.care_ratio || [],
        yAxis: 2,
        color: careRatioColor,
        marker: { enabled: false }
      },
      {
        name: 'Fachkraftquote',
        type: 'line',
        data: chartData.expert_ratio || [],
        yAxis: 3,
        color: expertRatioColor,
        marker: { enabled: false }
      },
      {
        name: 'Einnahmen',
        type: 'line',
        data: chartData.income_total || [],
        yAxis: 4,
        color: financeIncomeColor,
        lineWidth: 2,
        marker: { enabled: false }
      },
      {
        name: 'Ausgaben',
        type: 'line',
        data: chartData.expenses_total || [],
        yAxis: 4,
        color: financeExpenseColor,
        lineWidth: 2,
        marker: { enabled: false }
      },
      {
        name: 'Saldo',
        type: 'line',
        data: chartData.net_total || [],
        yAxis: 4,
        color: financeNetColor,
        dashStyle: 'ShortDash',
        lineWidth: 2,
        marker: { enabled: false }
      }
      ,
      ...(chartData.flags && chartData.flags.length > 0 ? [{
        type: 'flags',
        name: 'Ereignisse',
        data: (chartData.flags || []).map(f => ({ x: f.x, title: f.title, text: f.text })),
        onSeries: undefined,
        shape: 'flag',
        width: 16,
        allowOverlapX: true,
        y: -50
      }] : [])
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () {
        const category = this.points?.[0]?.category || this.x;
        return generateWeeklyChartTooltip(this.points, category);
      }
    },
  }), [
    chartData,
    demandColor,
    capacityPedagogicalColor,
    capacityAdministrativeColor,
    careRatioColor,
    expertRatioColor,
    financeIncomeColor,
    financeExpenseColor,
    financeNetColor,
  ]);

  return (
    <Box>
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

      <Box h={400}>
        <HighchartsReact highcharts={Highcharts} options={midtermOptions} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Box>
  );
}


