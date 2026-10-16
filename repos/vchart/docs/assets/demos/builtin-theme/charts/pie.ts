import { IPieChartSpec } from '@visactor/vchart';
import { IChartInfo } from './interface';

export default {
  title: 'Pie Chart',
  spec: {
    type: 'pie',
    data: [
      {
        id: 'id0',
        values: [
          { type: 'oxygen', value: '46.60' },
          { type: 'silicon', value: '27.72' },
          { type: 'aluminum', value: '8.13' },
          { type: 'iron', value: '5' },
          { type: 'calcium', value: '3.63' },
          { type: 'sodium', value: '2.83' },
          { type: 'potassium', value: '2.59' },
          { type: 'others', value: '3.5' }
        ]
      }
    ],
    valueField: 'value',
    categoryField: 'type',
    title: {
      visible: true,
      text: 'Statistics of Surface Element Content'
    },
    legends: {
      visible: true,
      orient: 'left',
      title: {
        visible: true,
        text: 'Elements'
      }
    },
    label: {
      visible: true
    }
  } as IPieChartSpec
} as IChartInfo;
