import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';

const run = () => {
  const spec = {
    type: 'linearProgress',
    title: {
      text: '条形进度图'
    },
    // animation: false,
    data: {
      values: [
        {
          type: 'Tradition Industries',
          value: 0.5,
          text: '50%'
        },
        {
          type: 'Business Companies',
          value: 0.25,
          text: '25%'
        }
      ]
    },
    direction: 'horizontal',
    xField: 'value',
    yField: 'type',
    seriesField: 'type',
    axes: [
      {
        orient: 'left',
        domainLine: { visible: false }
      }
    ]
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
