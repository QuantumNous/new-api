---
category: examples
group: marker
title: markLine 数据高亮
keywords: lineChart,marker
order: 33-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/marker/mark-line-coordinates.png
option: lineChart#markLine
---

# markLine 数据高亮

markLine 通过数据点定位的方式高亮折线图数据

## 关键配置

数据点定位:

- `coordinates`属性声明构建 markLine 折线的数据点或数据聚合值数组.
  数据点的声明方式为`{ xKey: value , yKey: value }`, 其中`xKey`为 x 轴对应的数据字段; `yKey`为 y 轴对应的数据字段; `value`为数据字段对应的数值 或 数据聚合类型, 聚合方式支持`"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`.

标签配置:

- `label`属性声明为标注线对应的标签属性
- `label.text`属性声明为标签的文本
- `label.refY`属性声明为标签相对 line 垂直方向的偏移; 同理`label.refX`属性声明为标签相对 line 平行方向的偏移
- `label.position`属性声明为标签相对于标注线的位置; 支持 `"start" | "middle" | "end" | "insideStartTop" | "insideStartBottom" | "insideMiddleTop" | "insideMiddleBottom" | "insideEndTop" | "insideEndBottom"`配置

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    id: 'data2',
    values: [
      { x: 1, y: 80 },
      { x: 2, y: 40 },
      { x: 3, y: 10 },
      { x: 4, y: 20 }
    ]
  },
  xField: 'x',
  yField: 'y',
  markLine: [
    {
      coordinates: [
        { x: 1, y: 80 },
        { x: 2, y: 40 },
        { x: 3, y: 10 }
      ],
      label: {
        text: 'Some data is highlighted',
        autoRotate: true,
        position: 'insideMiddleTop',
        labelBackground: {
          padding: 2,
          style: {
            fill: '#E8346D'
          }
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      },
      line: {
        style: {
          stroke: '#E8346D',
          lineDash: [],
          lineWidth: 2
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)
