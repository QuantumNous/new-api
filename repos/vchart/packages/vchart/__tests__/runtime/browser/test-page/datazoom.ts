import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';

const run = () => {
  const getSpec = () => ({
    width: 800,
    type: 'bar',
    xField: 'x',
    yField: 'y',
    seriesField: 'type',
    title: {
      text: 'xxx'
    },
    data: {
      id: 'data2',
      values: [
        { type: '1111', x: 'A', y: 80 },
        { type: '1111', x: 'B', y: 40 },
        { type: '1111', x: 'C', y: 10 },
        { type: '1111', x: 'D', y: 20 },
        { type: '2222', x: 'A', y: 80 },
        { type: '2222', x: 'B', y: 40 },
        { type: '2222', x: 'C', y: 10 },
        { type: '2222', x: 'D', y: 20 }
      ]
    },
    legends: {},
    dataZoom: [
      {
        orient: 'bottom'
      }
    ]
  });

  const cs = new VChart(getSpec(), {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    onError: null,
    logLevel: 5
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  window['getSpec'] = getSpec;
  console.log(cs);
};
run();
