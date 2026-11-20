---
category: examples
group: interaction
title: Combination Chart Highlight by Key
keywords: commonChart
order: 42-4
cover: /vchart/preview/interaction-combination-chart-highlight-by-key_1.9.0.gif
option: commonChart
---

# Combination Chart Highlight by Key

By configuring the `element-highlight-by-key` interaction type, elements with the same `key` are highlighted and selected, while other elements are blurred; note that series can set the `dataKey` to specify the unique `key` for each shape.

## Key Configuration

- `interactions` set the interaction for the series
- `dataKey` set the globally unique `key` for graphic elements
- `bar.state.blur` set the style for the `blur` state in bar series
- `point.state.blur` set the style for the `blur` state in point elements of line series
- `line.state.blur` set the style for the `blur` state in line elements of line series

## Code Demo

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Mon-Tue', type: 'a', y: 19 },
        { x: 'Tue-Web', type: 'a', y: 18 },
        { x: 'Wed-Thur', type: 'a', y: 16 },
        { x: 'Thur-Fri', type: 'a', y: 14 },
        { x: 'Fri-Sat', type: 'a', y: 12 },
        { x: 'Sat-Sun', type: 'a', y: 11 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Mon-Tue', type: 'b', y: 16 },
        { x: 'Tue-Web', type: 'b', y: 17 },
        { x: 'Wed-Thur', type: 'b', y: 18 },
        { x: 'Thur-Fri', type: 'b', y: 20 },
        { x: 'Fri-Sat', type: 'b', y: 24 },
        { x: 'Sat-Sun', type: 'b', y: 26 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataKey: 'x',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: 'x',
      yField: 'y',

      bar: {
        state: {
          blur: {
            opacity: 0.2
          }
        }
      }
    },
    {
      type: 'line',
      dataKey: 'x',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,

      point: {
        state: {
          blur: {
            opacity: 0.2
          }
        }
      },
      line: {
        state: {
          blur: {
            opacity: 0.2
          }
        }
      }
    }
  ],
  axes: [
    { orient: 'left' },
    {
      orient: 'bottom',
      visible: true,
      domain: ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'],
      label: { visible: true },
      type: 'band',
      // bandPadding: 0,
      // paddingInner: 1,
      // paddingOuter: 0
      trimPadding: true
    },
    {
      orient: 'bottom',
      visible: false,
      label: { visible: true },
      type: 'band',
      bandPadding: 0,
      paddingInner: 0,
      paddingOuter: 0
    }
  ],
  interactions: [
    {
      type: 'element-highlight-by-key'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Key Configuration

None

## Related Tutorials

[Line Chart](link)
