import { ICommonChartSpec } from '@visactor/vchart';
import { IChartInfo } from './interface';

const yearData: any = {};
const firstYear = 1950;
const lastYear = 2023;

for (let year = firstYear; year <= lastYear; year++) {
  const data: any[] = [];
  yearData[year] = data;

  for (let i = 0; i < 50; i++) {
    if (year === firstYear) {
      data.push({
        x: Math.round(Math.random() * 100 - 90),
        y: Math.round(Math.random() * 100 - 90),
        value: Math.round(Math.random() * 1000),
        index: i
      });
    } else {
      const previous = yearData[year - 1][i];
      data.push({
        x: previous.x + Math.round(Math.random() * 5 - 2 + i / 50),
        y: previous.y + Math.round(Math.random() * 5 - 2 + i / 50),
        value: Math.abs(previous.value + Math.round(Math.random() * 100 - 45)),
        index: i
      });
    }
  }
}

const specs = Object.values(yearData).map((data, index) => {
  return {
    data: [
      {
        id: 'id',
        values: data
      },
      {
        id: 'year',
        values: [{ year: Object.keys(yearData)[index] }]
      }
    ]
  };
});

const DURATION = 300;

export default {
  title: 'Scatter Chart',
  spec: {
    type: 'common',
    player: {
      orient: 'bottom',
      auto: true,
      interval: DURATION,
      dy: 10,
      specs
    },
    data: specs[0].data,
    axes: [
      {
        orient: 'left',
        type: 'linear',
        range: { min: -100, max: 100 }
      },
      {
        orient: 'bottom',
        type: 'linear',
        range: { min: -100, max: 100 }
      }
    ],
    series: [
      {
        type: 'scatter',
        // 通过数据中的 index 进行数据匹配
        dataKey: 'index',
        // 声明点半径大小
        sizeField: 'value',
        size: {
          type: 'linear',
          range: [5, 30]
        },
        xField: 'x',
        yField: 'y',
        animationAppear: {
          duration: DURATION,
          easing: 'linear'
        },
        animationUpdate: {
          duration: DURATION,
          easing: 'linear'
        }
      }
    ],
    crosshair: {
      xField: { visible: true },
      yField: { visible: true }
    },
    legends: {
      visible: true,
      type: 'size',
      orient: 'right',
      field: 'value',
      width: 100
    } as any
  } as ICommonChartSpec
} as IChartInfo;
