import { useMemo, useEffect } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { useSelector, useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import { updateWeeklyChartData } from '../../store/chartSlice';
import { generateWeeklyChartTooltip } from '../../utils/chartUtilsWeekly';

export default function WeeklyChart() {
  
  const plotBandColor1 = '#fff2a6ff'; 
  const plotBandColor2= '#909090ff'; 
  const plotBandColorLabel = '#000000'; 
  const demandColor = '#7cb5ec'; // Default color for demand
  const capacityColor = '#90ed7d'; // Default color for capacity
  const careRatioColor = '#f45b5b'; // Default color for care ratio
  const expertRatioColor = '#ff9800'; // Default color for expert ratio

  const scenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const dispatch = useDispatch();

  // Get current filters from chartSlice (per scenario)
  const chartState = useSelector(state => state.chart[scenarioId] || {});
  const chartData = useMemo(() => chartState.chartData?.weekly || {}, [chartState]);

  // Update chart data when filters or simulation data change
  useEffect(() => {
    if (scenarioId) {
      dispatch(updateWeeklyChartData(scenarioId));
    }
  }, [dispatch, scenarioId]);

  // Optimized: Only recalculate when chartData changes
  const weeklyOptions = useMemo(() => {
    // Ensure all data arrays are mutable copies
    const safeCategories = chartData.categories ? [...chartData.categories] : [];
    const safeDemand = chartData.demand ? chartData.demand.map(val => Number(val) || 0) : [];
    const safeCapacity = chartData.capacity ? chartData.capacity.map(val => Number(val) || 0) : [];
    const safeCareRatio = chartData.care_ratio ? chartData.care_ratio.map(val => Number(val) || 0) : [];
    const safeExpertRatio = chartData.expert_ratio ? chartData.expert_ratio.map(val => Number(val) || 0) : [];

    return {
      chart: { type: 'line' },
      title: { text: null },
      xAxis: {
        categories: safeCategories,
        title: { text: 'Zeiten' },
        labels: { 
          step: 1,
          formatter: function() {
            const [, time] = this.value.split(' ');
            if (time === '7:00' || time === '9:00' || time === '11:00' || time === '13:00' || time === '15:00') {
              return time;
            }
            return '';
          }
        },
        plotBands: [
          {
            from: 0,
            to: 20.99,
            color: plotBandColor1,
            label: { text: 'Mo', style: { color: plotBandColorLabel } }
          },
          {
            from: 21,
            to: 41.99,
            color: plotBandColor2,
            label: { text: 'Di', style: { color: plotBandColorLabel } }
          },
          {
            from: 42,
            to: 62.99,
            color: plotBandColor1,
            label: { text: 'Mi', style: { color: plotBandColorLabel } }
          },
          {
            from: 63,
            to: 83.99,
            color: plotBandColor2,
            label: { text: 'Do', style: { color: plotBandColorLabel } }
          },
          {
            from: 84,
            to: 104.99,
            color: plotBandColor1,
            label: { text: 'Fr', style: { color: plotBandColorLabel } }
          }
        ]
      },
      yAxis: [
        { // Bedarf (Kinder)
          title: { text: 'Bedarf (Kinder)' },
          min: 0,
          max: chartData.maxdemand || null,
          tickInterval: 5,
          opposite: false,
          gridLineWidth: 1
        },
        { // Kapazität (Mitarbeiter)
          title: { text: 'Kapazität (Mitarbeiter)' },
          min: 0,
          max: chartData.maxcapacity || null,
          tickInterval: 1,
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
        { // Fachkraftquote in Prozent
          title: { text: 'Fachkraftquote (%)' },
          min: 0,
          max: chartData.maxexpert_ratio || null,
          tickInterval: 10,
          opposite: true,
          gridLineWidth: 0
        }
      ],
      series: [
        {
          name: 'Bedarf',
          type: 'area',
          data: safeDemand,
          yAxis: 0,
          color: demandColor,
          fillOpacity: 0.3,
          marker: { enabled: false }
        },
        {
          name: 'Kapazität',
          type: 'column',
          data: safeCapacity,
          yAxis: 1,
          color: capacityColor,
        },
        {
          name: 'Betreuungsschlüssel',
          type: 'line',
          data: safeCareRatio,
          yAxis: 2,
          color: careRatioColor,
          marker: { enabled: false }
        },
        {
          name: 'Fachkraftquote',
          type: 'line',
          data: safeExpertRatio,
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
    };
  }, [chartData, plotBandColor1, plotBandColor2]);

  return (
    <Box sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Chart */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <HighchartsReact highcharts={Highcharts} options={weeklyOptions} />
      </Box>
    </Box>
  );
}