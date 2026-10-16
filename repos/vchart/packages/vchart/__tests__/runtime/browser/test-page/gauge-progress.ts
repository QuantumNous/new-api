import { isMobile } from 'react-device-detect';
import type { IGaugeChartSpec } from '../../../../src/index';
// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../../src/index';
import { degreeToRadian } from '@visactor/vutils';

const run = () => {
  const pointerPath =
    // eslint-disable-next-line max-len
    'M-0.020059 -0.978425 C-0.018029 -0.9888053 -0.013378 -1 0 -1 C0.01342 -1 0.01812 -0.989146 0.0201 -0.978425 C0.02161 -0.9702819 0.0692 -0.459505 0.09486 -0.184807 C0.10298 -0.097849 0.1089 -0.034548 0.11047 -0.018339 C0.11698 0.04908 0.07373 0.11111 0.00002 0.11111 C-0.07369 0.11111 -0.117184 0.04991 -0.110423 -0.018339 C-0.103662 -0.086591 -0.022089 -0.9680447 -0.020059 -0.978425Z';
  const circlePath =
    // eslint-disable-next-line max-len
    'M1 0 C1 0.55228 0.55228 1 0 1 C-0.552285 1 -1 0.55228 -1 0 C-1 -0.552285 -0.552285 -1 0 -1 C0.55228 -1 1 -0.552285 1 0Z';

  const spec: IGaugeChartSpec = {
    type: 'gauge',
    data: [
      {
        id: 'id0',
        values: [
          {
            type: '目标A',
            value: 0.6
          }
        ]
      }
    ],
    radiusField: 'type',
    angleField: 'value',
    seriesField: 'type',
    outerRadius: 0.8,
    innerRadius: 0.5,
    startAngle: -270,
    endAngle: 90,
    gauge: {
      type: 'circularProgress',
      progress: {
        style: {
          fill: {
            gradient: 'conical',
            startAngle: degreeToRadian(-225 - 5),
            endAngle: degreeToRadian(45 + 5),
            stops: [
              {
                offset: 0,
                color: '#4FC6B4'
              },
              {
                offset: 1,
                color: '#31679E'
              }
            ]
          }
        }
      },
      tickMask: {
        visible: true,
        angle: 3,
        offsetAngle: 0,
        forceAlign: true,
        style: {
          cornerRadius: 15
        }
      },
      track: {
        style: {
          fill: '#ccc'
        }
      }
    },
    pointer: {
      width: 0.5,
      height: 0.5,
      style: {
        path: pointerPath,
        fill: '#5A595E'
      }
    },
    pin: {
      style: {
        path: circlePath,
        fill: '#888'
      }
    },
    pinBackground: {
      width: 0.08,
      height: 0.08,
      style: {
        path: circlePath,
        fill: '#ddd'
      }
    },
    axes: [
      {
        type: 'linear',
        orient: 'angle',
        inside: true,
        tick: { visible: true, tickCount: 10 },
        subTick: { visible: true },
        label: {
          visible: true,
          //space: 5
          formatMethod: text => '啊啊啊啊' + text
        }
        //zIndex: 500
      }
    ]
  };

  // VChart.ThemeManager.setCurrentTheme('dark');
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
    // theme: 'dark'
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  console.log(cs);
};
run();
