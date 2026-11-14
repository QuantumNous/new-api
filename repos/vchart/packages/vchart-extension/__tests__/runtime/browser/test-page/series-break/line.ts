import { IBarChartSpec, default as VChart } from '@visactor/vchart';
import { registerSeriesBreak, appendSeriesBreakConfig } from '../../../../../src';

const spec = {
  type: 'line',
  data: [
    {
      name: 'line',
      fields: {
        y: {
          alias: '伤害'
        },
        c: {
          alias: '怪物',
          domain: ['飘飘猪', '绿水灵']
        }
      },
      values: [
        {
          x: '回合1',
          y: 43,
          c: '绿水灵'
        },
        {
          x: '回合1',
          y: 35,
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
          y: 28,
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
          y: 17,
          c: '绿水灵',
          latest: true
        },
        {
          x: '回合6',
          y: 98,
          c: '飘飘猪',
          latest: true
        }
      ]
    }
  ],
  labels: {
    visible: true
  },
  legend: {
    orient: 'bottom',
    visible: true
  },
  axes: [
    {
      orient: 'left',
      domain: true,
      domainWidth: 2,
      domainColor: '#000',
      breaks: [
        {
          type: 'zigzag',
          //scopeType: 'length',
          visible: true,
          range: [50, 95]
        },
        {
          type: 'straight',
          visible: true,
          range: [10, 15]
        }
      ],
      zero: true,
      nice: true
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
