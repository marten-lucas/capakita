import React, { useMemo, useEffect } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { useSelector, useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import { updateMidTermChartData } from '../../store/chartSlice';
import { generateWeeklyChartTooltip } from '../../utils/chartUtils/chartUtilsWeekly';

// MidtermChart component
export default function MidtermChart() {
  // Colors
  const demandColor = 'rgba(124,181,236,0.8)';
  const capacityColor = '#90ed7d';
  const careRatioColor = '#f45b5b';
  const expertRatioColor = '#ff9800';

  const scenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const dispatch = useDispatch();

  // Get current filters from chartSlice (per scenario)
  const chartState = useSelector(state => state.chart[scenarioId] || {});
  const chartData = useMemo(() => chartState.chartData?.midterm || {}, [chartState]);
  const timedimension = chartState.timedimension || 'month';

  // Update chart data when filters or simulation data change
  useEffect(() => {
    if (scenarioId) {
      dispatch(updateMidTermChartData(scenarioId));
    }
  }, [dispatch, scenarioId]);


  // Chart options
  const midtermOptions = useMemo(() => ({
    chart: { type: 'column' },
    title: { text: `Midterm Simulation - ${timedimension}` },
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
    }
  }), [chartData, timedimension, demandColor, capacityColor, careRatioColor, expertRatioColor]);

  return (
    <Box sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <HighchartsReact highcharts={Highcharts} options={midtermOptions} />
      </Box>
    </Box>
  );
}

