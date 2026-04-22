import { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, useMantineTheme } from '@mantine/core';
import { useSelector } from 'react-redux';
import { createColoredYAxis } from '../../utils/highchartsAxis';
import { selectAgeHistogramChartData } from '../../store/chartSelectors';

export default function AgeHistogram() {
  const theme = useMantineTheme();
  const chartData = useSelector(selectAgeHistogramChartData);

  const options = useMemo(() => ({
    chart: { type: 'column' },
    title: { text: null },
    xAxis: {
      categories: chartData.categories || [],
      title: { text: 'Alter in Jahren' },
      labels: {
        rotation: -45,
        style: { fontSize: '10px' },
      },
    },
    yAxis: createColoredYAxis({
      title: 'Anzahl Kinder',
      color: theme.colors.indigo[6],
      min: 0,
      allowDecimals: false,
    }),
    legend: { enabled: false },
    tooltip: {
      pointFormat: '<b>{point.y}</b> Kinder',
    },
    series: [
      {
        name: 'Kinder',
        data: chartData.series || [],
        color: theme.colors.indigo[6],
      },
    ],
  }), [chartData, theme.colors.indigo]);

  return (
    <Box h={400}>
      <HighchartsReact highcharts={Highcharts} options={options} containerProps={{ style: { height: '100%' } }} />
    </Box>
  );
}
