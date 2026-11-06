import { IChartInfo } from './interface';

export default {
  title: 'Gauge Chart',
  spec: {
    type: 'gauge',
    data: [
      {
        id: 'pointer',
        values: [
          {
            type: 'A',
            value: 0.6
          }
        ]
      },
      {
        id: 'segment',
        values: [
          {
            type: 'Level 1',
            value: 0.4
          },
          {
            type: 'Level 2',
            value: 0.6
          },
          {
            type: 'Level 3',
            value: 0.8
          }
        ]
      }
    ],
    gauge: {
      type: 'gauge',
      dataIndex: 1,
      categoryField: 'type',
      valueField: 'value',
      seriesField: 'type',
      label: {
        visible: true,
        position: 'inside-outer',
        offsetRadius: 10,
        style: {
          text: datum => datum['type']
        }
      }
    },
    pointer: {
      style: {
        fill: '#666666'
      }
    },
    categoryField: 'type',
    valueField: 'value',
    outerRadius: 0.9,
    innerRadius: 0.6,
    startAngle: -225,
    endAngle: 45,
    axes: [
      {
        type: 'linear',
        orient: 'angle',
        inside: true,
        outerRadius: 0.9,
        innerRadius: 0.6,
        grid: { visible: false }
      }
    ],
    indicator: [
      {
        visible: true,
        offsetY: '65%',
        title: {
          style: {
            text: '60%'
          }
        },
        content: [
          {
            style: {
              text: 'Level 2'
            }
          }
        ]
      }
    ]
  }
} as IChartInfo;
