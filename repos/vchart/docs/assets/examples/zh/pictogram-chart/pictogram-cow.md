---
category: examples
group: pictogram chart
title: 象形图-牛肉示意图
keywords: pictogramChart, space
order: 26-1
cover: /vchart/preview/pictogram-cow_1.13.0.png
option: pictogramChart
---

# 象形图-牛肉部位示意图

> Demo 复刻自 echarts-庖丁解牛 示例

## 关键配置

- 在 SVG 文件中，为图元配置 name 属性，则在图表配置中可以通过 name 配置指定图元样式；

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

const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/cow.svg');
const cow = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: [
      { name: 'Queue', value: 15 },
      { name: 'Langue', value: 35 },
      { name: 'Plat de joue', value: 15 },
      { name: 'Gros bout de poitrine', value: 25 },
      { name: 'Jumeau à pot-au-feu', value: 45 },
      { name: 'Onglet', value: 85 },
      { name: 'Plat de tranche', value: 25 },
      { name: 'Araignée', value: 15 },
      { name: 'Gîte à la noix', value: 55 },
      { name: "Bavette d'aloyau", value: 25 },
      { name: 'Tende de tranche', value: 65 },
      { name: 'Rond de gîte', value: 45 },
      { name: 'Bavettede de flanchet', value: 85 },
      { name: 'Flanchet', value: 35 },
      { name: 'Hampe', value: 75 },
      { name: 'Plat de côtes', value: 65 },
      { name: 'Tendron Milieu de poitrine', value: 65 },
      { name: 'Macreuse à pot-au-feu', value: 85 },
      { name: 'Rumsteck', value: 75 },
      { name: 'Faux-filet', value: 65 },
      { name: 'Côtes Entrecôtes', value: 55 },
      { name: 'Basses côtes', value: 45 },
      { name: 'Collier', value: 85 },
      { name: 'Jumeau à biftek', value: 15 },
      { name: 'Paleron', value: 65 },
      { name: 'Macreuse à bifteck', value: 45 },
      { name: 'Gîte', value: 85 },
      { name: 'Aiguillette baronne', value: 65 },
      { name: 'Filet', value: 95 }
    ]
  },
  nameField: 'name',
  valueField: 'value',
  color: {
    type: 'linear',
    domain: [
      {
        dataId: 'data',
        fields: ['value']
      }
    ],
    range: ['#f51633', '#921319']
  },
  legends: [
    {
      visible: true,
      type: 'color',
      field: 'value',
      orient: 'top'
    }
  ],
  region: [
    {
      roam: true
    }
  ],
  svg: 'cow',
  pictogram: {
    style: {
      fill: {
        field: 'value',
        scale: 'color'
      }
    }
  },
  'Tendron Milieu de poitrine': {
    style: {
      fill: 'orange'
    },
    state: {
      hover: {
        fill: '#FFBF7F'
      }
    }
  }
};
VChart.registerSVG('cow', cow);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[象形图](link)
