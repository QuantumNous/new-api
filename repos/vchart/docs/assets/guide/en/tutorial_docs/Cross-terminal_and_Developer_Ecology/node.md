# Node Server-Side Rendering

VChart provides the ability to render server-side in Node environments. You can use VChart to generate chart images in a Node environment. Here, we will introduce how to use [node-canvas](https://github.com/Automattic/node-canvas) to implement chart server-side rendering.

## How to use

VChart's Node server-side rendering capability is provided by the underlying rendering engine [VRender](https://github.com/VisActor/VRender). The usage is very simple. Below is a simple example to illustrate:

```ts
const fs = require('fs');

const VChart = require('@visactor/vchart');
const Canvas = require('canvas');

// Normal chart spec configuration
const spec = {
  type: 'radar',
  data: [
    {
      id: 'Map',
      values: [
        { key: 'North', value: 31, category: 'Destroyer' },
        { key: 'Northeast', value: 32, category: 'Destroyer' },
        { key: 'East', value: 21, category: 'Destroyer' },
        { key: 'Southeast', value: 15, category: 'Destroyer' },
        { key: 'South', value: 50, category: 'Destroyer' },
        { key: 'Southwest', value: 44, category: 'Destroyer' },
        { key: 'West', value: 32, category: 'Destroyer' },
        { key: 'Northwest', value: 32, category: 'Destroyer' },
        { key: 'North', value: 31, category: 'Destroyer' },
        { key: 'Northeast', value: 32, category: 'Destroyer' },
        { key: 'East', value: 21, category: 'Destroyer' },
        { key: 'Southeast', value: 40, category: 'Aircraft Carrier' },
        { key: 'South', value: 25, category: 'Aircraft Carrier' },
        { key: 'Southwest', value: 22, category: 'Aircraft Carrier' },
        { key: 'West', value: 18, category: 'Aircraft Carrier' },
        { key: 'Northwest', value: 7, category: 'Aircraft Carrier' },
        { key: 'North', value: 24, category: 'Aircraft Carrier' },
        { key: 'Northeast', value: 43, category: 'Aircraft Carrier' },
        { key: 'East', value: 42, category: 'Aircraft Carrier' }
      ]
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  seriesField: 'category',
  legends: {
    visible: true,
    orient: 'bottom'
  }
};
const cs = new VChart.default(spec, {
  // Declare the rendering environment to use and pass the corresponding rendering environment parameters
  mode: 'node',
  modeParams: Canvas,
  animation: false // Turn off animation
});

cs.renderSync();

// Export image
const buffer = cs.getImageBuffer();
fs.writeFileSync(`./chart.png`, buffer);
```

Upon executing the above script, you will obtain the following image:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a24.png" alt="Radar Chart">
</div>
