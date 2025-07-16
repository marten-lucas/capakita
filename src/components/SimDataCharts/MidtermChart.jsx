import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';

const midtermOptions = {
  chart: { type: 'bar' },
  title: { text: 'Midterm Simulation' },
  xAxis: { categories: ['Woche 1', 'Woche 2', 'Woche 3', 'Woche 4'] },
  yAxis: { title: { text: 'Value' } },
  series: [
    { name: 'Demand', data: [25, 30, 28, 32] },
    { name: 'Capacity', data: [28, 29, 30, 31] }
  ]
};

export default function MidtermChart() {
  return <HighchartsReact highcharts={Highcharts} options={midtermOptions} />;
}
