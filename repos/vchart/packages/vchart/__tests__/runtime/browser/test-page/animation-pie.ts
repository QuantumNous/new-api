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

let dataArray = [
  { type: 'oxygen', value: '46.60' },
  { type: 'silicon', value: '27.72' },
  { type: 'aluminum', value: '8.13' },
  { type: 'iron', value: '5' }
];

const spec = {
  type: 'pie',
  data: [
    {
      id: 'data0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' }
        // { type: 'iron', value: '5' }
      ]
    }
  ],
  pie: {
    state: {
      hover: {
        fill: 'red'
      }
    }
  },
  animationAppear: {
    duration: 1000
  },
  animationUpdate: {
    duration: 300
  },
  animationEnter: {
    duration: 1000,
    type: 'growAngleIn'
  },
  animationExit: {
    duration: 1000,
    type: 'growAngleOut'
  },
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  legends: {
    visible: true
  },
  label: {
    visible: true
  }
};

const run = () => {
  registerMediaQuery();
  // VChart.ThemeManager.setCurrentTheme('dark');
  const cs = new VChart(spec, {
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

  const button = document.createElement('button');
  button.innerHTML = 'update';
  button.addEventListener('click', () => {
    dataArray = dataArray.map(d => ({ ...d, value: 100 * Math.random() }));
    cs.updateData('data0', dataArray);
  });
  document.body.appendChild(button);

  const button2 = document.createElement('button');
  button2.innerHTML = 'add&remove';
  button2.addEventListener('click', () => {
    const name = Math.random().toString();
    dataArray = [
      { type: 'oxygen', value: '16.60' }, // update
      { type: 'silicon', value: '27.72' },
      // { type: 'aluminum', value: '8.13' }, // remove
      { type: 'test', value: '8.13' } // add
      // { type: 'iron', value: '5' }
    ];
    cs.updateDataSync('data0', dataArray);
  });
  document.body.appendChild(button2);

  // document.body.appendChild(button5);
  // const button6 = document.createElement('button');
  // button6.innerHTML = 'direction';
  // button6.addEventListener('click', () => {
  //   const nextSpec: any = { ...spec };
  //   nextSpec.direction = nextSpec.direction === 'horizontal' ? 'vertical' : 'horizontal';
  //   [nextSpec.xField, nextSpec.yField] = [nextSpec.yField, nextSpec.xField];
  //   spec = nextSpec;
  //   cs.updateSpec(spec as any);
  // });
  // document.body.appendChild(button6);

  window['vchart'] = cs;
  console.log(cs);
};
run();
