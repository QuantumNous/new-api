---
category: examples
group: range column chart
title: Range Bar Chart
keywords: rangeColumnChart,comparison,rectangle,trend
order: 4-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/range-column-chart/range-bar.png
option: rangeColumnChart
---

# Range Column Chart

Range Column Chart. It displays a series of data by drawing two X values for each data point, each X value being drawn as the upper and lower limits of the bar.

## Key option

- Set the `direction` property to 'horizontal'
- Configure the `xField` property as an array of the minimum value numeric property and the maximum value numeric property
- Declare the `yField` property as the categorical field
- `label.position` can be set to `middle`, `start`, `end`, or `bothEnd`, which represent label positions in the middle, at the start, at the end, and at both ends, respectively. Default is `middle`

## Demo source

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
      id: 'data0',
      values: [
        { type: 'Category One', min: 76, max: 100 },
        { type: 'Category Two', min: 56, max: 108 },
        { type: 'Category Three', min: 38, max: 129 },
        { type: 'Category Four', min: 58, max: 155 },
        { type: 'Category Five', min: 45, max: 120 },
        { type: 'Category Six', min: 23, max: 99 },
        { type: 'Category Seven', min: 18, max: 56 },
        { type: 'Category Eight', min: 18, max: 34 }
      ]
    }
  ],
  direction: 'horizontal',
  yField: 'type',
  xField: ['min', 'max'],
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorial

[Range Column Chart](link)
