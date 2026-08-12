---
category: examples
group: area chart
title: Multi-series area chart
keywords: areaChart,comparison,trend,area
order: 1-10
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/area-with-marker.png
option: areaChart
---

# Multi-series area chart

Area plots display quantitative data graphically. It is based on line plots. Regions between axes and lines are usually emphasized with colors, textures and shaded lines. Usually, an area plot compares two or more quantities. Area plots are suitable for trend changes and comparisons between one or more sets of data that want to be reflected under continuous independent variables, while also observing the trend of changes in the total amount of data.

## Key option

- `type: area` Property declared as area map
- `xField` Property declared as category field or timing field
- `yField` Property declared as numeric field
- `stack`Property declared as whether to stack
- `markLine` Properties are declared as guides for data tags, `markLine.coordinates` Used to specify data coordinates

## Demo source

```javascript livedemo
const markLineStyle = {
  endSymbol: {
    style: {
      angle: 180,
      fill: '#000',
      dy: -5
    }
  },
  label: {
    dx: -22,
    dy: -20,
    labelBackground: {
      padding: [5, 10, 5, 10],
      style: {
        fill: '#000',
        borderRadius: 5
      }
    },
    style: {
      fill: '#fff'
    }
  }
};
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '0:00',
        value: 0,
        type: 'A'
      },
      {
        time: '1:00',
        value: 1000,
        type: 'A'
      },
      {
        time: '2:00',
        value: 4500,
        type: 'A'
      },
      {
        time: '3:00',
        value: 6000,
        type: 'A'
      },
      {
        time: '4:00',
        value: 4500,
        type: 'A'
      },
      {
        time: '5:00',
        value: 1000,
        type: 'A'
      },
      {
        time: '6:00',
        value: 0,
        type: 'A'
      },
      {
        time: '4:00',
        value: 0,
        type: 'B'
      },
      {
        time: '5:00',
        value: 1000,
        type: 'B'
      },
      {
        time: '6:00',
        value: 7000,
        type: 'B'
      },
      {
        time: '7:00',
        value: 8500,
        type: 'B'
      },
      {
        time: '8:00',
        value: 7000,
        type: 'B'
      },
      {
        time: '9:00',
        value: 1000,
        type: 'B'
      },
      {
        time: '10:00',
        value: 0,
        type: 'B'
      },
      {
        time: '8:00',
        value: 0,
        type: 'C'
      },
      {
        time: '9:00',
        value: 1000,
        type: 'C'
      },
      {
        time: '10:00',
        value: 6500,
        type: 'C'
      },
      {
        time: '11:00',
        value: 8000,
        type: 'C'
      },
      {
        time: '12:00',
        value: 6500,
        type: 'C'
      },
      {
        time: '13:00',
        value: 1000,
        type: 'C'
      },
      {
        time: '14:00',
        value: 0,
        type: 'C'
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  seriesField: 'type',
  stack: false,
  markLine: [
    {
      coordinates: [
        {
          time: '3:00',
          value: 0
        },
        {
          time: '3:00',
          value: 6000
        }
      ],
      ...markLineStyle,
      label: {
        text: '6000',
        ...markLineStyle.label
      }
    },
    {
      coordinates: [
        {
          time: '7:00',
          value: 0
        },
        {
          time: '7:00',
          value: 8500
        }
      ],
      ...markLineStyle,
      label: {
        text: '8500',
        ...markLineStyle.label
      }
    },
    {
      coordinates: [
        {
          time: '11:00',
          value: 0
        },
        {
          time: '11:00',
          value: 8000
        }
      ],
      ...markLineStyle,
      label: {
        text: '8000',
        ...markLineStyle.label
      }
    }
  ],
  point: {
    visible: false
  },
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  area: {
    style: {
      fillOpacity: 0.1
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[area map](link)
