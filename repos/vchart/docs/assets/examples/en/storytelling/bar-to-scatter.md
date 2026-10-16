---
category: examples
group: storytelling
title: Global animation for switching between bar charts and scatter plots
keywords: animation,morphing,bar,scatter,barChart,scatterChart
order: 42-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/morph-bar-to-scatter.gif
option: commonChart#series-bar.animationUpdate
---

# Global animation for switching between bar charts and scatter plots

Global animation enhances the observer's tracking of data changes in certain scenarios, such as in the example below, where the blending of scatter points toward the columns becomes more vivid.

## Key configuration

- `morph.morphKey`: Specifies the correlation between the series of different charts; changes in the data of series with the same `morphKey` will be analyzed automatically.
- `morph.morphElementKey`: specifies the matching field for the data of the series that owns the association.

## Demo source

```javascript livedemo
/**
 * 自1.12.0后，全局形变动画需要手动注册才能生效
 *
 * import { registerMorph } from '@visactor/vchart';
 *
 * registerMorph();
 *
 * 自2.0.0开始，全局形变动画默认开启，不再需要手动注册
 */
VCHART_MODULE.registerMorph && VCHART_MODULE.registerMorph();
function calculateAverage(data, dim) {
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    total += data[i][dim];
  }
  return (total /= data.length);
}

function generateData(type) {
  const data = [];
  for (let i = 0; i < 10; i++) {
    data.push({ x: i, y: Math.random(), type });
  }
  return data;
}
const DataA = generateData('A');

const DataB = generateData('B');

const barSpec = {
  type: 'common',
  series: [
    {
      type: 'bar',
      data: { values: [{ value: calculateAverage(DataA, 'y'), type: 'A' }] },
      xField: 'type',
      yField: 'value',
      morph: {
        morphKey: 'A'
      }
    },
    {
      type: 'bar',
      data: { values: [{ value: calculateAverage(DataB, 'y'), type: 'B' }] },
      xField: 'type',
      yField: 'value',
      morph: {
        morphKey: 'B'
      }
    }
  ],
  axes: [
    { orient: 'left', type: 'linear', max: 1 },
    { orient: 'bottom', type: 'band' }
  ]
};

const scatterSpec = {
  type: 'common',
  series: [
    {
      type: 'scatter',
      data: { values: DataA },
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      morph: {
        morphKey: 'A',
        morphElementKey: 'type'
      }
    },
    {
      type: 'scatter',
      data: { values: DataB },
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      morph: {
        morphKey: 'B',
        morphElementKey: 'type'
      }
    }
  ],
  axes: [
    { orient: 'left', type: 'linear', zero: false, max: 1 },
    { orient: 'bottom', type: 'band' }
  ]
};

const specs = [barSpec, scatterSpec];

const vchart = new VChart(specs[0], { dom: CONTAINER_ID });

vchart.renderSync();
let count = 1;
setInterval(() => {
  vchart.updateSpec(specs[count % 2]);
  count++;
}, 3000);
```

## Related Tutorials

[Scatterplot](link)
