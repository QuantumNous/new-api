import { isMobile } from 'react-device-detect';
import type { IAreaChartSpec } from '../../../../src/index';
// eslint-disable-next-line no-duplicate-imports
import {
  default as VChart,
  registerMediaQuery,
  registerAnimate,
  registerCustomAnimate,
  registerStateTransition,
  registerSequentialAnimate
} from '../../../../src/index';
registerAnimate();
registerCustomAnimate();
registerStateTransition();
registerSequentialAnimate();

const valueList = [
  new Array(10000).fill(0).map((item, index) => ({ x: index, y: Math.random() * 100 })),
  new Array(10000).fill(0).map((item, index) => ({ x: index, y: Math.random() * 100 })),
  new Array(10000).fill(0).map((item, index) => ({ x: index, y: Math.random() * 100 })),
  new Array(10000).fill(0).map((item, index) => ({ x: index, y: Math.random() * 100 })),
  new Array(10000).fill(0).map((item, index) => ({ x: index, y: Math.random() * 100 })),
  new Array(10000).fill(0).map((item, index) => ({ x: index, y: Math.random() * 100 })),
  new Array(10000).fill(0).map((item, index) => ({ x: index, y: Math.random() * 100 }))
];

const spec = {
  type: 'common',
  series: [
    {
      type: 'scatter',
      xField: 'x',
      yField: 'y',
      animationThreshold: 10000000000
    }
  ],
  animation: false,
  axes: [
    {
      title: {
        visible: true,
        text: 'Horse Power'
      },
      orient: 'left',
      range: { min: 0 },
      type: 'linear'
    },
    {
      title: {
        visible: true,
        text: 'Miles Per Gallon'
      },
      orient: 'bottom',
      label: { visible: true },
      type: 'linear'
    }
  ],
  data: [
    {
      id: 'data',
      values: new Array(10000).fill(0).map((item, index) => ({ x: index, y: Math.random() * 100 }))
    }
  ]
};

const run = () => {
  const button = document.createElement('button');
  button.innerHTML = 'create';
  let cs;
  button.addEventListener('click', () => {
    registerMediaQuery();
    // VChart.ThemeManager.setCurrentTheme('dark');
    cs = new VChart(spec, {
      dom: document.getElementById('chart') as HTMLElement,
      mode: isMobile ? 'mobile-browser' : 'desktop-browser',
      //theme: 'dark',
      onError: err => {
        console.error(err);
      }
    });
    console.time('renderTime');

    cs.renderAsync().then(() => {
      console.timeEnd('renderTime');
    });

    window['vchart'] = cs;
  });

  document.body.appendChild(button);

  const button2 = document.createElement('button');
  button2.innerHTML = 'update';
  button2.addEventListener('click', () => {
    cs.updateData('data', valueList[Math.floor(Math.random() * valueList.length)]);
  });
  document.body.appendChild(button2);
};
run();
