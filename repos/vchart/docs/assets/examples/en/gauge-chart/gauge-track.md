---
category: examples
group: gauge
title: Gauge Chart with Track Mark
keywords: gauge,comparison,circle
order: 15-8
cover: /vchart/preview/gauge-track_1.7.2.png
option: gaugeChart
---

# Gauge Chart with Track Mark

## Key option

- `categoryField`,`valueField` Properties are used to specify data categories and pointer angle fields, respectively
- `innerRadius`,`outerRadius` Property is used to specify the inner and outer radii of the dashboard
- `startAngle`,`endAngle` Properties are used to specify the start and end angles of the dashboard
- `track` Properties can be configured the background mask of gauge series

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'pointer',
      values: [
        {
          type: 'A',
          value: 10
        }
      ]
    },
    {
      id: 'segment',
      values: [
        {
          type: 'Level 1',
          value: 6
        },
        {
          type: 'Level 2',
          value: 9
        },
        {
          type: 'Level 3',
          value: 12
        }
      ]
    }
  ],
  series: [
    {
      type: 'gauge',
      dataIndex: 1,
      radiusField: 'type',
      angleField: 'value',
      seriesField: 'type',
      outerRadius: 0.9,
      innerRadius: 0.65,
      roundCap: true,
      segment: {
        style: {
          cornerRadius: 500,
          innerPadding: 10,
          outerPadding: 10,
          fill: {
            type: 'threshold',
            field: 'value',
            domain: [6.1, 9.1],
            range: ['#E33232', '#FFC528', '#07A35A']
          }
        }
      },
      track: {
        visible: true,
        style: {
          cornerRadius: 500,
          roundCap: true,
          fill: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    {
      type: 'gaugePointer',
      dataIndex: 0,
      categoryField: 'type',
      valueField: 'value',
      innerRadius: 0.45,
      pin: {
        visible: true,
        width: 0.04,
        height: 0.04,
        isOnCenter: false,
        style: {
          fill: {
            type: 'threshold',
            field: 'value',
            domain: [6, 9],
            range: ['#E33232', '#FFC528', '#07A35A']
          }
        }
      },
      pinBackground: {
        visible: false
      },
      pointer: {
        width: 0.2,
        height: 0.1,
        isOnCenter: false,
        style: {
          fill: {
            type: 'threshold',
            field: 'value',
            domain: [6, 9],
            range: ['#E33232', '#FFC528', '#07A35A']
          }
        }
      },
      animation: false
    }
  ],
  startAngle: -200,
  endAngle: 20,
  axes: [
    {
      type: 'linear',
      orient: 'angle',
      inside: true,
      outerRadius: 0.9,
      innerRadius: 0.6,
      min: 0,
      max: 12,
      grid: { visible: false },
      tick: { visible: true, tickSize: 0, style: { lineWidth: 4, lineCap: 'round' } },
      subTick: { visible: true, tickSize: 0, style: { lineWidth: 4, lineCap: 'round' } },
      label: { visible: false }
    },
    {
      type: 'linear',
      orient: 'radius',
      outerRadius: 0.6,
      grid: { visible: false },
      label: { visible: false }
    }
  ],
  indicator: [
    {
      visible: true,
      offsetY: '-10%',
      title: {
        style: {
          text: '76',
          fontSize: 80,
          fontWeight: 800
        }
      },
      content: [
        {
          style: {
            dy: 10,
            text: 'Current Score',
            fontSize: 24
          }
        }
      ]
    },
    {
      visible: true,
      offsetX: '-70%',
      offsetY: '45%',
      title: {
        style: {
          text: '0',
          fontSize: 18
        }
      }
    },
    {
      visible: true,
      offsetX: '70%',
      offsetY: '45%',
      title: {
        style: {
          text: '12',
          fontSize: 18
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

[Gauge chart](link)
