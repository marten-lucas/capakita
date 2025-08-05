import React, { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
// Placeholder for future: import { updateFinancialChartData } from '../../store/chartSlice';
// Placeholder for future: import { generateFinancialChartTooltip } from '../../utils/chartUtilsFinancial';

export default function FinancialChart({ scenarioId }) {
  // Colors (adjust as needed)
  const expenseColor = '#f45b5b';
  const incomeColor = '#90ed7d';

  // Placeholder: get chart data from redux (to be implemented)
  const chartState = useSelector(state => state.chart[scenarioId] || {});
  const chartData = useMemo(() => chartState.chartData?.financial || {}, [chartState]);
  // Placeholder: const timedimension = chartState.timedimension || 'month';

  // Placeholder: dispatch = useDispatch();
  // Placeholder: useEffect(() => { dispatch(updateFinancialChartData(scenarioId)); }, [dispatch, scenarioId]);

  // Chart options (skeleton)
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
      // formatter: function () { return generateFinancialChartTooltip(this.points, this.x); }
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
