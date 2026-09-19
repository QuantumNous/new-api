import { isMobile } from 'react-device-detect';
import type { ITooltipTheme } from '../../../../src/index';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

const run = () => {
  const data = [
    { year: '2012', type: 'Forest', value: 320 },
    { year: '2012', type: 'Steppe', value: 220 },
    { year: '2012', type: 'Desert', value: 150 },
    { year: '2012', type: 'Wetland', value: 98 },
    { year: '2013', type: 'Forest', value: 332 },
    { year: '2013', type: 'Steppe', value: 182 },
    { year: '2013', type: 'Desert', value: 232 },
    { year: '2013', type: 'Wetland', value: 77 },
    { year: '2014', type: 'Forest', value: 301 },
    { year: '2014', type: 'Steppe', value: 191 },
    { year: '2014', type: 'Desert', value: 201 },
    { year: '2014', type: 'Wetland', value: 101 },
    { year: '2015', type: 'Forest', value: 334 },
    { year: '2015', type: 'Steppe', value: 234 },
    { year: '2015', type: 'Desert', value: 154 },
    { year: '2015', type: 'Wetland', value: 99 },
    { year: '2016', type: 'Forest', value: 390 },
    { year: '2016', type: 'Steppe', value: 290 },
    { year: '2016', type: 'Desert', value: 190 },
    { year: '2016', type: 'Wetland', value: 40 }
  ];
  const aggregation = {};
  data.forEach(({ year, value }) => {
    if (!aggregation[year]) {
      aggregation[year] = 0;
    }
    aggregation[year] += value;
  });
  const spec = {
    type: 'bar',
    data: [
      {
        id: 'bar',
        values: data
      }
    ],
    xField: ['year', 'type'],
    yField: 'value',
    seriesField: 'type',
    bar: {
      state: {
        legend_hover_reverse: {
          fill: '#ccc'
        }
      }
    },
    legends: {
      visible: true
    },
    tooltip: {
      mark: {
        title: {
          value: datum => `Y${datum['year']}`
        },
        content: [
          {
            key: datum => datum['type'],
            value: datum => datum['value']
          },
          {
            hasShape: false,
            key: 'Proportion',
            value: datum => Math.round((datum['value'] / aggregation[datum['year']]) * 10000) / 100 + '%'
          }
        ]
      },
      dimension: {
        title: {
          value: datum => `Y${datum['year']} (mouse scrolling available)`
        },
        content: [
          {
            key: datum => datum['type'],
            value: datum => datum['value']
          },
          {
            hasShape: false,
            key: datum => datum['type'] + ' Proportion',
            value: datum => Math.round((datum['value'] / aggregation[datum['year']]) * 10000) / 100 + '%'
          }
        ]
      },
      enterable: true,
      style: {
        maxContentHeight: 120,
        keyLabel: {
          maxWidth: 100,
          multiLine: true
        }
      } as ITooltipTheme
    }
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
