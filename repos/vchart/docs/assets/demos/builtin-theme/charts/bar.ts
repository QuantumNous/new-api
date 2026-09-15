import { IBarChartSpec } from '@visactor/vchart';
import { IChartInfo } from './interface';

export default {
  title: 'Bar Chart',
  spec: {
    type: 'bar',
    direction: 'horizontal',
    data: [
      {
        id: 'barData',
        values: [
          { type: 'Autocracies', year: '1930', value: 129 },
          { type: 'Autocracies', year: '1940', value: 133 },
          { type: 'Autocracies', year: '1950', value: 130 },
          { type: 'Autocracies', year: '1960', value: 126 },
          { type: 'Autocracies', year: '1970', value: 117 },
          { type: 'Autocracies', year: '1980', value: 114 },
          { type: 'Autocracies', year: '1990', value: 111 },
          { type: 'Autocracies', year: '2000', value: 89 },
          { type: 'Autocracies', year: '2010', value: 80 },
          { type: 'Autocracies', year: '2018', value: 80 },
          { type: 'Democracies', year: '1930', value: 22 },
          { type: 'Democracies', year: '1940', value: 13 },
          { type: 'Democracies', year: '1950', value: 25 },
          { type: 'Democracies', year: '1960', value: 29 },
          { type: 'Democracies', year: '1970', value: 38 },
          { type: 'Democracies', year: '1980', value: 41 },
          { type: 'Democracies', year: '1990', value: 57 },
          { type: 'Democracies', year: '2000', value: 87 },
          { type: 'Democracies', year: '2010', value: 98 },
          { type: 'Democracies', year: '2018', value: 99 }
        ]
      }
    ],
    yField: ['year', 'type'],
    xField: 'value',
    seriesField: 'type',
    label: {
      visible: true
    },
    legends: {
      visible: true,
      orient: 'right'
    },
    scrollBar: {
      start: 0,
      end: 0.5
    }
  } as IBarChartSpec
} as IChartInfo;
