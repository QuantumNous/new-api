import { IBarChartSpec } from '@visactor/vchart';
import { IChartInfo } from './interface';

export default {
  title: 'Bar Chart',
  spec: {
    type: 'bar',
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
    xField: 'State',
    yField: 'Population',
    seriesField: 'Age',
    stack: true,
    legends: {
      visible: true
    },
    dataZoom: {
      orient: 'bottom'
    }
  } as IBarChartSpec
} as IChartInfo;
