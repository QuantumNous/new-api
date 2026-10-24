# How to Reference VChart in Projects

In the [How to Get VChart](./How_to_Get_VChart) chapter, we introduced the ways to get VChart. This chapter will introduce how to reference VChart under these ways.

## Use with cdn

After getting the VChart file from [cdn](./How_to_Get_VChart#cdn-获取), you can add it to the `<script>` tag in the HTML file:

**Note: When introducing in cdn mode, you need to pay attention to the reference method of VChart:**

`const vchart = new VChart.default(spec, { dom: 'chart' });`

```html
<body>
  <div id="chart" style="outline: solid red 1px; width: 100%; height: 500px"></div>
</body>
<!-- Reference VChart -->
<script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>

<script>
  // Create a pie chart
  const spec = {
    type: 'pie',
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
      text: 'Surface Element Content Statistics'
    },
    legends: {
      visible: true,
      orient: 'left'
    },
    label: {
      visible: true
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

  const vchart = new VChart.default(spec, { dom: 'chart' });
  vchart.renderSync();
</script>
```

## Use with npm

After installing `@visactor/vchart` into your project via the [npm](./How_to_Get_VChart#npm-获取) method, you can use it as follows:

```ts
import { default as VChart } from '@visactor/vchart';

const spec = {
  type: 'pie',
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
    text: 'Surface Element Content Statistics'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true
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

// Create a VChart instance based on the prepared chart dom container
const vchart = new VChart(spec, {
  dom: 'chart'
});

// Call the rendering method to draw the chart
vchart.renderSync();
```

## Import on demand

`@visactor/vchart` provides all VChart functionality by default. If your project has strong requirements for code size, you can also import the relevant charts and components on demand.
VChart supports on-demand loading through tree-shaking optimization to reduce the bundle size. If you have not turned off the tree-shaking optimization of your bundle tool, you can register the charts and components you need as shown like the example below:

```ts
// Import the VChart core module
import { VChart } from '@visactor/vchart';
// Import bar chart register
import { registerBarChart } from '@visactor/vchart';
// Import Tooltip, CrossHair components
import { registerTooltip, registerCartesianCrossHair, registerDomTooltipHandler } from '@visactor/vchart';

// Register
VChart.useRegisters([registerBarChart, registerTooltip, registerDomTooltipHandler, registerCartesianCrossHair]);
```

If the tree-shaking optimization of your bundle tool is turned off, you need to manually import the internal files from `@visactor/vchart/esm/xxx`, such as `@visactor/vchart/esm/core` or `@visactor/vchart/esm/component`, etc. The usage is as follows:

```ts
// Import the VChart core module
import { VChart } from '@visactor/vchart/esm/core';
// Import bar chart register
import { registerBarChart } from '@visactor/vchart/esm/chart';
// Import Tooltip, CrossHair components
import { registerTooltip, registerCartesianCrossHair } from '@visactor/vchart/esm/component';
// Import dom tooltip plugin
import { registerDomTooltipHandler } from '@visactor/vchart/esm/plugin';
// Import WeChat environment code
import { registerWXEnv } from '@visactor/vchart/esm/env';

// Register
VChart.useRegisters([
  registerBarChart,
  registerTooltip,
  registerCartesianCrossHair,
  registerDomTooltipHandler,
  registerWXEnv
]);
```

VChart provides support for browser and node environments by default. If your project needs to run in a mini program environment for on-demand loading, please be careful to import the mini program environment code when necessary.
For example, when using in WeChat Mini Program, you need to call `registerWXEnv`:

```ts
import { registerWXEnv } from '@visactor/vchart';
VChart.useRegisters([registerWXEnv]);
```

You can specifically view the code example: [On-demand import of bar chart](https://codesandbox.io/s/the-example-of-visactor-vcharts-shrinking-bundle-size-4gsdfn). For more detailed instructions, please refer to the[ Load on Demand Tutorial](/vchart/guide/tutorial_docs/Load_on_Demand)
