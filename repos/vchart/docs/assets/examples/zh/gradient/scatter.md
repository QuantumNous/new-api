---
category: demo
group: gradient
title: 渐变气泡图
keywords: scatterChart,comparison,distribution,scatter,gradient
order: 38-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gradient/scatter.png
option: scatterChart
---

# 渐变气泡图

可以在图元样式的 `fill` 和 `stroke` 等支持配置颜色的属性上配置渐变色，目前支持三种渐变配置：线性渐变、径向渐变、锥形渐变。该例子展示了径向渐变的使用。

## 关键配置

- 径向渐变配置如下

```javascript livedemo
// 径向渐变，前五个参数分别是 x0, y0, r0, x1, y1, r1，其中 r0 r1 代表半径，取值同线性渐变
{
  gradient: 'radial',
  x0: 0.5,
  y0: 0,
  r0: 0,
  x1: 0.5,
  y1: 1,
  r1: 0.7,
  stops: [
    {
      offset: 0,
      color: 'rgba(255,255,255,0.5)' // 0% 处的颜色
    },
    {
      offset: 1,
      color: '#6690F2' // 100% 处的颜色
    }
  ]
}
```

## 代码演示

```javascript livedemo
const data = [
  {
    type: 'A',
    x: 9,
    y: 81,
    r: 63
  },
  {
    type: 'A',
    x: 98,
    y: 5,
    r: 89
  },
  {
    type: 'A',
    x: 51,
    y: 50,
    r: 73
  },
  {
    type: 'A',
    x: 41,
    y: 22,
    r: 14
  },
  {
    type: 'A',
    x: 58,
    y: 24,
    r: 20
  },
  {
    type: 'A',
    x: 78,
    y: 37,
    r: 34
  },
  {
    type: 'A',
    x: 55,
    y: 56,
    r: 53
  },
  {
    type: 'A',
    x: 18,
    y: 45,
    r: 70
  },
  {
    type: 'A',
    x: 42,
    y: 44,
    r: 28
  },
  {
    type: 'A',
    x: 3,
    y: 52,
    r: 59
  },
  {
    type: 'A',
    x: 31,
    y: 18,
    r: 97
  },
  {
    type: 'A',
    x: 79,
    y: 91,
    r: 63
  },
  {
    type: 'A',
    x: 93,
    y: 23,
    r: 23
  },
  {
    type: 'A',
    x: 44,
    y: 83,
    r: 22
  },
  {
    type: 'B',
    x: 42,
    y: 38,
    r: 20
  },
  {
    type: 'B',
    x: 6,
    y: 18,
    r: 1
  },
  {
    type: 'B',
    x: 1,
    y: 93,
    r: 55
  },
  {
    type: 'B',
    x: 57,
    y: 2,
    r: 90
  },
  {
    type: 'B',
    x: 80,
    y: 76,
    r: 22
  },
  {
    type: 'B',
    x: 11,
    y: 74,
    r: 96
  },
  {
    type: 'B',
    x: 88,
    y: 56,
    r: 10
  },
  {
    type: 'B',
    x: 30,
    y: 47,
    r: 49
  },
  {
    type: 'B',
    x: 57,
    y: 62,
    r: 98
  },
  {
    type: 'B',
    x: 4,
    y: 16,
    r: 16
  },
  {
    type: 'B',
    x: 46,
    y: 10,
    r: 11
  },
  {
    type: 'B',
    x: 22,
    y: 87,
    r: 89
  },
  {
    type: 'B',
    x: 57,
    y: 91,
    r: 82
  },
  {
    type: 'B',
    x: 45,
    y: 15,
    r: 98
  }
];
const spec = {
  type: 'scatter',
  data: {
    values: data
  },
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  sizeField: 'r',
  size: {
    type: 'linear',
    range: [6, 35]
  },
  color: [
    {
      gradient: 'radial',
      x0: 0.5,
      y0: 0.5,
      r0: 0,
      x1: 0.5,
      y1: 1,
      r1: 0.7,
      stops: [
        {
          offset: 0,
          color: 'rgba(255,255,255,0.5)'
        },
        {
          offset: 1,
          color: '#6690F2'
        }
      ]
    },
    {
      gradient: 'radial',
      x0: 0.5,
      y0: 0.5,
      r0: 0,
      x1: 0.5,
      y1: 1,
      r1: 0.7,
      stops: [
        {
          offset: 0,
          color: 'rgba(255,255,255,0.5)'
        },
        {
          offset: 1,
          color: '#FFDC83'
        }
      ]
    }
  ],
  axes: [
    { type: 'linear', orient: 'left', min: -10 },
    { type: 'linear', orient: 'bottom', domainLine: { visible: true } }
  ],
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
