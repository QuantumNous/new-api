---
category: examples
group: area chart
title: 面积图样式
keywords: areaChart,comparison,trend,area
order: 1-11
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/area-style.png
option: areaChart
---

# Area chart style

You can configure the style related to the **area** graphic element through the **area.style** property, and configure the title style through **title.textStyle**.
This example shows the gradient fill of the area and the multi-line text configuration of the title.

## Key option

- `type: area` Property declared as area map
- `xField` Property declared as category field or timing field
- `yField` Property declared as numeric field
- `area.style` Style star with property declared as area primitive

## Demo source

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 15
      },
      {
        time: '4:00',
        value: 12
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 10
      },
      {
        time: '14:00',
        value: 12
      },
      {
        time: '16:00',
        value: 13
      },
      {
        time: '18:00',
        value: 14
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  axes: [
    {
      orient: 'left',
      visible: false,
      range: {
        min: 0,
        max: 20
      }
    },
    {
      orient: 'bottom',
      visible: false
    }
  ],
  point: {
    visible: false
  },
  area: {
    style: {
      fill: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            opacity: 1
          },
          {
            offset: 1,
            opacity: 0.3
          }
        ]
      }
    }
  },
  title: {
    padding: {
      left: 60,
      top: 20
    },
    textStyle: {
      character: [
        {
          text: 'Hive Table Count',
          fontSize: 30,
          fontWeight: 500,
          fill: '#BBB'
        },
        {
          text: '\n345, 239 Records',
          fontSize: 40,
          fill: '#000',
          fontWeight: 500
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[area map](link)
