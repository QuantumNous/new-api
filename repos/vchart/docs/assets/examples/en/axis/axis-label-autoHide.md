---
category: demo
group: axis
title: Axis label autoHide
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-11
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-label-autoHide.png
option: barChart#axes
---

# Axis label autoHide

By default, the coordinate axis enables the axis sampling algorithm to deal with the problem of overlapping axis text, but the axis component also provides the corresponding axis label layout capability, and the corresponding configurations are: `autoHide`, `autoRotate` and `autoLimit` represent auto-hide, Automatic rotation and automatic omission, the axis sampling algorithm and the axis label layout of the axis component can coexist, but it is recommended to choose one according to the actual situation. Due to the different implementation methods, it is recommended to use the axis sampling layout for large amounts of data, and its performance will be better than that of the axis component label layout.

This example introduces the use of `autoHide`.

## Key Configuration

Configure the axes for the corresponding direction on the `axes` attribute:

- Configure `sampling` property to `false` to turn off axis sampling
- The `label.autoHide` property is set to `true` to enable the axis component's label layout strategy autoHide
- Configure `label.autoHideMethod` to adjust the strategy

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        autoHide: true,
        autoHideMethod: 'greedy',
        autoHideSeparation: 10
      }
    }
  ],
  data: [
    {
      name: 'bar',
      fields: {
        y: {
          alias: 'sales'
        }
      },
      values: [
        {
          x: '2021-12-21 2:00',
          y: 82
        },
        {
          x: '2021-12-21 4:00',
          y: 50
        },
        {
          x: '2021-12-21 6:00',
          y: 64
        },
        {
          x: '2021-12-21 8:00',
          y: 30
        },
        {
          x: '2021-12-21 10:00',
          y: 40
        },
        {
          x: '2021-12-21 12:00',
          y: 40
        },
        {
          x: '2021-12-21 14:00',
          y: 56
        },
        {
          x: '2021-12-21 16:00',
          y: 40
        },
        {
          x: '2021-12-21 18:00',
          y: 64
        },
        {
          x: '2021-12-21 20:00',
          y: 74
        },
        {
          x: '2021-12-21 22:00',
          y: 98
        }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation associated with this demo configuration.
