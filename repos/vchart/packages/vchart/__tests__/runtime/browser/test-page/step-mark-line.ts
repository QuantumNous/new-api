import type { IBarChartSpec, ILineChartSpec, IMarkLineSpec } from '../../../../src/index';
import { default as VChart } from '../../../../src/index';
const CONTAINER_ID = 'chart';

const run = () => {
  const spec: IBarChartSpec = {
    type: 'bar',
    padding: [12, 50, 12, 12],
    data: [
      {
        id: 'barData',
        values: [
          { month: 'Monday', sales: 22 },
          { month: 'Tuesday', sales: 13 },
          { month: 'Wednesday', sales: 25 },
          { month: 'Thursday', sales: 29 },
          { month: 'Friday', sales: 38 }
        ]
      }
    ],
    xField: 'month',
    yField: 'sales',
    markLine: [
      {
        type: 'type-step',
        coordinates: [
          { month: 'Monday', sales: 22 },
          { month: 'Wednesday', sales: 25 }
        ],
        connectDirection: 'top',
        expandDistance: 50,
        label: {
          formatMethod: (a, b) => {
            console.log(a, b);
            return 'sss';
          },
          labelBackground: {
            visible: true,
            style: {
              fillOpacity: 1
            }
          },
          style: {
            fill: '#000'
          }
        },
        line: {
          style: {
            lineDash: [0],
            lineWidth: 2
          }
        }
      },
      {
        type: 'type-step',
        coordinates: [
          { month: 'Thursday', sales: 29 },
          { month: 'Friday', sales: 38 }
        ],
        connectDirection: 'right',
        expandDistance: 80,
        label: {
          formatMethod: (a, b) => {
            console.log(a, b);
            return 'sss';
          },
          labelBackground: {
            visible: true,
            padding: 6,
            style: {
              fillOpacity: 1,
              fill: '#fff',
              stroke: '#000',
              lineWidth: 3,
              cornerRadius: 15
            }
          },
          style: {
            fill: '#000'
          }
        },
        line: {
          multiSegment: true,
          mainSegmentIndex: 1,
          style: [
            {
              lineDash: [2, 2],
              stroke: '#000',
              lineWidth: 2
            },
            {
              stroke: '#000',
              lineWidth: 2
            },
            {
              lineDash: [2, 2],
              stroke: '#000',
              lineWidth: 2
            }
          ]
        },
        endSymbol: {
          size: 12,
          refX: -6
        }
      }
    ]
  };

  const vchart = new VChart(spec, { dom: CONTAINER_ID });
  vchart.renderAsync();

  // Just for the convenience of console debugging, DO NOT COPY!
  window['vchart'] = vchart;
};
run();
