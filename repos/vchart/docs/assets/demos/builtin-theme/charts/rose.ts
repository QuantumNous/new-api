import { IRoseChartSpec } from '@visactor/vchart';
import { IChartInfo } from './interface';

export default {
  title: 'Rose Chart',
  spec: {
    type: 'rose',
    data: {
      id: '0',
      values: [
        {
          time: '2:00',
          value: 27,
          type: 'Sales'
        },
        {
          time: '6:00',
          value: 25,
          type: 'Sales'
        },
        {
          time: '10:00',
          value: 18,
          type: 'Sales'
        },
        {
          time: '14:00',
          value: 15,
          type: 'Sales'
        },
        {
          time: '18:00',
          value: 10,
          type: 'Sales'
        },
        {
          time: '22:00',
          value: 5,
          type: 'Sales'
        },
        {
          time: '2:00',
          value: 7,
          type: 'Discount'
        },
        {
          time: '6:00',
          value: 5,
          type: 'Discount'
        },
        {
          time: '10:00',
          value: 38,
          type: 'Discount'
        },
        {
          time: '14:00',
          value: 5,
          type: 'Discount'
        },
        {
          time: '18:00',
          value: 20,
          type: 'Discount'
        },
        {
          time: '22:00',
          value: 15,
          type: 'Discount'
        }
      ]
    },
    categoryField: ['time', 'type'],
    valueField: 'value',
    seriesField: 'type',
    outerRadius: 0.8,
    axes: [
      {
        orient: 'angle',
        domainLine: { visible: true },
        grid: { visible: true },
        label: {
          visible: true
        }
      },
      {
        orient: 'radius',
        grid: { visible: true, smooth: true },
        label: {
          visible: true
        }
      }
    ],
    crosshair: {
      categoryField: {
        visible: true,
        line: {
          type: 'rect'
        }
        /*
        label: {
          visible: true
        }
        */
      },
      valueField: {
        visible: true,
        line: {
          type: 'line',
          smooth: true
        }
        /*
        label: {
          visible: true
        }
        */
      }
    },
    legends: {
      visible: true,
      orient: 'left'
    }
  } as IRoseChartSpec
} as IChartInfo;
