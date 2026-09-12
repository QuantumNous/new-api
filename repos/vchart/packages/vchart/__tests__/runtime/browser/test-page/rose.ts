import { isMobile } from 'react-device-detect';
import type { IRoseChartSpec } from '../../../../src/index';
import { VChart } from '../../../../src/index';

const run = () => {
  const spec: IRoseChartSpec = {
    type: 'rose',
    data: [
      {
        values: [
          {
            value: '159',
            type: 'Tradition Industries'
          },
          {
            value: '50',
            type: 'Business Companies'
          },
          {
            value: '13',
            type: 'Customer-facing Companies'
          }
        ]
      }
    ],
    outerRadius: 0.8,
    innerRadius: 0.2,
    categoryField: 'type',
    valueField: 'value',
    seriesField: 'type',
    label: {
      visible: true,
      layout: {
        tangentConstraint: false
      }
    },
    axes: [
      {
        type: 'band',
        orient: 'angle',
        visible: true,
        grid: {
          visible: true
        },
        domainLine: {
          visible: true
        },
        label: {
          visible: true
        }
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
