import React, { useMemo, useEffect } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, useMantineTheme } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { updateMidTermChartData } from '../../store/chartSlice';
import { generateWeeklyChartTooltip } from '../../utils/chartUtils/chartUtilsWeekly';

export default function MidtermChart() {
  const theme = useMantineTheme();

  const demandColor = theme.colors.blue[6];
  const capacityColor = theme.colors.green[6];
  const careRatioColor = theme.colors.red[6];
  const expertRatioColor = theme.colors.orange[6];

  const scenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const dispatch = useDispatch();

  // Get current filters from chartSlice (per scenario)
  const chartState = useSelector(state => state.chart[scenarioId] || {});
  const chartData = useMemo(() => chartState.chartData?.midterm || {}, [chartState]);

  // Update chart data when filters or simulation data change
  useEffect(() => {
    if (scenarioId) {
      dispatch(updateMidTermChartData(scenarioId));
    }
  }, [dispatch, scenarioId]);


  // Chart options
  const midtermOptions = useMemo(() => ({
    chart: { type: 'column', zoomType: 'x' }, // <-- enable zoom
    title: { text: null },
    xAxis: {
      categories: chartData.categories,
      title: { text: 'Zeitraum' }
    },
    yAxis: [
      { // Bedarf
        title: { text: 'Bedarf (Stunden)' },
        min: 0,
        max: chartData.maxdemand || null,
        tickInterval: null,
        opposite: false,
        gridLineWidth: 1
      },
      { // Kapazität
        title: { text: 'Kapazität (Stunden)' },
        min: 0,
        max: chartData.maxcapacity || null,
        tickInterval: null,
        opposite: false,
        gridLineWidth: 1
      },
      { // Betreuungsschlüssel
        title: { text: 'Betreuungsschlüssel' },
        min: 0,
        max: chartData.max_care_ratio || null,
        tickInterval: null,
        opposite: true,
        gridLineWidth: 0
      },
      { // Fachkraftquote
        title: { text: 'Fachkraftquote (%)' },
        min: 0,
        max: chartData.maxexpert_ratio || 100,
        tickInterval: 10,
        opposite: true,
        gridLineWidth: 0
      }
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
        name: 'Kapazität',
        type: 'area',
        data: chartData.capacity || [],
        yAxis: 1,
        color: capacityColor,
        fillOpacity: 0.6,
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
        // Use category (e.g., "2026-04") instead of just index
        const category = this.points?.[0]?.category || this.x;
        return generateWeeklyChartTooltip(this.points, category);
      }
    },
  }), [chartData, demandColor, capacityColor, careRatioColor, expertRatioColor]);

  return (
    <Box h={400}>
      <HighchartsReact highcharts={Highcharts} options={midtermOptions} containerProps={{ style: { height: '100%' } }} />
    </Box>
  );
}


