---
category: demo
group: axis
title: Axis label autoWrap
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-13
cover: /vchart/preview/axis-label-autoWrap_1.12.5.png
option: barChart#axes
---

# Axis label autoWrap

The coordinate axis labels of the Cartesian coordinate system have the capability to automatically wrap when exceeding the limit length, which can be enabled through the `autoWrap` property. At the same time, the maximum number of lines for wrapping can be configured through the `label.style.lineClamp` property.

Currently, for the Cartesian coordinate system, the default vertical display space limitation for the y-axis is 30% of the chart height or width. If you enable the axis label's `autoWrap`, it will automatically wrap once the axis space exceeds the limit.

Automatic line wrapping (`autoLimit`) and automatic label rotation (`autoRotate`) are both optimization strategies for excessively long text. They cannot be effective at the same time. If `autoRotate` is enabled, the automatic rotation strategy will be used preferentially.

## Key Configuration

In the `axes` property, configure for the corresponding direction axis:

- Set the `label.autoWrap` property to `true` to enable automatic line wrapping for the axis component's labels.

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  xField: 'month',
  yField: 'sales',
  width: 300,
  axes: [
    {
      orient: 'left',
      label: {
        autoWrap: true,
        formatter: `++++++++++++++++++_{label}_++++++++++++++++++`
      }
    },
    {
      orient: 'bottom',
      maxHeight: '20%', // Limit maximum height to 20% of chart height
      sampling: false,
      label: {
        formatter: `{label}_{label}`,
        autoWrap: true,
        autoHide: true,
        style: {
          wordBreak: 'break-word',
          lineClamp: 2
        }
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
