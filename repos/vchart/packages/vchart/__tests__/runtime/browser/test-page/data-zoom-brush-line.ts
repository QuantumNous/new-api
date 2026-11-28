import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';

const run = () => {
  const spec = {
    type: 'line',
    data: {
      values: [
        { time: 1720339200000, value: 7, legend: '优秀' },
        { time: 1720339800000, value: 37, legend: '优秀' },
        { time: 1720340400000, value: 10, legend: '优秀' },
        { time: 1720341000000, value: 37, legend: '优秀' },
        { time: 1720341600000, value: 37, legend: '优秀' },
        { time: 1720342200000, value: 37, legend: '优秀' },
        { time: 1720342800000, value: 3, legend: '优秀' },
        { time: 1720343400000, value: 37, legend: '优秀' },
        { time: 1720344000000, value: 3, legend: '优秀' },
        { time: 1720345800000, value: 3, legend: '优秀' },
        { time: 1720346400000, value: 37, legend: '优秀' },
        { time: 1720347000000, value: 37, legend: '优秀' },
        { time: 1720347600000, value: 3, legend: '优秀' },
        { time: 1720348200000, value: 37, legend: '优秀' }
      ]
    },
    xField: 'time',
    yField: 'value',
    axes: [
      {
        orient: 'bottom',
        type: 'time',
        layers: [
          {
            // 格式化x时间轴
            timeFormat: '%m/%d %H:%M'
          }
        ]
        // min:1720334200000,
        // max:1720349800000
      }
    ],
    brush: {
      visible: true,
      brushType: 'x',
      // 开启后默认关联所有axis/dataZoom
      zoomAfterBrush: true,
      zoomWhenEmpty: false,
      brushMoved: false, // 选框是否可被平移
      delayType: 'throttle',
      style: {
        shadowColor: '#1664FF1A',
        lineWidth: 0.5
      }
    },
    dataZoom: [
      {
        orient: 'bottom',
        showDetail: false,
        visible: true
      }
    ],
    crosshair: {
      xField: {
        visible: true,
        line: {
          type: 'line'
        }
      }
    },
    point: {
      style: {
        size: 4
      },
      state: {
        dimension_hover: {
          size: 10
        }
      }
    },
    tooltip: {
      dimension: {
        visible: (a, b, c) => {
          return a[0].value > 1720339200000 && a[0].value < 1720348200000;
        },
        title: {
          valueTimeFormat: '%Y-%m-%d  %H:%M:%S'
        },
        content: {
          key: datum => datum.legend,
          value: datum => {
            return datum.value;
          }
        }
      }
    },
    line: {
      style: {
        lineWidth: 2
      }
    },
    legends: { visible: true }
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
