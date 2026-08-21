---
category: demo
group: crosshair
title: Crosshair of Radar Chart
keywords: radarChart,comparison,crosshair,circle
order: 28-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/crosshair/polar-line.png
option: radarChart#crosshair
---

# Crosshair of Radar Chart

The crosshair's performance in different coordinate systems is different, corresponding to different configurations. In the polar coordinate system, you need to configure on `categoryField` and `valueField`.

## Key option

- `crosshair.categoryField` Configure the crosshair of the dimension data, usually the angle axis, and the line of the angle axis supports 'line' and 'rect' shapes
- `crosshair.valueField` Configure the crosshair of the indicator data, usually the radius axis, line only supports 'line'

## Demo source

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      id: 'radar',
      values: [
        { name: 'Openlane', value1: 160.2, value2: 66.9 },
        { name: 'Yearin', value1: 150.1, value2: 50.5 },
        { name: 'Goodsilron', value1: 120.7, value2: 32.3 },
        { name: 'Condax', value1: 89.4, value2: 74.5 },
        { name: 'Opentech', value1: 78.5, value2: 29.7 },
        { name: 'Golddex', value1: 77.6, value2: 102.2 },
        { name: 'Isdom', value1: 69.8, value2: 22.6 },
        { name: 'Plusstrip', value1: 63.6, value2: 45.3 },
        { name: 'Kinnamplus', value1: 59.7, value2: 12.8 },
        { name: 'Zumgoity', value1: 54.3, value2: 19.6 },
        { name: 'Stanredtax', value1: 52.9, value2: 96.3 },
        { name: 'Conecom', value1: 42.9, value2: 11.9 },
        { name: 'Zencorporation', value1: 40.9, value2: 16.8 },
        { name: 'Iselectrics', value1: 39.2, value2: 9.9 },
        { name: 'Treequote', value1: 36.6, value2: 36.9 },
        { name: 'Sumace', value1: 34.8, value2: 14.6 },
        { name: 'Lexiqvolax', value1: 32.1, value2: 35.6 },
        { name: 'Sunnamplex', value1: 31.8, value2: 5.9 },
        { name: 'Faxquote', value1: 29.3, value2: 14.7 },
        { name: 'Donware', value1: 23.0, value2: 2.8 },
        { name: 'Warephase', value1: 21.5, value2: 12.1 },
        { name: 'Donquadtech', value1: 19.7, value2: 10.8 },
        { name: 'Nam-zim', value1: 15.5, value2: 4.1 },
        { name: 'Y-corporation', value1: 14.2, value2: 11.3 }
      ],
      transforms: [
        {
          type: 'fold',
          options: {
            key: 'type',
            value: 'value',
            fields: ['value1', 'value2']
          }
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  seriesField: 'type',
  innerRadius: 0.3,
  outerRadius: 0.9,
  stack: true,
  area: {
    visible: true
  },
  point: {
    visible: false
  },
  axes: [
    {
      orient: 'angle',
      domainLine: {
        style: {
          lineDash: [2, 2]
        }
      },
      grid: {
        style: {
          lineDash: [2, 2]
        }
      },
      tick: {
        visible: false
      }
    },
    {
      orient: 'radius',
      grid: {
        smooth: true,
        style: {
          lineDash: [2, 2]
        }
      },
      label: {
        visible: true,
        inside: true
      }
    }
  ],
  crosshair: {
    categoryField: {
      visible: true,
      line: {
        style: {
          stroke: '#000',
          lineWidth: 1,
          opacity: 1,
          lineDash: [4, 4]
        }
      },
      label: {
        visible: true // label default close
      }
    },
    valueField: {
      visible: true,
      line: {
        smooth: true,
        style: {
          stroke: '#000',
          lineWidth: 1,
          opacity: 1,
          lineDash: [4, 4]
        }
      },
      label: {
        visible: true // label default close
      }
    }
  },
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach the links of tutorials or API documents related to the demo configuration.
