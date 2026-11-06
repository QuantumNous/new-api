import { ICandlestickChartSpec } from '../../../../src/charts/candlestick/interface';
import { registerCandlestickChart } from '../../../../src/charts/candlestick/candlestick';
import VChart from '@visactor/vchart';

const data = [
  { time: '2024-07-01', open: 100, close: 130, high: 135, low: 90 },
  { time: '2024-07-02', open: 130, close: 80, high: 140, low: 75 },
  { time: '2024-07-03', open: 80, close: 150, high: 155, low: 70 },
  { time: '2024-07-04', open: 150, close: 140, high: 160, low: 105 },
  { time: '2024-07-05', open: 140, close: 170, high: 180, low: 115 },
  { time: '2024-07-06', open: 170, close: 170, high: 175, low: 95 },
  { time: '2024-07-07', open: 170, close: 100, high: 175, low: 95 },
  { time: '2024-07-08', open: 100, close: 160, high: 210, low: 90 }
];

const spec: ICandlestickChartSpec = {
  type: 'candlestick',
  xField: 'time',
  openField: 'open',
  closeField: 'close',
  highField: 'high',
  lowField: 'low',
  data: [
    {
      values: data
    }
  ]
};

const run = () => {
  registerCandlestickChart();
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    onError: err => {
      console.error(err);
    }
  });
  console.time('renderTime');
  cs.renderSync();
  console.timeEnd('renderTime');
  window['vchart'] = cs;
  console.log(cs);
};
run();
