import { isMobile } from 'react-device-detect';
import type { IVennChartSpec } from '../../../../src/index';
// eslint-disable-next-line no-duplicate-imports
import { default as VChart, registerVennChart } from '../../../../src/index';

const spec: IVennChartSpec = {
  type: 'venn',
  data: {
    values: [
      { sets: ['A'], value: 50 },
      { sets: ['B'], value: 10 },
      { sets: ['C'], value: 8 },
      { sets: ['D'], value: 6 },
      { sets: ['E'], value: 7 },
      { sets: ['F'], value: 5 },
      { sets: ['G'], value: 4 },
      { sets: ['H'], value: 4 },
      { sets: ['I'], value: 4 },
      { sets: ['J'], value: 3 },
      { sets: ['A', 'B'], value: 4 },
      { sets: ['A', 'C'], value: 3 },
      { sets: ['A', 'D'], value: 3 },
      { sets: ['A', 'E'], value: 3 },
      { sets: ['A', 'F'], value: 3 },
      { sets: ['A', 'G'], value: 2 },
      { sets: ['A', 'H'], value: 2 },
      { sets: ['A', 'I'], value: 2 },
      { sets: ['A', 'J'], value: 2 }
    ]
  },
  categoryField: 'sets',
  valueField: 'value',
  seriesField: 'sets',
  circle: {
    style: {
      strokeOpacity: 0.8,
      fill: 'transparent',
      lineWidth: 8
    },
    state: {
      hover: {
        stroke: 'black',
        lineWidth: 8
      }
    }
  },
  overlap: {
    style: {
      strokeOpacity: 0.8,
      fill: 'transparent',
      lineWidth: 8
    },
    state: {
      hover: {
        stroke: 'black',
        lineWidth: 8
      }
    }
  },
  label: {
    style: {
      fill: 'black'
    }
  },
  legends: [
    {
      visible: true,
      position: 'middle',
      orient: 'bottom',
      data: items => {
        items.forEach(({ shape }) => (shape.fill = shape.stroke));
        return items;
      }
    }
  ],
  tooltip: {
    mark: {
      updateContent: prev => {
        prev?.forEach(line => {
          line.shapeFill = line.shapeStroke;
        });
        return prev;
      }
    }
  }
};

const run = () => {
  registerVennChart();
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

  window['vchart'] = cs;
  console.log(cs);
};
run();
