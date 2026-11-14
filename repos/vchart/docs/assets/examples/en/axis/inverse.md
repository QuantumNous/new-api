---
category: demo
group: axis
title: Axis Inversion
keywords: areaChart,comparison,trend,area,axis
order: 25-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/inverse.png
option: lineChart#axes
---

# Axis Inversion

In this example, we reverse the specified axis through the `inverse` property provided on `axes`, and also add arrows to the axis lines.

## Key option

Configure the following on the `axes` property for the specified axis direction:

- Set the `inverse` property to true to enable axis inversion
- Configure the `startSymbol` or `endSymbol` property on the `domainLine` property for marking both ends of the axis line

## Demo source

```javascript livedemo
const spec = {
  type: 'area',
  data: [
    {
      id: 'line',
      values: [
        { x: '周一', y: 12 },
        { x: '周二', y: 13 },
        { x: '周三', y: 11 },
        { x: '周四', y: 10 },
        { x: '周五', y: 12 },
        { x: '周六', y: 14 },
        { x: '周日', y: 17 }
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
      zIndex: 101,
      orient: 'left',
      inverse: true, //  inverse the left axis
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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Please find the relevant tutorial or API documentation link associated with this demo configuration.
