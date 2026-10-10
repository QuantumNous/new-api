---
category: demo
group: interaction
title: Dual Axis Chart Element Activation
keywords: commonChart
order: 42-0
cover: /vchart/preview/interaction-element-active_1.9.0.gif
option: commonChart
---

# Dual Axis Chart Element Activation Style

By configuring the `element-active` interaction type, the selected elements are set to an `active` state.

## Key Configuration

- `interactions` sets the series interactions
- `line.state.active` sets the line chart element activation state style
- `bar.state.active` sets the bar chart element activation state style

## Code Demo

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'Breakfast', y: 15 },
        { x: 'Monday', type: 'Lunch', y: 25 },
        { x: 'Tuesday', type: 'Breakfast', y: 12 },
        { x: 'Tuesday', type: 'Lunch', y: 30 },
        { x: 'Wednesday', type: 'Breakfast', y: 15 },
        { x: 'Wednesday', type: 'Lunch', y: 24 },
        { x: 'Thursday', type: 'Breakfast', y: 10 },
        { x: 'Thursday', type: 'Lunch', y: 25 },
        { x: 'Friday', type: 'Breakfast', y: 13 },
        { x: 'Friday', type: 'Lunch', y: 20 },
        { x: 'Saturday', type: 'Breakfast', y: 10 },
        { x: 'Saturday', type: 'Lunch', y: 22 },
        { x: 'Sunday', type: 'Breakfast', y: 12 },
        { x: 'Sunday', type: 'Lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'Beverage', y: 22 },
        { x: 'Tuesday', type: 'Beverage', y: 43 },
        { x: 'Wednesday', type: 'Beverage', y: 33 },
        { x: 'Thursday', type: 'Beverage', y: 22 },
        { x: 'Friday', type: 'Beverage', y: 10 },
        { x: 'Saturday', type: 'Beverage', y: 30 },
        { x: 'Sunday', type: 'Beverage', y: 50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      label: { visible: true, syncState: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y',
      bar: {
        state: {
          active: {
            stroke: '#000',
            lineWidth: 2
          }
        }
      },
      interactions: [
        {
          type: 'element-active'
        }
      ]
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true, syncState: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      line: {
        state: {
          active: {
            lineWidth: 4
          }
        }
      },
      interactions: [
        {
          type: 'element-active'
        }
      ]
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0] },
    { orient: 'right', seriesId: ['line'], grid: { visible: false } },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Key Configuration

None

## Related Tutorials
