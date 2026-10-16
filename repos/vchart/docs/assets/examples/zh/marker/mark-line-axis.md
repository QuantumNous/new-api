---
category: examples
group: marker
title: markLine 轴空间定位
keywords: lineChart,marker
order: 33-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/marker/mark-line-axis.png
option: lineChart#markLine
---

# markLine 轴空间定位

## 关键配置

x 轴定位:

- `x`属性声明 markLine 的 x 数据或数据聚合值以定位 x 坐标, 聚合方式支持`"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`

y 轴定位:

- `y`属性声明 markLine 的 y 数据或数据聚合值以定位 y 坐标,, 聚合方式同上

标签配置:

- `label`属性声明为标注线对应的标签属性
- `label.text`属性声明为标签的文本
- `label.refY`属性声明为标签相对 line 垂直方向的偏移; 同理`label.refX`属性声明为标签相对 line 平行方向的偏移
- `label.position`属性声明为标签相对于标注线的位置; 支持 `"start" | "middle" | "end" | "insideStartTop" | "insideStartBottom" | "insideMiddleTop" | "insideMiddleBottom" | "insideEndTop" | "insideEndBottom"`配置

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  markLine: [
    {
      x: 'Wed',
      label: {
        text: 'National holiday',
        position: 'insideEndBottom',
        refY: 10,
        labelBackground: {
          padding: 5,
          style: {
            stroke: '#6690F2',
            fillOpacity: 0
          }
        },
        style: {
          fill: '#6690F2'
        }
      },
      line: {
        style: {
          stroke: '#6690F2',
          lineDash: []
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    },
    {
      y: 'average',
      label: {
        text: 'Average Visit Num',
        position: 'insideEndBottom',
        refY: -10,
        labelBackground: {
          padding: 2,
          style: {
            fill: '#6690F2'
          }
        },
        style: {
          fontSize: 12
        }
      },
      line: {
        style: {
          stroke: '#6690F2',
          lineDash: []
        }
      },
      endSymbol: {
        style: {
          visible: false
        }
      }
    }
  ],
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  data: {
    id: 'data2',
    values: [
      { x: 'Mon', y: 14000, type: 'A' },
      { x: 'Tue', y: 14500, type: 'A' },
      { x: 'Wed', y: 24000, type: 'A' },
      { x: 'Thu', y: 13000, type: 'A' },
      { x: 'Fri', y: 15000, type: 'A' },
      { x: 'Sat', y: 19000, type: 'A' },
      { x: 'Sun', y: 21000, type: 'A' },
      { x: 'Mon', y: 15000, type: 'B' },
      { x: 'Tue', y: 14800, type: 'B' },
      { x: 'Wed', y: 25000, type: 'B' },
      { x: 'Thu', y: 9000, type: 'B' },
      { x: 'Fri', y: 15000, type: 'B' },
      { x: 'Sat', y: 20000, type: 'B' },
      { x: 'Sun', y: 19000, type: 'B' }
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
