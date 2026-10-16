---
category: demo
group: axis
title: Axis label autoRotate
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-12
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-label-autoRotate.png
option: barChart#axes
---

# Axis label autoRotate

The coordinate axis labels of the Cartesian coordinate system provide automatic rotation anti-overlapping capabilities, which can be enabled through the `autoRotate` attribute, and the optional rotation range can be configured through the `autoRotateAngle` attribute, which is [0, 45, 90] by default.

## Key Configuration

Configure the axes for the corresponding direction on the `axes` attribute:

- Configure the `label.autoRotate` property to `true` to enable automatic rotation of the label of the axis component
- Configure `label.autoRotateAngle` to adjust the optional rotation range

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  width: 350,
  xField: 'month',
  yField: 'sales',
  axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        autoRotate: true,
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
