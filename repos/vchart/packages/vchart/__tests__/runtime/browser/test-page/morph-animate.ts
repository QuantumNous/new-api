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

// registerMorph();

const pieSpec = {
  type: 'pie',
  data: [
    {
      values: [
        { type: '1', value: Math.random() },
        { type: '2', value: Math.random() },
        { type: '3', value: Math.random() }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.6,
  valueField: 'value',
  categoryField: 'type',
  cornerRadius: 100,
  tooltip: false
};

const bar = Object.assign({}, pieSpec, {
  type: 'bar',
  xField: 'type',
  yField: 'value',
  seriesField: 'type',
  bar: {
    style: {
      fillOpacity: 0.8,
      cornerRadius: 100
    }
  }
});
const scatter = Object.assign({}, pieSpec, {
  type: 'scatter',
  xField: 'type',
  yField: 'value',
  // seriesField: 'type',
  scatter: {
    style: {
      fillOpacity: 0.8,
      cornerRadius: 100,
      size: 60
    }
  },
  morph: {
    enable: true,
    morphKey: 'aaa',
    morphElementKey: null
  }
});
const line = Object.assign({}, pieSpec, {
  type: 'line',
  xField: 'type',
  yField: 'value',
  seriesField: 'type',
  scatter: {
    style: {
      fillOpacity: 0.8,
      cornerRadius: 100,
      size: 60
    }
  }
});
const area = Object.assign({}, pieSpec, {
  type: 'area',
  xField: 'type',
  yField: 'value',
  morph: {
    enable: true,
    morphKey: 'aaa',
    morphElementKey: null
  },
  scatter: {
    style: {
      fillOpacity: 0.8,
      cornerRadius: 100,
      size: 60
    }
  }
});
const funnel = Object.assign({}, pieSpec, {
  type: 'funnel',
  categoryField: 'type',
  valueField: 'value'
});
const progress = Object.assign({}, pieSpec, {
  type: 'circularProgress',
  valueField: 'value',
  categoryField: 'type',
  seriesField: 'type',
  radius: 0.8,
  innerRadius: 0.5,
  roundCap: true,
  cornerRadius: 20,
  progress: {
    style: {
      innerPadding: 5,
      outerPadding: 5
    }
  }
});

const run = () => {
  registerMediaQuery();

  const specs: any[] = [pieSpec, bar, scatter, funnel, progress];

  // VChart.ThemeManager.setCurrentTheme('dark');
  const cs = new VChart(specs[0], {
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

  let count = 1;
  setInterval(() => {
    cs.updateSpec(specs[count % specs.length]);
    count++;
  }, 2000);

  window['vchart'] = cs;
  console.log(cs);
};
run();
