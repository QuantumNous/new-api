import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';

const run = () => {
  const spec = {
    type: 'circularProgress',
    data: [
      {
        id: 'id0',
        values: [
          {
            type: 'Tradition Industries',
            value: 0.795,
            text: '79.5%'
          },
          {
            type: 'Business Companies',
            value: 0.5,
            text: '50%'
          },
          {
            type: 'Customer-facing Companies',
            value: 0.25,
            text: '25%'
          }
        ]
      }
    ],
    color: ['rgb(255, 222, 0)', 'rgb(171, 205, 5)', 'rgb(0, 154, 68)'],
    valueField: 'value',
    categoryField: 'type',
    seriesField: 'type',
    radius: 0.8,
    innerRadius: 0.4,
    progress: {
      style: {
        innerPadding: 5,
        outerPadding: 5
      },
      state: {
        hover: {
          innerPadding: 0,
          outerPadding: 0
        }
      }
    },
    tickMask: {
      visible: true,
      angle: 10,
      offsetAngle: 0,
      forceAlign: true,
      style: {
        cornerRadius: 15
      }
    },
    axes: [
      {
        visible: false,
        type: 'linear',
        orient: 'angle'
      },
      {
        visible: false,
        type: 'band',
        orient: 'radius'
      }
    ],
    indicator: {
      visible: true,
      trigger: 'hover',
      title: {
        visible: true,
        field: 'type',
        autoLimit: true,
        style: {
          fontSize: 20,
          fill: 'black'
        }
      },
      content: [
        {
          visible: true,
          field: 'text',
          style: {
            fontSize: 16,
            fill: 'gray'
          }
        }
      ]
    },
    legends: {
      visible: true,
      orient: 'bottom',
      title: {
        visible: false
      }
    }
  };

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');

  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  console.log(cs);
};
run();
