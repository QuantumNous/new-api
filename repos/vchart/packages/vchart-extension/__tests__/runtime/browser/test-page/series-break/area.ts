import { IBarChartSpec, default as VChart } from '@visactor/vchart';
import { registerSeriesBreak, appendSeriesBreakConfig } from '../../../../../src';

const spec = {
  type: 'area',
  data: [
    {
      name: 'area',

      values: [
        {
          x: '回合1',
          y: 15,
          c: '绿水灵'
        },
        {
          x: '回合1',
          y: 13,
          c: '飘飘猪'
        },
        {
          x: '回合2',
          y: 41,
          c: '绿水灵'
        },
        {
          x: '回合2',
          y: 10,
          c: '飘飘猪'
        },
        {
          x: '回合3',
          y: 19,
          c: '绿水灵'
        },
        {
          x: '回合3',
          y: 15,
          c: '飘飘猪'
        },
        {
          x: '回合4',
          y: 24,
          c: '绿水灵'
        },
        {
          x: '回合4',
          y: 38,
          c: '飘飘猪'
        },
        {
          x: '回合5',
          y: 87,
          c: '绿水灵'
        },
        {
          x: '回合5',
          y: 66,
          c: '飘飘猪'
        },
        {
          x: '回合6',
          y: 480,
          c: '绿水灵',
          latest: true
        },
        {
          x: '回合6',
          y: 490,
          c: '飘飘猪',
          latest: true
        }
      ]
    }
  ],

  axes: [
    {
      orient: 'left',
      domain: true,
      domainWidth: 1,
      breaks: [
        {
          visible: true,
          range: [160, 470]
        }
      ],
      zero: true,
      nice: true,
      domainLine: {
        visible: true
      }
    },
    {
      orient: 'bottom'
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c'
};

const run = () => {
  registerSeriesBreak();
  appendSeriesBreakConfig(spec as IBarChartSpec);

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
