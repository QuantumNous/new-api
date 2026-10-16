---
category: examples
group: pictogram chart
title: 象形图-心脏医学示意图
keywords: pictogramChart, space
order: 26-6
cover: https://cdn.jsdelivr.net/gh/Eomnational/image/img/20250303-105748.gif
option: pictogramChart
---

# 象形图-心脏医学示意图

> 由 [Zero1017](https://github.com/Eomnational) 贡献

象形图是一种数据可视化形式，它通过使用图形符号（通常是 SVG 格式）来表示数据中的具体值或类别。本示例展示了如何使用象形图来呈现心脏医学示意图，通过不同的颜色区分心脏的不同部分。

## 关键配置

- 通过 `VChart.registerSVG` 接口来注册 svg 资源；
- `svg` 属性声明为注册的 svg 名称；
- 使用 `color` 配置项为不同的心脏部分指定颜色；

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

// 从指定 URL 异步获取 SVG 资源
const response = await fetch('https://cdn.jsdelivr.net/gh/Eomnational/image/img/3.svg');
const shape = await response.text();

// 定义象形图的配置项
const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: [{ name: 'Aorta' }, { name: 'Vein' }, { name: 'CardiacBase' }, { name: 'PulmonaryArtery' }]
  },
  region: [
    {
      // 允许在空白区域漫游
      roam: { blank: true }
    }
  ],
  seriesField: 'name',
  nameField: 'name',
  valueField: 'value',
  svg: 'heart',
  color: {
    specified: {
      Aorta: '#F0321F',
      Vein: '#1AC6FF',
      CardiacBase: '#FB6747',
      PulmonaryArtery: '#FB8D6C',
      undefined: 'white'
    }
  },
  interactions: [
    {
      type: 'element-active-by-legend',
      filterField: 'name'
    }
  ],
  pictogram: {
    style: {
      fill: {
        scale: 'color',
        field: 'name'
      }
    },
    state: {
      active: {
        fillOpacity: 0.8,
        stroke: {
          scale: 'color',
          field: 'name'
        },
        lineWidth: 2
      },
      hover: {
        fillOpacity: 0.8,
        stroke: {
          scale: 'color',
          field: 'name'
        },
        lineWidth: 2
      }
    }
  },
  title: { text: 'Medical Schematic Diagram of the Heart' },
  legends: { orient: 'top', filter: false }
};

// 注册 SVG 资源
VChart.registerSVG('heart', shape);

// 创建 VChart 实例
const vchart = new VChart(spec, { dom: CONTAINER_ID });
// 渲染图表
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[象形图](link)
