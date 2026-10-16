import { isMobile } from 'react-device-detect';
import type { IAreaChartSpec } from '../../../../src/index';
// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../../src/index';

const getSpec = (): IAreaChartSpec => ({
  type: 'area',
  direction: 'horizontal',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked area chart of cosmetic products sales'
  },
  // stack: true,
  yField: 'type',
  xField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  crosshair: {
    xField: { visible: true, label: { visible: true } },
    yField: { visible: true, label: { visible: true } }
  },
  axes: [
    {
      orient: 'left',
      type: 'band',
      minBandSize: 50,
      maxBandSize: 100,
      autoRegionSize: true,
      inverse: true
    },
    { orient: 'top', type: 'linear' },
    { orient: 'bottom', type: 'linear' }
  ],
  scrollBar: [
    { orient: 'right', start: 0, filterMode: 'axis', axisIndex: 0, auto: true }
    // { orient: 'bottom', start: 0, end: 0.5, roam: true, filterMode: 'axis' }
  ],
  tooltip: {
    // renderMode: 'canvas',
    dimension: {
      content: [
        {
          key: 'type11111',
          value: 'type11111',
          shapeFill: 'transparent',
          shapeLineWidth: 0.2
          /*
          shapeType:
            // eslint-disable-next-line max-len
            'M-0.020059 -0.978425 C-0.018029 -0.9888053 -0.013378 -1 0 -1 C0.01342 -1 0.01812 -0.989146 0.0201 -0.978425 C0.02161 -0.9702819 0.0692 -0.459505 0.09486 -0.184807 C0.10298 -0.097849 0.1089 -0.034548 0.11047 -0.018339 C0.11698 0.04908 0.07373 0.11111 0.00002 0.11111 C-0.07369 0.11111 -0.117184 0.04991 -0.110423 -0.018339 C-0.103662 -0.086591 -0.022089 -0.9680447 -0.020059 -0.978425Z'
          */
        }
      ],
      position: 'tl',
      positionMode: 'pointer'
    },
    mark: {
      position: 'top'
    }
  }
});

const run = () => {
  // VChart.ThemeManager.setCurrentTheme('dark');
  const cs = new VChart(getSpec(), {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    theme: 'dark'
  });
  console.time('renderTime');

  cs.on('tooltipShow', () => {
    console.log('tooltipShow');
  });

  cs.on('tooltipHide', () => {
    console.log('tooltipHide');
  });

  cs.on('tooltipRelease', () => {
    console.log('tooltipRelease');
  });

  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  window['getSpec'] = getSpec;
  console.log(cs);
};
run();
