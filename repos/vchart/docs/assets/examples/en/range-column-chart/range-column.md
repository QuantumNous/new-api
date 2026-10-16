---
category: examples
group: range column chart
title: Range Column Chart
keywords: rangeColumnChart,comparison,rectangle,trend
order: 4-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/range-column-chart/range-column.png
---

# Range Column Chart

Range Column Chart. Display a series of data by drawing two Y values for each data point, with each Y value being drawn as the upper and lower limits of the column.

## Key option

- Set the `xField` attribute as the categorical field
- Set the `yField` attribute as an array consisting of the minimum numeric attribute and the maximum numeric attribute
- `label.position` can be configured as `middle`, `start`, `end`, or `bothEnd`, which represent label placed at the middle, starting point, ending point, and both ends, respectively. The default is `middle`.

## Live Demo

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
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
  xField: 'type',
  yField: ['min', 'max'],
  label: {
    position: 'bothEnd'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Related Tutorials

[Range Column Chart](link)
