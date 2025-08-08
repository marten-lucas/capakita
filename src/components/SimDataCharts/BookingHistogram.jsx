import { useMemo, useEffect } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { useSelector, useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import { updateHistogramChartData } from '../../store/chartSlice';
import { generateHistogramTooltip } from '../../utils/chartUtils/chartUtilsHistogram';

export default function BookingHistogram() {
  const demandColor = '#7cb5ec'; // Default color for demand (children)
  const capacityColor = '#90ed7d'; // Default color for capacity (employees)

  const scenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const dispatch = useDispatch();

  // Get current filters from chartSlice (per scenario)
  const chartState = useSelector(state => state.chart[scenarioId] || {});
  const chartData = useMemo(() => chartState.chartData?.histogram || {}, [chartState]);
  const referenceDate = chartState.referenceDate;
  const filterGroups = useMemo(() => chartState.filter?.Groups || [], [chartState.filter?.Groups]);
  const filterQualifications = useMemo(() => chartState.filter?.Qualifications || [], [chartState.filter?.Qualifications]);

  // Update chart data when filters, reference date, or simulation data change
  useEffect(() => {
    if (scenarioId) {
      dispatch(updateHistogramChartData(scenarioId));
    }
  }, [dispatch, scenarioId, referenceDate, filterGroups, filterQualifications]);

  // Optimized: Only recalculate when chartData changes
  const histogramOptions = useMemo(() => {
    // Ensure all data arrays are mutable copies
    const safeCategories = chartData.categories ? [...chartData.categories] : [];
    const safeDemand = chartData.demand ? chartData.demand.map(val => Number(val) || 0) : [];
    const safeCapacity = chartData.capacity ? chartData.capacity.map(val => Number(val) || 0) : [];

    return {
      chart: { type: 'column' },
      title: { text: 'Buchungsstunden Verteilung' },
      xAxis: {
        categories: safeCategories,
        title: { text: 'Stunden pro Woche' },
        labels: { 
          rotation: -45,
          style: { fontSize: '10px' }
        }
      },
      yAxis: {
        title: { text: 'Anzahl Personen' },
        min: 0,
        allowDecimals: false
      },
      plotOptions: {
        column: {
          pointPadding: 0.1,
          borderWidth: 1,
          groupPadding: 0.1
        }
      },
      series: [
        {
          name: 'Kinder',
          data: safeDemand,
          color: demandColor,
        },
        {
          name: 'Mitarbeiter',
          data: safeCapacity,
          color: capacityColor,
        }
      ],
      legend: { 
        align: 'center', 
        verticalAlign: 'bottom' 
      },
      tooltip: {
        shared: true,
        useHTML: true,
        formatter: function () {
          return generateHistogramTooltip(this.points, this.x);
        }
      }
    };
  }, [chartData, demandColor, capacityColor]);

  return (
    <Box sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Chart */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <HighchartsReact highcharts={Highcharts} options={histogramOptions} />
      </Box>
    </Box>
  );
}
