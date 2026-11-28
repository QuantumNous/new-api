---
category: demo
group: axis
title: symlog轴
keywords: lineChart,comparison,composition,trend,axis
order: 25-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/symlog-axis.png
option: lineChart#axes
---

# symlog axis

A Symlog axis is a type of axis used for drawing charts that balances between logarithmic and linear axes while retaining the advantages of logarithmic axes and linear axes.
The Symlog axis is characterized by symmetry, that is, the scale lines of positive and negative values ​​are symmetrically distributed on both sides of the axis, which helps to better display the positive and negative relationship of the data. The tick marks on the Symlog axis are usually distributed on a logarithmic axis, but in the area close to 0, the tick marks are converted to a linear axis distribution to better display the absolute value of the data.

## Key option

exist `axes` Configure the axis type on the property:

- `type` Properties are set to`'symlog'`, used to configure the axis type

## Demo Source

```javascript livedemo
const symexp = c => {
  return x => {
    return Math.sign(x) * Math.expm1(Math.abs(x)) * c;
  };
};
const scale = symexp(10);
// console.log('symlog', symlog(1))
const data = [];
for (let i = -5; i < 6; i++) {
  data.push({
    x: scale(i),
    y: i
  });
}
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 2,
    row: 6,
    rowHeight: [
      {
        index: 0,
        size: 30
      },
      {
        index: 3,
        size: 20
      }
    ],
    elements: [
      {
        modelId: 'title',
        col: 1,
        row: 0
      },
      {
        modelId: 'line-region-A',
        col: 1,
        row: 1
      },
      {
        modelId: 'axis-left-A',
        col: 0,
        row: 1
      },
      {
        modelId: 'axis-bottom-A',
        col: 1,
        row: 2
      },
      {
        modelId: 'line-region-B',
        col: 1,
        row: 4
      },
      {
        modelId: 'axis-left-B',
        col: 0,
        row: 4
      },
      {
        modelId: 'axis-bottom-B',
        col: 1,
        row: 5
      }
    ]
  },
  region: [
    {
      id: 'line-region-A'
    },
    {
      id: 'line-region-B'
    }
  ],
  series: [
    {
      regionId: 'line-region-A',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line-A',
        values: data
      }
    },
    {
      regionId: 'line-region-B',
      type: 'line',
      xField: 'x',
      yField: 'y',
      data: {
        id: 'line-B',
        values: data
      }
    }
  ],
  title: {
    text: 'the example shows difference of linear axis and symlog axis',
    id: 'title'
  },
  axes: [
    {
      id: 'axis-left-A',
      regionId: 'line-region-A',
      orient: 'left',
      type: 'linear'
    },

    {
      id: 'axis-bottom-A',
      regionId: 'line-region-A',
      orient: 'bottom',
      type: 'linear'
    },
    {
      id: 'axis-left-B',
      regionId: 'line-region-B',
      orient: 'left',
      type: 'linear'
    },

    {
      id: 'axis-bottom-B',
      regionId: 'line-region-B',
      orient: 'bottom',
      type: 'symlog'
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach a link to the tutorial or API documentation associated with this demo configuration.
