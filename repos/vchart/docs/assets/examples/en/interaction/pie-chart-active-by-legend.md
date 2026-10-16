---
category: demo
group: interaction
title: Legend Trigger Pie Chart Sector Activation
keywords: pieChart,comparison,composition,proportion,circle
order: 42-4
cover: /vchart/preview/interaction-pie-chart-active-by-legend_1.9.0.gif
option: pieChart
---

# Legend Trigger Pie Chart Sector Activation

By configuring the `element-active-by-legend` interaction type, the legend triggers the activation (`active`) state of the graphic elements.

## Key Configuration

- `interactions` set the interaction of the series
- `pie.state.active` set the style corresponding to the `active` state of the pie graphic element
- `label.syncState` set the linkage between label state and sector state
- `label.state.active` set the style corresponding to the `active` state of the label

## Code Demo

````
```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        stroke: '#000',
        lineWidth: 1
      },
      active: {
        outerRadius: 0.9
      }
    }
  },
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true,
    syncState: true,
    state: {
      active: {
        fontWeight: 'bold'
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  },
  interactions: [
    {
      type: 'element-active-by-legend'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
````

## Related Tutorials
