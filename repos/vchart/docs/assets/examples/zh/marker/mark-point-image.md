---
category: examples
group: marker
title: markPoint 图片标记
keywords: marker, pieChart
order: 33-9
cover: /vchart/preview/mark-point-image.png
option: areaChart#markPoint
---

## 关键配置

- 使用 `markPoint.itemContent` 属性声明标注内容

## 代码演示

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'China (regional and medium)', value: '13.1' },
        { type: 'China (long haul)', value: '3.9' },
        { type: 'Rest of Asia', value: '55' },
        { type: 'Rest of the world', value: '60' }
      ]
    }
  ],
  outerRadius: 0.65,
  valueField: 'value',
  categoryField: 'type',
  color: ['rgb(233,178,200)', 'rgb(248,218,226)', 'rgb(163,219,218)', 'rgb(210,210,210)'],
  title: {
    visible: true,
    text: 'Plane deliveries to China by region and type (2016–2035, % forecast)',
    subtext:
      'source: https://multimedia.scmp.com/news/china/article/2170344/china-2025-aviation/index.html?src=follow-chapter'
  },
  legends: {
    visible: true,
    orient: 'top'
  },
  label: {
    visible: true
  },
  markPoint: [
    {
      position: {
        x: '50%',
        y: '50%'
      },
      regionRelative: true,
      itemLine: {
        visible: false
      },
      itemContent: {
        type: 'image',
        style: {
          dx: -50,
          dy: 50,
          image: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/airplane.png'
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

[markPoint](link)
