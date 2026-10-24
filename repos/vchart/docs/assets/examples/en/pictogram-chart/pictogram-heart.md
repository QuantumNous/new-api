---
category: examples
group: pictogram chart
title: Pictogram - Medical Schematic Diagram of the Heart
keywords: pictogramChart, space
order: 26-6
cover: https://cdn.jsdelivr.net/gh/Eomnational/image/img/20250303-105748.gif
option: pictogramChart
---

# Pictogram - Medical Schematic Diagram of the Heart

> Contributed by [Zero1017](https://github.com/Eomnational)

A pictogram is a form of data visualization that uses graphic symbols (usually in SVG format) to represent specific values or categories in data. This example demonstrates how to use a pictogram to present a medical schematic diagram of the heart, distinguishing different parts of the heart by different colors.

## Key Configurations

- Register SVG resources through the `VChart.registerSVG` interface.
- Declare the `svg` attribute as the name of the registered SVG.
- Use the `color` configuration item to specify colors for different parts of the heart.

## Code Demonstration

```javascript livedemo
/** --Please add the following code when using in your project-- */
// For version 1.x, please additionally import and execute registerPictogramChart in your project
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
// For version 2.0.0, please additionally import and execute registerPictogramChart in your project
// import { registerPictogramChart } from '@visactor/vchart-extension';
// registerPictogramChart();
/** --Please add the above code when using in your project-- */

/** --Please remove the following code when using in your project-- */
if (VCHART_MODULE.registerPictogramChart) {
  // Execute registration code for version 1.x
  VCHART_MODULE.registerPictogramChart();
} else if (VChartExtension.registerPictogramChart) {
  // Execute registration code for version 2.0.0
  VChartExtension.registerPictogramChart();
}
// Asynchronously fetch SVG resources from the specified URL
const response = await fetch('https://cdn.jsdelivr.net/gh/Eomnational/image/img/3.svg');
const shape = await response.text();

// Define the configuration items for the pictogram
const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: [{ name: 'Aorta' }, { name: 'Vein' }, { name: 'CardiacBase' }, { name: 'PulmonaryArtery' }]
  },
  region: [
    {
      // Allow roaming in blank areas
      roam: { blank: true }
    }
  ],
  seriesField: 'name',
  nameField: 'name',
  valueField: 'value',
  svg: 'heart',
  color: {
    specified: {
      Aorta: '#F0321F',
      Vein: '#1AC6FF',
      CardiacBase: '#FB6747',
      PulmonaryArtery: '#FB8D6C',
      undefined: 'white'
    }
  },
  interactions: [
    {
      type: 'element-active-by-legend',
      filterField: 'name'
    }
  ],
  pictogram: {
    style: {
      fill: {
        scale: 'color',
        field: 'name'
      }
    },
    state: {
      active: {
        fillOpacity: 0.8,
        stroke: {
          scale: 'color',
          field: 'name'
        },
        lineWidth: 2
      },
      hover: {
        fillOpacity: 0.8,
        stroke: {
          scale: 'color',
          field: 'name'
        },
        lineWidth: 2
      }
    }
  },
  title: { text: 'Medical Schematic Diagram of the Heart' },
  legends: { orient: 'top', filter: false }
};

// Register SVG resources
VChart.registerSVG('heart', shape);

// Create a VChart instance
const vchart = new VChart(spec, { dom: CONTAINER_ID });
// Render the chart
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
