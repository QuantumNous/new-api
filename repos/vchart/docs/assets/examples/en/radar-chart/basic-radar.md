---
category: examples
group: radar chart
title: Basic Radar Chart
keywords: radarChart,comparison,line,circle
order: 10-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c8170c.png
option: radarChart
---

# Basic Radar Chart

Radar charts can be used to display data across multiple dimensions, as well as comparisons between dimensions.

## Key Configuration

- `type: 'radar'`: Declare the radar chart type
- `categoryField`: Declare the dimension field
- `valueField`: Declare the value field
- `axes`: Configure the two axes of the radar chart
  - Radius axis declaration: `orient: 'radius'`
  - Angle axis declaration: `orient: 'angle'`
- `point`: Configure the points of the radar chart
  - `visible: false`: Do not display points
- `area`: Configure the area of the radar chart
  - `visible: true`: Display the area
  - `state`: Configure the style of the area when hovering

## Demo source

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      id: 'radarData',
      values: [
        {
          key: 'Strength',
          value: 5
        },
        {
          key: 'Speed',
          value: 5
        },
        {
          key: 'Shooting',
          value: 3
        },
        {
          key: 'Endurance',
          value: 5
        },
        {
          key: 'Precision',
          value: 5
        },
        {
          key: 'Growth',
          value: 5
        }
      ]
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  point: {
    visible: false // disable point
  },
  area: {
    visible: true, // display area
    state: {
      // The style in the hover state of the area
      hover: {
        fillOpacity: 0.5
      }
    }
  },
  line: {
    style: {
      lineWidth: 4
    }
  },
  axes: [
    {
      orient: 'radius', // radius axis
      zIndex: 100,
      min: 0,
      max: 8,
      domainLine: {
        visible: false
      },
      label: {
        visible: true,
        space: 0,
        style: {
          textAlign: 'center',
          stroke: '#fff',
          lineWidth: 4
        }
      },
      grid: {
        smooth: false,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'angle', // angle axis
      zIndex: 50,
      tick: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      label: {
        space: 20
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Range Bar Chart](link)
