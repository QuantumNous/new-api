---
category: demo
group: legend
title: 图例展示在图表内部
keywords: barChart,comparison,rectangle,legend
order: 27-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/legend/float.png
option: barChart#legends
---

# 图例展示在图表内部

## 关键配置

- `legend` 的 `position` 配置为 `absolute`，图例展示在图表内部
- `legend` 的 `left` 和 `top` 配置为图表内部的相对位置

## 代码演示

```javascript livedemo
const data = [
  { city: 'Tulsa, OK', rate: -1.6, trend: 'reduce' },
  { city: 'San Francisco, CA', rate: -0.9, trend: 'reduce' },
  { city: 'Corpus Christi, TX', rate: -0.7, trend: 'reduce' },
  { city: 'San Jose, CA', rate: 0, trend: 'rise' },
  { city: 'Boston, MA', rate: 0.3, trend: 'rise' },
  { city: 'Manhattan, NY', rate: 0.4, trend: 'rise' },
  { city: 'El Paso, TX', rate: 0.4, trend: 'rise' },
  { city: 'Houston, TX', rate: 0.8, trend: 'rise' },
  { city: 'Lexington, KY', rate: 1, trend: 'rise' },
  { city: 'Oklahoma City, OK', rate: 1.1, trend: 'rise' }
];
const spec = {
  type: 'bar',
  data: [
    {
      id: 'bar',
      values: data
    }
  ],
  yField: 'city',
  xField: 'rate',
  seriesField: 'trend',
  direction: 'horizontal',
  color: ['#1890FF', '#2FC25B'],
  label: {
    visible: true,
    style: {
      text: obj => obj.rate.toFixed(1) + '%',
      fill: '#333',
      fontWeight: 'bold',
      fontSize: 10
    }
  },
  axes: [
    {
      orient: 'left',
      domainLine: { visible: false },
      tick: { visible: false }
    },
    {
      orient: 'bottom',
      tick: { visible: false, tickCount: 5 },
      label: {
        formatMethod: val => val + '%'
      },
      min: -2,
      max: 2
    }
  ],
  legends: [
    {
      visible: true,
      orient: 'top',
      position: 'start',
      layoutType: 'absolute',
      left: 150,
      top: 100,
      item: {
        shape: {
          style: {
            symbolType: 'square'
          }
        }
      },
      // Configure legend background
      background: {
        visible: true,
        padding: 4,
        style: {
          stroke: '#000',
          lineWidth: 2,
          cornerRadius: 2,
          // shadow configuration
          shadowBlur: 20,
          shadowColor: '#69c0ff',
          shadowOffsetX: 4,
          shadowOffsetY: 4
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

附上和该 demo 配置相关联的教程或者 api 文档的链接。
