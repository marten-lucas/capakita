import { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, useMantineTheme } from '@mantine/core';
import { useSelector } from 'react-redux';
import { generateHistogramTooltip } from '../../utils/chartUtils/chartUtilsHistogram';
import { createColoredYAxis } from '../../utils/highchartsAxis';
import { selectHistogramChartData } from '../../store/chartSelectors';

export default function BookingHistogram() {
  const theme = useMantineTheme();

  const demandColor = theme.colors.blue[6];
  const capacityPedagogicalColor = theme.colors.green[6];
  const capacityAdministrativeColor = theme.colors.violet[6];

  const chartData = useSelector(selectHistogramChartData);

  // Optimized: Only recalculate when chartData changes
  const histogramOptions = useMemo(() => {
    // Ensure all data arrays are mutable copies
    const safeCategories = chartData.categories ? [...chartData.categories] : [];
    const safeDemand = chartData.demand ? chartData.demand.map(val => Number(val) || 0) : [];
    const safeCapacityPedagogical = chartData.capacity_pedagogical ? chartData.capacity_pedagogical.map(val => Number(val) || 0) : [];
    const safeCapacityAdministrative = chartData.capacity_administrative ? chartData.capacity_administrative.map(val => Number(val) || 0) : [];

    return {
      chart: { type: 'column', zoomType: 'x' },
      title: { text: null },
      xAxis: {
        categories: safeCategories,
        title: { text: 'Stunden pro Woche' },
        labels: { 
          rotation: -45,
          style: { fontSize: '10px' }
        }
      },
      yAxis: createColoredYAxis({
        title: 'Anzahl Personen',
        color: demandColor,
        min: 0,
        allowDecimals: false
      }),
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
          name: 'Mitarbeiter (pädagogisch)',
          data: safeCapacityPedagogical,
          color: capacityPedagogicalColor,
        },
        {
          name: 'Mitarbeiter (administrativ)',
          data: safeCapacityAdministrative,
          color: capacityAdministrativeColor,
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
      },
      // Remove navigator and scrollbar
    };
  }, [chartData, demandColor, capacityPedagogicalColor, capacityAdministrativeColor]);

  return (
    <Box h={400}>
      <HighchartsReact highcharts={Highcharts} options={histogramOptions} containerProps={{ style: { height: '100%' } }} />
    </Box>
  );
}

