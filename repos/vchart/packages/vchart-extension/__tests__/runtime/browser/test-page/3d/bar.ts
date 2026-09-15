import VChart from '@visactor/vchart';
import { registerBar3dChart } from '../../../../../src';

const spec = {
  type: 'bar3d',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  bar3d: {
    style: {
      length: 20,
      z: -20
    },
    state: {
      selected: {
        stroke: '#000',
        strokeWidth: 1
      }
    }
  },
  axes: [
    { orient: 'bottom', type: 'band', tick: { tickSize: 20 }, mode: '3d' },
    { orient: 'left', type: 'linear', tick: { tickSize: 20 }, mode: '3d' }
  ]
};

const run = () => {
  registerBar3dChart();

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    },
    disableDirtyBounds: true,
    options3d: {
      enable: true
    }
  });

  cs.renderSync();

  window['vchart'] = cs;
};
run();
