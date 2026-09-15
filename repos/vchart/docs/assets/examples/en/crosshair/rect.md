---
category: demo
group: crosshair
title: Rectangular Crosshair
keywords: lineChart, comparison, trend, line, crosshair
order: 28-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/crosshair/rect.png
option: lineChart#crosshair
---

# Crosshair

Crosshair is used to mark specific data points in the chart, often triggered by mouse hover or click. The configuration attribute is `crosshair`. This example shows the default display effect of crosshair.

## Key option

- `bindingAxesIndex`: Declare the index of the bound axis, default is 0
- `defaultSelect`: Declare the default selected data
  - `axisIndex`: which axis data is displayed by default
  - `datum`: the data displayed by default
- `dimension_hover`: the state of a certain dimension when the mouse hovers

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      values: [
        {
          x: '回合1',
          y: 21,
          c: '绿水灵'
        },
        {
          x: '回合1',
          y: 38,
          c: '飘飘猪'
        },
        {
          x: '回合2',
          y: 28,
          c: '绿水灵'
        },
        {
          x: '回合2',
          y: 45,
          c: '飘飘猪'
        },
        {
          x: '回合3',
          y: 22,
          c: '绿水灵'
        },
        {
          x: '回合3',
          y: 56,
          c: '飘飘猪'
        },
        {
          x: '回合4',
          y: 34,
          c: '绿水灵'
        },
        {
          x: '回合4',
          y: 48,
          c: '飘飘猪'
        },
        {
          x: '回合5',
          y: 34,
          c: '绿水灵'
        },
        {
          x: '回合5',
          y: 64,
          c: '飘飘猪'
        },
        {
          x: '回合6',
          y: 44,
          c: '绿水灵'
        },
        {
          x: '回合6',
          y: 72,
          c: '飘飘猪'
        },
        {
          x: '回合7',
          y: 38,
          c: '绿水灵'
        },
        {
          x: '回合7',
          y: 65,
          c: '飘飘猪'
        },
        {
          x: '回合8',
          y: 24,
          c: '绿水灵'
        },
        {
          x: '回合8',
          y: 70,
          c: '飘飘猪'
        },
        {
          x: '回合9',
          y: 28,
          c: '绿水灵'
        },
        {
          x: '回合9',
          y: 62,
          c: '飘飘猪'
        }
      ]
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  },
  axes: [
    {
      orient: 'left',
      max: 100
    },
    {
      orient: 'bottom'
    },
    {
      orient: 'right',
      max: 100
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  point: {
    style: {
      size: 5
    },
    state: {
      dimension_hover: {
        size: 10
      }
    }
  },
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'rect'
      },
      bindingAxesIndex: [1],
      defaultSelect: {
        axisIndex: 1,
        datum: '回合6'
      },
      label: {
        visible: true // label default close
      }
    },
    yField: {
      visible: true,
      bindingAxesIndex: [0, 2],
      defaultSelect: {
        axisIndex: 2,
        datum: 40
      },
      line: {
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      },
      label: {
        visible: true // label defult close
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or api documentation related to the demo configuration.

```

```
