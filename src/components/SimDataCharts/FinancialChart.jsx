import React, { useMemo, useEffect } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { useSelector, useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import { updateFinancialChartData } from '../../store/chartSlice';
import { generateFinancialChartTooltip } from '../../utils/chartUtils/chartUtilsFinancial';

export default function FinancialChart({ scenarioId }) {
  // Colors (adjust as needed)
  const expenseColor = '#f45b5b';
  const incomeColor = '#90ed7d';

  const dispatch = useDispatch();

  // Get chart data from redux
  const chartState = useSelector(state => state.chart[scenarioId] || {});
  const chartData = useMemo(() => chartState.chartData?.financial || {}, [chartState]);

  useEffect(() => {
    if (scenarioId) {
      dispatch(updateFinancialChartData(scenarioId));
    }
  }, [dispatch, scenarioId]);

  // Chart options
  const financialOptions = useMemo(() => ({
    chart: { type: 'column' },
    title: { text: 'Finanzen (Prototyp)' },
    xAxis: { 
      categories: chartData.categories || [],
      title: { text: 'Zeitraum' }
    },
    yAxis: [
      {
        title: { text: 'Betrag (€)' },
        min: 0,
        // max: chartData.maxAmount || null,
        tickInterval: null,
        opposite: false,
        gridLineWidth: 1
      }
    ],
    series: [
      {
        name: 'Ausgaben',
        type: 'column',
        data: chartData.expenses || [],
        color: expenseColor
      },
      {
        name: 'Einnahmen',
        type: 'column',
        data: chartData.income || [],
        color: incomeColor
      }
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () { return generateFinancialChartTooltip(this.points, this.x); }
    }
  }), [chartData, expenseColor, incomeColor]);

  return (
    <Box sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <HighchartsReact highcharts={Highcharts} options={financialOptions} />
      </Box>
    </Box>
  );
}
