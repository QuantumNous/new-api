---
category: examples
group: pictogram chart
title: pSVG Motion Path Animation
keywords: pictogramChart, space, animation
order: 26-4
cover: /vchart/preview/pictogram-route_1.13.0.png
option: pictogramChart
---

# SVG Motion Path Animation

> Demo is a replica of the echarts-GEO SVG Lines example.

## Key Configurations

- Draw extended pictograms of paths and figures using `customMark`;
- Utilize the path animation (MotionPath) capability provided by VRender to enable the figure to move along the path.

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
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/route.svg');
const routeSVG = await response.text();
const points = [
  {
    x: 110.6189462165178,
    y: 456.64349563895087
  },
  {
    x: 124.10988522879458,
    y: 450.8570048730469
  },
  {
    x: 123.9272226116071,
    y: 389.9520693708147
  },
  {
    x: 61.58708083147317,
    y: 386.87942320312504
  },
  {
    x: 61.58708083147317,
    y: 72.8954315876116
  },
  {
    x: 258.29514854771196,
    y: 72.8954315876116
  },
  {
    x: 260.75457021484374,
    y: 336.8559607533482
  },
  {
    x: 280.5277985253906,
    y: 410.2406672084263
  },
  {
    x: 275.948185765904,
    y: 528.0254369698661
  },
  {
    x: 111.06907909458701,
    y: 552.795792593471
  },
  {
    x: 118.87138231445309,
    y: 701.365737015904
  },
  {
    x: 221.36468155133926,
    y: 758.7870354617745
  },
  {
    x: 307.86195445452006,
    y: 742.164737297712
  },
  {
    x: 366.8489324762834,
    y: 560.9895157073103
  },
  {
    x: 492.8750778390066,
    y: 560.9895157073103
  },
  {
    x: 492.8750778390066,
    y: 827.9639780566406
  },
  {
    x: 294.9255269587053,
    y: 827.9639780566406
  },
  {
    x: 282.79803391043527,
    y: 868.2476088113839
  }
];
const spec = {
  type: 'pictogram',
  height: 500,
  data: {
    id: 'data',
    values: []
  },
  region: [
    {
      roam: { blank: true }
    }
  ],
  customMark: [
    {
      type: 'symbol',
      parent: 'pictogram',
      name: 'people',
      animation: true,
      style: {
        x: 110.6189462165178,
        y: 456.64349563895087,
        size: 40,
        fill: '#a10000',
        symbolType:
          'M-.345.005c0-.2216.1784-.4.4-.4s.4.1784.4.4c0 .0169-.001.0336-.0031.05H-.3419c-.002-.0164-.0031-.0331-.0031-.05zm.9096-.0267c-.0062-.0149-.0096-.0312-.0096-.0483 0-.0693.0558-.125.125-.125s.125.0558.125.125a.1268.1268 90 01-.0015.0197l.0095.0055-.1565.271-.0016-.0009V.255h-.2873c-.0732.0915-.1859.15-.3127.15s-.2395-.0585-.3127-.15H-.545v-.0281l-.0009.0004-.0887-.1903C-.6709.0153-.695-.0245-.695-.07c0-.0693.0558-.125.125-.125S-.445-.1393-.445-.07c0 .009-.0009.0178-.0028.0263L-.4017.055h.9221z'
      }
    },
    {
      type: 'line',
      name: 'route',
      parent: 'pictogram',
      style: {
        stroke: '#a10000',
        lineWidth: 2,
        lineDash: [4, 4],
        points
      }
    }
  ],
  svg: 'route',
  nameField: 'name',
  valueField: 'value'
};

VChart.registerSVG('route', routeSVG);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
const people = vchart.getChart()?.getMarkByUserName('people')[0]?.getGraphics()[0];
const route = vchart.getChart()?.getMarkByUserName('route')[0]?.getGraphics()[0];
const cp = new VRender.CustomPath2D();
cp.fromLine(route);
people
  .animate()
  .wait(2000)
  .play(
    new VRender.MotionPath(null, null, 10000, 'linear', {
      path: cp,
      distance: 1,
      changeAngle: true,
      initAngle: Math.PI / 2
    })
  )
  .loop(100);
// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[PictogramChart](link)
