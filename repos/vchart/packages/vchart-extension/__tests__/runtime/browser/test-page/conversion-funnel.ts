import { IConversionFunnelChartSpec } from '../../../../src/charts/conversion-funnel/interface';
import { registerConversionFunnelChart } from '../../../../src/charts/conversion-funnel/conversion-funnel';
import { VChart } from '@visactor/vchart';

const align = ['right' as const, 'left' as const];
const alignIndex = 0;

const spec: IConversionFunnelChartSpec = {
  type: 'conversionFunnel',
  // animationAppear: false,
  animation: false,
  // padding: { left: 250, right: 250 },
  height: 400,
  maxSize: '55%',
  isTransform: true,
  shape: 'rect',
  // funnelAlign: align[alignIndex],
  funnelBackground: {
    visible: true,
    style: {
      cornerRadius: 5,
      fillOpacity: 0.1,
      fill: datum => {
        return datum.name === 'Resume Screening' ? 'red' : 'blue';
      }
    }
  },
  label: {
    visible: true,
    style: {
      lineHeight: 16,
      limit: Infinity,
      fill: 'white',
      text: datum => [`${datum.name}`, `${datum.value}`]
    }
  },
  outerLabel: {
    visible: true,
    position: 'right',
    alignLabel: true,
    style: {
      text: datum => {
        return `${datum.percent * 100}%`;
      },
      dx: -10
    },
    line: {
      style: {
        lineDash: [2, 2]
      }
    }
  },
  transformLabel: {
    visible: true,
    style: {
      fill: 'black'
    }
  },
  conversionArrow: {
    // margin: 30,
    text: {
      // textMargin: 10,
      formatMethod: (text: string, params: any) => {
        let hasDuplicateNode = false;
        if (params.arrow.layout.duplicateNode) {
          hasDuplicateNode = true;
        }
        return {
          type: 'rich',
          text: [
            { text: `${text}\n`, fill: hasDuplicateNode ? 'red' : 'black' },
            { text: 111, fill: hasDuplicateNode ? 'red' : 'blue' }
          ]
        };
      },
      style: {
        // textAlign: 'right'
      }
    },
    line: {
      style: {
        stroke: (...args) => {
          // TODO: DATUM
          // console.log(args[0]);
          return args[0].from === 0 ? 'red' : 'black';
        }
      }
    },
    arrows: [
      {
        from: 1,
        to: 0,
        text: '3-4',
        position: align[alignIndex]
      },
      {
        from: 3,
        to: 4,
        text: '3-4',
        position: align[alignIndex]
      },
      {
        from: 3,
        to: 4,
        text: '3-4',
        position: align[alignIndex]
      },
      {
        from: 3,
        to: 4,
        text: '3-4',
        position: align[alignIndex]
      },
      {
        from: 0,
        to: 1,
        text: '0-1',
        position: align[alignIndex]
      },
      {
        from: 0,
        to: 1,
        text: '0-1 same',
        position: align[alignIndex]
      },

      {
        from: 1,
        to: 2,
        text: '1-2',
        position: align[alignIndex]
      },
      {
        from: 2,
        to: 3,
        text: '2-3',
        position: align[alignIndex]
      },
      {
        from: 3,
        to: 4,
        text: '3-4',
        position: align[alignIndex]
      },
      {
        from: 0,
        to: 2,
        text: '0-2',
        position: align[alignIndex]
      },
      {
        from: 1,
        to: 3,
        text: '1-3',
        position: align[alignIndex]
      },
      {
        from: 0,
        to: 4,
        text: '0-4',
        position: align[alignIndex]
      },
      // left
      {
        from: 0,
        to: 1,
        text: '0-1',
        position: align[align.length - 1 - alignIndex]
      },
      {
        from: 0,
        to: 1,
        text: '0-1 same',
        position: align[align.length - 1 - alignIndex]
      },

      {
        from: 1,
        to: 2,
        text: '1-2',
        position: align[align.length - 1 - alignIndex]
      },
      {
        from: 2,
        to: 3,
        text: '2-3',
        position: align[align.length - 1 - alignIndex]
      },
      {
        from: 3,
        to: 4,
        text: '3-4',
        position: align[align.length - 1 - alignIndex]
      },
      {
        from: 0,
        to: 2,
        text: '0-2',
        position: align[align.length - 1 - alignIndex]
      },
      {
        from: 1,
        to: 3,
        text: '1-3',
        position: align[align.length - 1 - alignIndex]
      },
      {
        from: 0,
        to: 4,
        text: '0-4',
        position: align[align.length - 1 - alignIndex]
      }
    ]
  },
  color: {
    type: 'ordinal',
    range: ['#00328E', '#0048AA', '#005FC5', '#2778E2', '#4E91FF', '#70ABFF', '#8FC7FF', '#AEE2FF']
  },
  legends: {},
  funnel: {
    style: {
      cornerRadius: 4,
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
  transform: {
    // style: {
    //   stroke: 'white',
    //   lineWidth: 2
    // },
    // state: {
    //   hover: {
    //     stroke: '#4e83fd',
    //     lineWidth: 1
    //   }
    // }
  },
  region: [
    {
      padding: { right: 200 }
    }
  ],
  data: [
    {
      name: 'funnel',
      values: [
        {
          value: 100,
          name: 'Resume Screening',
          percent: 1
        },
        {
          value: 80,
          name: 'Resume Evaluation',
          percent: 0.8
        },
        {
          value: 50,
          name: 'Evaluation Passed',
          percent: 0.5
        },
        {
          value: 30,
          name: 'Interview',
          percent: 0.3
        },
        {
          value: 10,
          name: 'Final Pass',
          percent: 0.1
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value'
};

const run = () => {
  registerConversionFunnelChart();
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });
  console.time('renderTime');
  cs.on('click', ({ mark, node }) => {
    console.log(mark, node);
  });
  cs.renderSync();

  console.timeEnd('renderTime');
  window['vchart'] = cs;
  console.log(cs);
};
run();
