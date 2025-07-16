import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';

const weeklyOptions = {
  chart: { type: 'bar' },
  title: { text: 'Weekly Simulation' },
  xAxis: { categories: ['Mo', 'Di', 'Mi', 'Do', 'Fr'] },
  yAxis: { title: { text: 'Value' } },
  series: [
    { name: 'Demand', data: [5, 7, 3, 6, 4] },
    { name: 'Capacity', data: [6, 6, 4, 5, 5] }
  ]
};

export default function WeeklyChart() {
  return <HighchartsReact highcharts={Highcharts} options={weeklyOptions} />;
}
