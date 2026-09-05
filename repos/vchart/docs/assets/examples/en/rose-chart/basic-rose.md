---
category: examples
group: rose
title: Basic Rose Chart
keywords: roseChart,comparison,composition,circle
order: 7-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/rose-chart/basic-rose.png
option: roseChart
---

# Basic Rose Chart

A rose chart is a statistical chart drawn in polar coordinates. Each category in the data is divided into equal parts, and the distance each part extends from the center depends on the value it represents. Rose charts are suitable for displaying cyclical data (such as months, seasons, etc.) and were used by British statistician Florence Nightingale to show the number of soldier deaths during the Crimean War.

## When to use

1. Display cyclical data (seasons, months, etc.).
2. Compare the size of different categories, with not too much difference in category values.

## Key configuration

- Use `categoryField` and `valueField` to specify the category and radius fields of the rose chart, respectively
- The `seriesField` field is used to specify different series
- Use `innerRadius` and `outerRadius` properties to specify the inner and outer radii of the sector

## Demo source

```javascript livedemo
const spec = {
  type: 'rose',
  data: [
    {
      values: [
        {
          value: '159',
          type: 'Tradition Industries'
        },
        {
          value: '50',
          type: 'Business Companies'
        },
        {
          value: '13',
          type: 'Customer-facing Companies'
        }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.2,
  categoryField: 'type',
  valueField: 'value',
  seriesField: 'type',
  label: {
    visible: true,
    layout: {
      tangentConstraint: false
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Related tutorial

[Rose Chart](link)
