---
category: examples
group: marker
title: markArea 轴空间 和 数据点定位
keywords: marker,areaChart
order: 33-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/marker/mark-area-multi.png
option: areaChart#markArea
---

# markArea 轴空间 和 数据点定位

markArea 支持轴空间定位、数据点 和 任意坐标定位方式, 此处展示轴空间和数据点两种定位效果.

## 关键配置

x 轴定位:

- `x`属性声明 markArea 左边界对应的数据或数据聚合值, 聚合方式支持`"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`
- `x1`属性声明 markArea 左边界对应的数据或数据聚合值, 聚合方式同上

y 轴定位:

- `y`属性声明 markArea 左边界对应的数据或数据聚合值, 聚合方式同上
- `y1`属性声明 markArea 左边界对应的数据或数据聚合值, 聚合方式同上

数据点定位:

- `coordinates`属性声明构建 markArea 轮廓的数据点或数据聚合值数组, 聚合方式同上. 数据点的声明方式为`{ xKey: value , yKey: value }`, 其中`xKey`为 x 轴对应的数据字段; `yKey`为 y 轴对应的数据字段; `value`为数据字段对应的数值 或 数据聚合类型, 聚合类型同上

标签配置:

- `label`属性声明为标注区域对应的标签属性
- `label.text`属性声明为标签的文本
- `label.position`属性声明为标签相对于标注区域的位置; 支持 `"left" | "right" | "top" | "bottom" | "middle" | "insideLeft" | "insideRight" | "insideTop" | "insideBottom"`配置

## 代码演示

```javascript livedemo
const spec = {
  width: 800,
  type: 'line',
  xField: 'x',
  yField: 'y',
  markArea: [
    {
      x: 'min',
      x1: 4,
      label: {
        text: '区域: 从 minX 到 x = 4',
        position: 'insideTop'
      }
    },
    {
      y: 20,
      y1: 40,
      label: {
        text: '区域: 从 y = 20 到 y = 40',
        position: 'insideRight'
      }
    },
    {
      coordinates: [
        {
          x: 1,
          y: 10
        },
        {
          x: 2,
          y: 80
        },
        {
          x: 3,
          y: 80
        },
        {
          x: 4,
          y: 50
        }
      ],
      label: {
        text: '区域: 任意数据点连接',
        position: 'middle'
      }
    }
  ],
  data: {
    id: 'data2',
    values: [
      { x: 1, y: 80 },
      { x: 2, y: 40 },
      { x: 3, y: 10 },
      { x: 4, y: 20 }
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
