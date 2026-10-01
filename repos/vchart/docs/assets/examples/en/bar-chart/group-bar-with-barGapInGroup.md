---
category: examples
group: bar chart
title: Spacing adjustment within grouped bars
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-13
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/group-bar-with-barGapInGroup.png
option: barChart
---

# Adjustment of spacing within groups of grouped bar charts

Since version 1.2.0, we can adjust the spacing of the columns within each group via `barGapInGroup`.

## Key configuration

- `barGapInGroup`: the spacing of the bars within each group in the grouped bar chart, either set as an absolute pixel value or as a percentage (e.g. '10%').

When there are multiple levels of grouping, you can use an array to set the spacing for the different levels, e.g. [10, '20%'], which means that the first level of grouping will be spaced at 10px, and the second level of grouping will be spaced at '20%'. If the number of arrays in barGapInGroup is less than the number of grouping levels, the last value will be used for the spacing of the subsequent groups.

1. number type, representing the pixel value
2. string type, percentage usage, e.g. '10%', the value is the bandWidth percentage of the scale corresponding to the last grouped field (since the columns are of equal width, the scale of the last grouped level is used)

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '1940', value: 133 },
        { type: 'Autocracies', year: '1950', value: 130 },
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1930', value: 22 },
        { type: 'Democracies', year: '1940', value: 13 },
        { type: 'Democracies', year: '1950', value: 25 },
        { type: 'Democracies', year: '1960', value: 29 },
        { type: 'Democracies', year: '1970', value: 38 },
        { type: 'Democracies', year: '1980', value: 41 },
        { type: 'Democracies', year: '1990', value: 57 },
        { type: 'Democracies', year: '2000', value: 87 },
        { type: 'Democracies', year: '2010', value: 98 },
        { type: 'Democracies', year: '2018', value: 99 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'top',
    position: 'start'
  },
  barWidth: 10,
  barGapInGroup: 0
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
