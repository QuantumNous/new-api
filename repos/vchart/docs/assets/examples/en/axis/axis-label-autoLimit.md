---
category: demo
group: axis
title: Axis label autoLimit
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-13
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-label-autoLimit.png
option: barChart#axes
---

# Axis label autoLimit

The coordinate axis label of the Cartesian coordinate system provides the ability to automatically omit the length beyond the limit, which can be enabled through the `autoLimit` attribute, and the omitted text can be configured through the `limitEllipsis` attribute, which defaults to '...'.

At present, for the Cartesian coordinate system, the default vertical display limit space of the x and y axes is 30% of the height or width of the chart. If you enable the `autoLimit` of the axis label, once the axis space exceeds the limit, it will be automatically omitted.

## Key Configuration

Configure the axes in the corresponding direction on the `axes` attribute:

- The `label.autoLimit` property is set to `true` to enable auto-elimination of labels for axis components.

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  width: 300,
  height: 200,
  xField: 'month',
  yField: 'sales',
  axes: [
    {
      orient: 'left',
      label: {
        autoLimit: true,
        formatMethod: val => `+++++++++_${val}_+++++++++`
      }
    },
    {
      orient: 'bottom',
      maxHeight: '20%', // Limit maximum height to 20% of chart height
      sampling: false,
      label: {
        autoRotate: true,
        autoLimit: true,
        autoRotateAngle: [0, 90]
      }
    }
  ],
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
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
