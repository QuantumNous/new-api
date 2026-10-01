import { isMobile } from 'react-device-detect';
import type { IAreaChartSpec, ILineChartSpec } from '../../../../src/index';
// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../../src/index';

const getData = () => {
  const data: any[] = [];
  for (let type = 0; type < 7; type++) {
    for (let i = 0; i < 60 * 24; i++) {
      data.push({
        type,
        category: i,
        value: Math.floor(Math.random() * 1000)
      });
    }
  }
  return data;
};

const getSpec = () => {
  const spec: ILineChartSpec = {
    type: 'line',
    data: {
      values: getData()
    },
    // stack: true,
    xField: 'category',
    yField: 'value',
    seriesField: 'type',
    legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
    crosshair: {
      xField: { visible: true }
    }
  };
  return spec;
};

const run = (i: number) => {
  const dom = document.createElement('div');
  dom.id = `chart_${i}`;
  document.getElementById('chart')?.appendChild(dom);
  const cs = new VChart(getSpec(), {
    dom,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs.renderSync();
  console.timeEnd('renderTime');
  window[`vchart_${i}`] = cs;
};
window[`getSpec`] = getSpec;
window[`getData`] = getData;

for (let i = 0; i < 4; i++) {
  run(i);
}
