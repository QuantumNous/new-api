---
category: examples
group: chart-3d
title: 3D Basic Funnel Chart
keywords: space
order: 23-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/funnel3d.png
option: funnel3dChart
---

# Basic Funnel Chart

The configuration of the 3D funnel chart inherits most of the ordinary word cloud configuration. The difference is that the type needs to be configured as funnel3d, and then the ChartSpace instance is created by adding the option3d configuration.

## When to use

1. The data is ordered, and there is a logical order relationship between them. The stage should be more than 3.
2. The process should be "consumptive", such as in the e-commerce field, where registered users must go through layers of consumption to reach the order stage; in the human resources field, the resumes received must go through multiple rounds of screening before reaching the final interview.

## Key Configuration

- `type: funnel3d` specifies the chart type as funnel chart
- `categoryField` specifies the category field
- `valueField` specifies the value field
- `support3d` label configuration support means support for 3d mode
- `face` currently 3d funnel chart is still immature and requires users to configure the appropriate effect according to the angle

## Live Demo

```javascript livedemo
/**
 * Since version 2.0.0, 3D charts are imported from vchart-extension.
 *
 * import { registerFunnel3dChart } from '@visactor/vchart-extension';
 *
 * registerFunnel3dChart();
 */

/** --Remove the following code when using in production-- */
if (VChartExtension.registerFunnel3dChart) {
  VChartExtension.registerFunnel3dChart();
}
/** --Remove the above code when using in production-- */

const spec = {
  padding: {
    top: 30
  },
  type: 'funnel3d',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true,
    support3d: true
  },
  maxSize: 400,
  minSize: 50,
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  disableDirtyBounds: true,
  options3d: {
    enable: true,
    center: {
      dx: 100,
      dy: 100
    }
  }
});
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[3D Funnel Chart](link)
