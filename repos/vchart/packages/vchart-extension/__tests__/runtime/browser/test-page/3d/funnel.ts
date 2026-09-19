import VChart from '@visactor/vchart';
import { registerFunnel3dChart } from '../../../../../src';

const spec = {
  padding: {
    top: 30
  },
  type: 'funnel3d',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true,
    support3d: true
  },
  maxSize: 400,
  minSize: 50,
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const run = () => {
  registerFunnel3dChart();

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    },
    disableDirtyBounds: true,
    options3d: {
      enable: true,
      center: {
        dx: 100,
        dy: 100
      }
    }
  });

  cs.renderSync();

  window['vchart'] = cs;
};
run();
