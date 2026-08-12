---
category: examples
group: marker
title: markLine 指定数据点并计算线性回归
keywords: marker,commonChart
order: 33-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/marker/mark-line-part-regression.png
option: barChart#markLine
---

# markLine 指定数据点并计算线性回归

markLine 可以对选定的数据点进一步聚合或回归.

## 关键配置

数据点定位:

- `coordinates`属性声明构建 markLine 折线的数据点或数据聚合值数组.
  数据点的声明方式为`{ xKey: value , yKey: value }`, 其中`xKey`为 x 轴对应的数据字段; `yKey`为 y 轴对应的数据字段; `value`为数据字段对应的数值 或 数据聚合类型, 聚合方式支持`"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`.

数据回归:

- 当通过`coordinates`属性配置数据点时, 可以通过配置`process`对数据点进一步聚合; 当`process`属性配置为`{ xy: "regression" }`时, 即可进行数据回归

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'bottom',
      bandPadding: 0.4
    }
  ],
  label: {
    visible: true,
    style: {
      fill: '#222'
    }
  },
  markLine: [
    {
      coordinates: [
        { x: 1, y: 11.8 },
        { x: 2, y: 18.8 },
        { x: 3, y: 14.4 },
        { x: 4, y: 6.8 },
        { x: 5, y: 1.9 },
        { x: 6, y: 0.8 }
      ],
      process: {
        xy: 'regression'
      },
      label: {
        visible: false
      },
      line: {
        style: {
          stroke: '#F68484',
          lineDash: [],
          lineWidth: 2
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    },
    {
      coordinates: [
        { x: 7, y: 2.5 },
        { x: 8, y: 5.8 },
        { x: 9, y: 7.4 },
        { x: 10, y: 21.8 },
        { x: 11, y: 16.1 },
        { x: 12, y: 15.5 }
      ],
      process: {
        xy: 'regression'
      },
      label: {
        visible: false
      },
      line: {
        style: {
          stroke: '#2CB4A8',
          lineDash: [],
          lineWidth: 2
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    }
  ],
  title: {
    visible: true,
    text: 'Seattle Monthly Precipitation',
    align: 'center'
  },
  bar: {
    style: {
      stroke: '#333',
      fill: 'rgb(124, 182, 215)'
    }
  },
  data: {
    id: 'data2',
    values: [
      { x: 1, y: 11.8 },
      { x: 2, y: 18.8 },
      { x: 3, y: 14.4 },
      { x: 4, y: 6.8 },
      { x: 5, y: 1.9 },
      { x: 6, y: 0.8 },
      { x: 7, y: 2.5 },
      { x: 8, y: 5.8 },
      { x: 9, y: 7.4 },
      { x: 10, y: 21.8 },
      { x: 11, y: 16.1 },
      { x: 12, y: 15.5 }
    ]
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)
