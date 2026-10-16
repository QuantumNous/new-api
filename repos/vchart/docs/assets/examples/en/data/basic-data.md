---
category: demo
group: data
title: Basic Data Usage
keywords: data
order: 34-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data/basic-data.png
option: lineChart#data
---

# Basic Data Usage

The vast majority of charts need to configure data. The `data` can be configured with a set of data, and the chart's `series` will use the 0th data by default. After configuring the `id` for the data, you can bind the data by configuring `dataId` in the series and other modules where data can be specified. The content of the data is configured in the `values` of the data.

## Key Configuration

Configure the data required for the chart in the values attribute of `data`

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Monday', y: 12 },
        { x: 'Tuesday', y: 13 },
        { x: 'Wednesday', y: 11 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 12 },
        { x: 'Saturday', y: 14 },
        { x: 'Sunday', y: 17 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  axes: [{ orient: 'left' }, { orient: 'bottom' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Data](link)
