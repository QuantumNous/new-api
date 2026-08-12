---
category: examples
group: pictogram chart
title: 象形图-选座售票图
keywords: pictogramChart, space
order: 26-0
cover: /vchart/preview/pictogram-seat-map_1.13.0.png
option: pictogramChart
---

# 象形图-选座售票图

象形图是一种数据可视化形式，它通过使用图形符号（通常是 SVG 格式）来表示数据中的具体值或类别。这种图表结合了图形艺术和数据分析，使得信息更具视觉吸引力和直观性。

## 关键配置

- 通过 `VChart.registerSVG` 接口来注册 svg 资源；
- `svg` 属性声明为注册的 svg 名称

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 1.x版本，在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
// 2.0.0版本，在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart-extension';
// registerPictogramChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
if (VCHART_MODULE.registerPictogramChart) {
  // 1.x 版本执行注册代码
  VCHART_MODULE.registerPictogramChart();
} else if (VChartExtension.registerPictogramChart) {
  // 2.0.0版本执行注册代码
  VChartExtension.registerPictogramChart();
}

const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/cinema.svg');
const cinema = await response.text();

const chosenSeats = [
  'Main Floor/A/10',
  'Main Floor/A/11',
  'Main Floor/A/12',
  'Main Floor/A/13',
  'Main Floor/A/14',
  'Main Floor/A/15',
  'Main Floor/A/16',
  'Main Floor/B/10',
  'Main Floor/B/11',
  'Main Floor/B/12',
  'Main Floor/B/13',
  'Main Floor/B/14',
  'Main Floor/B/15',
  'Main Floor/B/16',
  'Main Floor/C/10',
  'Main Floor/C/11',
  'Main Floor/C/12',
  'Main Floor/C/13',
  'Main Floor/C/14',
  'Main Floor/C/15',
  'Main Floor/C/16',
  'Main Floor/D/10',
  'Main Floor/D/11',
  'Main Floor/D/12',
  'Main Floor/D/13',
  'Main Floor/D/14',
  'Main Floor/D/15',
  'Main Floor/D/16',
  'Main Floor/E/10',
  'Main Floor/E/11',
  'Main Floor/E/12',
  'Main Floor/E/13',
  'Main Floor/E/14',
  'Main Floor/E/15',
  'Main Floor/E/16',
  'Main Floor/F/10',
  'Main Floor/F/11',
  'Main Floor/F/12',
  'Main Floor/F/13',
  'Main Floor/F/14',
  'Main Floor/F/15',
  'Main Floor/F/16',
  'Main Floor/G/10',
  'Main Floor/G/11',
  'Main Floor/G/12',
  'Main Floor/G/13',
  'Main Floor/G/14',
  'Main Floor/G/15',
  'Main Floor/G/16',
  'Main Floor/H/10',
  'Main Floor/H/11',
  'Main Floor/H/12',
  'Main Floor/H/13',
  'Main Floor/H/14',
  'Main Floor/H/15',
  'Main Floor/H/16',
  'Main Floor/J/10',
  'Main Floor/J/11',
  'Main Floor/J/12',
  'Main Floor/J/13',
  'Main Floor/J/14',
  'Main Floor/J/15',
  'Main Floor/J/16',
  'Main Floor/K/10',
  'Main Floor/K/11',
  'Main Floor/K/12',
  'Main Floor/K/13',
  'Main Floor/K/14',
  'Main Floor/K/15',
  'Main Floor/K/16',
  'Main Floor/L/10',
  'Main Floor/L/11',
  'Main Floor/L/12',
  'Main Floor/L/13',
  'Main Floor/L/14',
  'Main Floor/L/15',
  'Main Floor/L/16',
  'Main Floor/M/10',
  'Main Floor/M/11',
  'Main Floor/M/12',
  'Main Floor/M/13',
  'Main Floor/M/14',
  'Main Floor/M/15',
  'Main Floor/M/16',
  'Main Floor/N/10',
  'Main Floor/N/11',
  'Main Floor/N/12',
  'Main Floor/N/13',
  'Main Floor/N/14',
  'Main Floor/N/15',
  'Main Floor/N/16',
  'Main Floor/O/10',
  'Main Floor/O/11',
  'Main Floor/O/12',
  'Main Floor/O/13',
  'Main Floor/O/14',
  'Main Floor/O/15',
  'Main Floor/O/16',
  'Main Floor/P/10',
  'Main Floor/P/11',
  'Main Floor/P/12',
  'Main Floor/P/13',
  'Main Floor/P/14',
  'Main Floor/P/15',
  'Main Floor/P/16',
  'Main Floor/A/5',
  'Main Floor/B/14',
  'Main Floor/C/7',
  'Main Floor/D/20',
  'Main Floor/E/3',
  'Main Floor/F/12',
  'Main Floor/G/8',
  'Main Floor/H/18',
  'Main Floor/J/4',
  'Main Floor/K/15',
  'Main Floor/L/9',
  'Main Floor/M/19',
  'Main Floor/N/6',
  'Main Floor/O/11',
  'Main Floor/P/17',
  'Main Floor/Q/10',
  'Main Floor/R/7',
  'Main Floor/A/22',
  'Main Floor/B/28',
  'Main Floor/C/30',
  'Main Floor/D/14',
  'Main Floor/E/2'
];
const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: chosenSeats.map(seat => ({ name: seat, value: 1 }))
  },
  region: [
    {
      roam: true
    }
  ],
  pictogram: {
    style: {
      fill: data => {
        if (data?.data?.value > 0) {
          return 'red';
        }
        return 'lightgrey';
      }
    },
    state: {
      selected: {
        fill: 'green'
      },
      hover: {
        fill: 'lightgreen'
      }
    }
  },
  select: {
    enable: true,
    mode: 'multiple'
  },
  hover: {
    enable: true
  },
  svg: 'cinema',
  nameField: 'name',
  valueField: 'value'
};

VChart.registerSVG('cinema', cinema);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[象形图](link)
