---
category: examples
group: pictogram chart
title: SVG Beef Cuts
keywords: pictogramChart, space
order: 26-1
cover: /vchart/preview/pictogram-cow_1.13.0.png
option: pictogramChart
---

# SVG Beef Cuts

> Demo is a replica of the echarts-Beef Cuts example.

## Key Configurations

- In the SVG file, configure the name attribute for the pictogram, then you can specify the pictogram style through the name configuration in the chart settings;

## Code Demo

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
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/cow.svg');
const cow = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: [
      { name: 'Queue', value: 15 },
      { name: 'Langue', value: 35 },
      { name: 'Plat de joue', value: 15 },
      { name: 'Gros bout de poitrine', value: 25 },
      { name: 'Jumeau à pot-au-feu', value: 45 },
      { name: 'Onglet', value: 85 },
      { name: 'Plat de tranche', value: 25 },
      { name: 'Araignée', value: 15 },
      { name: 'Gîte à la noix', value: 55 },
      { name: "Bavette d'aloyau", value: 25 },
      { name: 'Tende de tranche', value: 65 },
      { name: 'Rond de gîte', value: 45 },
      { name: 'Bavettede de flanchet', value: 85 },
      { name: 'Flanchet', value: 35 },
      { name: 'Hampe', value: 75 },
      { name: 'Plat de côtes', value: 65 },
      { name: 'Tendron Milieu de poitrine', value: 65 },
      { name: 'Macreuse à pot-au-feu', value: 85 },
      { name: 'Rumsteck', value: 75 },
      { name: 'Faux-filet', value: 65 },
      { name: 'Côtes Entrecôtes', value: 55 },
      { name: 'Basses côtes', value: 45 },
      { name: 'Collier', value: 85 },
      { name: 'Jumeau à biftek', value: 15 },
      { name: 'Paleron', value: 65 },
      { name: 'Macreuse à bifteck', value: 45 },
      { name: 'Gîte', value: 85 },
      { name: 'Aiguillette baronne', value: 65 },
      { name: 'Filet', value: 95 }
    ]
  },
  nameField: 'name',
  valueField: 'value',
  color: {
    type: 'linear',
    domain: [
      {
        dataId: 'data',
        fields: ['value']
      }
    ],
    range: ['#f51633', '#921319']
  },
  legends: [
    {
      visible: true,
      type: 'color',
      field: 'value',
      orient: 'top'
    }
  ],
  region: [
    {
      roam: true
    }
  ],
  svg: 'cow',
  pictogram: {
    style: {
      fill: {
        field: 'value',
        scale: 'color'
      }
    }
  },
  'Tendron Milieu de poitrine': {
    style: {
      fill: 'orange'
    },
    state: {
      hover: {
        fill: '#FFBF7F'
      }
    }
  }
};
VChart.registerSVG('cow', cow);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[PictogramChart](link)
