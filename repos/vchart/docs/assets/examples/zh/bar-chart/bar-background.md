---
category: examples
group: bar chart
title: 带条形背景的条形图
keywords: barChart,comparison,distribution,rectangle,composition,rank
cover: /vchart/preview/bar-background_1.6.0.png
option: barChart
---

# 带条形背景的条形图

条形图和柱状图都可以设置 bar 图元的背景图元 barBackground。

## 关键配置

- 在 `xField` 属性上设置 x 轴的映射字段以及**分组字段**。
- `seriesField` 属性声明了颜色映射字段。
- `stack` 属性声明为 true 用来配置堆叠，会根据 `seriesField` 属性声明的字段进行堆叠
- `axes` 属性中为位于 `bottom` 位置的坐标轴轴线开启配置 `domainLine.onZero`，将轴线调整到纵轴数值 0 处
- `barBackground` 属性为背景图元的设置，设置项与 `bar` 相同。背景图元默认不显示

## 代码演示

```javascript livedemo
const response = await fetch('https://www.unpkg.com/@visactor/vchart-theme@latest/public/vScreenVolcanoBlue.json');
const theme = await response.json();
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          date: '2019-08-29',
          group: 'A',
          value: 154,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'B',
          value: 378,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'A',
          value: 103,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'B',
          value: 310,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'A',
          value: 153,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'B',
          value: 398,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'A',
          value: 105,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'B',
          value: 298,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'A',
          value: 151,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'B',
          value: 408,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'A',
          value: 110,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'B',
          value: 302,
          stack: 'Drink'
        }
      ]
    }
  ],
  xField: ['date', 'stack', 'group'],
  yField: 'value',
  seriesField: 'group',
  stack: true,
  barBackground: {
    visible: true,
    fieldLevel: 0,
    style: {
      lineWidth: 0,
      fill: 'rgba(255,255,255,0.15)'
    }
  },
  axes: [
    {
      orient: 'left',
      title: {
        visible: true,
        text: 'Week-on-week (sales)'
      },
      tick: {
        tickCount: 10
      }
    },
    {
      orient: 'top',
      showAllGroupLayers: true
    }
  ],
  tooltip: {
    dimension: {
      content: [
        {
          key: datum => `${datum.stack}-${datum.group}`,
          value: datum => datum.value
        }
      ]
    }
  },
  animation: false,
  theme
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

let ptr = 0;
const specList = [
  {
    barBackground: {
      fieldLevel: 0,
      style: {
        lineWidth: 0
      }
    }
  },
  {
    barBackground: {
      fieldLevel: 1,
      style: {
        lineWidth: 0
      }
    }
  },
  {
    barBackground: {
      fieldLevel: 2,
      style: {
        lineWidth: 0
      }
    }
  },
  {
    barBackground: {
      fieldLevel: 2,
      style: {
        lineWidth: 2,
        stroke: null
      }
    }
  }
];
const timer = setInterval(() => {
  vchart?.updateSpec(specList[++ptr % specList.length], true);
}, 1500);

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 关键配置

## 相关教程

[柱状图](link)
