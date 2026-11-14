---
category: examples
group: chart-3d
title: 3D Basic Pie Chart
keywords: space
order: 23-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/pie3d.png
option: pieChart
---

# Basic 3D Pie Chart

The configuration of the 3D pie chart inherits most of the configuration of the ordinary word cloud, the difference is that the type needs to be configured to pie3d, and then the option3d configuration is added when the ChartSpace instance is created.

## When to use

1. Display the proportion of data in different categories.
2. Compare the sizes of different categories, and the differences in values are relatively obvious.

## Key option

- `options3d` This configuration is passed into the ChartSpace constructor, declaring that the ChartSpace needs to support 3d mode
- `categoryField` and `valueField` attributes are used to specify the pie chart category and fan angle fields respectively
- `innerRadius` and `outerRadius` attributes are used to specify the inner and outer radii of the sector

## Demo source

```javascript livedemo
/**
 * Since version 2.0.0, 3D charts are imported from vchart-extension.
 *
 * import { registerPie3dChart } from '@visactor/vchart-extension';
 *
 * registerPie3dChart();
 */

/** --Remove the following code when using in production-- */
if (VChartExtension.registerPie3dChart) {
  VChartExtension.registerPie3dChart();
}
/** --Remove the above code when using in production-- */

const spec = {
  type: 'pie3d',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: false,
    position: 'inside',
    support3d: true,
    style: {
      stroke: '#fff',
      keepDirIn3d: false,
      fontSize: 12
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related tutorials

[3D Pie Chart](link)
