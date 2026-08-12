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

const goldenMedals = {
  2000: [
    { country: 'USA', value: 37 },
    { country: 'Russia', value: 32 },
    { country: 'China', value: 28 },
    { country: 'Australia', value: 16 },
    { country: 'Germany', value: 13 },
    { country: 'France', value: 13 },
    { country: 'Italy', value: 13 },
    { country: 'Netherlands', value: 12 },
    { country: 'Cuba', value: 11 },
    { country: 'U.K.', value: 11 }
  ],
  2004: [
    { country: 'USA', value: 46 },
    { country: 'China', value: 32 },
    { country: 'Russia', value: 28 },
    { country: 'Australia', value: 17 },
    { country: 'Japan', value: 16 },
    { country: 'Germany', value: 13 },
    { country: 'France', value: 11 },
    { country: 'Italy', value: 10 },
    { country: 'South Korea', value: 9 },
    { country: 'U.K.', value: 9 }
  ],
  2008: [
    { country: 'China', value: 58 },
    { country: 'USA', value: 36 },
    { country: 'Russia', value: 24 },
    { country: 'U.K.', value: 19 },
    { country: 'Germany', value: 16 },
    { country: 'Australia', value: 14 },
    { country: 'South Korea', value: 13 },
    { country: 'Japan', value: 9 },
    { country: 'Italy', value: 8 },
    { country: 'France', value: 7 }
  ],
  2012: [
    { country: 'USA', value: 66 },
    { country: 'China', value: 39 },
    { country: 'U.K.', value: 29 },
    { country: 'Russia', value: 19 },
    { country: 'South Korea', value: 13 },
    { country: 'Germany', value: 11 },
    { country: 'France', value: 11 },
    { country: 'Australia', value: 8 },
    { country: 'Italy', value: 8 },
    { country: 'Hungary', value: 8 }
  ],
  2016: [
    { country: 'USA', value: 106 },
    { country: 'U.K.', value: 27 },
    { country: 'China', value: 26 },
    { country: 'Russia', value: 19 },
    { country: 'Germany', value: 17 },
    { country: 'Japan', value: 12 },
    { country: 'France', value: 10 },
    { country: 'South Korea', value: 9 },
    { country: 'Italy', value: 8 },
    { country: 'Australia', value: 8 }
  ],
  2020: [
    { country: 'USA', value: 39 },
    { country: 'China', value: 38 },
    { country: 'Japan', value: 27 },
    { country: 'U.K.', value: 22 },
    { country: 'Russian Olympic Committee', value: 20 },
    { country: 'Australia', value: 17 },
    { country: 'Netherlands', value: 10 },
    { country: 'France', value: 10 },
    { country: 'Germany', value: 10 },
    { country: 'Italy', value: 10 }
  ]
};

const colors = {
  China: '#d62728',
  USA: '#1664FF',
  Russia: '#B2CFFF',
  'U.K.': '#1AC6FF',
  Australia: '#94EFFF',
  Japan: '#FF8A00',
  Cuba: '#FFCE7A',
  Germany: '#3CC780',
  France: '#B9EDCD',
  Italy: '#7442D4',
  'South Korea': '#DDC5FA',
  'Russian Olympic Committee': '#B2CFFF',
  Netherlands: '#FFC400',
  Hungary: '#FAE878'
};

const dataSpecs = Object.keys(goldenMedals).map(year => {
  return {
    data: [
      {
        id: 'id',
        values: goldenMedals[year]
          .sort((a, b) => b.value - a.value)
          .map(v => {
            return { ...v, fill: colors[v.country] };
          })
      },
      {
        id: 'year',
        values: [{ year }]
      }
    ]
  };
});
const duration = 1000;
const exchangeDuration = 600;

const spec = {
  type: 'bar',
  padding: {
    top: 12,
    right: 100,
    bottom: 12
  },
  data: dataSpecs[0].data,
  direction: 'horizontal',
  yField: 'country',
  xField: 'value',
  seriesField: 'country',
  bar: {
    style: {
      fill: datum => datum.fill
    }
  },
  axes: [
    {
      animation: true,
      orient: 'bottom',
      type: 'linear',
      visible: true,
      grid: {
        visible: true
      }
    },
    {
      animation: true,
      id: 'axis-left',
      orient: 'left',
      width: 130,
      tick: { visible: false },
      label: { visible: true },
      type: 'band'
    }
  ],
  title: {
    visible: true,
    text: 'Top 10 Olympic Gold Medals by Country Since 2000'
  },
  animationUpdate: {
    bar: [
      {
        type: 'update',
        options: { excludeChannels: ['y'] },
        easing: 'linear',
        duration
      },
      {
        channel: ['y'],
        easing: 'circInOut',
        duration: exchangeDuration
      }
    ],
    axis: {
      duration: exchangeDuration,
      easing: 'circInOut'
    }
  },
  animationEnter: {
    bar: [
      {
        type: 'moveIn',
        duration: exchangeDuration,
        easing: 'circInOut',
        options: {
          direction: 'y',
          orient: 'negative'
        }
      }
    ]
  },
  animationExit: {
    bar: [
      {
        type: 'fadeOut',
        duration: exchangeDuration
      }
    ]
  },
  customMark: [
    {
      type: 'text',
      dataId: 'year',
      style: {
        textBaseline: 'bottom',
        fontSize: 200,
        textAlign: 'right',
        fontFamily: 'PingFang SC',
        fontWeight: 600,
        text: datum => datum.year,
        x: (datum, ctx) => {
          return ctx.vchart.getChart().getCanvasRect()?.width - 50;
        },
        y: (datum, ctx) => {
          return ctx.vchart.getChart().getCanvasRect()?.height - 50;
        },
        fill: 'grey',
        fillOpacity: 0.5
      }
    }
  ],
  player: {
    type: 'continuous',
    orient: 'bottom',
    auto: true,
    loop: true,
    dx: 80,
    position: 'middle',
    interval: duration,
    specs: dataSpecs,
    slider: {
      railStyle: {
        height: 6
      }
    },
    controller: {
      backward: {
        style: {
          size: 12
        }
      },
      forward: {
        style: {
          size: 12
        }
      },
      start: {
        order: 1,
        position: 'end'
      }
    }
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
