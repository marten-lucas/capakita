import React, { useMemo, useEffect } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { useSelector, useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles'; // <-- import useTheme
import { updateMidTermChartData } from '../../store/chartSlice';
import { generateWeeklyChartTooltip } from '../../utils/chartUtils/chartUtilsWeekly';

// MidtermChart component
export default function MidtermChart() {
  const theme = useTheme(); // <-- get theme

  // Use theme colors
  const demandColor = theme.palette.primary.main;
  const capacityColor = theme.palette.success.main;
  const careRatioColor = theme.palette.error.main;
  const expertRatioColor = theme.palette.warning.main;

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
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () {
        return generateWeeklyChartTooltip(this.points, this.x);
      }
    },
  }), [chartData, demandColor, capacityColor, careRatioColor, expertRatioColor]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ height: 400 }}>
        <HighchartsReact highcharts={Highcharts} options={midtermOptions} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Box>
  );
}


