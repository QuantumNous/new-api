import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

const run = () => {
  const spec = {
    type: 'common',
    data: [
      {
        id: 'barData',
        values: [
          {
            State: 'WY',
            Age: 'Under 5 Years',
            Population: 25635
          },
          {
            State: 'WY',
            Age: '5 to 13 Years',
            Population: 1890
          },
          {
            State: 'WY',
            Age: '14 to 17 Years',
            Population: 9314
          },
          {
            State: 'DC',
            Age: 'Under 5 Years',
            Population: 30352
          },
          {
            State: 'DC',
            Age: '5 to 13 Years',
            Population: 20439
          },
          {
            State: 'DC',
            Age: '14 to 17 Years',
            Population: 10225
          },
          {
            State: 'VT',
            Age: 'Under 5 Years',
            Population: 38253
          },
          {
            State: 'VT',
            Age: '5 to 13 Years',
            Population: 42538
          },
          {
            State: 'VT',
            Age: '14 to 17 Years',
            Population: 15757
          },
          {
            State: 'ND',
            Age: 'Under 5 Years',
            Population: 51896
          },
          {
            State: 'ND',
            Age: '5 to 13 Years',
            Population: 67358
          },
          {
            State: 'ND',
            Age: '14 to 17 Years',
            Population: 18794
          },
          {
            State: 'AK',
            Age: 'Under 5 Years',
            Population: 72083
          },
          {
            State: 'AK',
            Age: '5 to 13 Years',
            Population: 85640
          },
          {
            State: 'AK',
            Age: '14 to 17 Years',
            Population: 22153
          }
        ]
      }
    ],
    series: [
      {
        type: 'bar',
        xField: ['State', 'Age'],
        yField: 'Population',
        seriesField: 'Age',
        bar: {
          state: {
            blur: {
              fillOpacity: 0.1
            }
          }
        },
        dataKey: ['State', 'Age', 'Population'],
        interactions: [
          {
            type: 'element-highlight-by-key'
          },
          {
            type: 'element-highlight-by-group'
          }
        ],
        stack: false
      },
      {
        type: 'scatter',
        xField: ['State', 'Age'],
        yField: 'Population',
        seriesField: 'Age',
        point: {
          style: {
            size: 0,
            stroke: null,
            lineWidth: 2,
            fillOpacity: 1,
            symbolType: 'circle',
            fill: 'white'
          },
          state: {
            dimension_hover: {
              size: 0
            },
            hover: {
              size: 10
            },
            highlight: {
              size: 10
            }
          }
        },
        stack: false,
        dataKey: ['State', 'Age', 'Population'],
        interactions: [
          {
            type: 'element-highlight-by-key'
          }
        ],
        animationUpdate: {
          duration: 100
        },
        tooltip: {
          visible: false
        }
      }
    ],
    axes: [
      {
        trimPadding: true,
        type: 'band',
        orient: 'bottom',
        paddingOuter: 0
      },
      {
        type: 'linear',
        orient: 'left'
      }
    ],
    legends: {
      orient: 'bottom',
      position: 'start'
    },
    tooltip: {
      group: {
        triggerMark: 'bar'
      }
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
