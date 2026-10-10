---
category: demo
group: axis
title: Axis Interaction
keywords: areaChart,comparison,composition,trend,area,axis
order: 25-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/interactive.png
option: areaChart#axes
---

# Axis Interaction

In this example, we enable axis interaction by turning on the `select` and `hover` properties of the axis. We show the response in different interaction states by changing the style of the labels in the axis background area.

## Key Configuration

Configure the axis for the specified direction on the `axes` property:

- Set the `select` property to true to enable axis selection interaction
- Set the `hover` property to true to enable axis hover interaction
- `background` property for axis background settings,
  - `background.visible` to enable background rendering
  - `background.style` to configure background style
  - `background.state` to configure the background style in hover and select interaction states
- `label` property for axis label configuration
  - `label.state` configures the background style in hover and select interaction states

## Live Demo

```javascript livedemo
const spec = {
  type: 'area',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Monday', y: 12 },
        { x: 'Tuesday', y: 13 },
        { x: 'Wednesday', y: 11 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 12 },
        { x: 'Saturday', y: 14 },
        { x: 'Sunday', y: 17 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  axes: [
    {
      zIndex: 100,
      orient: 'bottom'
    },
    {
      zIndex: 100,
      orient: 'left',
      inverse: true, // inverse the left axis
      domainLine: {
        visible: true,
        // show the endSymbol
        endSymbol: {
          visible: true,
          style: {
            fill: '#000'
          }
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

Attach links to tutorials or API documentation related to the configuration of this demo.
