---
category: demo
group: waterfall
title: Horizontal Waterfall Chart
keywords: waterfall,comparison,distribution,rectangle
order: 18-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/waterfall/direction-waterfall.png
option: waterfallChart
---

# Horizontal Waterfall Chart

Use the `direction` configuration to change the chart direction

## Key option

- `direction` configures the chart direction

## Demo source

```javascript livedemo
const spec = {
  type: 'waterfall',
  direction: 'horizontal',
  data: {
    id: 'id0',
    values: [
      { x: 'Feb.4', total: true, value: 45 },
      { x: 'Feb.11', y: -5 },
      { x: 'Feb.20', y: 2 },
      { x: 'Feb.25', y: -2 },
      { x: 'Mar.4', y: 2 },
      { x: 'Mar.11', y: 2 },
      { x: 'Mar.19', y: -2 },
      { x: 'Mar.26', y: 1 },
      { x: 'Apr.1', y: 1 },
      { x: 'Apr.8', y: 1 },
      { x: 'Apr.15', y: 2 },
      { x: 'Apr.22', y: 1 },
      { x: 'Apr.29', y: -2 },
      { x: 'May.6', y: -1 },
      { x: 'total', total: true }
    ]
  },
  legends: { visible: true, orient: 'bottom' },
  xField: 'y',
  yField: 'x',
  stackLabel: {
    valueType: 'absolute',
    formatMethod: text => {
      return text + '%';
    }
  },
  seriesFieldName: {
    total: 'total',
    increase: 'increase',
    decrease: 'reduce'
  },
  total: {
    type: 'field',
    tagField: 'total',
    valueField: 'value'
  },
  axes: [
    {
      orient: 'bottom',
      range: { min: 30, max: 50 },
      title: { visible: true, text: 'favorability' },
      label: {
        formatMethod: v => {
          return v + '%';
        }
      }
    },
    {
      orient: 'left',
      label: { visible: true },
      type: 'band',
      paddingInner: 0.4,
      title: { visible: true, text: 'date' }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Direction](link)
[Waterfall Chart](link)
