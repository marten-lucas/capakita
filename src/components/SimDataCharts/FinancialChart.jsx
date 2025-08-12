import React, { useMemo, useEffect } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { useSelector, useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles'; // <-- import useTheme
import { updateFinancialChartData } from '../../store/chartSlice';
import { generateFinancialChartTooltip } from '../../utils/chartUtils/chartUtilsFinancial';

export default function FinancialChart({ scenarioId, timedimension }) {
  const theme = useTheme(); // <-- get theme

  // Use theme colors
  const expenseColor = theme.palette.error.main;
  const incomeColor = theme.palette.success.main;
  const saldoColor = theme.palette.primary.main;
  const saldoCumColor = theme.palette.warning.main;

  const dispatch = useDispatch();

  // Get chart data from redux
  const chartState = useSelector(state => state.chart[scenarioId] || {});
  const chartData = useMemo(() => chartState.chartData?.financial || {}, [chartState]);

  useEffect(() => {
    if (scenarioId) {
      dispatch(updateFinancialChartData(scenarioId, timedimension));
    }
  }, [dispatch, scenarioId, timedimension]);

  // Chart options
  const financialOptions = useMemo(() => ({
    chart: { type: 'column', alignTicks: true, zoomType: 'x' },
    title: { text: null },
    xAxis: {
      categories: chartData.categories || [],
      title: { text: 'Zeitraum' }
    },
    yAxis: [
      {
        title: { text: 'Betrag (€)' },
        //min: 0,
        max: chartData.maxAmount || null,
        tickInterval: null,
        opposite: false,
        gridLineWidth: 1
      },
      {
        title: { text: 'Saldo (€)' },
        //min: chartData.minAmount || null,
        opposite: true,
        gridLineWidth: 0
      }
    ],
    series: [
      {
        name: 'Ausgaben',
        type: 'column',
        data: chartData.expenses || [],
        color: expenseColor,
        yAxis: 0
      },
      {
        name: 'Einnahmen',
        type: 'column',
        data: chartData.income || [],
        color: incomeColor,
        yAxis: 0
      },
      {
        name: 'Monatlicher Saldo',
        type: 'line',
        data: (chartData.income || []).map((inc, i) => inc - (chartData.expenses?.[i] || 0)),
        color: saldoColor,
        yAxis: 1,
        marker: { enabled: true }
      },
      {
        name: 'Kumulierter Saldo',
        type: 'line',
        data: (() => {
          const income = chartData.income || [];
          const expenses = chartData.expenses || [];
          let cum = 0;
          return income.map((inc, i) => {
            cum += (inc - (expenses[i] || 0));
            return cum;
          });
        })(),
        color: saldoCumColor,
        yAxis: 1,
        marker: { enabled: true }
      }
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () { return generateFinancialChartTooltip(this.points, this.x); }
    },
  }), [chartData, expenseColor, incomeColor, saldoColor, saldoCumColor]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ height: 400 }}>
        <HighchartsReact highcharts={Highcharts} options={financialOptions} containerProps={{ style: { height: '100%' } }} />
      </Box>
    </Box>
  );
}
