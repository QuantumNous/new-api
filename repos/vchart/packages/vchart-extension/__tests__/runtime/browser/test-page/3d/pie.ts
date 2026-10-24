import VChart from '@visactor/vchart';
import { registerPie3dChart } from '../../../../../src';

const spec = {
  width: 500,
  height: 500,
  type: 'pie3d',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  label: {
    visible: true,
    position: 'inside',
    support3d: true,
    style: {
      stroke: '#fff',
      keepDirIn3d: false,
      fontSize: 12
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const run = () => {
  registerPie3dChart();

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    },
    disableDirtyBounds: true,
    animation: false,
    options3d: {
      enable: true
    }
  });

  cs.renderSync();

  window['vchart'] = cs;
};
run();
