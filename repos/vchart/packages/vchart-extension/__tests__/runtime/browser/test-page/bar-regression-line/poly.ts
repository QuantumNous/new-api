import { registerRegressionLine } from '../../../../../src/components/regression-line/regression-line';
import { appendBarRegressionLineConfig } from './../../../../../src/components/bar-regression-line';
import { default as VChart } from '@visactor/vchart';

const spec = {
  type: 'bar',
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
  yField: 'sales'
};

const run = () => {
  registerRegressionLine();
  appendBarRegressionLineConfig(spec, {
    degree: 3,
    line: {
      style: {
        stroke: 'red',
        lineWidth: 2
      }
    },
    confidenceInterval: {
      style: {
        fill: 'red',
        fillOpacity: 0.2
      }
    }
  });

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });

  cs.renderSync();

  window['vchart'] = cs;
};
run();
