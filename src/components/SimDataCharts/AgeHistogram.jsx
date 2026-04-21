import { useMemo, useEffect } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, useMantineTheme } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { updateAgeHistogramData } from '../../store/chartSlice';

export default function AgeHistogram() {
  const theme = useMantineTheme();
  const scenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const chartState = useSelector((state) => state.chart[scenarioId] || {});
  const chartData = useMemo(() => chartState.chartData?.ageHistogram || {}, [chartState]);
  const dispatch = useDispatch();

  useEffect(() => {
    if (scenarioId) {
      dispatch(updateAgeHistogramData(scenarioId));
    }
  }, [dispatch, scenarioId, chartState.referenceDate, chartState.filter?.Groups]);

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
    yAxis: {
      min: 0,
      allowDecimals: false,
      title: { text: 'Anzahl Kinder' },
    },
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
